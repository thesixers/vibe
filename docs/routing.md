# Routing

Vibe supports the standard HTTP methods. Every route handler can return a value directly — Vibe sends it automatically.

## Defining Routes

```js
app.get("/path", handler);
app.post("/path", handler);
app.put("/path", handler);
app.del("/path", handler); // DELETE (avoids JS reserved word)
app.patch("/path", handler);
app.head("/path", handler);
```

## Handler Return Values

The simplest way to send a response is to return a value from your handler:

```js
// Return an object → JSON response
app.get("/user", () => ({ name: "Alice", age: 30 }));

// Return a string → text response
app.get("/hello", () => "Hello, world!");

// Return a number → text response
app.get("/count", () => 42);

// Return nothing / call res manually
app.get("/manual", (req, res) => {
  res.status(201).json({ created: true });
});

// Return an Error → triggers the error handler
app.get("/fail", () => new Error("Something went wrong"));
```

## Route Parameters

Use `:paramName` to capture dynamic segments:

```js
app.get("/users/:id", (req) => {
  const { id } = req.params;
  return { userId: id };
});

// Multiple params
app.get("/posts/:postId/comments/:commentId", (req) => {
  const { postId, commentId } = req.params;
  return { postId, commentId };
});
```

## Query Parameters

Query strings (`?key=value`) are lazily parsed and available on `req.query`:

```js
app.get("/search", (req) => {
  const { q, page = "1" } = req.query;
  return { query: q, page: parseInt(page) };
});
// GET /search?q=vibe&page=2
```

## Wildcard Routes

Use `*` to match any remaining path segment:

```js
app.get("/files/*", (req) => {
  return { path: req.url };
});
// Matches: /files/images/avatar.png
```

## Async Handlers

All handlers support `async/await` natively:

```js
app.get("/data", async (req) => {
  const result = await db.query("SELECT * FROM users");
  return result;
});
```

## Route-Level Interceptors

Attach middleware to a specific route using the options object:

```js
import { authMiddleware } from "./guards.js";

app.get("/protected", { intercept: authMiddleware }, (req) => ({
  secret: "data",
}));

// Multiple interceptors run in order
app.post(
  "/admin/publish",
  { intercept: [authMiddleware, adminGuard] },
  handler,
);
```

## Schema Serialization (Fast JSON)

Pre-compile a JSON serializer for a route to get maximum output performance:

```js
app.get(
  "/products",
  {
    schema: {
      response: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
            price: { type: "number" },
          },
        },
      },
    },
  },
  async () => {
    return await db.getProducts();
  },
);
```

## Logging All Routes

```js
app.logRoutes();
// Prints a table of all registered routes to the console
```
