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
    // Use the full original URL (includes query string) for the cache key.
    // req.url is overwritten with just the pathname by the server internals,
    // so we fall back to req._rawUrl which preserves the full URL.
    // We also append serialized route params so that parameterised routes
    // (e.g. /users/:id) with different param values get distinct cache entries.
    const rawUrl = req._rawUrl || req.url;
    const paramsStr =
      req.params && Object.keys(req.params).length > 0
        ? JSON.stringify(req.params)
        : "";
    const key = LRUCache.key(req.method, rawUrl + paramsStr);
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

    // Store original json and end methods to intercept response
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);

    // Intercept res.json (explicit json calls by handler)
    res.json = (data) => {
      const newEntry = cache.set(key, data);
      res.setHeader("ETag", newEntry.etag);
      res.setHeader("X-Cache", "MISS");
      originalJson(data);
    };

    // Intercept res.end (implicit return-value path in server.js uses
    // res.writeHead + res.end directly, bypassing res.json).
    // Note: res.getHeader() does NOT see headers set via res.writeHead(),
    // so we can't check Content-Type that way. Instead, try JSON.parse directly.
    res.end = (body) => {
      if (body && !res._vibeCached) {
        try {
          const parsed = JSON.parse(body);
          // Only cache plain objects/arrays — not error objects, not primitives
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            !parsed.error // skip error responses
          ) {
            res._vibeCached = true;
            const newEntry = cache.set(key, parsed);
            // setHeader is safe here — headers not yet flushed
            res.setHeader("ETag", newEntry.etag);
            res.setHeader("X-Cache", "MISS");
          }
        } catch {
          // Not JSON — skip caching
        }
      }
      originalEnd(body);
    };

    return true; // Continue to handler
  };
}

export default LRUCache;
