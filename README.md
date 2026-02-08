<div align="center">
  <img src="./assets/vlogo.png" alt="Vibe Logo" width="180" />
  <h1>Vibe</h1>
  <p>
    <b>The fastest Node.js web framework with the simplest syntax.</b>
  </p>
  <p>
    <img src="https://img.shields.io/badge/performance-14,687_RPS-brightgreen" alt="Performance" />
    <img src="https://img.shields.io/badge/vs_Express-2.2x_faster-blue" alt="vs Express" />
    <img src="https://img.shields.io/badge/vs_Fastify-30%25_faster-orange" alt="vs Fastify" />
  </p>
</div>

---

## 🏆 Why Vibe?

| Metric                    |      Vibe      |  Express  |  Fastify   |
| :------------------------ | :------------: | :-------: | :--------: |
| **JSON Performance**      | **14,687 RPS** | 6,629 RPS | 11,289 RPS |
| **Install Size**          |  **~280 KB**   |   ~5 MB   |   ~4 MB    |
| **Lines for Hello World** |       3        |     5     |     6      |
| **Dependencies**          |       2        |    30+    |    15+     |
| **Built-in Clustering**   |       ✅       |    ❌     |     ❌     |
| **Built-in Caching**      |       ✅       |    ❌     |     ❌     |
| **C++ Optimizations**     |       ✅       |    ❌     |     ❌     |

> **Vibe is faster than Fastify, simpler than Express, and 14-18x smaller than both.**

---

## ⚡ Features

| Feature                  | Description                                                |
| :----------------------- | :--------------------------------------------------------- |
| 🚀 **C++ Native Module** | JSON stringify & URL parsing in C++                        |
| 🎯 **Hybrid Router**     | O(1) static + O(log n) Trie routing                        |
| 🔌 **Plugin System**     | Fastify-style `register()` with encapsulation              |
| 🎨 **Decorators**        | Extend app, request, and response                          |
| ⚡ **Cluster Mode**      | Built-in multi-process scaling                             |
| 💾 **LRU Cache**         | Built-in response caching with ETag                        |
| 🔗 **Connection Pool**   | Generic pool for databases                                 |
| 📂 **Streaming**         | Large file uploads without buffering                       |
| 🔒 **Security**          | Path traversal protection, body limits, error sanitization |
| 🔄 **Express Adapter**   | Use any Express middleware with `adapt()`                  |

---

## 🚀 Quick Start

```javascript
import vibe from "vibe";

const app = vibe();

// Direct value - no callback needed!
app.get("/", "Hello Vibe!");

// Auto JSON response - just return an object
app.get("/users/:id", (req) => ({ userId: req.params.id }));

app.listen(3000);
```

**That's it.** No `res.send()`, no `res.json()` - just return data.

---

## 📊 Benchmarks

Tested with 5,000 requests, 50 concurrency:

```
Framework    | JSON RPS    | vs Express | vs Fastify
-------------|-------------|------------|------------
Vibe         | 14,687      | 2.2x ✅    | 1.3x ✅
Fastify      | 11,289      | 1.7x       | baseline
Express      | 6,629       | baseline   | 0.6x
```

Run benchmarks yourself:

```bash
npm run benchmark
```

---

## 📖 Core API

### Routes

```javascript
// Simple string response
app.get("/", "Hello World");

// JSON response (just return object)
app.get("/json", { message: "Hello" });

// With handler function
app.get("/users/:id", (req) => ({ id: req.params.id }));

// With interceptor (middleware)
app.post("/protected", { intercept: authCheck }, handler);

// All HTTP methods
app.get() / app.post() / app.put() / app.del() / app.patch() / app.head();
```

### Plugins (Fastify-style)

```javascript
// Register with prefix
await app.register(
  async (app) => {
    app.get("/status", { status: "ok" }); // GET /api/status
    app.get("/health", { healthy: true }); // GET /api/health
  },
  { prefix: "/api" },
);
```

### Decorators

