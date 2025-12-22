import fs from "fs";
import path from "path";
import { mimeTypes } from "./mime.js";

/**
 * Extends the native ServerResponse with helper methods.
 *
 * @param {import("http").ServerResponse} res
 * @param {Object} options
 * @param {string} options.publicFolder
 */
export default function responseMethods(res, options) {
  /**
   * Sends a response.
   * Objects are sent as JSON, primitives as text.
   *
   * @param {any} data
   */
  res.send = (data) => {
    if (typeof data === "undefined") {
      throw new Error("Response data is not a sendable data type");
    }

    if (typeof data === "object") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
      return;
    }

    res.setHeader("Content-Type", "text/plain");
    res.end(String(data));
  };

  /**
   * Sends a JSON response.
   *
   * @param {Object} data
   */
  res.json = (data) => res.send(data);

  /**
   * Sets HTTP status code.
   *
   * @param {number} code
   * @returns {import("http").ServerResponse}
   */
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  /**
   * Sends an HTML file from the public directory.
   *
   * @param {string} filename
   */
  /**
   * Safely send an HTML file from the public folder.
   * Prevents path traversal attacks.
   * @param {string} filename
   */
  res.sendHtml = (filename) => {
    if (!options.publicFolder) throw new Error("No Public folder set");

    // Resolve absolute path
    const resolvedPath = path.resolve(options.publicFolder, filename);

    // Ensure file is inside public folder
    if (!resolvedPath.startsWith(path.resolve(options.publicFolder))) {
      res.statusCode = 403;
      return res.end("Forbidden");
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      res.statusCode = 404;
      return res.end("Not Found");
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(resolvedPath).pipe(res);
  };

  /**
   * Safely send any static file from the public folder.
   * Prevents path traversal attacks.
   * @param {string} filePath
   */
  res.sendFile = (filePath) => {
    if (!options.publicFolder) throw new Error("No Public folder set");

    const resolvedPath = path.resolve(options.publicFolder, filePath);

    // Ensure file is inside public folder
    if (!resolvedPath.startsWith(path.resolve(options.publicFolder))) {
      res.statusCode = 403;
      return res.end("Forbidden");
    }

    if (!fs.existsSync(resolvedPath)) {
      res.statusCode = 404;
      return res.end("Not Found");
    }

    const ext = path.extname(resolvedPath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
    });

    fs.createReadStream(resolvedPath).pipe(res);
  };

  /**
   * Sends a 200 OK success response.
   *
   * @param {any} data
   * @param {string} message
   */
  res.success = (data = null, message = "Success") => {
    res.status(200).send({
      success: true,
      message,
      data,
    });
  };

  /**
   * Sends a 201 Created response.
   *
   * @param {any} data
   * @param {string} message
   */
  res.created = (data = null, message = "Resource created") => {
    res.status(201).send({
      success: true,
      message,
      data,
    });
  };

  /**
   * Sends a 400 Bad Request response.
   *
   * @param {string} message
   * @param {any} errors
   */
  res.badRequest = (message = "Bad Request", errors = null) => {
    res.status(400).send({
      success: false,
      message,
      errors,
    });
  };

  /**
   * Sends a 401 Unauthorized response.
   *
   * @param {string} message
   */
  res.unauthorized = (message = "Unauthorized") => {
    res.status(401).send({
      success: false,
      message,
    });
  };

  /**
   * Sends a 403 Forbidden response.
   *
   * @param {string} message
   */
  res.forbidden = (message = "Forbidden") => {
    res.status(403).send({
      success: false,
      message,
    });
  };

  /**
   * Sends a 404 Not Found response.
   *
   * @param {string} message
   */
  res.notFound = (message = "Resource not found") => {
    res.status(404).send({
      success: false,
      message,
    });
  };

  /**
   * Sends a 409 Conflict response.
   *
   * @param {string} message
   */
  res.conflict = (message = "Conflict") => {
    res.status(409).send({
      success: false,
      message,
    });
  };

  /**
   * Sends a 500 Internal Server Error response.
   *
   * @param {Error} error
   */
  res.serverError = (error) => {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Internal Server Error",
    });
  };

  /**
   * Redirects the client to another URL.
   *
   * @param {string} url
   * @param {number} [status=302]
   */
  res.redirect = (url, status = 302) => {
    res.statusCode = status;
    res.setHeader("Location", url);
    res.end();
  };
}
