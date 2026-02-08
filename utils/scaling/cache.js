/**
 * LRU Cache for Response Caching
 * Efficient caching with TTL and max size limits
 */

/**
 * Cache entry
 * @typedef {Object} CacheEntry
 * @property {any} value - Cached value
 * @property {number} expires - Expiration timestamp
 * @property {string} etag - ETag for conditional requests
 */

/**
 * Cache options
 * @typedef {Object} CacheOptions
 * @property {number} [max=1000] - Maximum number of entries
 * @property {number} [ttl=60000] - Default TTL in milliseconds
 */

/**
 * LRU Cache implementation
 */
export class LRUCache {
  /**
   * @param {CacheOptions} options
   */
  constructor(options = {}) {
    this.max = options.max || 1000;
    this.ttl = options.ttl || 60000;
    this.cache = new Map();
  }

  /**
   * Generate cache key from request
   * @param {string} method
   * @param {string} url
   * @returns {string}
   */
  static key(method, url) {
    return `${method}:${url}`;
  }

  /**
   * Generate ETag from value
   * @param {any} value
   * @returns {string}
   */
  static etag(value) {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `"${Math.abs(hash).toString(36)}"`;
  }

  /**
   * Get value from cache
   * @param {string} key
   * @returns {CacheEntry | null}
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry;
  }

  /**
   * Set value in cache
   * @param {string} key
   * @param {any} value
   * @param {number} [ttl] - TTL in ms (uses default if not specified)
   * @returns {CacheEntry}
   */
  set(key, value, ttl) {
    // Evict oldest if at capacity
    if (this.cache.size >= this.max) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }

    const entry = {
      value,
      expires: Date.now() + (ttl || this.ttl),
      etag: LRUCache.etag(value),
    };

    this.cache.set(key, entry);
    return entry;
  }

  /**
   * Delete entry from cache
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache size
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Check if key exists and is valid
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }
}

/**
 * Create cache middleware for route-level caching
 * @param {LRUCache} cache
 * @returns {Function}
 */
export function cacheMiddleware(cache) {
  return (req, res) => {
    const key = LRUCache.key(req.method, req.url);
    const entry = cache.get(key);

    if (entry) {
      // Check If-None-Match header
      const clientEtag = req.headers["if-none-match"];
      if (clientEtag === entry.etag) {
        res.statusCode = 304;
        res.end();
        return false; // Stop execution
      }

      // Return cached response
      res.setHeader("ETag", entry.etag);
      res.setHeader("X-Cache", "HIT");
      res.json(entry.value);
      return false; // Stop execution
    }

    // Store original json method to intercept response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      // Cache the response
      const newEntry = cache.set(key, data);
      res.setHeader("ETag", newEntry.etag);
      res.setHeader("X-Cache", "MISS");
      originalJson(data);
    };

    return true; // Continue to handler
  };
}

export default LRUCache;
