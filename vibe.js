import server from "./utils/server.js";
import { adapt } from "./utils/adapt.js";
import { PathToRegex } from "./utils/handler.js";

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
 *
 * Returning a value implicitly sends a response.
 *
 * @typedef {(req: VibeRequest, res: VibeResponse) => any | Promise<any>} Handler
 */

/**
 * Middleware / interceptor function.
 * Returning or resolving to `false` stops execution.
 *
 * @typedef {(req: VibeRequest, res: VibeResponse) => boolean | void | Promise<boolean | void>} Interceptor
 */

/**
 * File upload configuration for a route.
 *
 * @typedef {Object} MediaOptions
 * @property {boolean} [public=true]  Save file under public folder
 * @property {string|null} [dest]     Subfolder inside public or root
 * @property {number} [maxSize]       Max file size in bytes
 */

/**
 * Additional route configuration.
 *
 * @typedef {Object} RouteOptions
 * @property {Interceptor | Interceptor[]} [intercept]
 * @property {MediaOptions} [media]
 */

/**
 * Internal route representation.
 *
 * @typedef {Object} VibeRoute
 * @property {string} method
 * @property {string} path
 * @property {RegExp} pathRegex
 * @property {string[]} paramKeys
 * @property {Handler | string | number | object} handler
 * @property {Interceptor | Interceptor[] | null} intercept
 * @property {MediaOptions} media
 */

/**
 * Internal framework configuration.
 *
 * @typedef {Object} VibeConfig
 * @property {VibeRoute[]} routes
 * @property {string} publicFolder
 * @property {Interceptor[]} interceps
 */

/**
 * Route registration signatures.
 *
 * @typedef {(path: string, handler: Handler | any) => void} SimpleRoute
 * @typedef {(path: string, options: RouteOptions, handler: Handler) => void} OptionsRoute
 */

/**
 * Router interface exposed to users.
 *
 * @typedef {Object} RouterAPI
 * @property {SimpleRoute & OptionsRoute} get
 * @property {SimpleRoute & OptionsRoute} post
 * @property {SimpleRoute & OptionsRoute} put
 * @property {SimpleRoute & OptionsRoute} del
 * @property {SimpleRoute & OptionsRoute} patch
 * @property {SimpleRoute & OptionsRoute} head
 * @property {(fn: Interceptor) => void} plugin
 * @property {(value: any) => void} log
 */

/**
 * Initializes a Vibe application instance.
 *
 * @returns {{
 *   get: RouterAPI["get"],
 *   post: RouterAPI["post"],
 *   put: RouterAPI["put"],
 *   del: RouterAPI["del"],
 *   patch: RouterAPI["patch"],
 *   head: RouterAPI["head"],
 *   listen: (port: number, host?: string) => void,
 *   include: (prefix: string | ((router: RouterAPI) => void), fn?: (router: RouterAPI) => void) => void,
 *   plugin: (fn: Interceptor) => void,
 *   setPublicFolder: (folder: string) => void,
 *   logRoutes: () => void,
 *   log: (value: any) => void
 * }}
 */
const vibe = () => {
  /** @type {VibeConfig} */
  const options = {
    routes: [
      {
        method: "GET",
        path: "/",
        handler: (req, res) => res.sendHtml("vibe.html"), // Default landing
        pathRegex: /^\/$/,
        paramKeys: [],
        intercept: null,
        media: {
          public: true,
          dest: null,
          maxSize: 10 * 1024 * 1024
        },
      },
    ],
    publicFolder: "public",
    interceps: [],
  };

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
    /** @type {VibeRoute} */
    const route = {
      method,
      path,
      pathRegex: null,
      paramKeys: [],
      handler: null,
      intercept: null,
      media: {
        public: true,
        dest: null,
        maxSize: 10 * 1024 * 1024
      },
    };

    if (path === "/") {
      log("registering the / path");
      // Special handling for overriding default route...
      if (handler !== undefined) {
        if (typeof opts !== "object" || Array.isArray(opts)) {
          throw new Error("Options must be an object when using 3-arg form");
        }
        options.routes[0].intercept = opts.intercept;
        options.routes[0].media.dest = opts.media?.dest;
        options.routes[0].media.public = opts.media?.public === undefined ? true : opts.media.public;
        options.routes[0].media.maxSize = opts.media?.maxSize || 10 * 1024 * 1024;
        options.routes[0].handler = handler;
      } else {
        options.routes[0].handler = opts;
      }
      const { paramKeys } = PathToRegex(path);
      options.routes[0].paramKeys = paramKeys;
      return;
    }

    if (handler !== undefined) {
      if (typeof opts !== "object" || Array.isArray(opts)) {
        throw new Error("Options must be an object when using 3-arg form");
      }
      route.intercept = opts.intercept;
      route.media.dest = opts.media?.dest;
      route.media.public = opts.media.public === undefined ? true : opts.media.public;
      route.media.maxSize = opts.media?.maxSize || 10 * 1024 * 1024;
      route.handler = handler;
    } else {
      route.handler = opts;
    }

    const { pathRegex, paramKeys } = PathToRegex(path);
    route.pathRegex = pathRegex;
    route.paramKeys = paramKeys;

    options.routes.push(route);
  }

  /**
   * Starts the HTTP server
   * @param {number} port - The port to listen on
   * @param {string} [host] - Optional host (e.g. '0.0.0.0')
   */
  function listen(port, host) {
    addStatic();
    server(options, Number(port), host);
  }

  /**
   * Groups routes or includes a sub-router
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
   * Helper to generate a sub-router API with a prefix
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
   * Registers a global middleware
   * @param {Interceptor} interceps 
   */
  function plugin(interceps) {
    options.interceps.push(adapt(interceps));
  }

  function logRoutes() {
    const routes = options.routes.map((route) => route.path);
    console.log(routes);
  }

  const log = (value) => console.log(value);

  const setPublicFolder = (foldername) =>
    (options.publicFolder = foldername || "public");

  function addStatic() {
    // Static file serving logic...
    const routePath = `/${options.publicFolder}/*`;
    const { pathRegex, paramKeys } = PathToRegex(routePath);
    options.routes.push({
      method: "GET",
      path: routePath,
      handler: (req, res) => {
        try {
          log(req.url);
          const filePath = req.url.split("/").filter(Boolean).slice(1).join("/");
          res.sendFile(filePath);
        } catch (error) {
          log(error.message);
          if (error.message === "Not Found") {
            res.status(404).send("Not Found");
          }
        }
      },
      pathRegex,
      paramKeys,
      intercept: null, // Fixed typo in original code
      media: { public: true, dest: null } // Added missing prop
    });
  }

  return {
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
    plugin, // Added to return object
  };
};

export default vibe;