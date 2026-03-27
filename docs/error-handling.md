# Error Handling

Vibe gives you three ways to trigger error handling from any route, and one central hook to control how errors are responded to.

## 1. Throw an Error

The most familiar pattern. Any uncaught `throw` inside a handler (sync or async) is caught automatically:

```js
app.get("/users/:id", async (req) => {
  const user = await db.find(req.params.id);
  if (!user) throw new Error("User not found");
  return user;
});
```

## 2. Return an Error

Return an `Error` object directly without halting the function — useful when you have conditional branches:

```js
app.get("/users/:id", async (req) => {
  const user = await db.find(req.params.id);
  if (!user) return new Error("User not found");
  return user;
});
```

## 3. `res.send(error)` / `res.json(error)`

Pass an `Error` instance to `res.send()` or `res.json()` and Vibe intercepts it:

```js
app.get("/data", (req, res) => {
  const err = new Error("Service unavailable");
  return res.send(err);
});
```

## 4. `res.serverError(error)`

Explicitly trigger the central error handler with a 500 response:

```js
app.get("/risky", async (req, res) => {
  try {
    await dangerousOperation();
  } catch (err) {
    return res.serverError(err);
  }
});
```

---

## Default Error Handler

When no custom handler is set, Vibe's default handler:

- Logs the error using `req.log.error(error)` (with full stack in dev, message only in production)
- Sends a JSON error response
- Automatically sets the correct status code based on error type

**Development response:**

```json
{ "error": "Internal Server Error", "message": "User not found" }
```

**Production response:**

```json
{ "error": "Internal Server Error" }
```

### Built-in Status Code Detection

| Error message contains | Status code                  |
| :--------------------- | :--------------------------- |
| `"exceeds max size"`   | `413 Payload Too Large`      |
| `"not allowed"`        | `415 Unsupported Media Type` |
| anything else          | `500 Internal Server Error`  |

---

## Custom Error Handler (`setErrorHandler`)

Override the default behavior with your own handler — giving you full control over logging, response format, and status codes:

```js
app.setErrorHandler((error, req, res) => {
  // Log with context
  req.log.error(error);

  // Determine status code
  const status = error.statusCode || 500;

  // Send a consistent response shape
  res.status(status).json({
    success: false,
    message: error.message,
    requestId: req.id,
  });
});
```

### Custom Error Classes

Combine `setErrorHandler` with custom error classes for clear, typed error handling:

```js
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.name = "AppError";
  }
}

class NotFoundError extends AppError {
  constructor(resource) {
    super(`${resource} not found`, 404);
  }
}

class ValidationError extends AppError {
  constructor(message, fields) {
    super(message, 400);
    this.fields = fields;
  }
}

// Register the handler
app.setErrorHandler((error, req, res) => {
  req.log.error(error, error.message, "red");

  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
      errors: error.fields,
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal Server Error",
    requestId: req.id,
  });
});

// Use in routes
app.get("/users/:id", async (req) => {
  const user = await db.find(req.params.id);
  if (!user) throw new NotFoundError("User");
  return user;
});

app.post("/users", (req) => {
  const { email } = req.body;
  if (!email) throw new ValidationError("Invalid body", { email: "Required" });
  // ...
});
```

### Async Error Handler

```js
app.setErrorHandler(async (error, req, res) => {
  await errorTracker.capture(error, { reqId: req.id });
  res.status(500).json({ success: false });
});
```

---

## Handling 404s

404 responses for unmatched routes are handled internally. You can override them with a wildcard route:

```js
app.get("/*", (req, res) => {
  res.notFound(`Route ${req.url} does not exist`);
});
```
