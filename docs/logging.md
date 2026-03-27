# Logging

Vibe ships a built-in structured logger that outputs Pino-compatible JSON — making it production-ready out of the box, compatible with log aggregators (Datadog, ELK, etc.) while offering a beautiful terminal experience for development.

## Initialization

```js
const app = vibe({
  logger: {
    lifecycle: true, // Auto-log request start + completion
    prettyPrint: true, // Human-readable output in terminal
    level: "info", // Minimum log level (default: "info")
  },
});
```

Set `logger: false` to disable logging entirely.

## Log Levels

| Level | Method     | Value | Use for                           |
| :---- | :--------- | :---- | :-------------------------------- |
| Trace | `.trace()` | 10    | Very verbose internal tracing     |
| Debug | `.debug()` | 20    | Development debugging             |
| Info  | `.info()`  | 30    | General operational messages      |
| Warn  | `.warn()`  | 40    | Unexpected but recoverable states |
| Error | `.error()` | 50    | Errors that need attention        |
| Fatal | `.fatal()` | 60    | Critical failures                 |

## Application-Level Logging (`app.log`)

Use `app.log` for messages outside of route handlers:

```js
app.log.info("Server is starting...");
app.log.info({ port: 3000, env: "production" }, "Server ready");
app.log.error(new Error("DB connection failed"));
```

## Request-Level Logging (`req.log`)

Inside a route handler, always use `req.log`. Every log line is automatically tagged with the request's unique UUID (`req.id`), so you can trace a full request lifecycle across multiple log lines:

```js
app.get("/checkout", async (req) => {
  req.log.info("Starting checkout");

  const cart = await getCart(req.user.id);
  req.log.info({ items: cart.length }, "Cart fetched");

  const order = await processOrder(cart);
  req.log.info({ orderId: order.id }, "Order placed");

  return order;
});
```

**Production output:**

```json
{"level":30,"time":1711481234123,"pid":1234,"hostname":"server","reqId":"c677...","msg":"Starting checkout"}
{"level":30,"time":1711481234145,"pid":1234,"hostname":"server","reqId":"c677...","items":3,"msg":"Cart fetched"}
{"level":30,"time":1711481234201,"pid":1234,"hostname":"server","reqId":"c677...","orderId":99,"msg":"Order placed"}
```

**Development (`prettyPrint: true`) output:**

```
[VIBE INFO 7:15:14 PM] [c677...] Starting checkout
[VIBE INFO 7:15:14 PM] [c677...] Cart fetched items=3
[VIBE INFO 7:15:14 PM] [c677...] Order placed orderId=99
```

## Signatures

All logger methods follow the same overloaded signature:

```js
// String message only
req.log.info("User authenticated");

// String message + color (prettyPrint mode only)
req.log.info("User authenticated", "green");

// Structured object + message
req.log.info({ userId: 42, duration: "23ms" }, "DB query complete");

// Structured object + message + color
req.log.warn({ userId: 42 }, "Slow query detected", "yellow");

// Error object (stack trace serialized automatically)
req.log.error(new Error("Connection refused"));

// Error + optional extra message
req.log.error(new Error("Timeout"), "Payment gateway failed");
```

## Color Support

Pass a color name as the last argument. Active only in `prettyPrint` mode — in production it writes `{ "color": "cyan" }` to the JSON payload for indexing.

**Supported colors:** `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`, `dim`, `bright`, `reset`

```js
req.log.info("Deployment started", "cyan");
req.log.warn("High memory usage", "yellow");
req.log.error("Service unreachable", "red");
```

## Lifecycle Hooks

When `lifecycle: true` is set, Vibe automatically logs:

1. **Incoming request** — method, URL, req.id
2. **Request completed** — status code, response time in ms

```
[VIBE INFO 7:15:14 PM] [c677...] Incoming request type="req"
[VIBE INFO 7:15:14 PM] [c677...] Request completed type="res" statusCode=200 responseTimeMs=23
```

## Child Loggers

Create a narrowed logger with additional context pre-bound:

```js
const dbLogger = app.log.child({ component: "database" });
dbLogger.info("Query started");
// {"component":"database","msg":"Query started",...}
```

## Custom Stream

Redirect log output to a file or any writable stream:

```js
import { createWriteStream } from "fs";

const app = vibe({
  logger: { stream: createWriteStream("./app.log") },
});
```
