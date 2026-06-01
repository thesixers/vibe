/**
 * Built-in CORS (Cross-Origin Resource Sharing) helper for Vibe.
 *
 * Returns an interceptor that handles preflight OPTIONS requests and sets
 * the appropriate Access-Control-* headers on every response.
 *
 * @example
 * import vibe, { cors } from "vibe-gx";
 * const app = vibe();
 *
 * app.plugin(cors({ origin: "https://myapp.com", credentials: true }));
 */

// Pre-allocated headers for preflight responses
const PREFLIGHT_HEADERS = { "content-length": "0" };

/**
 * @typedef {Object} CorsOptions
 * @property {string | string[] | ((origin: string) => boolean)} [origin="*"]
 *   Allowed origin(s). Can be a string, array of strings, or a function
 *   that returns true/false for a given origin.
 * @property {string[]} [methods] Allowed HTTP methods. Default: common methods
 * @property {string[]} [allowedHeaders] Allowed request headers
 * @property {string[]} [exposedHeaders] Headers exposed to the browser
 * @property {boolean} [credentials=false] Allow cookies / auth headers
 * @property {number} [maxAge] Preflight cache duration in seconds
 */

/**
 * Creates a CORS interceptor.
 *
 * - Handles OPTIONS preflight requests automatically (responds 204 and stops).
 * - Sets Access-Control-* headers on every request.
 * - Supports wildcard, single origin, array of origins, or dynamic function.
 *
 * @param {CorsOptions} [opts={}]
 * @returns {import("../vibe.js").Interceptor}
 */
export function cors(opts = {}) {
  const {
    origin = "*",
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization"],
    exposedHeaders = [],
    credentials = false,
    maxAge,
  } = opts;

  // Pre-compute static header values where possible
  const methodsStr = methods.join(", ");
  const allowedHeadersStr = allowedHeaders.join(", ");
  const exposedHeadersStr = exposedHeaders.length
    ? exposedHeaders.join(", ")
    : null;
  const maxAgeStr = maxAge != null ? String(maxAge) : null;

  /**
   * Resolve the Access-Control-Allow-Origin value for a given request origin.
   * @param {string} requestOrigin
   * @returns {string | null} The value to set, or null to omit the header
   */
  function resolveOrigin(requestOrigin) {
    if (origin === "*") return "*";

    if (typeof origin === "function") {
      return origin(requestOrigin) ? requestOrigin : null;
    }

    if (Array.isArray(origin)) {
      return origin.includes(requestOrigin) ? requestOrigin : null;
    }

    // Single string
    return origin === requestOrigin ? requestOrigin : null;
  }

  /**
   * The interceptor returned to app.plugin().
   * @param {import("../vibe.js").VibeRequest} req
   * @param {import("../vibe.js").VibeResponse} res
   * @returns {boolean}
   */
  return function corsInterceptor(req, res) {
    const requestOrigin = req.headers["origin"];

    // No Origin header — not a cross-origin request, skip CORS headers
    if (!requestOrigin) return true;

    const allowedOrigin = resolveOrigin(requestOrigin);

    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);

      // If not wildcard, tell proxies/CDNs the response varies by Origin
      if (allowedOrigin !== "*") {
        res.setHeader("Vary", "Origin");
      }
    }

    if (credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    if (exposedHeadersStr) {
      res.setHeader("Access-Control-Expose-Headers", exposedHeadersStr);
    }

    // Handle preflight (OPTIONS) — respond immediately and stop
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", methodsStr);
      res.setHeader("Access-Control-Allow-Headers", allowedHeadersStr);

      if (maxAgeStr) {
        res.setHeader("Access-Control-Max-Age", maxAgeStr);
      }

      res.writeHead(204, PREFLIGHT_HEADERS);
      res.end();
      return false; // Stop further processing
    }

    return true;
  };
}
