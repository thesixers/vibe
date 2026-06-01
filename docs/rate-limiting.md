# Rate Limiting

Vibe ships with a built-in sliding window rate limiter. No external dependencies required.

## Import

```js
import { rateLimit } from "vibe-gx";
```

## Global Rate Limit

Apply a limit to every route in your app:

```js
import vibe, { rateLimit } from "vibe-gx";

const app = vibe();

app.plugin(rateLimit({ max: 100, window: 60_000 })); // 100 requests per minute per IP

app.listen(3000);
```

## Per-Route Rate Limit

Apply a tighter limit to a specific route:

```js
app.post(
  "/auth/login",
  { intercept: rateLimit({ max: 5, window: 60_000 }) }, // 5 attempts per minute
  loginHandler,
);
```

## Options

| Option       | Type                          | Default               | Description                                              |
| :----------- | :---------------------------- | :-------------------- | :------------------------------------------------------- |
| `max`        | `number`                      | **required**          | Maximum requests allowed per window                      |
| `window`     | `number`                      | `60000` (1 min)       | Window duration in milliseconds                          |
| `keyBy`      | `(req) => string`             | `req.ip`              | Custom function to derive the rate limit key             |
| `message`    | `string`                      | `"Too Many Requests"` | Response body when limit is exceeded                     |
| `statusCode` | `number`                      | `429`                 | HTTP status code when limit is exceeded                  |
| `skip`       | `(req) => boolean`            | —                     | Return `true` to bypass rate limiting for a request      |

## Response Headers

Every response includes rate limit info headers:

| Header                  | Description                                        |
| :---------------------- | :------------------------------------------------- |
| `X-RateLimit-Limit`     | Maximum requests allowed in the window             |
| `X-RateLimit-Remaining` | Remaining requests in the current window           |
| `X-RateLimit-Reset`     | Unix timestamp (seconds) when the window resets    |
| `Retry-After`           | Seconds to wait before retrying (only on 429)      |

## Custom Key (Rate Limit per Token)

By default the limiter keys by `req.ip`. You can key by anything:

```js
// Rate limit per auth token instead of IP
app.plugin(
  rateLimit({
    max: 1000,
    window: 60_000,
    keyBy: (req) => req.headers["authorization"] ?? req.ip,
  }),
);
```

## Skip Certain Requests

Bypass the limiter for internal traffic or health checks:

```js
app.plugin(
  rateLimit({
    max: 100,
    window: 60_000,
    skip: (req) => req.ip === "127.0.0.1", // skip localhost
  }),
);
```

## Combine Global + Per-Route

You can stack a loose global limit with a tight per-route limit:

```js
// Loose global guard
app.plugin(rateLimit({ max: 200, window: 60_000 }));

// Tight limit on sensitive routes
const loginLimit = rateLimit({ max: 5, window: 60_000, message: "Too many login attempts. Try again later." });
const otpLimit   = rateLimit({ max: 3, window: 300_000 }); // 3 per 5 minutes

app.post("/auth/login",    { intercept: loginLimit }, loginHandler);
app.post("/auth/otp",      { intercept: otpLimit },   otpHandler);
```

## Multi-Worker Note

The rate limiter uses an in-memory store. In a multi-worker cluster setup (e.g. using `clusterize` with multiple workers), each worker has its own counter — limits are not shared across workers. For shared rate limiting across workers, use an external store like Redis.
