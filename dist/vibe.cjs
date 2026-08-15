var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// vibe.js
var vibe_exports = {};
__export(vibe_exports, {
  LRUCache: () => LRUCache,
  Pool: () => Pool,
  adapt: () => adapt,
  cacheMiddleware: () => cacheMiddleware,
  clusterize: () => clusterize,
  color: () => color,
  cors: () => cors,
  createPool: () => createPool,
  default: () => vibe_default,
  getWorkerCount: () => getWorkerCount,
  getWorkerId: () => getWorkerId,
  isPrimary: () => isPrimary,
  isWorker: () => isWorker,
  parseJsonStream: () => parseJsonStream,
  rateLimit: () => rateLimit
});
module.exports = __toCommonJS(vibe_exports);

// utils/core/server.js
var import_http = __toESM(require("http"), 1);

// utils/core/handler.js
var import_os = __toESM(require("os"), 1);

// utils/helpers/colors.js
var codes = {
  reset: "\x1B[0m",
  bright: "\x1B[1m",
  dim: "\x1B[2m",
  red: "\x1B[31m",
  green: "\x1B[32m",
  yellow: "\x1B[33m",
  blue: "\x1B[34m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  magenta: "\x1B[35m",
  black: "\x1B[30m",
  gray: "\x1B[90m",
  redBright: "\x1B[91m",
  greenBright: "\x1B[92m",
  yellowBright: "\x1B[93m",
  blueBright: "\x1B[94m",
  cyanBright: "\x1B[96m",
  whiteBright: "\x1B[97m",
  magentaBright: "\x1B[95m"
};
var color = {
  red: (text) => `${codes.red}${text}${codes.reset}`,
  green: (text) => `${codes.green}${text}${codes.reset}`,
  yellow: (text) => `${codes.yellow}${text}${codes.reset}`,
  blue: (text) => `${codes.blue}${text}${codes.reset}`,
  cyan: (text) => `${codes.cyan}${text}${codes.reset}`,
  dim: (text) => `${codes.dim}${text}${codes.reset}`,
  reset: (text) => `${codes.reset}${text}${codes.reset}`,
  magenta: (text) => `${codes.magenta}${text}${codes.reset}`,
  black: (text) => `${codes.black}${text}${codes.reset}`,
  gray: (text) => `${codes.gray}${text}${codes.reset}`,
  redBright: (text) => `${codes.redBright}${text}${codes.reset}`,
  greenBright: (text) => `${codes.greenBright}${text}${codes.reset}`,
  yellowBright: (text) => `${codes.yellowBright}${text}${codes.reset}`,
  blueBright: (text) => `${codes.blueBright}${text}${codes.reset}`,
  cyanBright: (text) => `${codes.cyanBright}${text}${codes.reset}`,
  whiteBright: (text) => `${codes.whiteBright}${text}${codes.reset}`,
  magentaBright: (text) => `${codes.magentaBright}${text}${codes.reset}`,
  bright: (text) => `${codes.bright}${text}${codes.reset}`
};

// utils/core/handler.js
function PathToRegex(path3) {
  const pathSegments = path3.split("/").filter(Boolean);
  const paramKeys = [];
  if (pathSegments.length === 0) {
    return { pathRegex: /^\/$/, paramKeys: [] };
  }
  let pathRegex = "^";
  for (let index = 0; index < pathSegments.length; index++) {
    const segment = pathSegments[index];
    if (segment.startsWith(":")) {
      paramKeys.push(segment.slice(1));
      pathRegex += `/(?<${segment.slice(1)}>[^/]+)`;
      continue;
    }
    if (segment === "*") {
      pathRegex += "/(.*)";
      continue;
    }
    pathRegex += `/${segment}`;
  }
  pathRegex += "$";
  pathRegex = new RegExp(pathRegex);
  return { pathRegex, paramKeys };
}
function isSendAble(value) {
  return value !== null && typeof value === "object" || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
function handleError(error2, req, res) {
  const isDev = process.env.NODE_ENV !== "production";
  const message = error2.message || "Unknown error";
  if (req && req.log) {
    req.log.error(error2);
  } else {
    if (isDev) {
      console.error("[VIBE ERROR]:", error2);
    } else {
      console.error("[VIBE ERROR]:", message);
    }
  }
  if (!res.headersSent) {
    let statusCode = 500;
    let errorType = "Internal Server Error";
    if (message.includes("exceeds max size")) {
      statusCode = 413;
      errorType = "Payload Too Large";
    } else if (message.includes("not allowed")) {
      statusCode = 415;
      errorType = "Unsupported Media Type";
    }
    res.writeHead(statusCode, { "content-type": "application/json" });
    const responseBody = isDev ? { error: errorType, message } : { error: errorType };
    res.end(JSON.stringify(responseBody));
  }
}
function getNetworkIP(host, port) {
  const interfaces = import_os.default.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    addresses.push(
      ...interfaces[name].map(
        (iface) => iface.address === "::1" ? { address: "[::1]", fam: iface.family } : { address: iface.address, fam: iface.family }
      ).filter((addr) => !addr.address.startsWith("fe80"))
    );
  }
  for (const addrs of addresses) {
    if (host === "0.0.0.0") {
      if (addrs.fam === "IPv4")
        log(`Server listening at - \x1B[4mhttp://${addrs.address}:${port}`);
    }
    if (host === "::") {
      log(`Server listening at - \x1B[4mhttp://${addrs.address}:${port}`);
    }
    if (addrs.address === host) {
      log(`Server listening at - \x1B[4mhttp://${addrs.address}:${port}`);
    }
  }
}
function log(message) {
  process.stdout.write(
    `${color.green("[VIBE LOG]:")} ${color.bright(message)}
`
  );
}
function error(message) {
  process.stderr.write(`${color.red(`[VIBE ERROR]: ${message}`)}
`);
}

// utils/core/parser.js
var import_busboy = __toESM(require("busboy"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_path = __toESM(require("path"), 1);
var DEFAULT_STREAM_THRESHOLD = 1024 * 1024;
function bodyParser(req, res, media = {}, options = {}) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers["content-type"];
    if (!contentType) return resolve();
    req.body ||= {};
    req.files ||= [];
    if (contentType.includes("multipart/form-data")) {
      if (!media || Object.keys(media).length === 0) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Bad Request",
            message: "File uploads not allowed on this route"
          })
        );
        return reject(
          new Error("File upload attempted without media configuration")
        );
      }
      parseMultipart(req, res, media, options, resolve, reject);
      return;
    }
    if (contentType.includes("application/json")) {
      parseJson(req, res, media, options, resolve, reject);
      return;
    }
    resolve();
  });
}
function parseMultipart(req, res, media, options, resolve, reject) {
  let bb;
  let fileError = null;
  const streaming = media.streaming === true;
  let pendingWrites = 0;
  let busboyFinished = false;
  let alreadyRejected = false;
  const rejectNow = (err) => {
    if (alreadyRejected) return;
    alreadyRejected = true;
    req.unpipe(bb);
    req.resume();
    reject(err);
  };
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
    bb = (0, import_busboy.default)({
      headers: req.headers,
      limits: {
        fileSize: media.maxSize || 10 * 1024 * 1024
      }
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
            `File type '${mimeType}' not allowed. Allowed: ${media.allowedTypes.join(", ")}`
          )
        );
      }
    }
    if (streaming) {
      req.emit("file", name, file, { filename, mimeType });
      return;
    }
    pendingWrites++;
    const parent = media.public ? options.publicFolder || "" : "";
    const dest = import_path.default.resolve(
      import_path.default.join(parent, media.dest || (media.public ? "uploads" : "private"))
    );
    if (media.public && !dest.startsWith(import_path.default.resolve(options.publicFolder || ""))) {
      options.logger?.warn(
        { dest, publicFolder: options.publicFolder },
        "[VIBE] Attempted upload outside public folder, skipping"
      );
      pendingWrites--;
      checkComplete();
      return file.resume();
    }
    try {
      if (!import_fs.default.existsSync(dest)) import_fs.default.mkdirSync(dest, { recursive: true });
    } catch (err) {
      options.logger?.error(err, "[VIBE] Failed to create upload folder");
      pendingWrites--;
      checkComplete();
      return file.resume();
    }
    const ext = import_path.default.extname(filename) || (mimeType?.includes("/") ? "." + mimeType.split("/")[1] : "");
    const safeName = `${import_path.default.basename(filename, ext)}-${import_crypto.default.randomBytes(3).toString("hex")}${ext}`;
    const filePath = import_path.default.join(dest, safeName);
    const writeStream = import_fs.default.createWriteStream(filePath);
    let size = 0;
    let truncated = false;
    file.on("data", (d) => size += d.length);
    file.on("limit", () => {
      truncated = true;
      const err = new Error(
        `File '${filename}' exceeds max size of ${media.maxSize || 10 * 1024 * 1024} bytes`
      );
      file.unpipe(writeStream);
      writeStream.end();
      file.resume();
      import_fs.default.unlink(filePath, () => {
        pendingWrites--;
      });
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
          size
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
function parseJson(req, res, media, options, resolve, reject) {
  const limit = options.maxJsonSize || 1e6;
  const streamThreshold = media?.streamThreshold || DEFAULT_STREAM_THRESHOLD;
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  if (media?.streaming && contentLength > streamThreshold) {
    req.body = null;
    req.emit("jsonStream", req);
    resolve();
    return;
  }
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > limit) {
      options.logger?.warn(
        { limit, received: body.length },
        "[VIBE] JSON payload too large, destroying connection"
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
async function parseJsonStream(stream) {
  return new Promise((resolve, reject) => {
    let body = "";
    stream.on("data", (chunk) => body += chunk);
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

// utils/core/response.js
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);

// utils/helpers/mime.js
var mimeTypes = {
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
  ".bin": "application/octet-stream"
};

// utils/core/response.js
var JSON_CT = { "content-type": "application/json" };
var TEXT_CT = { "content-type": "text/plain" };
var RESPONSES = {
  notFound: JSON.stringify({ success: false, message: "Resource not found" }),
  unauthorized: JSON.stringify({ success: false, message: "Unauthorized" }),
  forbidden: JSON.stringify({ success: false, message: "Forbidden" }),
  badRequest: JSON.stringify({ success: false, message: "Bad Request" }),
  conflict: JSON.stringify({ success: false, message: "Conflict" }),
  serverError: JSON.stringify({
    success: false,
    message: "Internal Server Error"
  })
};
var vibeResponseMethods = {
  /**
   * Sends a response. Fast path for JSON objects.
   * @param {any} data
   */
  send(data) {
    if (data === void 0) {
      throw new Error("Response data is not a sendable data type");
    }
    if (data instanceof Error) {
      return this._vibeOptions.errorHandler(data, this.req, this);
    }
    if (typeof data === "object" && data !== null) {
      if (!this.headersSent) this.writeHead(this.statusCode || 200, JSON_CT);
      this.end(JSON.stringify(data));
      return;
    }
    if (!this.headersSent) this.writeHead(this.statusCode || 200, TEXT_CT);
    this.end(String(data));
  },
  /**
   * Sends a JSON response.
   * @param {Object} data
   */
  json(data) {
    if (data instanceof Error) {
      return this._vibeOptions.errorHandler(data, this.req, this);
    }
    if (!this.headersSent) this.writeHead(this.statusCode || 200, JSON_CT);
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
    const resolvedPath = import_path2.default.resolve(publicFolder, filename);
    if (!resolvedPath.startsWith(import_path2.default.resolve(publicFolder))) {
      this.statusCode = 403;
      return this.end("Forbidden");
    }
    if (!import_fs2.default.existsSync(resolvedPath)) {
      this.statusCode = 404;
      return this.end("Not Found");
    }
    this.writeHead(200, { "Content-Type": "text/html" });
    import_fs2.default.createReadStream(resolvedPath).pipe(this);
  },
  /**
   * Safely send any static file from the public folder.
   * @param {string} filePath
   */
  sendFile(filePath) {
    const publicFolder = this._vibeOptions.publicFolder;
    if (!publicFolder) throw new Error("No Public folder set");
    const resolvedPath = import_path2.default.resolve(publicFolder, filePath);
    if (!resolvedPath.startsWith(import_path2.default.resolve(publicFolder))) {
      this.statusCode = 403;
      return this.end("Forbidden");
    }
    if (!import_fs2.default.existsSync(resolvedPath)) {
      this.statusCode = 404;
      return this.end("Not Found");
    }
    const ext = import_path2.default.extname(resolvedPath);
    this.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    });
    import_fs2.default.createReadStream(resolvedPath).pipe(this);
  },
  /**
   * Send any file from an absolute path (not restricted to public folder).
   * @param {string} absolutePath - Full path to the file
   * @param {object} [opts] - Options
   * @param {boolean} [opts.download=false] - Force download
   * @param {string} [opts.filename] - Custom filename for download
   */
  sendAbsoluteFile(absolutePath, opts = {}) {
    const resolvedPath = import_path2.default.resolve(absolutePath);
    if (!import_fs2.default.existsSync(resolvedPath)) {
      this.statusCode = 404;
      return this.end("Not Found");
    }
    const ext = import_path2.default.extname(resolvedPath);
    const filename = opts.filename || import_path2.default.basename(resolvedPath);
    const headers = {
      "Content-Type": mimeTypes[ext] || "application/octet-stream"
    };
    if (opts.download) {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }
    this.writeHead(200, headers);
    import_fs2.default.createReadStream(resolvedPath).pipe(this);
  },
  /**
   * Sends a 200 OK success response.
   * @param {any} data
   * @param {string} message
   */
  success(data = null, message = "Success") {
    this.writeHead(200, JSON_CT);
    this.end(JSON.stringify({ success: true, message, data }));
  },
  /**
   * Sends a 201 Created response.
   * @param {any} data
   * @param {string} message
   */
  created(data = null, message = "Resource created") {
    this.writeHead(201, JSON_CT);
    this.end(JSON.stringify({ success: true, message, data }));
  },
  /**
   * Sends a 400 Bad Request response.
   * @param {string} message
   * @param {any} errors
   */
  badRequest(message = "Bad Request", errors = null) {
    this.writeHead(400, JSON_CT);
    this.end(
      errors ? JSON.stringify({ success: false, message, errors }) : RESPONSES.badRequest
    );
  },
  /**
   * Sends a 401 Unauthorized response.
   * @param {string} message
   */
  unauthorized(message) {
    this.writeHead(401, JSON_CT);
    this.end(
      message ? JSON.stringify({ success: false, message }) : RESPONSES.unauthorized
    );
  },
  /**
   * Sends a 403 Forbidden response.
   * @param {string} message
   */
  forbidden(message) {
    this.writeHead(403, JSON_CT);
    this.end(
      message ? JSON.stringify({ success: false, message }) : RESPONSES.forbidden
    );
  },
  /**
   * Sends a 404 Not Found response.
   * @param {string} message
   */
  notFound(message) {
    this.writeHead(404, JSON_CT);
    this.end(
      message ? JSON.stringify({ success: false, message }) : RESPONSES.notFound
    );
  },
  /**
   * Sends a 409 Conflict response.
   * @param {string} message
   */
  conflict(message) {
    this.writeHead(409, JSON_CT);
    this.end(
      message ? JSON.stringify({ success: false, message }) : RESPONSES.conflict
    );
  },
  /**
   * Sends a 500 Internal Server Error response.
   * @param {Error} error
   */
  serverError(error2) {
    const logger = this._vibeOptions?.logger;
    if (logger) {
      logger.error(error2, "[VIBE] Internal server error");
    } else {
      console.error(error2);
    }
    this.writeHead(500, JSON_CT);
    this.end(RESPONSES.serverError);
  },
  /**
   * Sets a cookie on the response.
   * Chainable — supports multiple cookies: res.setCookie("a","1").setCookie("b","2")
   * @param {string} name - Cookie name
   * @param {string} value - Cookie value (will be URI-encoded)
   * @param {Object} [options]
   * @param {number} [options.maxAge] - Max age in seconds
   * @param {Date} [options.expires] - Expiry date
   * @param {string} [options.path="/"] - Cookie path
   * @param {string} [options.domain] - Cookie domain
   * @param {boolean} [options.secure] - HTTPS only
   * @param {boolean} [options.httpOnly] - Inaccessible to JS
   * @param {"Strict"|"Lax"|"None"} [options.sameSite] - SameSite policy
   * @returns {this}
   */
  setCookie(name, value, options = {}) {
    let cookie = `${name}=${encodeURIComponent(value)}`;
    if (options.maxAge != null) cookie += `; Max-Age=${options.maxAge}`;
    if (options.expires instanceof Date) cookie += `; Expires=${options.expires.toUTCString()}`;
    cookie += `; Path=${options.path ?? "/"}`;
    if (options.domain) cookie += `; Domain=${options.domain}`;
    if (options.secure) cookie += "; Secure";
    if (options.httpOnly) cookie += "; HttpOnly";
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
    const existing = this.getHeader("Set-Cookie");
    if (Array.isArray(existing)) this.setHeader("Set-Cookie", [...existing, cookie]);
    else if (existing) this.setHeader("Set-Cookie", [existing, cookie]);
    else this.setHeader("Set-Cookie", cookie);
    return this;
  },
  /**
   * Clears a cookie by immediately expiring it.
   * @param {string} name - Cookie name
   * @param {Object} [options] - Same options as setCookie (except maxAge/expires)
   * @returns {this}
   */
  clearCookie(name, options = {}) {
    return this.setCookie(name, "", { ...options, maxAge: 0, expires: /* @__PURE__ */ new Date(0) });
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
  }
};
function installResponseMethods(ResponseProto) {
  const proto = ResponseProto.prototype;
  for (const [name, fn] of Object.entries(vibeResponseMethods)) {
    if (!(name in proto)) {
      proto[name] = fn;
    }
  }
}

// utils/native.js
function parseQuery(queryString) {
  const query = {};
  if (!queryString) return query;
  let qs = queryString;
  if (qs[0] === "?") {
    qs = qs.slice(1);
  }
  const pairs = qs.split("&");
  for (const pair of pairs) {
    const eq = pair.indexOf("=");
    if (eq > 0) {
      try {
        const key = decodeURIComponent(pair.slice(0, eq));
        const value = decodeURIComponent(pair.slice(eq + 1));
        query[key] = value;
      } catch {
        query[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
  }
  return query;
}

// utils/core/server.js
var JSON_HEADERS = { "content-type": "application/json" };
var TEXT_HEADERS = { "content-type": "text/plain" };
var NOT_FOUND_BODY = "Not Found";
var EMPTY_PARAMS = Object.freeze(/* @__PURE__ */ Object.create(null));
var _reqIdCounter = 0;
var MAX_INT = Number.MAX_SAFE_INTEGER;
function server(options, port, host, callback) {
  installResponseMethods(import_http.default.ServerResponse);
  if (!import_http.default.IncomingMessage.prototype._vibeProtoInstalled) {
    Object.defineProperty(import_http.default.IncomingMessage.prototype, "query", {
      get() {
        if (this._parsedQuery !== void 0) return this._parsedQuery;
        this._parsedQuery = this._qIdx < 0 ? EMPTY_PARAMS : parseQuery(this._rawUrl.slice(this._qIdx + 1));
        return this._parsedQuery;
      },
      configurable: true
    });
    Object.defineProperty(import_http.default.IncomingMessage.prototype, "id", {
      get() {
        if (this._reqId === void 0) {
          if (this._vibeGenReqId) {
            this._reqId = this._vibeGenReqId(this);
          } else {
            _reqIdCounter = _reqIdCounter >= MAX_INT ? 1 : _reqIdCounter + 1;
            this._reqId = _reqIdCounter;
          }
        }
        return this._reqId;
      },
      configurable: true
    });
    Object.defineProperty(import_http.default.IncomingMessage.prototype, "log", {
      get() {
        if (this._reqLog === void 0)
          this._reqLog = this._vibeLogger.child({ reqId: this.id });
        return this._reqLog;
      },
      configurable: true
    });
    Object.defineProperty(import_http.default.IncomingMessage.prototype, "cookies", {
      get() {
        if (this._parsedCookies !== void 0) return this._parsedCookies;
        const header = this.headers["cookie"];
        if (!header) return this._parsedCookies = EMPTY_PARAMS;
        const cookies = {};
        for (const pair of header.split(";")) {
          const idx = pair.indexOf("=");
          if (idx < 0) continue;
          const key = pair.slice(0, idx).trim();
          const val = pair.slice(idx + 1).trim();
          if (key) cookies[key] = decodeURIComponent(val);
        }
        return this._parsedCookies = cookies;
      },
      configurable: true
    });
    import_http.default.IncomingMessage.prototype._vibeProtoInstalled = true;
  }
  const useTrieMatching = options.routeCount > options.trieThreshold;
  const staticRoutes = options.staticRoutes || /* @__PURE__ */ new Map();
  const interceptors = options.interceptors;
  const hasInterceptors = interceptors && interceptors.length > 0;
  const requestDecorators = options.requestDecorators;
  const replyDecorators = options.replyDecorators;
  const hasRequestDecorators = requestDecorators && Object.keys(requestDecorators).length > 0;
  const hasReplyDecorators = replyDecorators && Object.keys(replyDecorators).length > 0;
  const trie = options.trie;
  const routes = options.routes;
  const requestDecoratorEntries = hasRequestDecorators ? Object.entries(requestDecorators) : null;
  const replyDecoratorEntries = hasReplyDecorators ? Object.entries(replyDecorators) : null;
  async function runIntercept(intercept, req, res) {
    if (!intercept) return true;
    if (Array.isArray(intercept)) {
      for (let i = 0; i < intercept.length; i++) {
        await intercept[i](req, res);
        if (res.writableEnded) return false;
      }
    } else {
      await intercept(req, res);
      if (res.writableEnded) return false;
    }
    return true;
  }
  function linearMatch(method, url) {
    for (let i = 0, len = routes.length; i < len; i++) {
      const route = routes[i];
      if (route.method !== method || route.isStatic) continue;
      const result = route.pathRegex.exec(url);
      if (result) {
        return { route, params: result.groups || EMPTY_PARAMS };
      }
    }
    return null;
  }
  function reqListener(req, res) {
    req._vibeLogger = options.logger;
    req._vibeGenReqId = options.genReqId;
    if (options.loggerConfig && options.loggerConfig.lifecycle) {
      req.startTime = Date.now();
      const sender = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || req.socket.remoteAddress || "unknown";
      req.log.info(
        { type: "req", url: req.url, method: req.method, sender },
        "Incoming request"
      );
      res.on("finish", () => {
        req.log.info(
          {
            type: "res",
            statusCode: res.statusCode,
            responseTimeMs: Date.now() - req.startTime
          },
          "Request completed"
        );
      });
    }
    const url = req.url;
    const qIdx = url.indexOf("?");
    const pathname = qIdx < 0 ? url : url.slice(0, qIdx);
    req._qIdx = qIdx;
    req._rawUrl = url;
    req._parsedQuery = void 0;
    req.url = pathname;
    req.ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || req.socket.remoteAddress;
    res._vibeOptions = options;
    if (requestDecoratorEntries) {
      for (let i = 0; i < requestDecoratorEntries.length; i++) {
        const e = requestDecoratorEntries[i];
        req[e[0]] = typeof e[1] === "function" ? e[1]() : e[1];
      }
    }
    if (replyDecoratorEntries) {
      for (let i = 0; i < replyDecoratorEntries.length; i++) {
        const e = replyDecoratorEntries[i];
        res[e[0]] = typeof e[1] === "function" ? e[1]() : e[1];
      }
    }
    if (!hasInterceptors && req.method === "GET") {
      const routeKey = "GET" + pathname;
      const staticMatch = staticRoutes.get(routeKey);
      if (staticMatch && !staticMatch.intercept) {
        req.params = EMPTY_PARAMS;
        if (staticMatch._handlerType === 2) {
          const pb = staticMatch._prebuilt;
          const c = pb.charCodeAt(0);
          if (c === 123 || c === 91) {
            res.writeHead(200, JSON_HEADERS);
          } else {
            res.writeHead(200, TEXT_HEADERS);
          }
          res.end(pb);
          return;
        }
        const handler = staticMatch.handler;
        const serialize = staticMatch.serialize;
        try {
          const result = handler(req, res);
          if (result !== void 0 && !res.writableEnded) {
            if (result && typeof result.then === "function") {
              result.then((val) => {
                if (val instanceof Error) {
                  return options.errorHandler(val, req, res);
                }
                if (val !== void 0 && !res.writableEnded) {
                  res.writeHead(200, JSON_HEADERS);
                  res.end(serialize ? serialize(val) : JSON.stringify(val));
                }
              }).catch((err) => options.errorHandler(err, req, res));
            } else if (typeof result === "object" && result !== null) {
              if (result instanceof Error) {
                return options.errorHandler(result, req, res);
              }
              res.writeHead(200, JSON_HEADERS);
              res.end(serialize ? serialize(result) : JSON.stringify(result));
            } else {
              res.writeHead(200, TEXT_HEADERS);
              res.end(String(result));
            }
          }
        } catch (err) {
          options.errorHandler(err, req, res);
        }
        return;
      }
    }
    handleRequest(req, res, pathname);
  }
  async function handleRequest(req, res, pathname) {
    if (hasInterceptors) {
      if (!await runIntercept(interceptors, req, res)) return;
    }
    const routeKey = req.method + pathname;
    let match = staticRoutes.get(routeKey);
    if (match) {
      match = { route: match, params: EMPTY_PARAMS };
    } else if (useTrieMatching) {
      match = trie.match(req.method, pathname);
    } else {
      match = linearMatch(req.method, pathname);
    }
    if (!match) {
      res.writeHead(404, TEXT_HEADERS);
      res.end(NOT_FOUND_BODY);
      return;
    }
    const { route, params } = match;
    const { handler, intercept, media, serialize } = route;
    try {
      const method = req.method;
      if (media || method !== "GET" && method !== "HEAD") {
        await bodyParser(req, res, media, options);
      }
      req.params = params;
      if (intercept) {
        if (!await runIntercept(intercept, req, res)) return;
      }
      if (typeof handler === "function") {
        const result = await handler(req, res);
        if (result instanceof Error) {
          return options.errorHandler(result, req, res);
        }
        if (result !== void 0 && !res.writableEnded) {
          if (serialize) {
            res.writeHead(200, JSON_HEADERS);
            res.end(serialize(result));
          } else {
            res.writeHead(200, JSON_HEADERS);
            res.end(JSON.stringify(result));
          }
        }
      } else if (isSendAble(handler)) {
        if (serialize && typeof handler === "object" && handler !== null) {
          res.writeHead(200, JSON_HEADERS);
          res.end(serialize(handler));
        } else {
          res.send(handler);
        }
      } else {
        throw new Error("Invalid handler type");
      }
    } catch (err) {
      options.errorHandler(err, req, res);
    }
  }
  let mainHost = host || "0.0.0.0";
  if (mainHost === "localhost") mainHost = "127.0.0.1";
  const vibe_server = import_http.default.createServer(reqListener);
  vibe_server.listen(port, mainHost, () => {
    getNetworkIP(mainHost, port);
    const strategy = useTrieMatching ? "Trie (O(log n))" : "Linear (O(n))";
    options.logger.info(
      {
        strategy,
        routeCount: options.routeCount,
        staticRoutes: staticRoutes.size,
        trieThreshold: options.trieThreshold
      },
      "[VIBE] Route matching strategy initialized"
    );
    if (callback) callback();
  });
  vibe_server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      error(`Port ${port} is already in use! 
${err.message}`);
      process.exit(1);
    } else {
      error(`Server error: 
${err.message}`);
    }
  });
  const shutdown = () => {
    vibe_server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 3e3).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("message", (msg) => {
    if (msg === "shutdown") shutdown();
  });
  return vibe_server;
}
var server_default = server;

// utils/helpers/adapt.js
var ERROR_RESPONSE = JSON.stringify({
  success: false,
  message: "Internal Server Error"
});
function adapt(mw) {
  const argCount = mw.length;
  if (argCount === 3) {
    return adaptExpress(mw);
  }
  const isAsync = mw.constructor.name === "AsyncFunction";
  if (isAsync) {
    return adaptAsync(mw);
  }
  return adaptSync(mw);
}
function adaptExpress(mw) {
  return (req, res) => {
    return new Promise((resolve) => {
      try {
        mw(req, res, (err) => {
          if (err) {
            handleError2(err, res);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      } catch (err) {
        handleError2(err, res);
        resolve(false);
      }
    });
  };
}
function adaptAsync(mw) {
  return async (req, res) => {
    try {
      await mw(req, res);
      return true;
    } catch (err) {
      handleError2(err, res);
      return false;
    }
  };
}
function adaptSync(mw) {
  return async (req, res) => {
    try {
      const result = mw(req, res);
      if (result && typeof result.then === "function") {
        await result;
      }
      return true;
    } catch (err) {
      handleError2(err, res);
      return false;
    }
  };
}
function handleError2(err, res) {
  if (process.env.NODE_ENV !== "production") {
    console.error("Middleware Error:", err);
  }
  if (!res.headersSent) {
    if (res.serverError) {
      res.serverError();
    } else {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(ERROR_RESPONSE);
    }
  }
}

// utils/core/trie.js
function createNode() {
  return {
    children: /* @__PURE__ */ new Map(),
    paramChild: null,
    wildcardChild: null,
    paramName: null,
    route: null
  };
}
var RouteTrie = class {
  constructor() {
    this.methods = /* @__PURE__ */ new Map();
  }
  /**
   * Gets or creates the trie root for a given HTTP method.
   * @param {string} method
   * @returns {TrieNode}
   */
  getMethodRoot(method) {
    if (!this.methods.has(method)) {
      this.methods.set(method, createNode());
    }
    return this.methods.get(method);
  }
  /**
   * Inserts a route into the trie.
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - Route path (e.g., "/users/:id")
   * @param {import("../vibe.js").VibeRoute} route - Route object
   */
  insert(method, path3, route) {
    const root = this.getMethodRoot(method);
    const segments = path3.split("/").filter(Boolean);
    if (segments.length === 0) {
      root.route = route;
      return;
    }
    let current = root;
    for (const segment of segments) {
      if (segment.startsWith(":")) {
        if (!current.paramChild) {
          current.paramChild = createNode();
          current.paramChild.paramName = segment.slice(1);
        }
        current = current.paramChild;
      } else if (segment === "*") {
        if (!current.wildcardChild) {
          current.wildcardChild = createNode();
        }
        current = current.wildcardChild;
        break;
      } else {
        if (!current.children.has(segment)) {
          current.children.set(segment, createNode());
        }
        current = current.children.get(segment);
      }
    }
    current.route = route;
  }
  /**
   * Matches a request path against the trie.
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @returns {{ route: import("../vibe.js").VibeRoute, params: Record<string, string> } | null}
   */
  match(method, path3) {
    const root = this.methods.get(method);
    if (!root) return null;
    const segments = path3.split("/").filter(Boolean);
    const params = {};
    if (segments.length === 0) {
      if (root.route) {
        return { route: root.route, params: {} };
      }
      return null;
    }
    const result = this._matchRecursive(root, segments, 0, params);
    return result;
  }
  /**
   * Recursive matching helper.
   * @param {TrieNode} node
   * @param {string[]} segments
   * @param {number} index
   * @param {Record<string, string>} params
   * @returns {{ route: import("../vibe.js").VibeRoute, params: Record<string, string> } | null}
   */
  _matchRecursive(node, segments, index, params) {
    if (index === segments.length) {
      if (node.route) {
        return { route: node.route, params: { ...params } };
      }
      return null;
    }
    const segment = segments[index];
    if (node.children.has(segment)) {
      const result = this._matchRecursive(
        node.children.get(segment),
        segments,
        index + 1,
        params
      );
      if (result) return result;
    }
    if (node.paramChild) {
      const newParams = { ...params, [node.paramChild.paramName]: segment };
      const result = this._matchRecursive(
        node.paramChild,
        segments,
        index + 1,
        newParams
      );
      if (result) return result;
    }
    if (node.wildcardChild) {
      const remaining = segments.slice(index).join("/");
      if (node.wildcardChild.route) {
        return {
          route: node.wildcardChild.route,
          params: { ...params, wildcard: remaining }
        };
      }
    }
    return null;
  }
  /**
   * Returns all registered routes (for debugging/logging).
   * @returns {Array<{ method: string, path: string }>}
   */
  getAllRoutes() {
    const routes = [];
    for (const [method, root] of this.methods) {
      this._collectRoutes(root, "", method, routes);
    }
    return routes;
  }
  /**
   * Helper to collect routes from trie.
   * @param {TrieNode} node
   * @param {string} path
   * @param {string} method
   * @param {Array} routes
   */
  _collectRoutes(node, path3, method, routes) {
    if (node.route) {
      routes.push({ method, path: path3 || "/" });
    }
    for (const [segment, child] of node.children) {
      this._collectRoutes(child, `${path3}/${segment}`, method, routes);
    }
    if (node.paramChild) {
      this._collectRoutes(
        node.paramChild,
        `${path3}/:${node.paramChild.paramName}`,
        method,
        routes
      );
    }
    if (node.wildcardChild) {
      this._collectRoutes(node.wildcardChild, `${path3}/*`, method, routes);
    }
  }
};

// utils/core/compile-serializer.js
function escapeString(str) {
  if (str.length === 0) return '""';
  let result = '"';
  let last = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 32 || code === 34 || code === 92) {
      if (i > last) result += str.slice(last, i);
      switch (code) {
        case 34:
          result += '\\"';
          break;
        case 92:
          result += "\\\\";
          break;
        case 8:
          result += "\\b";
          break;
        case 12:
          result += "\\f";
          break;
        case 10:
          result += "\\n";
          break;
        case 13:
          result += "\\r";
          break;
        case 9:
          result += "\\t";
          break;
        default:
          result += "\\u" + code.toString(16).padStart(4, "0");
      }
      last = i + 1;
    }
  }
  if (last === 0) return '"' + str + '"';
  if (last < str.length) result += str.slice(last);
  return result + '"';
}
function compileSerializer(schema) {
  if (!schema || !schema.type) {
    return JSON.stringify;
  }
  return compileType(schema);
}
function compileObject(schema) {
  const props = schema.properties;
  if (!props) return JSON.stringify;
  const keys = Object.keys(props);
  if (keys.length === 0) return () => "{}";
  const parts = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const prop = props[key];
    const comma = i > 0 ? "," : "";
    const jsonKey = `${comma}"${key}":`;
    parts.push({ key, jsonKey, type: prop.type || "unknown", schema: prop });
  }
  const allSimple = parts.every(
    (p) => p.type === "string" || p.type === "number" || p.type === "integer" || p.type === "boolean"
  );
  if (allSimple && keys.length <= 16) {
    let body = 'if(o===null||o===undefined)return"null";\n';
    body += "return '{' + ";
    const segments = [];
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const accessor = `o[${JSON.stringify(p.key)}]`;
      let valExpr;
      switch (p.type) {
        case "string":
          valExpr = `(${accessor}===null||${accessor}===undefined?"null":e(""+${accessor}))`;
          break;
        case "number":
        case "integer":
          valExpr = `(${accessor}!=${accessor}||${accessor}===1/0||${accessor}===-1/0?"null":""+${accessor})`;
          break;
        case "boolean":
          valExpr = `(${accessor}?"true":"false")`;
          break;
      }
      segments.push(`'${p.jsonKey}'+${valExpr}`);
    }
    body += segments.join("+") + "+'}';";
    try {
      return new Function("e", "o", body).bind(null, escapeString);
    } catch {
      return buildFallbackSerializer(parts);
    }
  }
  return buildComplexSerializer(parts);
}
function buildComplexSerializer(parts) {
  const entries = parts.map((p) => ({
    key: p.key,
    jsonKey: p.jsonKey,
    serializer: compileType(p.schema)
  }));
  return function serializeComplex(obj) {
    if (obj === null || obj === void 0) return "null";
    let result = "{";
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const v = obj[e.key];
      result += e.jsonKey;
      if (v === null || v === void 0) {
        result += "null";
      } else {
        result += e.serializer(v);
      }
    }
    return result + "}";
  };
}
function buildFallbackSerializer(parts) {
  const entries = parts.map((p) => ({
    key: p.key,
    jsonKey: p.jsonKey,
    type: p.type
  }));
  return function serializeFallback(obj) {
    if (obj === null || obj === void 0) return "null";
    let result = "{";
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const v = obj[e.key];
      result += e.jsonKey;
      if (v === null || v === void 0) {
        result += "null";
      } else if (e.type === "string") {
        result += escapeString("" + v);
      } else {
        result += "" + v;
      }
    }
    return result + "}";
  };
}
function compileType(schema) {
  switch (schema.type) {
    case "object":
      return compileObject(schema);
    case "array":
      return compileArray(schema);
    case "string":
      return escapeString;
    case "number":
    case "integer":
      return serializeNumber;
    case "boolean":
      return serializeBoolean;
    case "null":
      return () => "null";
    default:
      return JSON.stringify;
  }
}
function serializeNumber(v) {
  if (v !== v || v === Infinity || v === -Infinity) return "null";
  return "" + v;
}
function serializeBoolean(v) {
  return v ? "true" : "false";
}
function compileArray(schema) {
  const itemSerializer = schema.items ? compileType(schema.items) : JSON.stringify;
  return function serializeArray(arr) {
    if (!Array.isArray(arr)) return "null";
    const len = arr.length;
    if (len === 0) return "[]";
    let result = "[" + itemSerializer(arr[0]);
    for (let i = 1; i < len; i++) {
      result += "," + itemSerializer(arr[i]);
    }
    return result + "]";
  };
}

// utils/core/logger.js
var import_os2 = __toESM(require("os"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var HOSTNAME = import_os2.default.hostname();
var LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100
  // Higher than all levels — suppresses all output (logger: false)
};
var LEVEL_NAMES = {
  10: "TRACE",
  20: "DEBUG",
  30: "INFO",
  40: "WARN",
  50: "ERROR",
  60: "FATAL"
};
var Logger = class {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level || "info"] || 30;
    this.colors = options.colors !== void 0 ? options.colors : true;
    this.prettyPrint = options.prettyPrint !== void 0 ? options.prettyPrint : this.colors;
    this.lifecycle = options.lifecycle || false;
    this.stream = options.stream || process.stdout;
    this.dest = options.dest || "console";
    this.logFile = options.logFile;
    this.bindings = options.bindings || {};
    if (this.logFile && (this.dest === "file" || this.dest === "both")) {
      this.fileStream = import_fs3.default.createWriteStream(this.logFile, { flags: "a" });
    }
    if (!this.bindings.pid) this.bindings.pid = process.pid;
    if (!this.bindings.hostname) this.bindings.hostname = HOSTNAME;
  }
  /**
   * Creates a lightweight child logger with scoped bindings (e.g. reqId).
   * Shares all parent state — no new Logger construction, no file streams.
   */
  child(bindings) {
    const mergedBindings = { ...this.bindings, ...bindings };
    const parent = this;
    return {
      level: parent.level,
      trace(obj, msg, c) {
        parent._log(10, obj, msg, c, mergedBindings);
      },
      debug(obj, msg, c) {
        parent._log(20, obj, msg, c, mergedBindings);
      },
      info(obj, msg, c) {
        parent._log(30, obj, msg, c, mergedBindings);
      },
      warn(obj, msg, c) {
        parent._log(40, obj, msg, c, mergedBindings);
      },
      error(obj, msg, c) {
        parent._log(50, obj, msg, c, mergedBindings);
      },
      fatal(obj, msg, c) {
        parent._log(60, obj, msg, c, mergedBindings);
      },
      // Nest further children through the parent so they also stay lightweight
      child(b) {
        return parent.child({ ...bindings, ...b });
      }
    };
  }
  trace(obj, msg, c) {
    this._log(10, obj, msg, c);
  }
  debug(obj, msg, c) {
    this._log(20, obj, msg, c);
  }
  info(obj, msg, c) {
    this._log(30, obj, msg, c);
  }
  warn(obj, msg, c) {
    this._log(40, obj, msg, c);
  }
  error(obj, msg, c) {
    this._log(50, obj, msg, c);
  }
  fatal(obj, msg, c) {
    this._log(60, obj, msg, c);
  }
  _log(level, obj, msg, c, bindings) {
    if (level < this.level) return;
    const base = {
      level,
      time: Date.now(),
      ...bindings || this.bindings
    };
    let logData = {};
    let customColor = void 0;
    if (obj instanceof Error) {
      logData.err = {
        type: obj.name || "Error",
        message: obj.message,
        stack: obj.stack
      };
      if (typeof msg === "string") logData.msg = msg;
      else logData.msg = obj.message;
      if (typeof c === "string") customColor = c;
    } else if (typeof obj === "string") {
      logData.msg = obj;
      if (typeof msg === "string") customColor = msg;
    } else if (typeof obj === "object" && obj !== null) {
      logData = { ...obj };
      if (typeof msg === "string") logData.msg = msg;
      if (typeof c === "string") customColor = c;
    } else {
      logData.msg = String(obj);
      if (typeof msg === "string") customColor = msg;
    }
    if (customColor) {
      logData.color = customColor;
    }
    const finalLog = { ...base, ...logData };
    if (this.dest === "console" || this.dest === "both") {
      if (this.prettyPrint) {
        this._printPretty(finalLog);
      } else {
        this.stream.write(JSON.stringify(finalLog) + "\n");
      }
    }
    if ((this.dest === "file" || this.dest === "both") && this.fileStream) {
      this.fileStream.write(JSON.stringify(finalLog) + "\n");
    }
  }
  _printPretty(log2) {
    const time = new Date(log2.time).toLocaleTimeString();
    const lvlName = LEVEL_NAMES[log2.level] || "INFO";
    const isError = log2.level >= 50;
    const isWarn = log2.level === 40;
    const isDebug = log2.level <= 20;
    const context = log2.reqId ? `[${log2.reqId}] ` : "";
    let content = log2.msg || "";
    if (log2.err && log2.err.stack) {
      content += "\n" + log2.err.stack;
    }
    const skipKeys = [
      "level",
      "time",
      "pid",
      "hostname",
      "reqId",
      "msg",
      "err",
      "color"
    ];
    let metaStr = "";
    for (const key of Object.keys(log2)) {
      if (!skipKeys.includes(key)) {
        metaStr += ` ${key}=${JSON.stringify(log2[key])}`;
      }
    }
    const rawPrefix = `[VIBE ${lvlName} ${time}]`;
    if (isError) {
      const fullLine = `${rawPrefix} ${context}${content}${metaStr}`;
      this.stream.write(color.red(fullLine) + "\n");
    } else if (isWarn) {
      const coloredContent = log2.color && color[log2.color] ? color[log2.color](content) : color.bright(content);
      this.stream.write(
        color.yellow(rawPrefix) + " " + context + coloredContent + (metaStr ? color.dim(metaStr) : "") + "\n"
      );
    } else if (isDebug) {
      this.stream.write(color.dim(`${rawPrefix} ${context}${content}${metaStr}`) + "\n");
    } else {
      const coloredContent = log2.color && color[log2.color] ? color[log2.color](content) : color.bright(content);
      this.stream.write(
        color.green(rawPrefix) + " " + context + coloredContent + (metaStr ? color.dim(metaStr) : "") + "\n"
      );
    }
  }
};
function createLogger(options = {}) {
  return new Logger(options);
}

