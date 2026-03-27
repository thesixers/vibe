# Caching

Vibe ships a built-in LRU (Least Recently Used) response cache with ETag support. Combine it with the `cacheMiddleware` to add automatic HTTP caching to any route.

## Import

```js
import { LRUCache, cacheMiddleware } from "vibe-gx";
```

## Quick Example

```js
const cache = new LRUCache({ maxSize: 500, ttl: 60_000 }); // 500 entries, 60s TTL

app.get("/products", cacheMiddleware(cache), async () => {
  return await db.getAllProducts();
});
```

The first request fetches from the database. Subsequent identical requests (same URL + query) are served from memory in microseconds.

## `LRUCache` Options

| Option    | Type     | Default | Description                                 |
| :-------- | :------- | :------ | :------------------------------------------ |
| `maxSize` | `number` | `1000`  | Maximum number of entries to hold in memory |
| `ttl`     | `number` | `60000` | Time-to-live in milliseconds                |

## `cacheMiddleware(cache)`

Returns a Vibe interceptor function. Use it as a route-level interceptor:

```js
const cache = new LRUCache({ maxSize: 200, ttl: 30_000 });

// Apply to a specific route
app.get("/categories", cacheMiddleware(cache), fetchCategories);

// Apply to multiple routes with the same cache instance
app.get("/tags", cacheMiddleware(cache), fetchTags);
```

## Cache Key

Cache keys are automatically composed from:

- `req.method` + `req.url` (pathname)
- Serialized `req.query` (query string parameters)

This means `/users?page=1` and `/users?page=2` get **separate** cache entries — no stale pagination bugs.

## ETag Support

`cacheMiddleware` automatically sets `ETag` headers. Clients that respect ETags will receive `304 Not Modified` without re-downloading the body, reducing bandwidth.

## Per-Route Cache Instances

Different routes can have different cache sizes and TTLs:

```js
// Heavy data — large cache, long TTL
const productCache = new LRUCache({ maxSize: 1000, ttl: 5 * 60_000 });

// User-specific data — smaller cache, short TTL
const userCache = new LRUCache({ maxSize: 100, ttl: 10_000 });

app.get("/products", cacheMiddleware(productCache), fetchProducts);
app.get("/me", { intercept: requireAuth }, cacheMiddleware(userCache), fetchMe);
```

## Global Cache

Apply the same cache to all routes via a global interceptor:

```js
const globalCache = new LRUCache({ maxSize: 2000, ttl: 30_000 });

app.plugin(cacheMiddleware(globalCache)); // applies to every GET route
```

## Bypassing Cache Per Request

Check a header or query param to skip caching for specific clients:

```js
function conditionalCache(cache) {
  return (req, res, next) => {
    if (req.headers["cache-control"] === "no-cache") return; // skip
    return cacheMiddleware(cache)(req, res);
  };
}
```

## Manual Cache Control

Access the `LRUCache` instance directly to manage entries:

```js
const cache = new LRUCache({ maxSize: 500, ttl: 60_000 });

// Invalidate cache after a write operation
app.post("/products", async (req) => {
  const product = await db.createProduct(req.body);
  cache.clear(); // or implement targeted invalidation
  return product;
});
```
