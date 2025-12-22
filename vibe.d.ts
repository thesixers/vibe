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
  originalName: string;
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
}

/**
 * Extended Vibe response object.
 */
// vibe.d.ts (partial update for VibeResponse)

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
}


// ==========================================
// Handlers & Interceptors
// ==========================================

/** Route handler function */
export type Handler = (
  req: VibeRequest,
  res: VibeResponse
) => void | Promise<void> | object | string | number;

/** Middleware/interceptor function */
export type Interceptor = (
  req: VibeRequest,
  res: VibeResponse
) => void | Promise<void>;

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
  (path: string, handler: Handler): void;
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
  /** Log helper */
  log: (value: any) => void;
  /** Register a plugin/middleware */
  plugin: (interceptor: Interceptor) => void;
}

/** Main Vibe application interface */
export interface VibeApp {
  get: RouteRegistrar;
  post: RouteRegistrar;
  put: RouteRegistrar;
  del: RouteRegistrar;
  patch: RouteRegistrar;
  head: RouteRegistrar;

  /** Start the HTTP server */
  listen: (port: number, host?: string) => void;

  /** Logs all registered routes */
  logRoutes: () => void;

  /** Internal logger */
  log: (value: any) => void;

  /** Configure folder for static files (default: "public") */
  setPublicFolder: (foldername: string) => void;

  /** Register global middleware */
  plugin: (interceptor: Interceptor) => void;

  /** Group routes under prefix or include sub-router */
  include: (
    prefixOrFunc: string | ((router: RouterAPI) => void),
    maybeFunc?: (router: RouterAPI) => void
  ) => void;
}

/**
 * Initialize a new Vibe application.
 * @returns Vibe application instance
 */
export default function vibe(): VibeApp;