// utils/scaling/cluster.js
var import_node_cluster = __toESM(require("node:cluster"), 1);
var import_node_os = __toESM(require("node:os"), 1);
function clusterize(startFn, options = {}) {
  const {
    workers = import_node_os.default.cpus().length,
    restart = true,
    restartDelay = 1e3,
    onWorkerStart,
    onWorkerExit
  } = options;
  if (import_node_cluster.default.isPrimary) {
    console.log(
      color.cyan(
        `[VIBE CLUSTER] Primary ${process.pid} starting ${workers} workers...`
      )
    );
    for (let i = 0; i < workers; i++) {
      forkWorker(onWorkerStart);
    }
    import_node_cluster.default.on("exit", (worker, code, signal) => {
      const reason = signal || `code ${code}`;
      console.log(
        color.yellow(
          `[VIBE CLUSTER] Worker ${worker.process.pid} exited (${reason})`
        )
      );
      if (onWorkerExit) {
        onWorkerExit(worker, code, signal);
      }
      if (restart && code !== 0) {
        console.log(
          color.cyan(
            `[VIBE CLUSTER] Restarting worker in ${restartDelay}ms...`
          )
        );
        setTimeout(() => forkWorker(onWorkerStart), restartDelay);
      }
    });
    process.on("SIGTERM", () => gracefulShutdown());
    process.on("SIGINT", () => gracefulShutdown());
  } else {
    console.log(color.green(`[VIBE CLUSTER] Worker ${process.pid} started`));
    startFn();
  }
}
function forkWorker(onStart) {
  const worker = import_node_cluster.default.fork();
  worker.on("online", () => {
    if (onStart) onStart(worker);
  });
  return worker;
}
function gracefulShutdown() {
  console.log(color.yellow("\n[VIBE CLUSTER] Shutting down..."));
  for (const id in import_node_cluster.default.workers) {
    import_node_cluster.default.workers[id].send("shutdown");
    import_node_cluster.default.workers[id].disconnect();
  }
  setTimeout(() => {
    console.log(color.red("[VIBE CLUSTER] Forcing shutdown"));
    process.exit(0);
  }, 5e3);
}
function isPrimary() {
  return import_node_cluster.default.isPrimary;
}
function isWorker() {
  return import_node_cluster.default.isWorker;
}
function getWorkerId() {
  return import_node_cluster.default.worker?.id || 0;
}
function getWorkerCount() {
  return Object.keys(import_node_cluster.default.workers || {}).length;
}

