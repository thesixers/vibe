# Static Files

Vibe can serve static files and HTML pages directly from a configured public folder.

## Setting the Public Folder

```js
app.setPublicFolder("public");
// or pass an absolute path
app.setPublicFolder("/var/www/myapp/static");
```

The default public folder is `"public"` relative to your working directory.

## Serving HTML Files

```js
app.get("/", (req, res) => {
  res.sendHtml("index.html");
});

app.get("/about", (req, res) => {
  res.sendHtml("about.html");
});
```

## Serving Static Files

```js
app.get("/download/:file", (req, res) => {
  res.sendFile(`downloads/${req.params.file}`);
});
```

Paths are always resolved relative to the configured public folder and are **path-traversal safe** — Vibe rejects any path that escapes the root.

## Serving Files by Absolute Path

When you need to serve files from outside the public folder:

```js
app.get("/export", async (req, res) => {
  const reportPath = await generateReport(req.query.id);
  res.sendAbsoluteFile(reportPath);
});

// Force download with a custom filename
app.get("/invoice/:id", async (req, res) => {
  const path = await getInvoicePath(req.params.id);
  res.sendAbsoluteFile(path, {
    download: true,
    filename: `invoice-${req.params.id}.pdf`,
  });
});
```

## Auto-Serving Static Assets

Register a static file catch-all route for assets like CSS, JS, and images:

```js
app.setPublicFolder("public");

// Serve anything under /assets/
app.get("/assets/*", (req, res) => {
  const filePath = req.url.replace("/assets/", "");
  res.sendFile(filePath);
});
```

## SPA (Single Page App) Fallback

For client-side routing with a framework like React or Vue:

```js
app.setPublicFolder("dist");

// API routes first
app.register(apiPlugin, { prefix: "/api" });

// All other GET requests → serve index.html
app.get("/*", (req, res) => {
  res.sendHtml("index.html");
});
```

## Security

- `sendFile()` and `sendHtml()` both validate that the resolved path stays within the public folder root.
- Any attempt at path traversal (e.g. `../../etc/passwd`) is immediately rejected with `403 Forbidden`.
- `sendAbsoluteFile()` does not restrict path but checks the file exists, returning `404 Not Found` if missing.
