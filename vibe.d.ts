// vibe.d.ts

/// <reference types="node" />

import { IncomingMessage, ServerResponse } from "http";

// ==========================================
// Core Data Structures
// ==========================================

/**
 * Represents a file uploaded via multipart/form-data.
 */
export interface UploadedFile {
  /** The name of the file as saved on disk (e.g., "image-a7x92b.png") */
  filename: string;
  /** The original name of the uploaded file */
  originalName?: string;
  /** MIME type of the file (e.g., "image/png") */
  type: string;
  /** Absolute or relative path to the file on disk */
  filePath: string;
  /** File size in bytes */
  size: number;
}

/**
 * Configuration for file uploads on a specific route.
 *
 * @example
 * {
 *   dest: "uploads",
 *   maxSize: 5 * 1024 * 1024,  // 5MB
 *   allowedTypes: ["image/jpeg", "image/png"],
 *   public: true
 * }
 */
export interface MediaOptions {
  /** Save file inside the configured public folder. Default: true */
  public?: boolean;
  /** Subfolder destination for uploads (e.g., "uploads/avatars") */
  dest?: string;
  /** Maximum allowed file size in bytes. Default: 10 MB (10485760) */
  maxSize?: number;
  /**
   * Allowed MIME types. Supports wildcards like "image/*"
   * @example ["image/jpeg", "image/png", "application/pdf"]
   */
  allowedTypes?: string[];
  /** Enable streaming mode for large files. Use req.on('file', ...) */
  streaming?: boolean;
}

/**
 * JSON Schema property definition for schema-based serialization.
 */
export interface JsonSchemaProperty {
  /** The type of the property */
  type:
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "object"
    | "array"
    | "null";
  /** Nested properties (for type: "object") */
  properties?: Record<string, JsonSchemaProperty>;
  /** Item schema (for type: "array") */
  items?: JsonSchemaProperty;
}

/**
 * JSON Schema definition for response serialization.
 *
 * @example
 * {
 *   type: "object",
 *   properties: {
 *     id: { type: "number" },
 *     name: { type: "string" },
 *     active: { type: "boolean" }
 *   }
 * }
 */
export interface JsonSchema extends JsonSchemaProperty {
  type: "object" | "array";
}

/**
 * Schema options for a route.
 * Used for pre-compiled response serialization (2-3x faster than JSON.stringify).
 *
 * @example
 * {
 *   response: {
 *     type: "object",
 *     properties: {
 *       id: { type: "number" },
 *       name: { type: "string" }
 *     }
 *   }
 * }
 */
export interface SchemaOptions {
  /** Response schema for pre-compiled JSON serialization */
  response?: JsonSchema;
}

/**
 * Options for registering a route.
 *
 * @example
 * // With interceptor only
 * { intercept: authMiddleware }
 *
 * @example
 * // With file upload
 * {
 *   intercept: authMiddleware,
 *   media: {
 *     dest: "uploads",
 *     maxSize: 10 * 1024 * 1024,
 *     allowedTypes: ["image/*"]
 *   }
 * }
 */
export interface RouteOptions {
  /**
   * Middleware function(s) to run before the handler.
   * Return false to stop execution.
   * @example
   * intercept: (req, res) => {
   *   if (!req.headers.authorization) {
   *     res.unauthorized();
   *     return false;
   *   }
   *   return true;
   * }
   */
  intercept?: Interceptor | Interceptor[];
  /**
   * Configuration for file uploads (multipart/form-data).
   * Files will be available in req.files array.
   */
  media?: MediaOptions;
  /**
   * JSON Schema for pre-compiled response serialization.
   * Generates a zero-overhead serializer at route registration time.
   *
   * @example
   * schema: {
   *   response: {
   *     type: "object",
   *     properties: {
   *       id: { type: "number" },
   *       name: { type: "string" }
   *     }
   *   }
   * }
   */
  schema?: SchemaOptions;
}

/**
 * Options for registering a plugin.
 */
export interface RegisterOptions {
  /** Route prefix for all routes defined in this plugin */
  prefix?: string;
  /** Additional options passed to the plugin */
  [key: string]: any;
}

// ==========================================
// Logging System
// ==========================================

export interface LoggerConfig {
  /** If true, automatically logs request lifecycle hooks (Incoming Request, Request Completed) */
  lifecycle?: boolean;
  /** If true, formats JSON output into human-readable Vibe-styled terminal lines (like pino-pretty) */
  prettyPrint?: boolean;
  /** Custom writable stream to output logs to (defaults to process.stdout) */
  stream?: NodeJS.WritableStream;
}

