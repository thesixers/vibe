import http from "http";
import {
  error,
  extractQuery,
  getNetworkIP,
  handleError,
  isSendAble,
  matchPath,
  runIntercept,
} from "./handler.js";
import bodyParser from "./parser.js";
import responseMethods from "./response.js";
import dns from "node:dns/promises";

/**
 * Creates and starts the Vibe HTTP server.
 *
 * Handles the full request lifecycle:
 * - Request normalization (URL, query, IP)
 * - Global interceptors
 * - Body parsing (JSON & multipart)
 * - Route matching (hybrid: linear for small, trie for large route sets)
 * - Route-level interceptors
 * - Smart handler execution & implicit responses
 *
 * @param {Object} options - Internal framework configuration
 * @param {import("./trie.js").RouteTrie} options.trie - Route trie for matching
 * @param {Array} options.routes - Routes array for linear matching
 * @param {number} options.routeCount - Number of registered routes
 * @param {number} options.trieThreshold - Threshold to switch to trie matching
 * @param {Array} options.interceptors - Global interceptors
 * @param {string} options.publicFolder - Public folder path
 * @param {Object} options.decorators - App-level decorators
 * @param {number} port - Port number to listen on
 * @param {string} [host] - Host address (defaults to 0.0.0.0)
 * @param {Function} [callback] - Optional callback when server starts
 * @returns {void}
 */
async function server(options, port, host, callback) {
  // Determine which matching strategy to use based on route count
  const useTrieMatching = () => options.routeCount > options.trieThreshold;

  async function reqListener(req, res) {
    req.query = extractQuery(req.url);
    const [pathname] = req.url.split("?");
    req.url = pathname;

    // 1. Extend Response Object
    responseMethods(res, options);

    // 2. Apply request decorators
    if (options.requestDecorators) {
      for (const [name, value] of Object.entries(options.requestDecorators)) {
        req[name] = typeof value === "function" ? value() : value;
      }
    }

    // 3. Apply response decorators
    if (options.replyDecorators) {
      for (const [name, value] of Object.entries(options.replyDecorators)) {
        res[name] = typeof value === "function" ? value() : value;
      }
    }

    // 4. Run Global Middleware (Plugins)
    const globalOk = await runIntercept(options.interceptors, req, res, false);
    if (!globalOk) return;

    req.ip = req.socket.remoteAddress || req.headers["x-forwarded-for"];

    // 5. Route Matching - HYBRID APPROACH
    let match = null;

    if (useTrieMatching()) {
      // Use Trie for large route sets (O(log n))
      match = options.trie.match(req.method, req.url);
    } else {
      // Use Linear for small route sets (lower overhead)
      match = linearMatch(options.routes, req.method, req.url);
    }

    if (match) {
      const { route, params } = match;
      const { handler, intercept, media } = route;

      try {
        // Parse Body (JSON or Multipart)
        await bodyParser(req, res, media, options);

        req.params = params;

        // 6. Run Route-Specific Middleware
        const beforeOk = await runIntercept(intercept, req, res);
        if (!beforeOk) return;

        // 7. Execute Main Handler
        if (typeof handler === "function") {
          const returnedValue = await handler(req, res);

          // Handle implicit returns (e.g. return { msg: 'hi' })
          if (returnedValue !== undefined) {
            if (!res.writableEnded) res.json(returnedValue);
          }
        } else if (isSendAble(handler)) {
          res.send(handler);
        } else {
          throw new Error(
            "Handler must be a function, string, number, or object",
          );
        }

        return;
      } catch (err) {
        handleError(err, req, res);
        return;
      }
    }

    // 404 Fallback
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  }

  /**
   * Linear route matching for small route sets
   * @param {Array} routes
   * @param {string} method
   * @param {string} url
   * @returns {{ route: Object, params: Object } | null}
   */
  function linearMatch(routes, method, url) {
    for (const route of routes) {
      if (route.method !== method) continue;

      const result = matchPath(route.pathRegex, url);
      if (result) {
        return {
          route,
          params: result.groups ? { ...result.groups } : {},
        };
      }
    }
    return null;
  }

  let mainHost = host || "0.0.0.0";
  if (mainHost === "localhost") mainHost = "127.0.0.1";

  const vibe_server = http.createServer(reqListener);

  vibe_server.listen(port, mainHost, async () => {
    try {
      await dns.lookup("::", { all: true });
    } catch {
      // IPv6 not available, ignore
    }
    getNetworkIP(mainHost, port);

    // Log which matching strategy is being used
    const strategy = useTrieMatching() ? "Trie (O(log n))" : "Linear (O(n))";
    console.log(
      `[VIBE] Route matching: ${strategy} (${options.routeCount} routes, threshold: ${options.trieThreshold})`,
    );

    if (callback) callback();
  });

  vibe_server.on("error", (err) => {
    error(`Port ${port} is already in use! \n${err.message}`);
  });
}

export default server;
