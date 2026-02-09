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
   * Log helper
   * @param value The message to log
   * @param color Optional color name (e.g. 'green', 'red')
   */
  log: (value: any, color?: ColorName) => void;

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

  /** Access app decorators */
  readonly decorators: Record<string, any>;
}

/**
 * Initialize a new Vibe application.
 * @returns Vibe application instance
 */
export default function vibe(): VibeApp;

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