/**
 * Fastify/Pino-compatible structured logger API.
 *
 * All methods accept a message string OR a structured object (Pino-style).
 * An optional color string can be passed as the last argument — in prettyPrint
 * mode it will colorize the terminal output, in production mode it writes as
 * a plain JSON `{ color: "..." }` key for log pipelines.
 *
 * @example
 * req.log.info("Processing payment");
 * req.log.info({ userId: 42, amount: 100 }, "Payment initiated");
 * req.log.error(new Error("DB timeout"));
 * req.log.warn("Slow query detected", "yellow");  // color override
 */
export interface LoggerAPI {
  trace(obj: object | string | Error, msg?: string, color?: ColorName): void;
  debug(obj: object | string | Error, msg?: string, color?: ColorName): void;
  info(obj: object | string | Error, msg?: string, color?: ColorName): void;
  warn(obj: object | string | Error, msg?: string, color?: ColorName): void;
  error(obj: object | string | Error, msg?: string, color?: ColorName): void;
  fatal(obj: object | string | Error, msg?: string, color?: ColorName): void;
  /** Returns a child logger with merged bindings (e.g., { reqId }) */
  child(bindings: Record<string, any>): LoggerAPI;
}

export interface VibeConfig {
  /** Configuration for the native Vibe terminal logger */
  logger?: LoggerConfig | boolean;
}

// ==========================================
// Request & Response Extensions
// ==========================================

/**
 * Extended Vibe request object.
 */
export interface VibeRequest extends IncomingMessage {
  /** Route parameters extracted from the URL (e.g., `/users/:id`) */
  params: Record<string, string>;
  /** Query string parameters (e.g., `?page=2`) */
  query: Record<string, string>;
  /** Parsed body of the request */
  body: Record<string, any>;
  /** Uploaded files array (if multipart/form-data) */
  files?: UploadedFile[];
  /** Client IP address */
  ip?: string;
  /** Detailed client IP info */
  fullIp?: string;
  /** Automatically generated UUID for the request lifecycle */
  id: string;
  /** Context-bound logger automatically stamped with the req.id constraint */
  log: LoggerAPI;
  /** Custom properties added via decorateRequest */
  [key: string]: any;
}

/**
 * Extended Vibe response object.
 */
export interface VibeResponse extends ServerResponse {
  json: (data: any) => void;
  send: (data: string | number | boolean | object) => void;
  status: (code: number) => VibeResponse;
  /** Send a file from the public folder */
  sendFile: (filePath: string) => void;
  /** Send any file by absolute path */
  sendAbsoluteFile: (
    absolutePath: string,
    opts?: { download?: boolean; filename?: string },
  ) => void;
  sendHtml: (filename: string) => void;
  redirect: (url: string, code?: number) => void;

  /** Sends a 200 OK response with a success message */
  success: (data?: any, message?: string) => void;
  /** Sends a 201 Created response */
  created: (data?: any, message?: string) => void;
  /** Sends a 400 Bad Request response with optional validation errors */
  badRequest: (message?: string, errors?: any) => void;
  /** Sends a 401 Unauthorized response */
  unauthorized: (message?: string) => void;
  /** Sends a 403 Forbidden response */
  forbidden: (message?: string) => void;
  /** Sends a 404 Not Found response */
  notFound: (message?: string) => void;
  /** Sends a 409 Conflict response */
  conflict: (message?: string) => void;
  /** Sends a 500 Internal Server Error response */
  serverError: (error?: any) => void;
  /** Custom properties added via decorateReply */
  [key: string]: any;
}

// ==========================================
// Handlers & Interceptors
// ==========================================

/** Route handler function */
export type Handler = (
  req: VibeRequest,
  res: VibeResponse,
) => void | Promise<void> | object | string | number;

/** Middleware/interceptor function */
export type Interceptor = (
  req: VibeRequest,
  res: VibeResponse,
) => boolean | void | Promise<boolean | void>;

/** Plugin callback function (Fastify-style) */
export type PluginCallback = (
  app: VibeApp,
  opts: RegisterOptions,
) => void | Promise<void>;

// ==========================================
// Colors Utility
// ==========================================

export type ColorName =
  | "reset"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "cyan"
  | "dim"
  | "magenta"
  | "black"
  | "gray"
  | "redBright"
  | "greenBright"
  | "yellowBright"
  | "blueBright"
  | "cyanBright"
  | "whiteBright"
  | "magentaBright"
  | "bright";

