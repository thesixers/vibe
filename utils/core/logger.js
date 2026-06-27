import os from "os";
import fs from "fs";
import { color } from "../helpers/colors.js";

const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100, // Higher than all levels — suppresses all output (logger: false)
};

const LEVEL_NAMES = {
  10: "TRACE",
  20: "DEBUG",
  30: "INFO",
  40: "WARN",
  50: "ERROR",
  60: "FATAL",
};

/**
 * High-performance structured JSON logger (Fastify/Pino style).
 */
export class Logger {
  constructor(options = {}) {
    this.level = LOG_LEVELS[options.level || "info"] || 30;
    this.colors = options.colors !== undefined ? options.colors : true;
    this.prettyPrint =
      options.prettyPrint !== undefined ? options.prettyPrint : this.colors;
    this.lifecycle = options.lifecycle || false;
    this.stream = options.stream || process.stdout;
    this.dest = options.dest || "console"; // "console", "file", "both"
    this.logFile = options.logFile;
    this.bindings = options.bindings || {};

    // Initialize file stream if needed
    if (this.logFile && (this.dest === "file" || this.dest === "both")) {
      this.fileStream = fs.createWriteStream(this.logFile, { flags: "a" });
    }

    if (!this.bindings.pid) this.bindings.pid = process.pid;
    if (!this.bindings.hostname) this.bindings.hostname = os.hostname();
  }

  /**
   * Creates a sub-logger with scoped bindings (e.g. reqId).
   */
  child(bindings) {
    return new Logger({
      level: Object.keys(LOG_LEVELS).find(
        (key) => LOG_LEVELS[key] === this.level,
      ),
      colors: this.colors,
      prettyPrint: this.prettyPrint,
      lifecycle: this.lifecycle,
      stream: this.stream,
      dest: this.dest,
      logFile: this.logFile,
      bindings: { ...this.bindings, ...bindings },
    });
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

  _log(level, obj, msg, c) {
    if (level < this.level) return;

    const base = {
      level,
      time: Date.now(),
      ...this.bindings,
    };

    let logData = {};
    let customColor = undefined;

    if (obj instanceof Error) {
      logData.err = {
        type: obj.name || "Error",
        message: obj.message,
        stack: obj.stack,
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

  _printPretty(log) {
    const time = new Date(log.time).toLocaleTimeString();
    const lvlName = LEVEL_NAMES[log.level] || "INFO";

    const isError = log.level >= 50;
    const isWarn  = log.level === 40;
    const isDebug = log.level <= 20;

    // Build context tag (reqId)
    const context = log.reqId ? `[${log.reqId}] ` : "";

    // Build message content
    let content = log.msg || "";
    if (log.err && log.err.stack) {
      content += "\n" + log.err.stack;
    }

    // Build metadata string (skip standard keys)
    const skipKeys = [
      "level", "time", "pid", "hostname", "reqId", "msg", "err", "color",
    ];
    let metaStr = "";
    for (const key of Object.keys(log)) {
      if (!skipKeys.includes(key)) {
        metaStr += ` ${key}=${JSON.stringify(log[key])}`;
      }
    }

    const rawPrefix = `[VIBE ${lvlName} ${time}]`;

    if (isError) {
      // Entire line is red — prefix, context, message, stack, metadata
      const fullLine = `${rawPrefix} ${context}${content}${metaStr}`;
      this.stream.write(color.red(fullLine) + "\n");
    } else if (isWarn) {
      // Yellow prefix, bright content
      const coloredContent = log.color && color[log.color]
        ? color[log.color](content)
        : color.bright(content);
      this.stream.write(
        color.yellow(rawPrefix) + " " + context + coloredContent +
        (metaStr ? color.dim(metaStr) : "") + "\n",
      );
    } else if (isDebug) {
      // Dim entire line for trace/debug
      this.stream.write(color.dim(`${rawPrefix} ${context}${content}${metaStr}`) + "\n");
    } else {
      // Info — green prefix + bright content (matches [VIBE LOG] style)
      const coloredContent = log.color && color[log.color]
        ? color[log.color](content)
        : color.bright(content);
      this.stream.write(
        color.green(rawPrefix) + " " + context + coloredContent +
        (metaStr ? color.dim(metaStr) : "") + "\n",
      );
    }
  }
}

export function createLogger(options = {}) {
  return new Logger(options);
}

export default createLogger;
