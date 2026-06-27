import busboy from "busboy";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { EventEmitter } from "events";

/**
 * Default streaming threshold (1MB)
 */
const DEFAULT_STREAM_THRESHOLD = 1024 * 1024;

/**
 * Parses incoming request bodies.
 * Supports JSON and multipart/form-data (file uploads).
 *
 * Streaming mode: For large files, emits events instead of buffering:
 * - req.emit("file", fieldName, stream, info) for each file
 *
 * @param {import("../vibe.js").VibeRequest} req - Incoming request
 * @param {import("../vibe.js").VibeResponse} res - Response object
 * @param {import("../vibe.js").MediaOptions} [media={}] - Route-specific file config
 * @param {import("../vibe.js").VibeConfig} [options={}] - Global framework config
 * @returns {Promise<void>} Resolves when parsing completes
 */
export default function bodyParser(req, res, media = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"];
    if (!contentType) return resolve();

    req.body ||= {};
    req.files ||= [];

    /* ---------- Multipart / File Uploads ---------- */
    if (contentType.includes("multipart/form-data")) {
      // SECURITY: Only allow file uploads if media config is explicitly set
      // This prevents attackers from uploading files to routes that don't expect them
      if (!media || Object.keys(media).length === 0) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Bad Request",
            message: "File uploads not allowed on this route",
          }),
        );
        return reject(
          new Error("File upload attempted without media configuration"),
        );
      }
      parseMultipart(req, res, media, options, resolve, reject);
      return;
    }

    /* ---------- JSON ---------- */
    if (contentType.includes("application/json")) {
      parseJson(req, res, media, options, resolve, reject);
      return;
    }

    // Other content-types are ignored
    resolve();
  });
}

/**
 * Parse multipart/form-data with optional streaming support
 */
function parseMultipart(req, res, media, options, resolve, reject) {
  let bb;
  let fileError = null;
  const streaming = media.streaming === true;
  let pendingWrites = 0;
  let busboyFinished = false;
  let alreadyRejected = false;

  // Helper to reject immediately (for errors that shouldn't wait)
  const rejectNow = (err) => {
    if (alreadyRejected) return;
    alreadyRejected = true;
    // Unpipe to stop processing more data
    req.unpipe(bb);
    // Drain the request to prevent hanging
    req.resume();
    reject(err);
  };

  // Helper to check if we're done (for normal completion)
  const checkComplete = () => {
    if (alreadyRejected) return;
    if (busboyFinished && pendingWrites === 0) {
      if (fileError) {
        reject(fileError);
      } else {
        resolve();
      }
    }
  };

  try {
    bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: media.maxSize || 10 * 1024 * 1024,
      },
    });
  } catch (err) {
    options.logger?.error(err, "[VIBE] Busboy init failed");
    return resolve();
  }

  bb.on("field", (name, value) => {
    req.body[name] = value;
  });

  bb.on("file", (name, file, info) => {
    const { filename, mimeType } = info;
    if (!filename) return file.resume();

    // File type validation - support wildcards like "image/*"
    if (media.allowedTypes && Array.isArray(media.allowedTypes)) {
      const isAllowed = media.allowedTypes.some((allowed) => {
        if (allowed.endsWith("/*")) {
          return mimeType.startsWith(allowed.slice(0, -1));
        }
        return allowed === mimeType;
      });
      if (!isAllowed) {
        file.resume();
        return rejectNow(
          new Error(
            `File type '${mimeType}' not allowed. Allowed: ${media.allowedTypes.join(", ")}`,
          ),
        );
      }
    }

    // STREAMING MODE: Emit file event, let handler deal with it
    if (streaming) {
      req.emit("file", name, file, { filename, mimeType });
      return;
    }

    // BUFFERING MODE: Write to disk
    pendingWrites++;

    const parent = media.public ? options.publicFolder || "" : "";
    const dest = path.resolve(
      path.join(parent, media.dest || (media.public ? "uploads" : "private")),
    );

    // Prevent path traversal
    if (
      media.public &&
      !dest.startsWith(path.resolve(options.publicFolder || ""))
    ) {
      options.logger?.warn(
        { dest, publicFolder: options.publicFolder },
        "[VIBE] Attempted upload outside public folder, skipping",
      );
      pendingWrites--;
      checkComplete();
      return file.resume();
    }

    try {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    } catch (err) {
      options.logger?.error(err, "[VIBE] Failed to create upload folder");
      pendingWrites--;
      checkComplete();
      return file.resume();
    }

    const ext =
      path.extname(filename) ||
      (mimeType?.includes("/") ? "." + mimeType.split("/")[1] : "");

    const safeName = `${path.basename(filename, ext)}-${crypto
      .randomBytes(3)
      .toString("hex")}${ext}`;
    const filePath = path.join(dest, safeName);

    const writeStream = fs.createWriteStream(filePath);
    let size = 0;
    let truncated = false;

    file.on("data", (d) => (size += d.length));

    // Handle file size limit exceeded
    file.on("limit", () => {
      truncated = true;
      const err = new Error(
        `File '${filename}' exceeds max size of ${media.maxSize || 10 * 1024 * 1024} bytes`,
      );
      file.unpipe(writeStream);
      writeStream.end();
      file.resume();
      // Clean up partial file and reject immediately
      fs.unlink(filePath, () => {
        pendingWrites--;
      });
      // Reject NOW - don't wait for busboy to finish
      rejectNow(err);
    });

    file.on("error", (err) => {
      options.logger?.error(err, "[VIBE] File stream error");
      writeStream.end();
      pendingWrites--;
      checkComplete();
    });

    writeStream.on("error", (err) => {
      options.logger?.error(err, "[VIBE] Write stream error");
      file.resume();
      pendingWrites--;
      checkComplete();
    });

    writeStream.on("finish", () => {
      if (!truncated) {
        req.files.push({
          filename: safeName,
          originalName: filename,
          type: mimeType,
          filePath,
          size,
        });
      }
      pendingWrites--;
      checkComplete();
    });

    file.pipe(writeStream);
  });

  bb.on("error", (err) => {
    options.logger?.error(err, "[VIBE] Busboy error");
    req.unpipe(bb);
    reject(err);
  });

  bb.on("finish", () => {
    busboyFinished = true;
    checkComplete();
  });

  req.pipe(bb);
}

/**
 * Parse JSON body with streaming support for large payloads
 */
function parseJson(req, res, media, options, resolve, reject) {
  const limit = options.maxJsonSize || 1e6;
  const streamThreshold = media?.streamThreshold || DEFAULT_STREAM_THRESHOLD;
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);

  // STREAMING MODE: For very large JSON, let handler process incrementally
  if (media?.streaming && contentLength > streamThreshold) {
    req.body = null; // Signal that body should be consumed via stream
    req.emit("jsonStream", req);
    resolve();
    return;
  }

  // BUFFERING MODE: Collect and parse
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > limit) {
      options.logger?.warn(
        { limit, received: body.length },
        "[VIBE] JSON payload too large, destroying connection",
      );
      req.destroy();
    }
  });

  req.on("end", () => {
    try {
      req.body = JSON.parse(body || "{}");
    } catch {
      req.body = {};
    }
    resolve();
  });
}

/**
 * Stream JSON parser helper
 * Use with streaming mode to parse large JSON incrementally
 *
 * @param {NodeJS.ReadableStream} stream
 * @returns {Promise<any>}
 */
export async function parseJsonStream(stream) {
  return new Promise((resolve, reject) => {
    let body = "";
    stream.on("data", (chunk) => (body += chunk));
    stream.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    stream.on("error", reject);
  });
}
