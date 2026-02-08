// utils/helpers/adapt.js

/**
 * Pre-computed error response for performance
 */
const ERROR_RESPONSE = JSON.stringify({
  success: false,
  message: "Internal Server Error",
});

/**
 * Adapts third-party middleware to work with Vibe.
 * OPTIMIZED: Pre-determines middleware type at wrap time, not runtime.
 *
 * Supports:
 * 1. Express-style: (req, res, next)
 * 2. Async/Promise: async (req, res)
 * 3. Sync: (req, res)
 *
 * @param {Function} mw - The middleware function to wrap
 * @returns {import("../../vibe.js").Interceptor} A Vibe-compatible interceptor
 */
export function adapt(mw) {
  // Pre-determine middleware type ONCE at wrap time
  const argCount = mw.length;

  // Express-style middleware (req, res, next)
  if (argCount === 3) {
    return adaptExpress(mw);
  }

  // Check if it's an async function
  const isAsync = mw.constructor.name === "AsyncFunction";

  if (isAsync) {
    return adaptAsync(mw);
  }

  // Sync or promise-returning function
  return adaptSync(mw);
}

/**
 * Optimized Express-style adapter
 * Uses callback pattern, only creates Promise when necessary
 */
function adaptExpress(mw) {
  return (req, res) => {
    return new Promise((resolve) => {
      try {
        mw(req, res, (err) => {
          if (err) {
            handleError(err, res);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      } catch (err) {
        handleError(err, res);
        resolve(false);
      }
    });
  };
}

/**
 * Optimized async middleware adapter
 */
function adaptAsync(mw) {
  return async (req, res) => {
    try {
      await mw(req, res);
      return true;
    } catch (err) {
      handleError(err, res);
      return false;
    }
  };
}

/**
 * Optimized sync middleware adapter
 * Only awaits if result is a Promise
 */
function adaptSync(mw) {
  return async (req, res) => {
    try {
      const result = mw(req, res);
      // Only await if it's a Promise (duck typing for speed)
      if (result && typeof result.then === "function") {
        await result;
      }
      return true;
    } catch (err) {
      handleError(err, res);
      return false;
    }
  };
}

/**
 * Centralized error handler - reuses pre-computed response
 */
function handleError(err, res) {
  // Log internally (only in dev)
  if (process.env.NODE_ENV !== "production") {
    console.error("Middleware Error:", err);
  }

  if (!res.headersSent) {
    if (res.serverError) {
      res.serverError();
    } else {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(ERROR_RESPONSE);
    }
  }
}

/**
 * Batch adapt multiple middleware at once
 * @param {...Function} middlewares
 * @returns {import("../../vibe.js").Interceptor[]}
 */
export function adaptAll(...middlewares) {
  return middlewares.map(adapt);
}

export default adapt;
