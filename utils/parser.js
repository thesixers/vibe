import busboy from "busboy";
import fs from "fs";
import crypto from "crypto";
import path from "path";

/**
 * Parses incoming request bodies.
 * Supports JSON and multipart/form-data (file uploads).
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
      let bb;

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

        // Determine upload folder
        const parent = media.public ? options.publicFolder || "" : "";
        const dest = path.resolve(path.join(parent, media.dest || (media.public ? "uploads" : "private")));

        // Prevent path traversal
        if (media.public && !dest.startsWith(path.resolve(options.publicFolder || ""))) {
          console.warn("Attempted upload outside public folder, skipping");
          return file.resume();
        }

        try {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        } catch (err) {
          console.error("Failed to create upload folder:", err);
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

        file.on("data", (d) => (size += d.length));

        file.on("error", (err) => {
          console.error("File stream error:", err);
          writeStream.end();
        });

        writeStream.on("error", (err) => {
          console.error("Write stream error:", err);
          file.resume();
        });

        writeStream.on("finish", () => {
          req.files.push({
            filename: safeName,
            originalName: filename,
            type: mimeType,
            filePath,
            size,
          });
        });

        file.pipe(writeStream);
      });

      bb.on("error", (err) => {
        console.error("Busboy error:", err);
        reject(err);
      });

      bb.on("finish", resolve);

      req.pipe(bb);
      return;
    }

    /* ---------- JSON ---------- */
    if (contentType.includes("application/json")) {
      let body = "";
      const limit = options.maxJsonSize || 1e6;

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

      return;
    }

    // Other content-types are ignored
    resolve();
  });
}
