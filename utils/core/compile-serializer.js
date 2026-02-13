/**
 * Schema-based JSON serializer compiler.
 *
 * Pre-compiles a specialized stringify function from a JSON schema
 * at route registration time. The generated function knows the exact
 * object shape, avoiding Object.keys() enumeration and type-checking
 * at request time.
 *
 * @module compile-serializer
 */

/**
 * Compiles a JSON schema into a specialized serializer function.
 *
 * @param {Object} schema - JSON schema (subset)
 * @returns {(data: any) => string} Compiled serializer
 */
export function compileSerializer(schema) {
  if (!schema || !schema.type) {
    return JSON.stringify;
  }

  const fn = compileType(schema);
  return fn;
}

/**
 * Escapes a string for JSON output.
 * Handles: " \ \b \f \n \r \t and control chars
 */
const escapeChar = {
  '"': '\\"',
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};

function escapeString(str) {
  let result = '"';
  let last = 0;

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // Check for characters that need escaping
    if (code === 34 || code === 92 || code < 32) {
      const char = str[i];
      if (i > last) result += str.slice(last, i);
      result += escapeChar[char] || "\\u" + code.toString(16).padStart(4, "0");
      last = i + 1;
    }
  }

  if (last === 0) return '"' + str + '"';
  if (last < str.length) result += str.slice(last);
  return result + '"';
}

/**
 * Compiles a type-specific serializer from schema.
 * Returns a function (value) => string.
 */
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
  if (v !== v || v === Infinity || v === -Infinity) return "null"; // NaN, Inf
  return "" + v;
}

function serializeBoolean(v) {
  return v ? "true" : "false";
}

/**
 * Compiles an object serializer from schema.properties.
 *
 * Generates a function that directly accesses known properties
 * by name, avoiding Object.keys() enumeration entirely.
 */
function compileObject(schema) {
  const props = schema.properties;
  if (!props) return JSON.stringify;

  const keys = Object.keys(props);
  if (keys.length === 0) return () => "{}";

  // Pre-compute property serializers and JSON key prefixes
  const entries = keys.map((key, i) => {
    const serializer = compileType(props[key]);
    // Pre-stringify the key + colon (and comma for non-first)
    const prefix = (i > 0 ? "," : "") + '"' + key + '":';
    return { key, serializer, prefix };
  });

  // Check if all properties are simple strings — ultra-fast path
  const allStrings = keys.every((k) => props[k].type === "string");

  if (allStrings && keys.length <= 8) {
    // Ultra-fast path for small all-string objects (most common API response)
    return function serializeStringObject(obj) {
      if (obj === null || obj === undefined) return "null";
      let result = "{";
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const v = obj[e.key];
        result += e.prefix;
        result += v === undefined || v === null ? "null" : escapeString("" + v);
      }
      return result + "}";
    };
  }

  // General path for mixed-type objects
  return function serializeObject(obj) {
    if (obj === null || obj === undefined) return "null";
    let result = "{";
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const v = obj[e.key];
      result += e.prefix;
      if (v === undefined || v === null) {
        result += "null";
      } else {
        result += e.serializer(v);
      }
    }
    return result + "}";
  };
}

/**
 * Compiles an array serializer from schema.items.
 */
function compileArray(schema) {
  const itemSerializer = schema.items
    ? compileType(schema.items)
    : JSON.stringify;

  return function serializeArray(arr) {
    if (!Array.isArray(arr)) return "null";
    if (arr.length === 0) return "[]";

    let result = "[" + itemSerializer(arr[0]);
    for (let i = 1; i < arr.length; i++) {
      result += "," + itemSerializer(arr[i]);
    }
    return result + "]";
  };
}

export default compileSerializer;
