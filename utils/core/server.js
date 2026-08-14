import http from "http";
import { error, getNetworkIP, handleError, isSendAble } from "./handler.js";
import bodyParser from "./parser.js";
import { installResponseMethods, initResponse } from "./response.js";
import { parseQuery } from "../native.js";

// Pre-allocated headers (frozen for V8 optimization)
const JSON_HEADERS = { "content-type": "application/json" };
const TEXT_HEADERS = { "content-type": "text/plain" };

// Pre-allocated 404 response
const NOT_FOUND_BODY = "Not Found";

// Shared frozen empty params (avoids per-request object allocation)
const EMPTY_PARAMS = Object.freeze(Object.create(null));

// Global counter for lightning fast request IDs
let _reqIdCounter = 0;
const MAX_INT = Number.MAX_SAFE_INTEGER;

/**
 * Creates and starts the Vibe HTTP server.
 * HEAVILY OPTIMIZED for performance
 */
function server(options, port, host, callback) {
  // Install response methods on prototype ONCE (zero per-request cost)
  installResponseMethods(http.ServerResponse);

  // Install all lazy prototype getters on IncomingMessage ONCE at startup.
  // Installing on the prototype means zero defineProperty calls per request.
  if (!http.IncomingMessage.prototype._vibeProtoInstalled) {
    Object.defineProperty(http.IncomingMessage.prototype, "query", {
      get() {
        if (this._parsedQuery !== undefined) return this._parsedQuery;
        this._parsedQuery =
          this._qIdx < 0 ? EMPTY_PARAMS : parseQuery(this._rawUrl.slice(this._qIdx + 1));
        return this._parsedQuery;
      },
      configurable: true,
    });

    // req.id — fast auto-incrementing integer (or custom generator from options)
    Object.defineProperty(http.IncomingMessage.prototype, "id", {
      get() {
        if (this._reqId === undefined) {
          if (this._vibeGenReqId) {
            this._reqId = this._vibeGenReqId(this);
          } else {
            _reqIdCounter = _reqIdCounter >= MAX_INT ? 1 : _reqIdCounter + 1;
            this._reqId = _reqIdCounter;
          }
        }
        return this._reqId;
      },
      configurable: true,
    });

    // req.log — child logger created lazily; requires req._vibeLogger stamped per-request
    Object.defineProperty(http.IncomingMessage.prototype, "log", {
      get() {
        if (this._reqLog === undefined)
          this._reqLog = this._vibeLogger.child({ reqId: this.id });
        return this._reqLog;
      },
      configurable: true,
    });

    // req.cookies — parsed once on first access
    Object.defineProperty(http.IncomingMessage.prototype, "cookies", {
      get() {
        if (this._parsedCookies !== undefined) return this._parsedCookies;
        const header = this.headers["cookie"];
        if (!header) return (this._parsedCookies = EMPTY_PARAMS);
        const cookies = {};
        for (const pair of header.split(";")) {
          const idx = pair.indexOf("=");
          if (idx < 0) continue;
          const key = pair.slice(0, idx).trim();
          const val = pair.slice(idx + 1).trim();
          if (key) cookies[key] = decodeURIComponent(val);
        }
        return (this._parsedCookies = cookies);
      },
      configurable: true,
    });

    http.IncomingMessage.prototype._vibeProtoInstalled = true;
  }

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
      if (route.method !== method || route.isStatic) continue;
      const result = route.pathRegex.exec(url);
      if (result) {
        return { route, params: result.groups || EMPTY_PARAMS };
      }
    }
    return null;
  }

  // Main request handler - ULTRA OPTIMIZED
  function reqListener(req, res) {
    // Stamp the logger so the prototype req.log getter can resolve it.
    // One cheap property assignment replaces three Object.defineProperty calls.
    req._vibeLogger = options.logger;
    req._vibeGenReqId = options.genReqId;

    if (options.loggerConfig && options.loggerConfig.lifecycle) {
      req.startTime = Date.now();

      // Determine sender IP early for logging
      const sender =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.headers["x-real-ip"] ||
        req.socket.remoteAddress ||
        "unknown";

      req.log.info(
        { type: "req", url: req.url, method: req.method, sender },
        "Incoming request",
      );

      res.on("finish", () => {
        req.log.info(
          {
            type: "res",
            statusCode: res.statusCode,
            responseTimeMs: Date.now() - req.startTime,
          },
          "Request completed",
        );
      });
    }

    // Fast pathname extraction
    const url = req.url;
    const qIdx = url.indexOf("?");
    const pathname = qIdx < 0 ? url : url.slice(0, qIdx);

    // Store raw values for lazy query parsing (prototype getter handles the rest)
    req._qIdx = qIdx;
    req._rawUrl = url;
    req._parsedQuery = undefined;

    req.url = pathname;

    // Resolve real client IP once — proxy-aware, available on ALL paths
    req.ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.socket.remoteAddress;

    // Stamp response with options ref (ONLY per-request cost for response methods)
    res._vibeOptions = options;

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

    // SYNC FAST PATH — avoid async/await for simple GET routes
    if (!hasInterceptors && req.method === "GET") {
      const routeKey = "GET" + pathname;
      const staticMatch = staticRoutes.get(routeKey);

      if (staticMatch && !staticMatch.intercept) {
        req.params = EMPTY_PARAMS;

        // Pre-built response (string/object/number/boolean registered at route time)
        if (staticMatch._handlerType === 2) {
          const pb = staticMatch._prebuilt;
          // Check if it looks like JSON (starts with { or [)
          const c = pb.charCodeAt(0);
          if (c === 123 || c === 91) {
            res.writeHead(200, JSON_HEADERS);
          } else {
            res.writeHead(200, TEXT_HEADERS);
          }
          res.end(pb);
          return;
        }

        // Function handler
        const handler = staticMatch.handler;
        const serialize = staticMatch.serialize;

        try {
          const result = handler(req, res);
          if (result !== undefined && !res.writableEnded) {
            if (result && typeof result.then === "function") {
              result
                .then((val) => {
                  if (val instanceof Error) {
                    return options.errorHandler(val, req, res);
                  }
                  if (val !== undefined && !res.writableEnded) {
                    res.writeHead(200, JSON_HEADERS);
                    res.end(serialize ? serialize(val) : JSON.stringify(val));
                  }
                })
                .catch((err) => options.errorHandler(err, req, res));
            } else if (typeof result === "object" && result !== null) {
              if (result instanceof Error) {
                return options.errorHandler(result, req, res);
              }
              res.writeHead(200, JSON_HEADERS);
              res.end(serialize ? serialize(result) : JSON.stringify(result));
            } else {
              res.writeHead(200, TEXT_HEADERS);
              res.end(String(result));
            }
          }
        } catch (err) {
          options.errorHandler(err, req, res);
        }
        return;
      }
    }

    // Fallback to full async handler for complex routes
    handleRequest(req, res, pathname);
  }

  async function handleRequest(req, res, pathname) {
    // Global interceptors
    if (hasInterceptors) {
      if (!(await runIntercept(interceptors, req, res))) return;
    }

    // Lazy IP already resolved in reqListener — no-op needed here

    // Route matching - FAST PATH first
    const routeKey = req.method + pathname;
    let match = staticRoutes.get(routeKey);

    if (match) {
      // Static route found - O(1)
      match = { route: match, params: EMPTY_PARAMS };
    } else if (useTrieMatching) {
      match = trie.match(req.method, pathname);
    } else {
      match = linearMatch(req.method, pathname);
    }

    if (!match) {
      res.writeHead(404, TEXT_HEADERS);
      res.end(NOT_FOUND_BODY);
      return;
    }

    const { route, params } = match;
    const { handler, intercept, media, serialize } = route;

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
        if (result instanceof Error) {
          return options.errorHandler(result, req, res);
        }
        if (result !== undefined && !res.writableEnded) {
          if (serialize) {
            // Pre-compiled schema serializer — fastest path
            res.writeHead(200, JSON_HEADERS);
            res.end(serialize(result));
          } else {
            res.writeHead(200, JSON_HEADERS);
            res.end(JSON.stringify(result));
          }
        }
      } else if (isSendAble(handler)) {
        if (serialize && typeof handler === "object" && handler !== null) {
          res.writeHead(200, JSON_HEADERS);
          res.end(serialize(handler));
        } else {
          res.send(handler);
        }
      } else {
        throw new Error("Invalid handler type");
      }
    } catch (err) {
      options.errorHandler(err, req, res);
    }
  }

  let mainHost = host || "0.0.0.0";
  if (mainHost === "localhost") mainHost = "127.0.0.1";

  const vibe_server = http.createServer(reqListener);

  vibe_server.listen(port, mainHost, () => {
    getNetworkIP(mainHost, port);

    const strategy = useTrieMatching ? "Trie (O(log n))" : "Linear (O(n))";
    options.logger.info(
      {
        strategy,
        routeCount: options.routeCount,
        staticRoutes: staticRoutes.size,
        trieThreshold: options.trieThreshold,
      },
      "[VIBE] Route matching strategy initialized",
    );

    if (callback) callback();
  });

  vibe_server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      error(`Port ${port} is already in use! \n${err.message}`);
      process.exit(1);
    } else {
      error(`Server error: \n${err.message}`);
    }
  });

  // Graceful shutdown support for node --watch, nodemon, and cluster mode
  const shutdown = () => {
    // vibe_server.close stops accepting new connections
    // Existing keep-alive connections will still prevent instant exit,
    // so we force an exit if it takes longer than 3 seconds.
    vibe_server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("message", (msg) => {
    if (msg === "shutdown") shutdown();
  });

  return vibe_server;
}

export default server;
