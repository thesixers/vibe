/**
 * Generic Connection Pool
 * Manages a pool of reusable resources (connections, clients, etc.)
 */

/**
 * Pool configuration
 * @typedef {Object} PoolOptions
 * @property {Function} create - Async function to create a new resource
 * @property {Function} destroy - Async function to destroy a resource
 * @property {Function} [validate] - Function to validate a resource is still usable
 * @property {number} [min=0] - Minimum pool size
 * @property {number} [max=10] - Maximum pool size
 * @property {number} [acquireTimeout=30000] - Timeout for acquiring resource (ms)
 * @property {number} [idleTimeout=60000] - Time before idle resources are destroyed (ms)
 */

/**
 * Pooled resource wrapper
 * @typedef {Object} PooledResource
 * @property {any} resource - The actual resource
 * @property {number} createdAt - Creation timestamp
 * @property {number} lastUsed - Last usage timestamp
 */

/**
 * Generic resource pool
 */
export class Pool {
  /**
   * @param {PoolOptions} options
   */
  constructor(options) {
    if (!options.create) throw new Error("Pool requires 'create' function");
    if (!options.destroy) throw new Error("Pool requires 'destroy' function");

    this.create = options.create;
    this.destroy = options.destroy;
    this.validate = options.validate || (() => true);
    this.min = options.min || 0;
    this.max = options.max || 10;
    this.acquireTimeout = options.acquireTimeout || 30000;
    this.idleTimeout = options.idleTimeout || 60000;

    /** @type {PooledResource[]} */
    this.available = [];
    /** @type {Set<any>} */
    this.inUse = new Set();
    /** @type {Array<{resolve: Function, reject: Function, timeout: NodeJS.Timeout}>} */
    this.waiting = [];

    this._closed = false;
    this._idleCheckInterval = null;

    // Initialize minimum resources
    this._initialize();
  }

  async _initialize() {
    const promises = [];
    for (let i = 0; i < this.min; i++) {
      promises.push(this._createResource());
    }
    await Promise.all(promises);

    // Start idle cleanup
    this._idleCheckInterval = setInterval(
      () => this._cleanupIdle(),
      this.idleTimeout / 2,
    );
  }

  async _createResource() {
    try {
      const resource = await this.create();
      const pooled = {
        resource,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      };
      this.available.push(pooled);
      return pooled;
    } catch (err) {
      console.error("[Pool] Failed to create resource:", err);
      throw err;
    }
  }

  _cleanupIdle() {
    const now = Date.now();
    const toRemove = [];

    for (let i = 0; i < this.available.length; i++) {
      const pooled = this.available[i];
      const idle = now - pooled.lastUsed;

      // Keep minimum resources
      if (this.available.length - toRemove.length <= this.min) break;

      if (idle > this.idleTimeout) {
        toRemove.push(i);
      }
    }

    // Remove in reverse order to preserve indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const pooled = this.available.splice(toRemove[i], 1)[0];
      this.destroy(pooled.resource).catch(() => {});
    }
  }

  /**
   * Acquire a resource from the pool
   * @returns {Promise<any>}
   */
  async acquire() {
    if (this._closed) throw new Error("Pool is closed");

    // Try to get available resource
    while (this.available.length > 0) {
      const pooled = this.available.pop();

      // Validate resource
      if (this.validate(pooled.resource)) {
        pooled.lastUsed = Date.now();
        this.inUse.add(pooled.resource);
        return pooled.resource;
      }

      // Resource invalid, destroy it
      await this.destroy(pooled.resource).catch(() => {});
    }

    // Create new if under max
    if (this.inUse.size < this.max) {
      const pooled = await this._createResource();
      const resource = this.available.pop().resource;
      this.inUse.add(resource);
      return resource;
    }

    // Wait for available resource
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.waiting.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.waiting.splice(idx, 1);
        reject(new Error("Acquire timeout"));
      }, this.acquireTimeout);

      this.waiting.push({ resolve, reject, timeout });
    });
  }

  /**
   * Release a resource back to the pool
   * @param {any} resource
   */
  release(resource) {
    if (!this.inUse.has(resource)) return;

    this.inUse.delete(resource);

    // If someone is waiting, give to them
    if (this.waiting.length > 0) {
      const { resolve, timeout } = this.waiting.shift();
      clearTimeout(timeout);
      this.inUse.add(resource);
      resolve(resource);
      return;
    }

    // Return to available pool
    this.available.push({
      resource,
      createdAt: Date.now(), // Approximate
      lastUsed: Date.now(),
    });
  }

  /**
   * Execute function with acquired resource (auto-release)
   * @param {Function} fn - Function that receives the resource
   * @returns {Promise<any>}
   */
  async use(fn) {
    const resource = await this.acquire();
    try {
      return await fn(resource);
    } finally {
      this.release(resource);
    }
  }

  /**
   * Close the pool and destroy all resources
   */
  async close() {
    this._closed = true;

    if (this._idleCheckInterval) {
      clearInterval(this._idleCheckInterval);
    }

    // Reject waiting
    for (const { reject, timeout } of this.waiting) {
      clearTimeout(timeout);
      reject(new Error("Pool closed"));
    }
    this.waiting = [];

    // Destroy available
    const destroyPromises = this.available.map((p) =>
      this.destroy(p.resource).catch(() => {}),
    );
    this.available = [];

    await Promise.all(destroyPromises);
  }

  /**
   * Get pool statistics
   * @returns {{ available: number, inUse: number, waiting: number, max: number }}
   */
  get stats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waiting.length,
      max: this.max,
    };
  }
}

/**
 * Create a new pool
 * @param {PoolOptions} options
 * @returns {Pool}
 */
export function createPool(options) {
  return new Pool(options);
}

export default { Pool, createPool };
