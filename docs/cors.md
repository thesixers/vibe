# CORS

Vibe ships with a built-in CORS helper. No external dependencies required.

## Import

```js
import { cors } from "vibe-gx";
```

## Basic Usage

```js
import vibe, { cors } from "vibe-gx";

const app = vibe();

app.plugin(cors({ origin: "https://myapp.com" }));

app.listen(3000);
```

## Allow All Origins

```js
app.plugin(cors()); // defaults to origin: "*"
// or explicitly:
app.plugin(cors({ origin: "*" }));
```

> ⚠️ Wildcard `*` cannot be used with `credentials: true`. Use an explicit origin instead.

## With Credentials (Cookies / Auth Headers)

```js
app.plugin(cors({
  origin: "https://myapp.com",
  credentials: true,
}));
```

## Multiple Allowed Origins

```js
app.plugin(cors({
  origin: ["https://myapp.com", "https://admin.myapp.com"],
  credentials: true,
}));
```

## Dynamic Origin (Function)

```js
const allowedOrigins = new Set(["https://myapp.com", "https://partner.com"]);

app.plugin(cors({
  origin: (incomingOrigin) => allowedOrigins.has(incomingOrigin),
  credentials: true,
}));
```

## Full Options

```js
app.plugin(cors({
  origin: "https://myapp.com",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Custom-Header"],
  exposedHeaders: ["X-RateLimit-Remaining"],
  credentials: true,
  maxAge: 86400, // cache preflight for 24 hours
}));
```

## Options Reference

| Option           | Type                                        | Default                                      | Description                                                      |
| :--------------- | :------------------------------------------ | :------------------------------------------- | :--------------------------------------------------------------- |
| `origin`         | `string \| string[] \| (origin) => boolean` | `"*"`                                        | Allowed origin(s)                                                |
| `methods`        | `string[]`                                  | `["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"]` | Allowed HTTP methods                                |
| `allowedHeaders` | `string[]`                                  | `["Content-Type", "Authorization"]`          | Headers the browser is allowed to send                           |
| `exposedHeaders` | `string[]`                                  | `[]`                                         | Headers the browser is allowed to read from the response         |
| `credentials`    | `boolean`                                   | `false`                                      | Allow cookies and `Authorization` headers                        |
| `maxAge`         | `number`                                    | —                                            | Seconds to cache the preflight response (reduces OPTIONS calls)  |

## Preflight Caching (`maxAge`)

Before every cross-origin request, browsers send a **preflight** — an `OPTIONS` request asking your server "am I allowed to do this?". Without `maxAge`, this happens before **every single request**, doubling your round trips:

```
OPTIONS /api/users   ← preflight
GET    /api/users    ← actual request
OPTIONS /api/posts   ← preflight again
GET    /api/posts    ← actual request
```

Setting `maxAge` tells the browser to **cache the preflight result** for that many seconds. After the first `OPTIONS`, all subsequent requests skip it:

```
OPTIONS /api/users   ← preflight (once)
GET    /api/users    ← actual request
GET    /api/posts    ← no preflight, browser remembers
GET    /api/comments ← no preflight
```

```js
app.plugin(cors({
  origin: "https://myapp.com",
  maxAge: 86_400, // cache for 24 hours
}));
```

> Chrome caps `maxAge` at 7200 seconds (2 hours). Firefox allows up to 86400 (24 hours).


## How It Works

- **Simple requests** (GET, POST with standard headers) — CORS headers are added to the response automatically.
- **Preflight requests** (`OPTIONS` with `Origin` header) — Vibe responds immediately with `204 No Content` and the appropriate headers, then stops. Your route handler is never called for preflight.
- If the request has no `Origin` header (e.g. a server-to-server call), CORS headers are skipped entirely.
