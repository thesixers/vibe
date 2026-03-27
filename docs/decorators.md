# Decorators

Decorators let you extend the `app` instance, every `req`, or every `res` with custom properties or methods. They are set up once at startup and have zero per-request allocation cost.

## `app.decorate(name, value)`

Add a property to the app instance itself:

```js
app.decorate("db", databaseConnection);
app.decorate("config", { maxUploadSize: 10_000_000 });

// Access anywhere you have the app reference
app.get("/status", () => ({
  dbConnected: app.db.isConnected(),
}));
```

## `app.decorateRequest(name, value)`

Add a property to **all** `req` objects. The value can be a constant or a factory function:

```js
// Static value
app.decorateRequest("language", "en");

// Factory function (computed fresh per request)
app.decorateRequest("timestamp", () => Date.now());

// Access in handlers
app.get("/info", (req) => ({
  language: req.language,
  at: req.timestamp,
}));
```

## `app.decorateReply(name, value)`

Add a property or method to **all** `res` objects:

```js
// Add a custom response helper
app.decorateReply("paginated", function (data, total, page, limit) {
  this.json({
    success: true,
    data,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  });
});

// Use in handlers
app.get("/users", async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const { users, total } = await db.getUsers(page, limit);
  res.paginated(users, total, page, limit);
});
```

## Practical Examples

### Attaching a Database

```js
import { createPool } from "vibe-gx";

const db = createPool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

app.decorate("db", db);

// Now accessible in all routes via app.db
// But typically you export 'app' and import it wherever needed
```

### Per-Request Auth Decorator

```js
app.decorateRequest("user", null);

app.plugin(async (req, res) => {
  const token = req.headers.authorization?.slice(7);
  if (token) {
    req.user = await verifyToken(token);
  }
});

app.get("/me", (req) => {
  if (!req.user) return res.unauthorized();
  return req.user;
});
```

### Custom Response Format

```js
app.decorateReply("apiResponse", function (data, meta = {}) {
  this.json({
    success: true,
    data,
    meta: {
      requestId: this.req?.id,
      timestamp: new Date().toISOString(),
      ...meta,
    },
  });
});

app.get("/products", async (req, res) => {
  const products = await db.getProducts();
  res.apiResponse(products, { count: products.length });
});
```

## Accessing Decorators

You can read all registered decorators programmatically:

```js
console.log(app.decorators);
// { db: ..., config: ... }
```
