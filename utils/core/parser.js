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

  // Helper to check if we're done
  const checkComplete = () => {
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
    console.error("Busboy init failed:", err);
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
        fileError = new Error(
          `File type '${mimeType}' not allowed. Allowed: ${media.allowedTypes.join(", ")}`,
        );
        return file.resume();
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
      console.warn("Attempted upload outside public folder, skipping");
      pendingWrites--;
      checkComplete();
      return file.resume();
    }

    try {
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    } catch (err) {
      console.error("Failed to create upload folder:", err);
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
      fileError = new Error(
        `File '${filename}' exceeds max size of ${media.maxSize || 10 * 1024 * 1024} bytes`,
      );
      file.unpipe(writeStream);
      writeStream.end();
      // Clean up partial file
      fs.unlink(filePath, () => {
        pendingWrites--;
        checkComplete();
      });
    });

    file.on("error", (err) => {
      console.error("File stream error:", err);
      writeStream.end();
      pendingWrites--;
      checkComplete();
    });

    writeStream.on("error", (err) => {
      console.error("Write stream error:", err);
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
    console.error("Busboy error:", err);
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
  const streamThreshold = media.streamThreshold || DEFAULT_STREAM_THRESHOLD;
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);

  // STREAMING MODE: For very large JSON, let handler process incrementally
  if (media.streaming && contentLength > streamThreshold) {
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
      console.warn("JSON payload too large, destroying connection");
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
