export const mimeTypes = {
  // Text & Code
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".txt": "text/plain",
  ".xml": "application/xml",

  // Images
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",

  // Fonts
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",

  // Documents
  ".pdf": "application/pdf",
  ".csv": "text/csv",

  // Audio & Video
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",

  // Binary / Default
  ".bin": "application/octet-stream",
};

/**
 * Helper to get content type by filename
 * @param {string} filename
 * @returns {string}
 */
export function getContentType(filename) {
  // Extract extension (e.g. "style.css" -> ".css")
  const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}