export const color: Record<ColorName, (text: string) => string>;

// ==========================================
// Router & App Interfaces
// ==========================================

/**
 * Route registration function.
 *
 * @example
 * // Simple handler
 * app.get("/path", (req, res) => { ... });
 *
 * @example
 * // Static response
 * app.get("/", "Hello World");
 *
 * @example
 * // With options (interceptor + file upload)
 * app.post("/upload", {
 *   intercept: authMiddleware,
 *   media: {
 *     dest: "uploads",
 *     maxSize: 10 * 1024 * 1024,
 *     allowedTypes: ["image/*"]
 *   }
 * }, handler);
 */
export interface RouteRegistrar {
  /**
   * Register a route with a handler or static response.
   * @param path - Route path (e.g., "/users/:id")
   * @param handler - Handler function, string, number, or object
   */
  (path: string, handler: Handler | string | number | object): void;

  /**
   * Register a route with options and handler.
   * @param path - Route path (e.g., "/upload")
   * @param options - Route options (intercept, media)
   * @param handler - Handler function
   */
  (
    path: string,
    options: RouteOptions,
    handler: Handler | string | number | object,
  ): void;
}

/** Sub-router or prefixed router instance */
export interface RouterAPI {
  get: RouteRegistrar;
  post: RouteRegistrar;
  put: RouteRegistrar;
  del: RouteRegistrar;
  patch: RouteRegistrar;
  head: RouteRegistrar;

  /**
   * Log helper supporting native colors and Vibe-stylized log levels
   * @param value The message or object to log
   * @param typeOrColor Optional color name (e.g. 'green') or level ('info', 'warn', 'error', 'req')
   */
  log: (
    value: any,
    typeOrColor?: ColorName | "info" | "error" | "warn" | "req",
  ) => void;

  /** Register a global interceptor */
  plugin: (interceptor: Interceptor) => void;
}

/** Main Vibe application interface */
export interface VibeApp extends RouterAPI {
  /**
   * Start the HTTP server
   * @param port Port to listen on
   * @param host Optional host (e.g. '0.0.0.0' or 'localhost')
   * @param callback Optional callback when server starts
   */
  listen(port: number | string, host?: string, callback?: () => void): void;
  listen(port: number | string, callback?: () => void): void;

  /** Logs all registered routes */
  logRoutes: () => void;

  /** Configure folder for static files (default: "public") */
  setPublicFolder: (foldername: string) => void;

  /**
   * Register an encapsulated plugin (Fastify-style)
   * @param fn Plugin function that receives (app, opts)
   * @param opts Plugin options including optional route prefix
   */
  register: (fn: PluginCallback, opts?: RegisterOptions) => Promise<void>;

  /**
   * Decorate the app instance with a custom property
   * @param name Property name
   * @param value Property value
   */
  decorate: (name: string, value: any) => void;

  /**
   * Decorate request objects with a custom property
   * @param name Property name
   * @param value Property value or factory function
   */
  decorateRequest: (name: string, value: any) => void;

  /**
   * Decorate response objects with a custom property
   * @param name Property name
   * @param value Property value or factory function
   */
  decorateReply: (name: string, value: any) => void;

  /**
   * Group routes under prefix or include sub-router (legacy)
   */
  include: (
    prefixOrFunc: string | ((router: RouterAPI) => void),
    maybeFunc?: (router: RouterAPI) => void,
  ) => void;

  /**
   * Access app decorators
   * @type {Record<string, any>}
   */
  readonly decorators: Record<string, any>;

  /**
   * Override the default error handler (Fastify-style).
   * Called for any unhandled `throw`, `return new Error()`, or `res.send(error)`.
   * @example
   * app.setErrorHandler((error, req, res) => {
   *   req.log.error(error);
   *   res.status(503).json({ success: false, message: error.message });
   * });
   */
  setErrorHandler(
    fn: (error: Error, req: VibeRequest, res: VibeResponse) => void,
  ): void;

  /**
   * Pino/Fastify-compatible structured logger instance.
   * Use for application-level logging outside of routes.
   * @example
   * app.log.info({ db: "connected" }, "Server ready");
   * app.log.info("Server ready", "green"); // with color in prettyPrint mode
   */
  log: LoggerAPI;

  /** Alias for `app.log` */
  logger: LoggerAPI;
}

/**
 * Initialize a new Vibe application.
 * @param config Optional application configuration
 * @returns Vibe application instance
 */
export default function vibe(config?: VibeConfig): VibeApp;

