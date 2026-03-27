# Middleware / Interceptors

Vibe uses **interceptors** instead of middleware — they work the same way but have a cleaner name that reflects their purpose.

## How Interceptors Work

An interceptor is a function that runs **before** your route handler. It receives `(req, res)` and can:

- Modify `req` (attach user info, etc.)
- End the response early (return a 401, etc.)
- Call nothing to pass through to the next step

If an interceptor ends the response (via `res.json()`, `res.unauthorized()`, etc.), Vibe stops execution and the route handler never runs.

```js
function authMiddleware(req, res) {
  const token = req.headers.authorization;
  if (!token) {
    return res.unauthorized("No token provided");
  }
  req.user = verifyToken(token); // attach to request
}
```

## Global Interceptors

Run before **every** route in the app:

```js
app.plugin(loggingMiddleware);
app.plugin(corsMiddleware);
```

Multiple global interceptors run in registration order:

```js
app.plugin(cors);
app.plugin(rateLimiter);
app.plugin(auth);
```

## Route-Level Interceptors

Attach to a single route via the options object:

```js
app.get("/dashboard", { intercept: authMiddleware }, (req) => ({
  user: req.user,
}));
```

### Multiple Route Interceptors

Pass an array — they run in order:

```js
app.post(
  "/admin/users",
  { intercept: [authMiddleware, requireAdmin] },
  handler,
);
```

## Async Interceptors

Interceptors can be async:

```js
async function sessionMiddleware(req, res) {
  const session = await db.getSession(req.headers.cookie);
  if (!session) return res.unauthorized();
  req.session = session;
}
```

## Example: CORS

```js
function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

app.plugin(cors);
```

## Example: Rate Limiting

```js
const requests = new Map();

function rateLimiter(req, res) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60_000;
  const max = 100;

  const entry = requests.get(ip) || { count: 0, start: now };
  if (now - entry.start > windowMs) {
    entry.count = 0;
    entry.start = now;
  }

  entry.count++;
  requests.set(ip, entry);

  if (entry.count > max) {
    res.status(429).json({ error: "Too many requests" });
  }
}

app.plugin(rateLimiter);
```

## Example: JWT Auth

```js
import jwt from "jsonwebtoken";

function requireAuth(req, res) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.unauthorized();

  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
  } catch {
    return res.unauthorized("Invalid token");
  }
}

app.get("/me", { intercept: requireAuth }, (req) => req.user);
```

## Plugin-Scoped Interceptors

Interceptors can be scoped inside a `register()` plugin so they only apply to that plugin's routes:

```js
app.register(
  async (api) => {
    api.plugin(requireAuth); // only affects routes in this block

    api.get("/profile", (req) => req.user);
    api.get("/settings", (req) => ({ theme: "dark" }));
  },
  { prefix: "/account" },
);
```