```javascript
app.decorate("config", { env: "prod" });
app.decorateRequest("user", null);
app.decorateReply("sendSuccess", function (data) {
  this.success(data);
});
```

### Express Middleware Adapter

```javascript
import { adapt } from "vibe/utils/helpers/adapt.js";
import cors from "cors";
import helmet from "helmet";

app.plugin(adapt(cors()));
app.plugin(adapt(helmet()));
```

---

## 🔥 Scalability

### Cluster Mode

```javascript
import vibe, { clusterize } from "vibe";

clusterize(
  () => {
    const app = vibe();
    app.get("/", "Hello from worker!");
    app.listen(3000);
  },
  { workers: 4, restart: true },
);
```

### Response Caching

```javascript
import vibe, { LRUCache, cacheMiddleware } from "vibe";

const cache = new LRUCache({ max: 1000, ttl: 60000 });

app.get("/data", { intercept: cacheMiddleware(cache) }, () => {
  return { expensive: "computation" };
});
```

### Connection Pool

```javascript
import vibe, { createPool } from "vibe";

const dbPool = createPool({
  create: async () => new DBConnection(),
  destroy: async (conn) => conn.close(),
  max: 10,
});

app.get("/users", async () => {
  return await dbPool.use((conn) => conn.query("SELECT * FROM users"));
});
```

### Streaming Uploads

```javascript
app.post("/upload", { media: { streaming: true } }, (req) => {
  req.on("file", (name, stream, info) => {
    stream.pipe(fs.createWriteStream(`/uploads/${info.filename}`));
  });
  return { status: "uploading" };
});
```

---

## 🔒 Security

Built-in protections:

| Feature                                 | Status |
| :-------------------------------------- | :----: |
| Path traversal protection               |   ✅   |
| File type validation                    |   ✅   |
| Body size limits (1MB JSON, 10MB files) |   ✅   |
| Error sanitization (production mode)    |   ✅   |
| Safe filename generation                |   ✅   |
| Port validation                         |   ✅   |

Set `NODE_ENV=production` for secure error handling.

---

## 🛠️ API Reference

### Application

| Method                                           | Description          |
| :----------------------------------------------- | :------------------- |
| `app.get/post/put/del/patch/head(path, handler)` | Register route       |
| `app.listen(port, host?, callback?)`             | Start server         |
| `app.register(fn, { prefix })`                   | Register plugin      |
| `app.plugin(fn)`                                 | Global interceptor   |
| `app.decorate(name, value)`                      | Add app property     |
| `app.decorateRequest(name, value)`               | Add to all requests  |
| `app.decorateReply(name, value)`                 | Add to all responses |

### Request (`req`)

| Property     | Description                |
| :----------- | :------------------------- |
| `req.params` | Route parameters           |
| `req.query`  | Query string (lazy parsed) |
| `req.body`   | Parsed body                |
| `req.files`  | Uploaded files             |
| `req.ip`     | Client IP                  |

### Response (`res`)

| Method                     | Description      |
| :------------------------- | :--------------- |
| `res.json(data)`           | Send JSON        |
| `res.send(data)`           | Send response    |
| `res.status(code)`         | Set status code  |
| `res.success(data)`        | 200 OK           |
| `res.created(data)`        | 201 Created      |
| `res.badRequest(msg?)`     | 400              |
| `res.unauthorized(msg?)`   | 401              |
| `res.forbidden(msg?)`      | 403              |
| `res.notFound(msg?)`       | 404              |
| `res.serverError(err?)`    | 500              |
| `res.redirect(url, code?)` | Redirect         |
| `res.sendFile(path)`       | Send static file |
| `res.sendHtml(path)`       | Send HTML file   |

---

## 📦 Installation

```bash
npm install vibe-gx
```

### Building Native Module (Optional)

For maximum performance, build the C++ native module:

```bash
npm run build:native
```

If the build fails, Vibe automatically falls back to pure JavaScript.

---

## 📝 License

Part of the **GeNeSix** brand. Created by **Nnamdi "Joe" Amaga**.

MIT License.
