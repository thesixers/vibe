import os from "os";
import { color } from "../helpers/colors.js";

const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
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
    this.prettyPrint = options.prettyPrint || false;
    this.lifecycle = options.lifecycle || false;
    this.stream = options.stream || process.stdout;
    this.bindings = options.bindings || {};

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
      prettyPrint: this.prettyPrint,
      lifecycle: this.lifecycle,
      stream: this.stream,
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

    if (this.prettyPrint) {
      this._printPretty(finalLog);
    } else {
      this.stream.write(JSON.stringify(finalLog) + "\n");
    }
  }

  _printPretty(log) {
    const time = new Date(log.time).toLocaleTimeString();
    const lvlName = LEVEL_NAMES[log.level] || "INFO";
    let prefixC = color.cyan;
    if (log.level >= 50) prefixC = color.red;
    else if (log.level === 40) prefixC = color.yellow;
    else if (log.level <= 20) prefixC = color.dim;

    const prefix = prefixC(`[VIBE ${lvlName} ${time}]`);
    let context = "";
    if (log.reqId) {
      context = `\x1b[90m[${log.reqId}]\x1b[0m `;
    }

    let content = log.msg || "";
    if (log.color && color[log.color]) {
      content = color[log.color](content);
    }

    if (log.err && log.err.stack) {
      content += "\n" + prefixC(log.err.stack);
    }

    // Attempt to print remaining metadata if it's not standard
    const skipKeys = [
      "level",
      "time",
      "pid",
      "hostname",
      "reqId",
      "msg",
      "err",
      "color",
    ];
    let metaStr = "";
    for (const key of Object.keys(log)) {
      if (!skipKeys.includes(key)) {
        metaStr += ` \x1b[90m${key}=${JSON.stringify(log[key])}\x1b[0m`;
      }
    }

    this.stream.write(`${prefix} ${context}${content}${metaStr}\n`);
  }
}

export function createLogger(options = {}) {
  return new Logger(options);
}

export default createLogger;
