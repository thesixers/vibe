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
 */
export interface MediaOptions {
  /** Save file inside the configured public folder. Default: true */
  public?: boolean;
  /** Subfolder destination for uploads (e.g., "uploads/avatars") */
  dest?: string;
  /** Maximum allowed file size in bytes. Default: 10 MB */
  maxSize?: number;
  /** Allowed MIME types (e.g., ["image/png", "image/jpeg"]) */
  allowedTypes?: string[];
}

/**
 * Options for registering a route.
 */
export interface RouteOptions {
  /** Middleware(s) to run before the main handler */
  intercept?: Interceptor | Interceptor[];
  /** Configuration for file uploads */
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
  sendFile: (filePath: string) => void;
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
 * Supports two signatures:
 * 1. (path, handler)
 * 2. (path, options, handler)
 */
export interface RouteRegistrar {
  (path: string, handler: Handler | string | number | object): void;
  (path: string, options: RouteOptions, handler: Handler): void;
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
