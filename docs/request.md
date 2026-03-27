# The Request Object (`req`)

Every route handler receives `req` as its first argument. Vibe extends the native Node.js `IncomingMessage` with convenient properties.

## Quick Reference

| Property      | Type                     | Description                                 |
| :------------ | :----------------------- | :------------------------------------------ |
| `req.params`  | `Record<string, string>` | URL route parameters (`/users/:id`)         |
| `req.query`   | `Record<string, string>` | Parsed query string (`?page=2`)             |
| `req.body`    | `Record<string, any>`    | Parsed JSON or URL-encoded body             |
| `req.files`   | `UploadedFile[]`         | Uploaded files (multipart)                  |
| `req.id`      | `string`                 | Auto-generated UUID for this request        |
| `req.log`     | `LoggerAPI`              | Context-bound logger (tagged with `req.id`) |
| `req.ip`      | `string`                 | Client IP address                           |
| `req.method`  | `string`                 | HTTP method (`GET`, `POST`, etc.)           |
| `req.url`     | `string`                 | Request pathname (without query string)     |
| `req.headers` | `IncomingHttpHeaders`    | All request headers                         |

## Route Parameters (`req.params`)

Populated from dynamic route segments defined with `:paramName`:

```js
app.get("/users/:id/posts/:postId", (req) => {
  console.log(req.params.id); // "42"
  console.log(req.params.postId); // "7"
});
```

## Query String (`req.query`)

Parsed lazily on first access. URL-encoded values are automatically decoded:

```js
app.get("/search", (req) => {
  // GET /search?q=hello+world&page=2
  console.log(req.query.q); // "hello world"
  console.log(req.query.page); // "2"
});
```

## Request Body (`req.body`)

Automatically parsed for `POST`, `PUT`, and `PATCH` requests.

### JSON Body

```js
app.post("/users", (req) => {
  const { name, email } = req.body;
  return { created: { name, email } };
});
// Content-Type: application/json
// { "name": "Alice", "email": "alice@example.com" }
```

### URL-Encoded Form Body

```js
app.post("/login", (req) => {
  const { username, password } = req.body;
  // ...
});
// Content-Type: application/x-www-form-urlencoded
```

### Empty Body

If no body is sent, `req.body` is an empty object `{}`.

## File Uploads (`req.files`)

Available when a route is configured with `media` options. See [File Uploads](./file-uploads.md) for full details.

```js
app.post("/upload", { media: { dest: "uploads" } }, (req) => {
  const [file] = req.files;
  return { filename: file.filename, size: file.size };
});
```

## Request ID (`req.id`)

Every request is automatically assigned a UUID:

```js
app.get("/info", (req) => {
  console.log(req.id); // "c6772593-8fbc-4f82-927d-d9a793a8ff1e"
});
```

## Context Logger (`req.log`)

A structured logger pre-bound with the request's `req.id`. All log lines for a given request share the same ID, making distributed tracing effortless:

```js
app.get("/orders", async (req) => {
  req.log.info("Fetching orders");
  const orders = await db.getOrders();
  req.log.info({ count: orders.length }, "Orders fetched");
  return orders;
});
```

See [Logging](./logging.md) for full details.

## Client IP (`req.ip`)

```js
app.get("/whoami", (req) => {
  return { ip: req.ip };
});
```

Vibe also respects the `x-forwarded-for` header when behind a proxy.

## Raw Headers

```js
app.get("/agent", (req) => {
  return { userAgent: req.headers["user-agent"] };
});
```
