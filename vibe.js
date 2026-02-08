import server from "./utils/core/server.js";
import { adapt } from "./utils/helpers/adapt.js";
import { color } from "./utils/helpers/colors.js";
import { RouteTrie } from "./utils/core/trie.js";
import { PathToRegex } from "./utils/core/handler.js";

/**
 * Helper to generate regex for a path
 * @param {string} path
 * @returns {RegExp}
 */
function pathToRegex(path) {
  return PathToRegex(path).pathRegex;
}

/**
 * @typedef {import("http").IncomingMessage} IncomingMessage
 * @typedef {import("http").ServerResponse} ServerResponse
 */

/**
 * Extended request object used by Vibe.
 *
 * @typedef {IncomingMessage & {
 *   params?: Record<string, string>,
 *   query?: Record<string, string>,
 *   body?: any,
 *   files?: Array<{
 *     filename: string,
 *     originalName?: string,
 *     type: string,
 *     filePath: string,
 *     size: number
 *   }>,
 *   ip?: string,
 *   fullIp?: string
 * }} VibeRequest
 */

/**
 * Extended response object used by Vibe.
 *
 * @typedef {ServerResponse & {
 *   send: (data: any) => void,
 *   json: (data: any) => void,
 *   status: (code: number) => VibeResponse,
 *   sendFile: (filePath: string) => void,
 *   sendHtml: (filename: string) => void,
 *   redirect?: (url: string, status?: number) => void,
 *   success?: (data?: any, message?: string) => void,
 *   created?: (data?: any, message?: string) => void,
 *   badRequest?: (message?: string, errors?: any) => void,
 *   unauthorized?: (message?: string) => void,
 *   forbidden?: (message?: string) => void,
 *   notFound?: (message?: string) => void,
 *   conflict?: (message?: string) => void,
 *   serverError?: (error: Error) => void
 * }} VibeResponse
 */

/**
 * Route handler function.
 * Returning a value implicitly sends a response.
 * @typedef {(req: VibeRequest, res: VibeResponse) => any | Promise<any>} Handler
 */

/**
 * Middleware / interceptor function.
 * Returning or resolving to `false` stops execution.
 * @typedef {(req: VibeRequest, res: VibeResponse) => boolean | void | Promise<boolean | void>} Interceptor
 */

/**
 * File upload configuration for a route.
 * @typedef {Object} MediaOptions
 * @property {boolean} [public=true] Save file under public folder
 * @property {string|null} [dest] Subfolder inside public or root
 * @property {number} [maxSize] Max file size in bytes
 * @property {string[]} [allowedTypes] Allowed MIME types (e.g., ["image/png", "image/jpeg"])
 */

/**
 * Additional route configuration.
 * @typedef {Object} RouteOptions
 * @property {Interceptor | Interceptor[]} [intercept]
 * @property {MediaOptions} [media]
 */

/**
 * Internal route representation.
 * @typedef {Object} VibeRoute
 * @property {string} method
 * @property {string} path
 * @property {Handler | string | number | object} handler
 * @property {Interceptor | Interceptor[] | null} intercept
 * @property {MediaOptions} media
 */

/**
 * Plugin callback function (Fastify-style).
 * @typedef {(app: VibeApp, opts: Object) => void | Promise<void>} PluginCallback
 */

/**
 * Plugin registration options.
 * @typedef {Object} RegisterOptions
 * @property {string} [prefix] Route prefix for all routes in this plugin
 */

/**
 * Router interface exposed to users.
 * @typedef {Object} RouterAPI
 * @property {Function} get
 * @property {Function} post
 * @property {Function} put
 * @property {Function} del
 * @property {Function} patch
 * @property {Function} head
 * @property {(fn: Interceptor) => void} plugin
 * @property {(value: any, color?: string) => void} log
 */

/**
 * Initializes a Vibe application instance.
 * @returns {VibeApp}
 */