// utils/scaling/cache.js
var LRUCache = class _LRUCache {
  /**
   * @param {CacheOptions} options
   */
  constructor(options = {}) {
    this.max = options.max || 1e3;
    this.ttl = options.ttl || 6e4;
    this.cache = /* @__PURE__ */ new Map();
  }
  /**
   * Generate cache key from request
   * @param {string} method
   * @param {string} url
   * @returns {string}
   */
  static key(method, url) {
    return `${method}:${url}`;
  }
  /**
   * Generate ETag from value
   * @param {any} value
   * @returns {string}
   */
  static etag(value) {
    const str = typeof value === "string" ? value : JSON.stringify(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `"${Math.abs(hash).toString(36)}"`;
  }
  /**
   * Get value from cache
   * @param {string} key
   * @returns {CacheEntry | null}
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }
  /**
   * Set value in cache
   * @param {string} key
   * @param {any} value
   * @param {number} [ttl] - TTL in ms (uses default if not specified)
   * @returns {CacheEntry}
   */
  set(key, value, ttl) {
    if (this.cache.size >= this.max) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    const entry = {
      value,
      expires: Date.now() + (ttl || this.ttl),
      etag: _LRUCache.etag(value)
    };
    this.cache.set(key, entry);
    return entry;
  }
  /**
   * Delete entry from cache
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    return this.cache.delete(key);
  }
  /**
   * Clear all entries
   */
  clear() {
    this.cache.clear();
  }
  /**
   * Get cache size
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }
  /**
   * Check if key exists and is valid
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this.get(key) !== null;
  }
};
function cacheMiddleware(cache) {
  return (req, res) => {
    const rawUrl = req._rawUrl || req.url;
    const paramsStr = req.params && Object.keys(req.params).length > 0 ? JSON.stringify(req.params) : "";
    const key = LRUCache.key(req.method, rawUrl + paramsStr);
    const entry = cache.get(key);
    if (entry) {
      const clientEtag = req.headers["if-none-match"];
      if (clientEtag === entry.etag) {
        res.statusCode = 304;
        res.end();
        return false;
      }
      res.setHeader("ETag", entry.etag);
      res.setHeader("X-Cache", "HIT");
      res.json(entry.value);
      return false;
    }
    const originalJson = res.json.bind(res);
    const originalEnd = res.end.bind(res);
    res.json = (data) => {
      const newEntry = cache.set(key, data);
      res.setHeader("ETag", newEntry.etag);
      res.setHeader("X-Cache", "MISS");
      originalJson(data);
    };
    res.end = (body) => {
      if (body && !res._vibeCached) {
        try {
          const parsed = JSON.parse(body);
          if (typeof parsed === "object" && parsed !== null && !parsed.error) {
            res._vibeCached = true;
            const newEntry = cache.set(key, parsed);
            res.setHeader("ETag", newEntry.etag);
            res.setHeader("X-Cache", "MISS");
          }
        } catch {
        }
      }
      originalEnd(body);
    };
    return true;
  };
}

// utils/scaling/pool.js
var Pool = class {
  /**
   * @param {PoolOptions} options
   */
  constructor(options) {
    if (!options.create) throw new Error("Pool requires 'create' function");
    if (!options.destroy) throw new Error("Pool requires 'destroy' function");
    this.create = options.create;
    this.destroy = options.destroy;
    this.validate = options.validate || (() => true);
    this.min = options.min || 0;
    this.max = options.max || 10;
    this.acquireTimeout = options.acquireTimeout || 3e4;
    this.idleTimeout = options.idleTimeout || 6e4;
    this.available = [];
    this.inUse = /* @__PURE__ */ new Set();
    this.waiting = [];
    this._closed = false;
    this._idleCheckInterval = null;
    this._initialize();
  }
  async _initialize() {
    const promises = [];
    for (let i = 0; i < this.min; i++) {
      promises.push(this._createResource());
    }
    await Promise.all(promises);
    this._idleCheckInterval = setInterval(
      () => this._cleanupIdle(),
      this.idleTimeout / 2
    );
  }
  async _createResource() {
    try {
      const resource = await this.create();
      const pooled = {
        resource,
        createdAt: Date.now(),
        lastUsed: Date.now()
      };
      this.available.push(pooled);
      return pooled;
    } catch (err) {
      console.error("[Pool] Failed to create resource:", err);
      throw err;
    }
  }
  _cleanupIdle() {
    const now = Date.now();
    const toRemove = [];
    for (let i = 0; i < this.available.length; i++) {
      const pooled = this.available[i];
      const idle = now - pooled.lastUsed;
      if (this.available.length - toRemove.length <= this.min) break;
      if (idle > this.idleTimeout) {
        toRemove.push(i);
      }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) {
      const pooled = this.available.splice(toRemove[i], 1)[0];
      this.destroy(pooled.resource).catch(() => {
      });
    }
  }
  /**
   * Acquire a resource from the pool
   * @returns {Promise<any>}
   */
  async acquire() {
    if (this._closed) throw new Error("Pool is closed");
    while (this.available.length > 0) {
      const pooled = this.available.pop();
      if (this.validate(pooled.resource)) {
        pooled.lastUsed = Date.now();
        this.inUse.add(pooled.resource);
        return pooled.resource;
      }
      await this.destroy(pooled.resource).catch(() => {
      });
    }
    if (this.inUse.size < this.max) {
      const pooled = await this._createResource();
      const resource = this.available.pop().resource;
      this.inUse.add(resource);
      return resource;
    }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const idx = this.waiting.findIndex((w) => w.resolve === resolve);
        if (idx >= 0) this.waiting.splice(idx, 1);
        reject(new Error("Acquire timeout"));
      }, this.acquireTimeout);
      this.waiting.push({ resolve, reject, timeout });
    });
  }
  /**
   * Release a resource back to the pool
   * @param {any} resource
   */
  release(resource) {
    if (!this.inUse.has(resource)) return;
    this.inUse.delete(resource);
    if (this.waiting.length > 0) {
      const { resolve, timeout } = this.waiting.shift();
      clearTimeout(timeout);
      this.inUse.add(resource);
      resolve(resource);
      return;
    }
    this.available.push({
      resource,
      createdAt: Date.now(),
      // Approximate
      lastUsed: Date.now()
    });
  }
  /**
   * Execute function with acquired resource (auto-release)
   * @param {Function} fn - Function that receives the resource
   * @returns {Promise<any>}
   */
  async use(fn) {
    const resource = await this.acquire();
    try {
      return await fn(resource);
    } finally {
      this.release(resource);
    }
  }
  /**
   * Close the pool and destroy all resources
   */
  async close() {
    this._closed = true;
    if (this._idleCheckInterval) {
      clearInterval(this._idleCheckInterval);
    }
    for (const { reject, timeout } of this.waiting) {
      clearTimeout(timeout);
      reject(new Error("Pool closed"));
    }
    this.waiting = [];
    const destroyPromises = this.available.map(
      (p) => this.destroy(p.resource).catch(() => {
      })
    );
    this.available = [];
    await Promise.all(destroyPromises);
  }
  /**
   * Get pool statistics
   * @returns {{ available: number, inUse: number, waiting: number, max: number }}
   */
  get stats() {
    return {
      available: this.available.length,
      inUse: this.inUse.size,
      waiting: this.waiting.length,
      max: this.max
    };
  }
};
function createPool(options) {
  return new Pool(options);
}

