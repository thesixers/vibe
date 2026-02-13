import fs from "fs";
import path from "path";
import { mimeTypes } from "../helpers/mime.js";

// Pre-allocated response templates (stringified once at startup)
const RESPONSES = {
  notFound: JSON.stringify({ success: false, message: "Resource not found" }),
  unauthorized: JSON.stringify({ success: false, message: "Unauthorized" }),
  forbidden: JSON.stringify({ success: false, message: "Forbidden" }),
  badRequest: JSON.stringify({ success: false, message: "Bad Request" }),
  conflict: JSON.stringify({ success: false, message: "Conflict" }),
  serverError: JSON.stringify({
    success: false,
    message: "Internal Server Error",
  }),
};

/**
 * Vibe response methods mixin.
 * These are added to ServerResponse.prototype ONCE at server startup,
 * avoiding per-request closure allocations.
 */
const vibeResponseMethods = {
  /**
   * Sends a response. Fast path for JSON objects.
   * @param {any} data
   */
  send(data) {
    if (data === undefined) {
      throw new Error("Response data is not a sendable data type");
    }

    if (typeof data === "object" && data !== null) {
      this.setHeader("Content-Type", "application/json");
      this.end(JSON.stringify(data));
      return;
    }

    this.setHeader("Content-Type", "text/plain");
    this.end(String(data));
  },

  /**
   * Sends a JSON response.
   * @param {Object} data
   */
  json(data) {
    this.setHeader("Content-Type", "application/json");
    this.end(JSON.stringify(data));
  },

  /**
   * Sets HTTP status code. Chainable.
   * @param {number} code
   * @returns {this}
   */
  status(code) {
    this.statusCode = code;
    return this;
  },

  /**
   * Safely send an HTML file from the public folder.
   * @param {string} filename
   */
  sendHtml(filename) {
    const publicFolder = this._vibeOptions.publicFolder;
    if (!publicFolder) throw new Error("No Public folder set");

    const resolvedPath = path.resolve(publicFolder, filename);

    if (!resolvedPath.startsWith(path.resolve(publicFolder))) {
      this.statusCode = 403;
      return this.end("Forbidden");
    }

    if (!fs.existsSync(resolvedPath)) {
      this.statusCode = 404;
      return this.end("Not Found");
    }

    this.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(resolvedPath).pipe(this);
  },

  /**
   * Safely send any static file from the public folder.
   * @param {string} filePath
   */
  sendFile(filePath) {
    const publicFolder = this._vibeOptions.publicFolder;
    if (!publicFolder) throw new Error("No Public folder set");

    const resolvedPath = path.resolve(publicFolder, filePath);

    if (!resolvedPath.startsWith(path.resolve(publicFolder))) {
      this.statusCode = 403;
      return this.end("Forbidden");
    }

    if (!fs.existsSync(resolvedPath)) {
      this.statusCode = 404;
      return this.end("Not Found");
    }

    const ext = path.extname(resolvedPath);
    this.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
    });

    fs.createReadStream(resolvedPath).pipe(this);
  },

  /**
   * Send any file from an absolute path (not restricted to public folder).
   * @param {string} absolutePath - Full path to the file
   * @param {object} [opts] - Options
   * @param {boolean} [opts.download=false] - Force download
   * @param {string} [opts.filename] - Custom filename for download
   */
  sendAbsoluteFile(absolutePath, opts = {}) {
    const resolvedPath = path.resolve(absolutePath);

    if (!fs.existsSync(resolvedPath)) {
      this.statusCode = 404;
      return this.end("Not Found");
    }

    const ext = path.extname(resolvedPath);
    const filename = opts.filename || path.basename(resolvedPath);
    const headers = {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
    };

    if (opts.download) {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }

    this.writeHead(200, headers);
    fs.createReadStream(resolvedPath).pipe(this);
  },

  /**
   * Sends a 200 OK success response.
   * @param {any} data
   * @param {string} message
   */
  success(data = null, message = "Success") {
    this.statusCode = 200;
    this.setHeader("Content-Type", "application/json");
    this.end(JSON.stringify({ success: true, message, data }));
  },

  /**
   * Sends a 201 Created response.
   * @param {any} data
   * @param {string} message
   */
  created(data = null, message = "Resource created") {
    this.statusCode = 201;
    this.setHeader("Content-Type", "application/json");
    this.end(JSON.stringify({ success: true, message, data }));
  },

  /**
   * Sends a 400 Bad Request response.
   * @param {string} message
   * @param {any} errors
   */
  badRequest(message = "Bad Request", errors = null) {
    this.statusCode = 400;
    this.setHeader("Content-Type", "application/json");
    this.end(
      errors
        ? JSON.stringify({ success: false, message, errors })
        : RESPONSES.badRequest,
    );
  },

  /**
   * Sends a 401 Unauthorized response.
   * @param {string} message
   */
  unauthorized(message) {
    this.statusCode = 401;
    this.setHeader("Content-Type", "application/json");
    this.end(
      message
        ? JSON.stringify({ success: false, message })
        : RESPONSES.unauthorized,
    );
  },

  /**
   * Sends a 403 Forbidden response.
   * @param {string} message
   */
  forbidden(message) {
    this.statusCode = 403;
    this.setHeader("Content-Type", "application/json");
    this.end(
      message
        ? JSON.stringify({ success: false, message })
        : RESPONSES.forbidden,
    );
  },

  /**
   * Sends a 404 Not Found response.
   * @param {string} message
   */
  notFound(message) {
    this.statusCode = 404;
    this.setHeader("Content-Type", "application/json");
    this.end(
      message
        ? JSON.stringify({ success: false, message })
        : RESPONSES.notFound,
    );
  },

  /**
   * Sends a 409 Conflict response.
   * @param {string} message
   */
  conflict(message) {
    this.statusCode = 409;
    this.setHeader("Content-Type", "application/json");
    this.end(
      message
        ? JSON.stringify({ success: false, message })
        : RESPONSES.conflict,
    );
  },

  /**
   * Sends a 500 Internal Server Error response.
   * @param {Error} error
   */
  serverError(error) {
    console.error(error);
    this.statusCode = 500;
    this.setHeader("Content-Type", "application/json");
    this.end(RESPONSES.serverError);
  },

  /**
   * Redirects the client to another URL.
   * @param {string} url
   * @param {number} [status=302]
   */
  redirect(url, status = 302) {
    this.statusCode = status;
    this.setHeader("Location", url);
    this.end();
  },
};

/**
 * Installs Vibe response methods onto the ServerResponse prototype.
 * Called ONCE at server startup — zero per-request cost.
 *
 * @param {typeof import("http").ServerResponse} ResponseProto
 */
export function installResponseMethods(ResponseProto) {
  const proto = ResponseProto.prototype;
  for (const [name, fn] of Object.entries(vibeResponseMethods)) {
    if (!(name in proto)) {
      proto[name] = fn;
    }
  }
}

/**
 * Stamps a single res object with the options ref.
 * This is the ONLY per-request work we need to do.
 *
 * @param {import("http").ServerResponse} res
 * @param {Object} options
 */
export function initResponse(res, options) {
  res._vibeOptions = options;
}

// Keep default export for backwards compatibility
export default function responseMethods(res, options) {
  initResponse(res, options);
}
