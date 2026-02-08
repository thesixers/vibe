/**
 * Radix Trie for efficient route matching.
 * Provides O(log n) average-case lookup instead of O(n) linear search.
 */

/**
 * @typedef {Object} TrieNode
 * @property {Map<string, TrieNode>} children - Static segment children
 * @property {TrieNode|null} paramChild - Dynamic parameter child (e.g., :id)
 * @property {TrieNode|null} wildcardChild - Wildcard child (*)
 * @property {string|null} paramName - Name of the parameter if this is a param node
 * @property {import("../vibe.js").VibeRoute|null} route - The route if this is an endpoint
 */

/**
 * Creates a new trie node.
 * @returns {TrieNode}
 */
function createNode() {
  return {
    children: new Map(),
    paramChild: null,
    wildcardChild: null,
    paramName: null,
    route: null,
  };
}

/**
 * Route Trie class for efficient route matching.
 */
export class RouteTrie {
  constructor() {
    // Separate tries for each HTTP method
    this.methods = new Map();
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
  insert(method, path, route) {
    const root = this.getMethodRoot(method);
    const segments = path.split("/").filter(Boolean);

    // Handle root path
    if (segments.length === 0) {
      root.route = route;
      return;
    }

    let current = root;

    for (const segment of segments) {
      if (segment.startsWith(":")) {
        // Dynamic parameter segment
        if (!current.paramChild) {
          current.paramChild = createNode();
          current.paramChild.paramName = segment.slice(1);
        }
        current = current.paramChild;
      } else if (segment === "*") {
        // Wildcard segment
        if (!current.wildcardChild) {
          current.wildcardChild = createNode();
        }
        current = current.wildcardChild;
        // Wildcard captures everything, break here
        break;
      } else {
        // Static segment
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
  match(method, path) {
    const root = this.methods.get(method);
    if (!root) return null;

    const segments = path.split("/").filter(Boolean);
    const params = {};

    // Handle root path
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
    // Base case: all segments matched
    if (index === segments.length) {
      if (node.route) {
        return { route: node.route, params: { ...params } };
      }
      return null;
    }

    const segment = segments[index];

    // 1. Try static match first (highest priority)
    if (node.children.has(segment)) {
      const result = this._matchRecursive(
        node.children.get(segment),
        segments,
        index + 1,
        params,
      );
      if (result) return result;
    }

    // 2. Try parameter match
    if (node.paramChild) {
      const newParams = { ...params, [node.paramChild.paramName]: segment };
      const result = this._matchRecursive(
        node.paramChild,
        segments,
        index + 1,
        newParams,
      );
      if (result) return result;
    }

    // 3. Try wildcard match (lowest priority, captures rest)
    if (node.wildcardChild) {
      const remaining = segments.slice(index).join("/");
      if (node.wildcardChild.route) {
        return {
          route: node.wildcardChild.route,
          params: { ...params, wildcard: remaining },
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
  _collectRoutes(node, path, method, routes) {
    if (node.route) {
      routes.push({ method, path: path || "/" });
    }

    for (const [segment, child] of node.children) {
      this._collectRoutes(child, `${path}/${segment}`, method, routes);
    }

    if (node.paramChild) {
      this._collectRoutes(
        node.paramChild,
        `${path}/:${node.paramChild.paramName}`,
        method,
        routes,
      );
    }

    if (node.wildcardChild) {
      this._collectRoutes(node.wildcardChild, `${path}/*`, method, routes);
    }
  }
}
