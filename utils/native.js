/**
 * Native Module Wrapper
 *
 * Attempts to load the C++ native module for performance.
 * Falls back to pure JavaScript implementations if native module is unavailable.
 */

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import load from "node-gyp-build";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let native = null;
let useNative = false;

// Try to load native module using node-gyp-build
try {
  const require = createRequire(import.meta.url);
  // Point to the root directory where binding.gyp is located
  const rootDir = path.join(__dirname, "..");
  native = load(rootDir);
  useNative = true;
  console.log("[VIBE] Native module loaded (C++ optimizations enabled)");
} catch (err) {
  // Native module not available, use JS fallback
  console.log(
    "[VIBE] Native module not available, using JavaScript implementation",
  );
}

/**
 * Fast JSON stringify
 * Uses native C++ implementation if available
 *
 * @param {any} value - Value to stringify
 * @returns {string} JSON string
 */
export function stringify(value) {
  if (useNative) {
    try {
      return native.stringify(value);
    } catch {
      // Fallback on error
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(value);
}

/**
 * Parse URL into pathname and query object
 * Uses native C++ implementation if available
 *
 * @param {string} url - URL to parse
 * @returns {{ pathname: string, query: Object }}
 */
export function parseUrl(url) {
  if (useNative) {
    try {
      return native.parseUrl(url);
    } catch {
      // Fallback
    }
  }

  // JavaScript fallback
  const qIdx = url.indexOf("?");
  if (qIdx < 0) {
    return { pathname: url, query: {} };
  }

  const pathname = url.slice(0, qIdx);
  const query = parseQuery(url.slice(qIdx + 1));
  return { pathname, query };
}

/**
 * Parse query string into object
 * Uses native C++ implementation if available
 *
 * @param {string} queryString - Query string (with or without leading ?)
 * @returns {Object} Parsed query parameters
 */
export function parseQuery(queryString) {
  if (useNative) {
    try {
      return native.parseQuery(queryString);
    } catch {
      // Fallback
    }
  }

  // JavaScript fallback
  const query = {};
  if (!queryString) return query;

  // Remove leading ?
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
        // Invalid encoding, use raw
        query[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
  }

  return query;
}

/**
 * Decode URI component
 * Uses native C++ implementation if available
 *
 * @param {string} encoded - Encoded string
 * @returns {string} Decoded string
 */
export function decodeURI(encoded) {
  if (useNative) {
    try {
      return native.decodeURI(encoded);
    } catch {
      // Fallback
    }
  }
  return decodeURIComponent(encoded);
}

/**
 * Check if native module is loaded
 * @returns {boolean}
 */
export function isNativeEnabled() {
  return useNative;
}

/**
 * Get native module version
 * @returns {string|null}
 */
export function getNativeVersion() {
  return useNative ? native.version : null;
}

export default {
  stringify,
  parseUrl,
  parseQuery,
  decodeURI,
  isNativeEnabled,
  getNativeVersion,
};
