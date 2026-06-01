/**
 * Built-in sliding window rate limiter for Vibe.
 *
 * Works as both a global plugin and a per-route interceptor.
 * Uses an in-memory Map with automatic TTL-based cleanup.
 * No external dependencies.
 *
 * @example
 * // Global — all routes
 * import { rateLimit } from "vibe-gx";
 * app.plugin(rateLimit({ max: 100, window: 60_000 }));
 *
 * @example
 * // Per-route — tight limit on login
 * app.post("/auth/login", { intercept: rateLimit({ max: 5, window: 60_000 }) }, handler);
 */

/**
 * @typedef {Object} RateLimitOptions
 * @property {number} max - Maximum number of requests allowed per window
 * @property {number} [window=60000] - Window duration in milliseconds. Default: 60s
 * @property {(req: import("../vibe.js").VibeRequest) => string} [keyBy] - Custom key function. Default: req.ip
 * @property {string} [message] - Custom error message. Default: "Too Many Requests"
 * @property {number} [statusCode=429] - HTTP status code when limit exceeded. Default: 429
 * @property {(req: import("../vibe.js").VibeRequest) => boolean} [skip] - Return true to bypass the limiter for a request
 */

// Pre-allocated 429 response headers
const RATE_LIMIT_HEADERS = { "content-type": "text/plain" };

/**
 * Creates a rate limiter interceptor using a sliding window algorithm.
 *
 * Each unique key (default: IP address) gets a counter and a window start time.
 * When the window expires the counter resets. When the counter exceeds `max`
 * the request is rejected with 429 and a `Retry-After` header.
 *
 * @param {RateLimitOptions} opts
 * @returns {import("../vibe.js").Interceptor}
 */
export function rateLimit(opts = {}) {
  const max = opts.max;

  if (!max || typeof max !== "number" || max < 1) {
    throw new Error("[vibe] rateLimit: `max` must be a positive number");
  }

  const windowMs = opts.window ?? 60_000;
  const message = opts.message ?? "Too Many Requests";
  const statusCode = opts.statusCode ?? 429;
  const keyBy = opts.keyBy ?? ((req) => req.ip ?? "unknown");
  const skip = opts.skip ?? null;

  // In-memory store: key → { count, windowStart }
  // Entries are cleaned up automatically when the window expires
  const store = new Map();

  // Periodic cleanup to prevent unbounded memory growth.
  // Runs every `windowMs` and removes all expired entries.
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart >= windowMs) {
        store.delete(key);
      }
    }
  }, windowMs);

  // Don't keep the process alive just for cleanup
  if (cleanupInterval.unref) cleanupInterval.unref();

  /**
   * The interceptor function returned to app.plugin() or route intercept.
   * @param {import("../vibe.js").VibeRequest} req
   * @param {import("../vibe.js").VibeResponse} res
   * @returns {boolean}
   */
  return function rateLimitInterceptor(req, res) {
    // Allow bypassing for certain requests (e.g. internal health checks)
    if (skip && skip(req)) return true;

    const key = keyBy(req);
    const now = Date.now();

    let entry = store.get(key);

    // No entry yet or window has expired — start a fresh window
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 1, windowStart: now };
      store.set(key, entry);
    } else {
      entry.count++;
    }

    const remaining = Math.max(0, max - entry.count);
    const resetInMs = windowMs - (now - entry.windowStart);
    const resetInSeconds = Math.ceil(resetInMs / 1000);

    // Always set informational headers
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil((entry.windowStart + windowMs) / 1000));

    if (entry.count > max) {
      res.setHeader("Retry-After", resetInSeconds);
      res.writeHead(statusCode, RATE_LIMIT_HEADERS);
      res.end(message);
      return false; // Stop request processing
    }

    return true;
  };
}
