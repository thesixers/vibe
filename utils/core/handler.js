import os from "os";
import { color } from "../helpers/colors.js";

/**
 * Parses query string from URL into an object.
 * @param {string} url
 * @returns {Object}
 */
export function extractQuery(url) {
  const query = {};
  if (!url.includes("?")) return query;
  for (const rq of url.split("?")[1].split("&")) {
    const parts = rq.split("=");
    if (parts.length === 2) {
      query[parts[0]] = parts[1];
    }
  }
  return query;
}

/**
 * Extracts raw parameters from URL based on route definition.
 * @param {string} routePath
 * @param {string} requestPath
 * @returns {Object}
 */
export function extractParams(routePath, requestPath) {
  const routeSegments = routePath.split("/").filter(Boolean);
  const requestSegments = requestPath.split("/").filter(Boolean);
  const params = {};

  routeSegments.forEach((segment, index) => {
    if (segment.startsWith(":")) {
      const paramName = segment.slice(1);
      params[paramName] = requestSegments[index];
    }
  });

  return params;
}

/**
 * Checks if the request URL matches the route Regex.
 * @param {RegExp} pathRegex
 * @param {string} requestPath
 * @returns {RegExpExecArray | null}
 */
export function matchPath(pathRegex, requestPath) {
  return pathRegex.exec(requestPath);
}

/**
 * Converts a route path string (e.g., "/users/:id") into a RegExp.
 * Captures named groups for parameters.
 * * @param {string} path - The path to register
 * @returns {{ pathRegex: RegExp, paramKeys: string[] }}
 */
export function PathToRegex(path) {
  const pathSegments = path.split("/").filter(Boolean);
  const paramKeys = [];

  // Handle root path specially
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

/**
 * Validates if data is safe to send via HTTP (string, number, boolean, object).
 * @param {any} value
 * @returns {boolean}
 */
export function isSendAble(value) {
  return (
    (value !== null && typeof value === "object") ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Executes a list of interceptor functions (middleware).
 * Stops execution if response is ended.
 * * @param {Function | Function[]} intercept - Single function or array of functions
 * @param {import("../vibe.js").VibeRequest} req
 * @param {import("../vibe.js").VibeResponse} res
 * @param {boolean} [isRoute=true] - Context flag for error messages
 * @returns {Promise<boolean>} - Returns false if response ended, true otherwise
 */
export async function runIntercept(intercept, req, res, isRoute = true) {
  if (!intercept || (Array.isArray(intercept) && intercept.length === 0))
    return true;

  const funcs = Array.isArray(intercept) ? intercept : [intercept];

  for (const func of funcs) {
    if (typeof func !== "function") {
      throw new Error(
        `All ${isRoute ? "Route" : "Global"} intercepts must be functions`,
      );
    }

    await func(req, res);

    if (res.writableEnded) return false;
  }

  return true;
}

/**
 * Centralized error handler for routes.
 * @param {Error} error
 * @param {import("../vibe.js").VibeRequest} req
 * @param {import("../vibe.js").VibeResponse} res
 */
export function handleError(error, req, res) {
  console.error("Error in route handler:", error);
  if (!res.headersSent) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
}

/**
 * Finds the local network IP address (IPv4)
 * @param {string} host
 * @param {number} port
 * @returns {void}
 */
export function getNetworkIP(host, port) {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    addresses.push(
      ...interfaces[name]
        .map((iface) =>
          iface.address === "::1"
            ? { address: "[::1]", fam: iface.family }
            : { address: iface.address, fam: iface.family },
        )
        .filter((addr) => !addr.address.startsWith("fe80")),
    );
  }

  for (const addrs of addresses) {
    if (host === "0.0.0.0") {
      // => listens on all ipv4 hosts
      if (addrs.fam === "IPv4")
        log(`Server listening at - \x1b[4mhttp://${addrs.address}:${port}`);
    }

    if (host === "::") {
      // => listens on all ipv6/ipv4 hosts
      log(`Server listening at - \x1b[4mhttp://${addrs.address}:${port}`);
    }

    if (addrs.address === host) {
      log(`Server listening at - \x1b[4mhttp://${addrs.address}:${port}`);
    }
  }
}

/**
 * Logs a message with a prefix.
 * @param {string} message
 */
export function log(message) {
  process.stdout.write(
    `${color.green("[VIBE LOG]:")} ${color.bright(message)}\n`,
  );
}

/**
 * Logs an error with a prefix.
 * @param {string} message
 */
export function error(message) {
  process.stderr.write(`${color.red(`[VIBE ERROR]: ${message}`)}\n`);
}
