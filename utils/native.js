/**
 * Pure JavaScript implementations for JSON stringify, URL parsing,
 * query string parsing, and URI decoding.
 */

/**
 * Fast JSON stringify (pure JS)
 * @param {any} value - Value to stringify
 * @returns {string} JSON string
 */
export function stringify(value) {
  return JSON.stringify(value);
}

/**
 * Parse URL into pathname and query object
 * @param {string} url - URL to parse
 * @returns {{ pathname: string, query: Object }}
 */
export function parseUrl(url) {
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
 * @param {string} queryString - Query string (with or without leading ?)
 * @returns {Object} Parsed query parameters
 */
export function parseQuery(queryString) {
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
        // Invalid encoding, use raw
        query[pair.slice(0, eq)] = pair.slice(eq + 1);
      }
    }
  }

  return query;
}

/**
 * Decode URI component
 * @param {string} encoded - Encoded string
 * @returns {string} Decoded string
 */
export function decodeURI(encoded) {
  return decodeURIComponent(encoded);
}

/**
 * Check if native module is loaded (always false now)
 * @returns {boolean}
 */
export function isNativeEnabled() {
  return false;
}

/**
 * Get native module version
 * @returns {string|null}
 */
export function getNativeVersion() {
  return null;
}

export default {
  stringify,
  parseUrl,
  parseQuery,
  decodeURI,
  isNativeEnabled,
  getNativeVersion,
};
