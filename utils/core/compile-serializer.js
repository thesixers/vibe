/**
 * Schema-based JSON serializer compiler.
 *
 * Uses `new Function()` code generation to produce zero-loop,
 * straight-line serializer functions from JSON schemas.
 * Each generated function directly accesses known properties
 * by name — no loops, no dynamic dispatch, no Object.keys().
 *
 * This is the same technique used by Fastify's fast-json-stringify.
 *
 * @module compile-serializer
 */

/**
 * Escapes a string for JSON output.
 * Handles: " \ \b \f \n \r \t and control chars.
 * This function is passed into generated serializers.
 */
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

/**
 * Compiles a JSON schema into a specialized serializer function
 * using code generation for maximum V8 optimization.
 *
 * @param {Object} schema - JSON schema (subset)
 * @returns {(data: any) => string} Compiled serializer
 */
export function compileSerializer(schema) {
  if (!schema || !schema.type) {
    return JSON.stringify;
  }

  return compileType(schema);
}

/**
 * Generates a code-gen serializer for an object schema.
 * Produces a single straight-line function with no loops.
 */
function compileObject(schema) {
  const props = schema.properties;
  if (!props) return JSON.stringify;

  const keys = Object.keys(props);
  if (keys.length === 0) return () => "{}";

  // Build the function body as a single expression
  const parts = [];

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const prop = props[key];
    const comma = i > 0 ? "," : "";
    const jsonKey = `${comma}"${key}":`;

    // Generate inline serialization code per property type
    parts.push({ key, jsonKey, type: prop.type || "unknown", schema: prop });
  }

  // Check if all string — ultra-fast codegen path
  const allSimple = parts.every(
    (p) =>
      p.type === "string" ||
      p.type === "number" ||
      p.type === "integer" ||
      p.type === "boolean",
  );

  if (allSimple && keys.length <= 16) {
    // Generate a straight-line function via new Function()
    // This avoids all loops and dynamic dispatch
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
      // Fallback if code-gen fails
      return buildFallbackSerializer(parts);
    }
  }

  // Complex types (nested objects, arrays) — use pre-compiled sub-serializers
  return buildComplexSerializer(parts);
}

/**
 * Builds a serializer for complex schemas with nested objects/arrays.
 * Uses pre-compiled child serializers (no code-gen).
 */
function buildComplexSerializer(parts) {
  // Pre-compile child serializers
  const entries = parts.map((p) => ({
    key: p.key,
    jsonKey: p.jsonKey,
    serializer: compileType(p.schema),
  }));

  return function serializeComplex(obj) {
    if (obj === null || obj === undefined) return "null";
    let result = "{";
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const v = obj[e.key];
      result += e.jsonKey;
      if (v === null || v === undefined) {
        result += "null";
      } else {
        result += e.serializer(v);
      }
    }
    return result + "}";
  };
}

/**
 * Fallback serializer when code-gen fails.
 */
function buildFallbackSerializer(parts) {
  const entries = parts.map((p) => ({
    key: p.key,
    jsonKey: p.jsonKey,
    type: p.type,
  }));

  return function serializeFallback(obj) {
    if (obj === null || obj === undefined) return "null";
    let result = "{";
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const v = obj[e.key];
      result += e.jsonKey;
      if (v === null || v === undefined) {
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

/**
 * Compiles a type-specific serializer from schema.
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
  if (v !== v || v === Infinity || v === -Infinity) return "null";
  return "" + v;
}

function serializeBoolean(v) {
  return v ? "true" : "false";
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
    const len = arr.length;
    if (len === 0) return "[]";

    let result = "[" + itemSerializer(arr[0]);
    for (let i = 1; i < len; i++) {
      result += "," + itemSerializer(arr[i]);
    }
    return result + "]";
  };
}

export default compileSerializer;