// utils/scaling/rate-limit.js
var RATE_LIMIT_HEADERS = { "content-type": "text/plain" };
function rateLimit(opts = {}) {
  const max = opts.max;
  if (!max || typeof max !== "number" || max < 1) {
    throw new Error("[vibe] rateLimit: `max` must be a positive number");
  }
  const windowMs = opts.window ?? 6e4;
  const message = opts.message ?? "Too Many Requests";
  const statusCode = opts.statusCode ?? 429;
  const keyBy = opts.keyBy ?? ((req) => req.ip ?? "unknown");
  const skip = opts.skip ?? null;
  const store = /* @__PURE__ */ new Map();
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.windowStart >= windowMs) {
        store.delete(key);
      }
    }
  }, windowMs);
  if (cleanupInterval.unref) cleanupInterval.unref();
  return function rateLimitInterceptor(req, res) {
    if (skip && skip(req)) return true;
    const key = keyBy(req);
    const now = Date.now();
    let entry = store.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 1, windowStart: now };
      store.set(key, entry);
    } else {
      entry.count++;
    }
    const remaining = Math.max(0, max - entry.count);
    const resetInMs = windowMs - (now - entry.windowStart);
    const resetInSeconds = Math.ceil(resetInMs / 1e3);
    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil((entry.windowStart + windowMs) / 1e3));
    if (entry.count > max) {
      res.setHeader("Retry-After", resetInSeconds);
      res.writeHead(statusCode, RATE_LIMIT_HEADERS);
      res.end(message);
      return false;
    }
    return true;
  };
}

