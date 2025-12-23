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
 * - Route matching (regex-based)
 * - Route-level interceptors
 * - Smart handler execution & implicit responses
 *
 * @param {import("../vibe.js").VibeConfig} options
 *        Internal framework configuration (routes, interceptors, settings).
 * @param {number} port
 *        Port number to listen on.
 * @param {string} [host]
 *        Host address (defaults to system localhost).
 * @param {() => void} [callback]
 *        Optional callback invoked once the server starts listening.
 * @returns {void}
 */
async function server(options, port, host, callback) {

  async function reqListener(req, res) {
    req.query = extractQuery(req.url);
    const [pathname] = req.url.split("?");
    req.url = pathname;

    // 1. Extend Response Object
    responseMethods(res, options);

    // 2. Run Global Middleware (Plugins)
    const globalOk = await runIntercept(options.interceps, req, res, false);
    if (!globalOk) return;

    req.ip = req.socket.remoteAddress || req.headers["x-forwarded-for"];

    // 3. Route Matching Loop
    for (const routeObj of options.routes.filter(
      (r) => r.method === req.method
    )) {
      const { method, path, handler, pathRegex, intercept, media } = routeObj;
      const result = matchPath(pathRegex, req.url);

      // Check Regex Match
      if (result) {
        try {
          // Parse Body (JSON or Multipart)
          await bodyParser(req, res, media, options);

          req.params = { ...result.groups };

          // 4. Run Route-Specific Middleware
          const beforeOk = await runIntercept(intercept, req, res);
          if (!beforeOk) return;

          // 5. Execute Main Handler
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
              "Handler must be a function, string, number, or object"
            );
          }

          return; // Exit loop after successful match
        } catch (error) {
          handleError(error, req, res);
          return;
        }
      }
    }

    // 404 Fallback
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not Found");
  }

  let mainHost = host || "0.0.0.0";
  if(mainHost === "localhost") mainHost = "127.0.0.1";

  const vibe_server  = http.createServer(reqListener);

  vibe_server.listen(port, mainHost, async () => {
    const addrs = await dns.lookup("::", { all: true });
    getNetworkIP(mainHost, port);
    if(callback) callback();
  });

  vibe_server.on("error", (err) => {
    error(`Port ${port} is already in use! \n${err.message}`);
  });
}

export default server;
