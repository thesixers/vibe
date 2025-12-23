<div align="center">
  <img src="./assets/vlogo.png" alt="Vibe Logo" width="180" />
  <h1>Vibe</h1>
  <p>
    <b>A lightweight, regex-based Node.js web framework built for speed and simplicity.</b>
  </p>
</div>

---

Vibe (part of the **GeNeSix** ecosystem) is a zero-dependency* web framework designed to give developers full control over the HTTP lifecycle. It features a custom regex router, built-in body parsing, dual-stack networking, and a robust middleware system—all without the bloat.

> **Dependency Note:** The only dependency is `busboy` for high-performance multipart file parsing.

## ⚡ Features

- **🚀 Zero-Bloat Routing:** Custom Regex-based routing engine supporting dynamic parameters.
- **✨ Smart Returns:** Return strings or objects directly from handlers—no need to call `res.send()`.
- **🌐 Dual-Stack Networking:** Automatic IPv4 (`127.0.0.1`) and IPv6 (`::1`) support on localhost.
- **🎨 Professional Logging:** Built-in JSON logger with color support and precise request timing.
- **📂 Built-in Body Parser:** Native support for JSON & File Uploads.
- **🛡️ Interceptor System:** Powerful Global and Route-specific middleware.

## 🚀 Quick Start

Create a file named `app.js`:

```javascript
import vibe from "./vibe.js";

const app = vibe();

// 1. Minimal "One-Liner" Route
app.get("/hello", "Hello World!");

// 2. Smart Object Return
app.post("/data", async (req, res) => {
  return { status: "success", received: req.body };
});

// 3. Start Server
// Vibe automatically logs the correct URLs (Local & Network)
app.listen(3000); 
```

**Output:**
```text
Server listening locally:
  - IPv4:    http://127.0.0.1:3000
  - IPv6:    http://[::1]:3000
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
Pass a configuration object as the second argument to handle files.

```javascript
app.post(
  "/upload",
  { media: { public: true, dest: "uploads", maxSize: 5 * 1024 * 1024 } },
  (req, res) => {
    // req.files is an array of uploaded files
    return { 
      message: "File uploaded successfully!", 
      count: req.files.length 
    };
  }
);
```

### 4. Global Middleware (Plugins)

Global middleware runs on **all routes**.

```javascript
app.plugin((req, res) => {
  app.log(`[${req.method}] ${req.url}`, "cyan");
});
```

### 5. Route-Specific Middleware (Interceptors)

Use `adapt()` if you want to wrap third-party logic or restrict access to specific routes:

```javascript
import { adapt } from "./utils/adapt.js";

const authGuard = adapt((req, res) => {
  if (!req.headers.authorization) {
    res.unauthorized("Missing Token");
    return false; // Stop execution
  }
});

app.get(
  "/private",
  { intercept: authGuard },
  (req, res) => {
    return { data: "Secret Data" };
  }
);
```

## 🛠️ API Reference

### Application (`app`)

| Method | Description |
| :--- | :--- |
| `app.listen(port, [host])` | Starts the server. Defaults to `0.0.0.0` (Prod) or Smart Localhost (Dev). |
| `app.log(msg, [color])` | Logs a message to stdout with optional color. |
| `app.plugin(fn)` | Registers a global interceptor. |
| `app.include(fn)` | Mounts a sub-router. |

### Request Object (`req`)

| Property | Description |
| :--- | :--- |
| `req.params` | Route parameters (e.g., `/user/:id`) |
| `req.query` | URL query strings parsed into an object |
| `req.body` | Parsed JSON body |
| `req.files` | Array of uploaded files (if multipart) |
| `req.ip` | Client IP address |

### Response Object (`res`)

| Method | Description |
| :--- | :--- |
| `res.json(data)` | Sends JSON response |
| `res.send(data)` | Sends text, number, or object |
| `res.status(code)` | Sets HTTP status code (chainable) |
| `res.sendFile(path)` | Sends file from public folder |
| `res.sendHtml(file)` | Sends HTML file from public folder |
| `res.redirect(url)` | Redirects client to URL |
| `res.success(data)` | **Helper:** Sends 200 OK JSON |
| `res.created(data)` | **Helper:** Sends 201 Created JSON |
| `res.badRequest(msg)` | **Helper:** Sends 400 Bad Request JSON |
| `res.unauthorized(msg)`| **Helper:** Sends 401 Unauthorized JSON |
| `res.forbidden(msg)` | **Helper:** Sends 403 Forbidden JSON |
| `res.notFound(msg)` | **Helper:** Sends 404 Not Found JSON |
| `res.serverError(err)` | **Helper:** Sends 500 Internal Error |

## 🎨 Color Utility
Vibe exports a lightweight color utility for your CLI scripts.

```javascript
import { color } from "./vibe.js"; // or ./utils/colors.js

console.log(color.green("Success!"));
console.log(color.red("Error!"));
```

## 📝 License

Part of the **GeNeSix** brand.  
Created by **Nnamdi "Joe" Amaga**.  
MIT License.