const vibe = () => {
  // Route trie for O(log n) matching (used when routes > threshold)
  const trie = new RouteTrie();

  // Route array for O(n) matching (used when routes <= threshold)
  const routes = [];

  // Threshold for switching between linear and trie matching
  const TRIE_THRESHOLD = 50;

  // Static routes Map for O(1) lookup (routes without params)
  const staticRoutes = new Map();

  // Internal configuration
  const options = {
    trie,
    routes,
    staticRoutes,
    routeCount: 0,
    trieThreshold: TRIE_THRESHOLD,
    publicFolder: "public",
    interceptors: [],
    decorators: {},
    requestDecorators: {},
    replyDecorators: {},
  };

  // Register default landing route
  const defaultRoute = {
    method: "GET",
    path: "/",
    pathRegex: /^\/$/,
    handler: (req, res) => res.sendHtml("vibe.html"),
    intercept: null,
    media: { public: true, dest: null, maxSize: 10 * 1024 * 1024 },
  };
  trie.insert("GET", "/", defaultRoute);
  routes.push(defaultRoute);
  options.routeCount = 1;

  // Current prefix for scoped routes (used in register)
  let currentPrefix = "";

  /**
   * Route registration methods
   */
  const get = (p, a, b) => registerRoute("GET", p, a, b);
  const post = (p, a, b) => registerRoute("POST", p, a, b);
  const put = (p, a, b) => registerRoute("PUT", p, a, b);
  const del = (p, a, b) => registerRoute("DELETE", p, a, b);
  const patch = (p, a, b) => registerRoute("PATCH", p, a, b);
  const head = (p, a, b) => registerRoute("HEAD", p, a, b);

  /**
   * Internal function to register a route
   * @param {string} method
   * @param {string} path
   * @param {RouteOptions | Handler} opts
   * @param {Handler} [handler]
   */
  function registerRoute(method, path, opts, handler) {
    // Apply current prefix
    const fullPath = currentPrefix + path;

    /** @type {VibeRoute} */
    const route = {
      method,
      path: fullPath,
      pathRegex: null,
      handler: null,
      intercept: null,
      media: {
        public: true,
        dest: null,
        maxSize: 10 * 1024 * 1024,
        allowedTypes: null,
      },
    };

    // Handle overriding root route
    if (fullPath === "/") {
      if (handler !== undefined) {
        if (typeof opts !== "object" || Array.isArray(opts)) {
          throw new Error("Options must be an object when using 3-arg form");
        }
        route.intercept = opts.intercept
          ? wrapIntercepts(opts.intercept)
          : null;
        route.media = { ...route.media, ...opts.media };
        route.handler = handler;
      } else {
        route.handler = opts;
      }
      route.pathRegex = /^\/$/;
      route.isStatic = true;
      trie.insert(method, "/", route);
      staticRoutes.set(method + "/", route);
      // Update existing root route in routes array
      const rootIdx = routes.findIndex(
        (r) => r.path === "/" && r.method === method,
      );
      if (rootIdx >= 0) routes[rootIdx] = route;
      else {
        routes.push(route);
        options.routeCount++;
      }
      return;
    }

    if (handler !== undefined) {
      if (typeof opts !== "object" || Array.isArray(opts)) {
        throw new Error("Options must be an object when using 3-arg form");
      }
      route.intercept = opts.intercept ? wrapIntercepts(opts.intercept) : null;
      route.media = { ...route.media, ...opts.media };
      route.handler = handler;
    } else {
      route.handler = opts;
    }

    // Generate regex for linear matching
    route.pathRegex = pathToRegex(fullPath);

    // Check if route is static (no params)
    const isStatic = !fullPath.includes(":") && !fullPath.includes("*");
    route.isStatic = isStatic;

    // Add to static routes Map for O(1) lookup
    if (isStatic) {
      staticRoutes.set(method + fullPath, route);
    }

    // Add to both structures
    trie.insert(method, fullPath, route);
    routes.push(route);
    options.routeCount++;
  }

  /**
   * Wraps interceptors with adapt() for consistent behavior
   * @param {Interceptor | Interceptor[]} intercept
   * @returns {Interceptor[]}
   */
  function wrapIntercepts(intercept) {
    if (Array.isArray(intercept)) {
      return intercept.map(adapt);
    }
    return [adapt(intercept)];
  }

  /**
   * Starts the HTTP server
   * @param {number} port - The port to listen on
   * @param {string} [host] - Optional host (e.g. '0.0.0.0')
   * @param {() => void} [callback] - Optional callback when server starts
   */
  function listen(port, host, callback) {
    addStatic();

    // Check port type
    if (port === undefined) {
      throw new Error("Port number is required to start the server");
    }

    if (typeof port === "string" || typeof port === "number") {
      if (!isNaN(Number(port))) {
        port = Number(port);
      } else {
        throw new Error("Port must be a number or numeric string");
      }
    } else {
      throw new Error("Port must be a number or numeric string");
    }

    // Validate port range
    if (port < 1 || port > 65535) {
      throw new Error("Port must be between 1 and 65535");
    }

    if (typeof host === "function") {
      callback = host;
      host = undefined;
    }

    server(options, Number(port), host, callback);
  }

  /**
   * Registers an encapsulated plugin (Fastify-style)
   * @param {PluginCallback} fn - Plugin function
   * @param {RegisterOptions} [opts={}] - Plugin options
   */
  async function register(fn, opts = {}) {
    const previousPrefix = currentPrefix;

    // Apply prefix if provided
    if (opts.prefix) {
      currentPrefix = previousPrefix + opts.prefix;
    }

    // Create a scoped app interface
    const scopedApp = {
      get,
      post,
      put,
      del,
      patch,
      head,
      plugin,
      decorate,
      decorateRequest,
      decorateReply,
      register,
      log,
      // Expose decorators
      ...options.decorators,
    };

    // Execute plugin
    try {
      const result = fn(scopedApp, opts);
      if (result && result.then) {
        await result;
      }
    } finally {
      // Restore prefix
      currentPrefix = previousPrefix;
    }
  }

  /**
   * Groups routes or includes a sub-router (legacy API)
   * @param {string | ((router: RouterAPI) => void)} prefixOrFunc
   * @param {((router: RouterAPI) => void)} [maybeFunc]
   */
  function include(prefixOrFunc, maybeFunc) {
    if (typeof prefixOrFunc === "function") {
      prefixOrFunc(routeAPI(""));
    } else {
      maybeFunc(routeAPI(prefixOrFunc));
    }
  }

  /**
   * Helper to generate a sub-router API with a prefix (legacy)
   * @param {string} prefix
   * @returns {RouterAPI}
   */
  function routeAPI(prefix) {
    const wrap = (method) => (path, a, b) =>
      registerRoute(method, prefix + path, a, b);

    return {
      get: wrap("GET"),
      post: wrap("POST"),
      put: wrap("PUT"),
      del: wrap("DELETE"),
      patch: wrap("PATCH"),
      head: wrap("HEAD"),
      log,
      plugin,
    };
  }

  /**
   * Registers a global middleware (interceptor)
   * @param {Interceptor} interceptor
   */
  function plugin(interceptor) {
    options.interceptors.push(adapt(interceptor));
  }

  /**
   * Decorates the app instance with a custom property
   * @param {string} name - Property name
   * @param {any} value - Property value
   */
  function decorate(name, value) {
    if (name in options.decorators) {
      throw new Error(`Decorator '${name}' already exists`);
    }
    options.decorators[name] = value;
  }

  /**
   * Decorates the request object with a custom property
   * @param {string} name - Property name
   * @param {any} value - Property value (or factory function)
   */
  function decorateRequest(name, value) {
    if (name in options.requestDecorators) {
      throw new Error(`Request decorator '${name}' already exists`);
    }
    options.requestDecorators[name] = value;
  }

  /**
   * Decorates the response object with a custom property
   * @param {string} name - Property name
   * @param {any} value - Property value (or factory function)
   */
  function decorateReply(name, value) {
    if (name in options.replyDecorators) {
      throw new Error(`Reply decorator '${name}' already exists`);
    }
    options.replyDecorators[name] = value;
  }

  /**
   * Logs all registered routes
   */
  function logRoutes() {
    const routes = trie.getAllRoutes();
    console.log(routes);
  }

  /**
   * Sets the public folder for static files
   * @param {string} foldername
   */
  const setPublicFolder = (foldername) =>
    (options.publicFolder = foldername || "public");

  /**
   * Adds static file serving route
   */
  function addStatic() {
    const routePath = `/${options.publicFolder}/*`;
    const route = {
      method: "GET",
      path: routePath,
      handler: (req, res) => {
        try {
          const filePath = req.url
            .split("/")
            .filter(Boolean)
            .slice(1)
            .join("/");
          res.sendFile(filePath);
        } catch (err) {
          log(err.message, "red");
          res.status(404).send("Not Found");
        }
      },
      intercept: null,
      media: { public: true, dest: null },
    };
    trie.insert("GET", routePath, route);
  }

  /**
   * Logs a message with optional color
   * @param {string} message
   * @param {string} [colorValue="reset"]
   */
  const log = (message, colorValue = "reset") =>
    process.stdout.write(`${color[colorValue](message)}\n`);

  // Build the app object with decorators
  const app = {
    get,
    post,
    put,
    del,
    patch,
    head,
    listen,
    logRoutes,
    log,
    setPublicFolder,
    include,
    plugin,
    register,
    decorate,
    decorateRequest,
    decorateReply,
  };

  // Add a getter for decorators
  Object.defineProperty(app, "decorators", {
    get() {
      return options.decorators;
    },
  });

  return app;
};

export default vibe;
export { color };

// Scalability utilities
export {
  clusterize,
  isPrimary,
  isWorker,
  getWorkerId,
  getWorkerCount,
} from "./utils/scaling/cluster.js";
export { LRUCache, cacheMiddleware } from "./utils/scaling/cache.js";
export { Pool, createPool } from "./utils/scaling/pool.js";
export { parseJsonStream } from "./utils/core/parser.js";
