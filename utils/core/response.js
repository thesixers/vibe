import fs from "fs";
import path from "path";
import { mimeTypes } from "../helpers/mime.js";

// Pre-computed headers for performance
const JSON_HEADERS = { "Content-Type": "application/json" };
const TEXT_HEADERS = { "Content-Type": "text/plain" };
const HTML_HEADERS = { "Content-Type": "text/html" };

// Pre-allocated response templates
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
 * Fast JSON stringify - handles common cases inline
 * @param {any} data
 * @returns {string}
 */
function fastStringify(data) {
  // Fast path for null/undefined
  if (data == null) return "null";

  const type = typeof data;

  // Fast path for primitives
  if (type === "string") return JSON.stringify(data);
  if (type === "number" || type === "boolean") return String(data);

  // Arrays and objects use native stringify (V8 optimized)
  return JSON.stringify(data);
}

/**
 * Extends the native ServerResponse with helper methods.
 * Optimized for performance with pre-computed headers and fast JSON.
 *
 * @param {import("http").ServerResponse} res
 * @param {Object} options
 * @param {string} options.publicFolder
 */
export default function responseMethods(res, options) {
  // Cache headers reference for faster access
  const setHeader = res.setHeader.bind(res);
  const endResponse = res.end.bind(res);

  /**
   * Sends a response. Optimized fast path for JSON.
   * @param {any} data
   */
  res.send = (data) => {
    if (data === undefined) {
      throw new Error("Response data is not a sendable data type");
    }

    if (typeof data === "object" && data !== null) {
      setHeader("Content-Type", "application/json");
      endResponse(fastStringify(data));
      return;
    }

    setHeader("Content-Type", "text/plain");
    endResponse(String(data));
  };

  /**
   * Sends a JSON response. Fast path.
   * @param {Object} data
   */
  res.json = (data) => {
    setHeader("Content-Type", "application/json");
    endResponse(fastStringify(data));
  };

  /**
   * Sets HTTP status code.
   * @param {number} code
   * @returns {import("http").ServerResponse}
   */
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  /**
   * Safely send an HTML file from the public folder.
   * @param {string} filename
   */
  res.sendHtml = (filename) => {
    if (!options.publicFolder) throw new Error("No Public folder set");

    const resolvedPath = path.resolve(options.publicFolder, filename);

    if (!resolvedPath.startsWith(path.resolve(options.publicFolder))) {
      res.statusCode = 403;
      return endResponse("Forbidden");
    }

    if (!fs.existsSync(resolvedPath)) {
      res.statusCode = 404;
      return endResponse("Not Found");
    }

    res.writeHead(200, HTML_HEADERS);
    fs.createReadStream(resolvedPath).pipe(res);
  };

  /**
   * Safely send any static file from the public folder.
   * @param {string} filePath
   */
  res.sendFile = (filePath) => {
    if (!options.publicFolder) throw new Error("No Public folder set");

    const resolvedPath = path.resolve(options.publicFolder, filePath);

    if (!resolvedPath.startsWith(path.resolve(options.publicFolder))) {
      res.statusCode = 403;
      return endResponse("Forbidden");
    }

    if (!fs.existsSync(resolvedPath)) {
      res.statusCode = 404;
      return endResponse("Not Found");
    }

    const ext = path.extname(resolvedPath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
    });

    fs.createReadStream(resolvedPath).pipe(res);
  };

  /**
   * Send any file from an absolute path (not restricted to public folder).
   * Use with caution - ensure you validate the path yourself.
   * @param {string} absolutePath - Full path to the file
   * @param {object} [opts] - Options
   * @param {boolean} [opts.download=false] - Force download with Content-Disposition
   * @param {string} [opts.filename] - Custom filename for download
   */
  res.sendAbsoluteFile = (absolutePath, opts = {}) => {
    const resolvedPath = path.resolve(absolutePath);

    if (!fs.existsSync(resolvedPath)) {
      res.statusCode = 404;
      return endResponse("Not Found");
    }

    const ext = path.extname(resolvedPath);
    const filename = opts.filename || path.basename(resolvedPath);
    const headers = {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
    };

    if (opts.download) {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }

    res.writeHead(200, headers);
    fs.createReadStream(resolvedPath).pipe(res);
  };

  /**
   * Sends a 200 OK success response.
   * @param {any} data
   * @param {string} message
   */
  res.success = (data = null, message = "Success") => {
    res.statusCode = 200;
    setHeader("Content-Type", "application/json");
    endResponse(fastStringify({ success: true, message, data }));
  };

  /**
   * Sends a 201 Created response.
   * @param {any} data
   * @param {string} message
   */
  res.created = (data = null, message = "Resource created") => {
    res.statusCode = 201;
    setHeader("Content-Type", "application/json");
    endResponse(fastStringify({ success: true, message, data }));
  };

  /**
   * Sends a 400 Bad Request response.
   * @param {string} message
   * @param {any} errors
   */
  res.badRequest = (message = "Bad Request", errors = null) => {
    res.statusCode = 400;
    setHeader("Content-Type", "application/json");
    endResponse(
      errors
        ? fastStringify({ success: false, message, errors })
        : RESPONSES.badRequest,
    );
  };

  /**
   * Sends a 401 Unauthorized response.
   * @param {string} message
   */
  res.unauthorized = (message) => {
    res.statusCode = 401;
    setHeader("Content-Type", "application/json");
    endResponse(
      message
        ? fastStringify({ success: false, message })
        : RESPONSES.unauthorized,
    );
  };

  /**
   * Sends a 403 Forbidden response.
   * @param {string} message
   */
  res.forbidden = (message) => {
    res.statusCode = 403;
    setHeader("Content-Type", "application/json");
    endResponse(
      message
        ? fastStringify({ success: false, message })
        : RESPONSES.forbidden,
    );
  };

  /**
   * Sends a 404 Not Found response.
   * @param {string} message
   */
  res.notFound = (message) => {
    res.statusCode = 404;
    setHeader("Content-Type", "application/json");
    endResponse(
      message ? fastStringify({ success: false, message }) : RESPONSES.notFound,
    );
  };

  /**
   * Sends a 409 Conflict response.
   * @param {string} message
   */
  res.conflict = (message) => {
    res.statusCode = 409;
    setHeader("Content-Type", "application/json");
    endResponse(
      message ? fastStringify({ success: false, message }) : RESPONSES.conflict,
    );
  };

  /**
   * Sends a 500 Internal Server Error response.
   * @param {Error} error
   */
  res.serverError = (error) => {
    console.error(error);
    res.statusCode = 500;
    setHeader("Content-Type", "application/json");
    endResponse(RESPONSES.serverError);
  };

  /**
   * Redirects the client to another URL.
   * @param {string} url
   * @param {number} [status=302]
   */
  res.redirect = (url, status = 302) => {
    res.statusCode = status;
    setHeader("Location", url);
    endResponse();
  };
}