// utils/helpers/cors.js
var PREFLIGHT_HEADERS = { "content-length": "0" };
function cors(opts = {}) {
  const {
    origin = "*",
    methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
    allowedHeaders = ["Content-Type", "Authorization"],
    exposedHeaders = [],
    credentials = false,
    maxAge
  } = opts;
  const methodsStr = methods.join(", ");
  const allowedHeadersStr = allowedHeaders.join(", ");
  const exposedHeadersStr = exposedHeaders.length ? exposedHeaders.join(", ") : null;
  const maxAgeStr = maxAge != null ? String(maxAge) : null;
  function resolveOrigin(requestOrigin) {
    if (origin === "*") return "*";
    if (typeof origin === "function") {
      return origin(requestOrigin) ? requestOrigin : null;
    }
    if (Array.isArray(origin)) {
      return origin.includes(requestOrigin) ? requestOrigin : null;
    }
    return origin === requestOrigin ? requestOrigin : null;
  }
  return function corsInterceptor(req, res) {
    const requestOrigin = req.headers["origin"];
    if (!requestOrigin) return true;
    const allowedOrigin = resolveOrigin(requestOrigin);
    if (allowedOrigin) {
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      if (allowedOrigin !== "*") {
        res.setHeader("Vary", "Origin");
      }
    }
    if (credentials) {
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (exposedHeadersStr) {
      res.setHeader("Access-Control-Expose-Headers", exposedHeadersStr);
    }
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", methodsStr);
      res.setHeader("Access-Control-Allow-Headers", allowedHeadersStr);
      if (maxAgeStr) {
        res.setHeader("Access-Control-Max-Age", maxAgeStr);
      }
      res.writeHead(204, PREFLIGHT_HEADERS);
      res.end();
      return false;
    }
    return true;
  };
}

