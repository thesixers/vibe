// utils/adapt.js

/**
 * Adapts third-party middleware to work with Vibe.
 * Supports:
 * 1. Express-style: (req, res, next)
 * 2. Async/Promise: async (req, res)
 * 3. Sync: (req, res)
 *
 * @param {Function} mw - The middleware function to wrap
 * @returns {import("../vibe.js").Interceptor} A Vibe-compatible interceptor
 */
export function adapt(mw) {
  return async (req, res) => {
    try {
      // --- Express-style middleware (req, res, next) ---
      if (mw.length === 3) {
        await new Promise((resolve, reject) => {
          mw(req, res, (err) => (err ? reject(err) : resolve()));
        });
      } 
      // --- Promise-based or sync middleware ---
      else {
        const result = mw(req, res);
        if (result && result.then) await result; // await if returns a promise
      }
      return true; // success
    } catch (err) {
      // Log the real error internally
      console.error("Middleware Error:", err);

      // Respond with generic internal server error to client
      if (res.serverError) {
        res.serverError(new Error("Internal Server Error"));
      } else if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          success: false,
          message: "Internal Server Error"
        }));
      }

      return false; // indicate failure
    }
  };
}
