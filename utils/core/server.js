import http from "http";
import {
  error,
  getNetworkIP,
  handleError,
  isSendAble,
  matchPath,
} from "./handler.js";
import bodyParser from "./parser.js";
import responseMethods from "./response.js";
import dns from "node:dns/promises";
import { parseQuery as nativeParseQuery, isNativeEnabled } from "../native.js";

// Pre-allocated 404 response
const NOT_FOUND_BODY = "Not Found";

/**
 * Creates and starts the Vibe HTTP server.
 * HEAVILY OPTIMIZED for performance
 */
async function server(options, port, host, callback) {
  // Pre-compute everything we can
  const useTrieMatching = options.routeCount > options.trieThreshold;
  const staticRoutes = options.staticRoutes || new Map();
  const interceptors = options.interceptors;
  const hasInterceptors = interceptors && interceptors.length > 0;
  const requestDecorators = options.requestDecorators;
  const replyDecorators = options.replyDecorators;
  const hasRequestDecorators =
    requestDecorators && Object.keys(requestDecorators).length > 0;
  const hasReplyDecorators =
    replyDecorators && Object.keys(replyDecorators).length > 0;
  const trie = options.trie;
  const routes = options.routes;

  // Pre-compute decorator entries
  const requestDecoratorEntries = hasRequestDecorators
    ? Object.entries(requestDecorators)
    : null;
  const replyDecoratorEntries = hasReplyDecorators
    ? Object.entries(replyDecorators)
    : null;

  // Inline interceptor runner (avoid function call overhead)
  async function runIntercept(intercept, req, res) {
    if (!intercept) return true;

    if (Array.isArray(intercept)) {
      for (let i = 0; i < intercept.length; i++) {
        await intercept[i](req, res);
        if (res.writableEnded) return false;
      }
    } else {
      await intercept(req, res);
      if (res.writableEnded) return false;
    }
    return true;
  }

  // Linear route matching (inlined for speed)
  function linearMatch(method, url) {
    for (let i = 0, len = routes.length; i < len; i++) {
      const route = routes[i];
      if (route.method !== method) continue;
      const result = route.pathRegex.exec(url);
      if (result) {
        return { route, params: result.groups || {} };
      }
    }
    return null;
  }

  // Main request handler - OPTIMIZED
  function reqListener(req, res) {
    // Fast pathname extraction
    const url = req.url;
    const qIdx = url.indexOf("?");
    const pathname = qIdx < 0 ? url : url.slice(0, qIdx);

    // Lazy query (getter) - uses native C++ when available
    let _query;
    req.__defineGetter__("query", function () {
      if (_query === undefined) {
        if (qIdx < 0) {
          _query = {};
        } else {
          // Use native parser if available
          _query = nativeParseQuery(url.slice(qIdx + 1));
        }
      }
      return _query;
    });

    req.url = pathname;

    // Extend response
    responseMethods(res, options);

    // Apply decorators (only if exist)
    if (requestDecoratorEntries) {
      for (let i = 0; i < requestDecoratorEntries.length; i++) {
        const e = requestDecoratorEntries[i];
        req[e[0]] = typeof e[1] === "function" ? e[1]() : e[1];
      }
    }
    if (replyDecoratorEntries) {
      for (let i = 0; i < replyDecoratorEntries.length; i++) {
        const e = replyDecoratorEntries[i];
        res[e[0]] = typeof e[1] === "function" ? e[1]() : e[1];
      }
    }

    // Main async handler
    handleRequest(req, res, pathname);
  }

  async function handleRequest(req, res, pathname) {
    // Global interceptors
    if (hasInterceptors) {
      if (!(await runIntercept(interceptors, req, res))) return;
    }

    // Lazy IP
    if (!req.ip) {
      req.ip = req.socket.remoteAddress || req.headers["x-forwarded-for"];
    }

    // Route matching - FAST PATH first
    const routeKey = req.method + pathname;
    let match = staticRoutes.get(routeKey);

    if (match) {
      // Static route found - O(1)
      match = { route: match, params: {} };
    } else if (useTrieMatching) {
      match = trie.match(req.method, pathname);
    } else {
      match = linearMatch(req.method, pathname);
    }

    if (!match) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end(NOT_FOUND_BODY);
      return;
    }

    const { route, params } = match;
    const { handler, intercept, media } = route;

    try {
      // Body parsing (only for non-GET with body)
      const method = req.method;
      if (media || (method !== "GET" && method !== "HEAD")) {
        await bodyParser(req, res, media, options);
      }

      req.params = params;

      // Route interceptors
      if (intercept) {
        if (!(await runIntercept(intercept, req, res))) return;
      }

      // Execute handler
      if (typeof handler === "function") {
        const result = await handler(req, res);
        if (result !== undefined && !res.writableEnded) {
          res.json(result);
        }
      } else if (isSendAble(handler)) {
        res.send(handler);
      } else {
        throw new Error("Invalid handler type");
      }
    } catch (err) {
      handleError(err, req, res);
    }
  }

  let mainHost = host || "0.0.0.0";
  if (mainHost === "localhost") mainHost = "127.0.0.1";

  const vibe_server = http.createServer(reqListener);

  vibe_server.listen(port, mainHost, async () => {
    try {
      await dns.lookup("::", { all: true });
    } catch {}
    getNetworkIP(mainHost, port);

    const strategy = useTrieMatching ? "Trie (O(log n))" : "Linear (O(n))";
    console.log(
      `[VIBE] Route matching: ${strategy} (${options.routeCount} routes, ${staticRoutes.size} static, threshold: ${options.trieThreshold})`,
    );

    if (callback) callback();
  });

  vibe_server.on("error", (err) => {
    error(`Port ${port} is already in use! \n${err.message}`);
  });
}

export default server;