// ==========================================
// LRU Cache
// ==========================================

export interface CacheOptions {
  /** Maximum number of entries. Default: 1000 */
  max?: number;
  /** Default TTL in milliseconds. Default: 60000 */
  ttl?: number;
}

export interface CacheEntry {
  value: any;
  expires: number;
  etag: string;
}

export class LRUCache {
  constructor(options?: CacheOptions);

  /** Generate cache key from request */
  static key(method: string, url: string): string;

  /** Generate ETag from value */
  static etag(value: any): string;

  /** Get value from cache */
  get(key: string): CacheEntry | null;

  /** Set value in cache */
  set(key: string, value: any, ttl?: number): CacheEntry;

  /** Delete entry from cache */
  delete(key: string): boolean;

  /** Clear all entries */
  clear(): void;

  /** Get cache size */
  readonly size: number;

  /** Check if key exists and is valid */
  has(key: string): boolean;
}

/**
 * Create cache middleware for route-level caching
 */
export function cacheMiddleware(cache: LRUCache): Interceptor;

// ==========================================
// Connection Pool
// ==========================================

export interface PoolOptions<T> {
  /** Async function to create a new resource */
  create: () => Promise<T>;
  /** Async function to destroy a resource */
  destroy: (resource: T) => Promise<void>;
  /** Function to validate a resource is still usable */
  validate?: (resource: T) => boolean;
  /** Minimum pool size. Default: 0 */
  min?: number;
  /** Maximum pool size. Default: 10 */
  max?: number;
  /** Timeout for acquiring resource (ms). Default: 30000 */
  acquireTimeout?: number;
  /** Time before idle resources are destroyed (ms). Default: 60000 */
  idleTimeout?: number;
}

export interface PoolStats {
  available: number;
  inUse: number;
  waiting: number;
  max: number;
}

export class Pool<T = any> {
  constructor(options: PoolOptions<T>);

  /** Acquire a resource from the pool */
  acquire(): Promise<T>;

  /** Release a resource back to the pool */
  release(resource: T): void;

  /** Execute function with acquired resource (auto-release) */
  use<R>(fn: (resource: T) => Promise<R> | R): Promise<R>;

  /** Close the pool and destroy all resources */
  close(): Promise<void>;

  /** Get pool statistics */
  readonly stats: PoolStats;
}

/**
 * Create a new connection pool
 */
export function createPool<T>(options: PoolOptions<T>): Pool<T>;

// ==========================================
// Cluster Mode
// ==========================================

export interface ClusterOptions {
  /** Number of worker processes. Default: CPU count */
  workers?: number;
  /** Auto-restart crashed workers. Default: true */
  restart?: boolean;
  /** Delay before restarting (ms). Default: 1000 */
  restartDelay?: number;
  /** Called when worker starts */
  onWorkerStart?: (worker: any) => void;
  /** Called when worker exits */
  onWorkerExit?: (worker: any, code: number, signal: string) => void;
}

/**
 * Start the application in cluster mode
 */
export function clusterize(startFn: () => void, options?: ClusterOptions): void;

/** Check if current process is the primary */
export function isPrimary(): boolean;

/** Check if current process is a worker */
export function isWorker(): boolean;

/** Get worker ID (0 for primary) */
export function getWorkerId(): number;

/** Get number of active workers */
export function getWorkerCount(): number;

// ==========================================
// Streaming Utilities
// ==========================================

/**
 * Parse JSON stream (line-delimited JSON)
 */
export function parseJsonStream(
  stream: NodeJS.ReadableStream,
  onData: (data: any) => void,
  onEnd?: () => void,
  onError?: (err: Error) => void,
): void;

// ==========================================
// Express Middleware Adapter
// ==========================================

/**
 * Adapt an Express-style middleware to work as a Vibe interceptor.
 * @param mw - Express middleware function (req, res, next)
 * @returns Vibe-compatible interceptor
 *
 * @example
 * import { adapt } from "vibe-gx";
 * import cors from "cors";
 * import cookieParser from "cookie-parser";
 *
 * app.plugin(adapt(cors()));
 * app.plugin(adapt(cookieParser()));
 */
export function adapt(
  mw: (req: any, res: any, next: (err?: any) => void) => void,
): Interceptor;

/**
 * Adapt multiple Express middlewares at once.
 * @param middlewares - Express middleware functions
 * @returns Array of Vibe-compatible interceptors
 */
export function adaptAll(
  ...middlewares: Array<(req: any, res: any, next: (err?: any) => void) => void>
): Interceptor[];