// vibe.js
function pathToRegex(path3) {
  return PathToRegex(path3).pathRegex;
}
var _processListenersInstalled = false;
var vibe = (config = {}) => {
  const trie = new RouteTrie();
  const routes = [];
  const TRIE_THRESHOLD = 40;
  const staticRoutes = /* @__PURE__ */ new Map();
  const loggerConfig = config.logger !== false ? config.logger || {} : { level: "silent" };
  const appLogger = config.logger instanceof Logger ? config.logger : createLogger(loggerConfig);
  const options = {
    trie,
    routes,
    staticRoutes,
    routeCount: 0,
    trieThreshold: TRIE_THRESHOLD,
    publicFolder: "public",
    interceptors: [],
    decorators: {},
    requestDecorators: {},
    replyDecorators: {},
    logger: appLogger,
    loggerConfig,
    errorHandler: handleError,
    genReqId: config.genReqId
  };
  if (!_processListenersInstalled) {
    _processListenersInstalled = true;
    process.on("uncaughtException", (err) => {
      appLogger.fatal(err, "Uncaught Exception crashed the server");
      setTimeout(() => process.exit(1), 100);
    });
    process.on("unhandledRejection", (reason) => {
      appLogger.fatal(
        { err: reason },
        "Unhandled Promise Rejection crashed the server"
      );
      setTimeout(() => process.exit(1), 100);
    });
  }
  function _addRoute(route) {
    routes.push(route);
    options.routeCount++;
    if (options.routeCount === options.trieThreshold) {
      for (let i = 0; i < routes.length; i++) {
        trie.insert(routes[i].method, routes[i].path, routes[i]);
      }
    } else if (options.routeCount > options.trieThreshold) {
      trie.insert(route.method, route.path, route);
    }
  }
  let currentPrefix = "";
  const get = (p, a, b) => registerRoute("GET", p, a, b);
  const post = (p, a, b) => registerRoute("POST", p, a, b);
  const put = (p, a, b) => registerRoute("PUT", p, a, b);
  const del = (p, a, b) => registerRoute("DELETE", p, a, b);
  const patch = (p, a, b) => registerRoute("PATCH", p, a, b);
  const head = (p, a, b) => registerRoute("HEAD", p, a, b);
  function registerRoute(method, path3, opts, handler) {
    const fullPath = currentPrefix + path3;
    const route = {
      method,
      path: fullPath,
      pathRegex: null,
      handler: null,
      intercept: null,
      serialize: null,
      media: null,
      // Only set when explicitly configured
      // Pre-computed handler metadata (avoids typeof checks on hot path)
      _handlerType: 0,
      // 0=unknown, 1=function, 2=prebuilt-string
      _prebuilt: null
      // Pre-stringified response for static handlers
    };
    if (fullPath === "/") {
      if (handler !== void 0) {
        if (typeof opts !== "object" || Array.isArray(opts)) {
          throw new Error("Options must be an object when using 3-arg form");
        }
        route.intercept = opts.intercept ? wrapIntercepts(opts.intercept) : null;
        if (opts.media) {
          route.media = {
            public: true,
            dest: null,
            maxSize: 10 * 1024 * 1024,
            allowedTypes: null,
            ...opts.media
          };
        }
        if (opts.schema?.response) {
          route.serialize = compileSerializer(opts.schema.response);
        }
        route.handler = handler;
      } else {
        route.handler = opts;
      }
      route.pathRegex = /^\/$/;
      route.isStatic = true;
      finalizeRoute(route);
      staticRoutes.set(method + "/", route);
      const rootIdx = routes.findIndex(
        (r) => r.path === "/" && r.method === method
      );
      if (rootIdx >= 0) {
        routes[rootIdx] = route;
        if (options.routeCount >= options.trieThreshold) {
          trie.insert(method, "/", route);
        }
      } else {
        _addRoute(route);
      }
      return;
    }
    if (handler !== void 0) {
      if (typeof opts !== "object" || Array.isArray(opts)) {
        throw new Error("Options must be an object when using 3-arg form");
      }
      route.intercept = opts.intercept ? wrapIntercepts(opts.intercept) : null;
      if (opts.media) {
        route.media = {
          public: true,
          dest: null,
          maxSize: 10 * 1024 * 1024,
          allowedTypes: null,
          ...opts.media
        };
      }
      if (opts.schema?.response) {
        route.serialize = compileSerializer(opts.schema.response);
      }
      route.handler = handler;
    } else {
      route.handler = opts;
    }
    const isStatic = !fullPath.includes(":") && !fullPath.includes("*");
    route.isStatic = isStatic;
    route.pathRegex = isStatic ? null : pathToRegex(fullPath);
    finalizeRoute(route);
    if (isStatic) {
      staticRoutes.set(method + fullPath, route);
    }
    _addRoute(route);
  }
  function finalizeRoute(route) {
    const h = route.handler;
    if (typeof h === "function") {
      route._handlerType = 1;
    } else if (typeof h === "string") {
      route._handlerType = 2;
      route._prebuilt = h;
    } else if (typeof h === "object" && h !== null) {
      route._handlerType = 2;
      route._prebuilt = route.serialize ? route.serialize(h) : JSON.stringify(h);
    } else if (typeof h === "number" || typeof h === "boolean") {
      route._handlerType = 2;
      route._prebuilt = String(h);
    }
  }
  function wrapIntercepts(intercept) {
    if (Array.isArray(intercept)) {
      return intercept.map(adapt);
    }
    return [adapt(intercept)];
  }
  function listen(port, host, callback) {
    addStatic();
    if (port === void 0) {
      throw new Error("Port number is required to start the server");
    }
    if (typeof port === "string" || typeof port === "number") {
      if (!isNaN(Number(port))) {
        port = Number(port);
      } else {
        throw new Error("Port must be a number or numeric string");
      }
    } else {
      throw new Error("Port must be a number or numeric string");
    }
    if (port < 1 || port > 65535) {
      throw new Error("Port must be between 1 and 65535");
    }
    if (typeof host === "function") {
      callback = host;
      host = void 0;
    }
    return server_default(options, Number(port), host, callback);
  }
  async function register(fn, opts = {}) {
    const previousPrefix = currentPrefix;
    if (opts.prefix) {
      currentPrefix = previousPrefix + opts.prefix;
    }
    const scopedApp = {
      get,
      post,
      put,
      del,
      patch,
      head,
      plugin,
      decorate,
      decorateRequest,
      decorateReply,
      register,
      log: appLogger,
      // Structured logger (api.log.info / warn / error etc.)
      logger: appLogger,
      // Alias — consistent with root app.logger
      logLegacy: log2,
      // Legacy colorized string logger (api.logLegacy(msg, color))
      setErrorHandler: (fn2) => {
        options.errorHandler = fn2;
      },
      // Expose decorators
      ...options.decorators
    };
    let result;
    try {
      result = fn(scopedApp, opts);
    } finally {
      currentPrefix = previousPrefix;
    }
    if (result && typeof result.then === "function") {
      await result;
    }
  }
  function include(prefixOrFunc, maybeFunc) {
    if (typeof prefixOrFunc === "function") {
      prefixOrFunc(routeAPI(""));
    } else {
      maybeFunc(routeAPI(prefixOrFunc));
    }
  }
  function routeAPI(prefix) {
    const wrap = (method) => (path3, a, b) => registerRoute(method, prefix + path3, a, b);
    return {
      get: wrap("GET"),
      post: wrap("POST"),
      put: wrap("PUT"),
      del: wrap("DELETE"),
      patch: wrap("PATCH"),
      head: wrap("HEAD"),
      log: appLogger,
      // Structured logger — consistent with app.log
      logger: appLogger,
      // Alias
      logLegacy: log2,
      // Legacy colorized string logger
      plugin
    };
  }
  function plugin(interceptor) {
    options.interceptors.push(adapt(interceptor));
  }
  function decorate(name, value) {
    if (name in options.decorators) {
      throw new Error(`Decorator '${name}' already exists`);
    }
    options.decorators[name] = value;
    if (app) app[name] = value;
  }
  function decorateRequest(name, value) {
    if (name in options.requestDecorators) {
      throw new Error(`Request decorator '${name}' already exists`);
    }
    options.requestDecorators[name] = value;
  }
  function decorateReply(name, value) {
    if (name in options.replyDecorators) {
      throw new Error(`Reply decorator '${name}' already exists`);
    }
    options.replyDecorators[name] = value;
  }
  function logRoutes() {
    const routes2 = trie.getAllRoutes();
    console.log(routes2);
  }
  const setPublicFolder = (foldername) => options.publicFolder = foldername || "public";
  function addStatic() {
    const routePath = `/${options.publicFolder}/*`;
    const route = {
      method: "GET",
      path: routePath,
      pathRegex: pathToRegex(routePath),
      handler: (req, res) => {
        try {
          const filePath = req.url.split("/").filter(Boolean).slice(1).join("/");
          res.sendFile(filePath);
        } catch (err) {
          log2(err.message, "red");
          res.status(404).send("Not Found");
        }
      },
      intercept: null,
      media: { public: true, dest: null }
    };
    _addRoute(route);
  }
  const log2 = (message, typeOrColor = "reset") => {
    const c = color[typeOrColor] || color.reset;
    process.stdout.write(c(message) + "\n");
  };
  const app = {
    get,
    post,
    put,
    del,
    patch,
    head,
    listen,
    logRoutes,
    log: appLogger,
    // Standard Fastify-like exposure (app.log.info())
    logger: appLogger,
    logLegacy: log2,
    setPublicFolder,
    setErrorHandler: (fn) => {
      options.errorHandler = fn;
    },
    include,
    plugin,
    register,
    decorate,
    decorateRequest,
    decorateReply
  };
  Object.defineProperty(app, "decorators", {
    get() {
      return options.decorators;
    }
  });
  return app;
};
var vibe_default = vibe;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  LRUCache,
  Pool,
  adapt,
  cacheMiddleware,
  clusterize,
  color,
  cors,
  createPool,
  getWorkerCount,
  getWorkerId,
  isPrimary,
  isWorker,
  parseJsonStream,
  rateLimit
});
