# Vibe

> **A lightweight, regex-based Node.js web framework built for speed and simplicity.**

Vibe (part of the **GeNeSix** ecosystem) is a zero-dependency* web framework designed to give developers full control over the HTTP lifecycle. It features a custom regex router, built-in body parsing, and a robust middleware system—all without the bloat.

**Only dependency is `busboy` for high-performance file parsing.**

## ⚡ Features

- **🚀 Zero-Bloat Routing:** Custom Regex-based routing engine supporting dynamic parameters.  
- **✨ Smart Returns:** Return strings or objects directly from handlers—no need to call `res.send()`.  
- **📂 Built-in Body Parser:** Native support for JSON & File Uploads.  
- **🛡️ Interceptor System:** Powerful Global and Route-specific middleware.  

## 🚀 Quick Start

Create a file named `app.js`:

```javascript
import vibe from "./vibe.js";
import { adapt } from "./utils/adapt.js";

const app = vibe();

// 1. Minimal "One-Liner" Route
app.get("/hello", "Hello World!");

// 2. Smart Object Return
app.post("/data", async (req, res) => {
  return { status: "success", received: req.body, files: req.files };
});

// 3. Start Server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

## 📖 Documentation

### 1. Minimalist Routing (The "Vibe" Way)

```javascript
app.get("/status", "System is Online");
app.get("/version", { version: "1.0.0" });
```

### 2. Standard Routing

```javascript
app.get("/not-found", (req, res) => {
  res.status(404).send("This page does not exist");
});
```

### 3. File Uploads

```javascript
app.post(
  "/upload",
  { media: { public: true, dest: "uploads" } },
  (req, res) => {
    return { message: "File uploaded successfully!", files: req.files };
  }
);
```

### 4. Global Middleware (Plugins)

Global middleware runs on **all routes**. No `adapt()` needed here:

```javascript
app.plugin((req, res) => {
  console.log(`[${req.method}] ${req.url}`);
});
```

### 5. Route-Specific Middleware (Interceptors)

Use `adapt()` if you want to wrap third-party or Express-style middleware for a specific route:

```javascript
app.get(
  "/private",
  { intercept: adapt(async (req, res) => {
      console.log("Route-specific interceptor");
    })
  },
  (req, res) => {
    res.send("Protected content");
  }
);
```

## 🛠️ API Reference

### Request Object (`req`)

| Property   | Description                        |
| ---------- | ---------------------------------- |
| `req.params` | Route parameters                  |
| `req.query`  | URL query strings                 |
| `req.body`   | Parsed request body               |
| `req.files`  | Uploaded files (if any)           |
| `req.ip`     | Client IP                          |

### Response Object (`res`)

| Method             | Description                           |
| -----------------  | ------------------------------------- |
| `res.json(data)`    | Sends JSON response                   |
| `res.send(data)`    | Sends text or object                  |
| `res.status(code)`  | Sets HTTP status code (chainable)    |
| `res.sendFile(path)`| Sends file from public folder         |
| `res.sendHtml(file)`| Sends HTML file from public folder   |
| `res.success(data, message)` | Sends 200 OK JSON                  |
| `res.created(data, message)` | Sends 201 Created JSON              |
| `res.badRequest(msg, errors)` | Sends 400 Bad Request JSON          |
| `res.unauthorized(msg)` | Sends 401 Unauthorized JSON          |
| `res.forbidden(msg)`    | Sends 403 Forbidden JSON            |
| `res.notFound(msg)`     | Sends 404 Not Found JSON            |
| `res.conflict(msg)`     | Sends 409 Conflict JSON             |
| `res.serverError(err)`  | Sends 500 Internal Server Error    |
| `res.redirect(url, status)` | Redirects client (default 302)   |

## 📝 License

Part of the **GeNeSix** brand.  
Created by **Nnamdi "Joe" Amaga**.  
MIT License.
