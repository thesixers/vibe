# The Response Object (`res`)

Every route handler receives `res` as its second argument. Vibe extends the native Node.js `ServerResponse` with ergonomic response methods.

## Sending Responses

### Return-Based (Recommended)

The simplest approach — just return a value and Vibe handles the rest:

```js
app.get("/user", () => ({ name: "Alice" })); // 200 JSON
app.get("/text", () => "Hello!"); // 200 text
app.get("/num", () => 42); // 200 text
```

### Method-Based

For more control, use `res` methods directly:

```js
app.get("/manual", (req, res) => {
  res.status(201).json({ created: true });
});
```

---

## Core Methods

### `res.json(data)`

Sends a JSON response with `Content-Type: application/json`.

```js
res.json({ success: true, data: [...] });
```

### `res.send(data)`

Smart send — detects object vs string and picks the right content type:

```js
res.send({ ok: true }); // JSON
res.send("Hello"); // text/plain
res.send(404); // text/plain "404"
```

If `data` is an `Error` instance, `res.send()` automatically routes it to the error handler.

### `res.status(code)`

Sets the HTTP status code. Chainable:

```js
res.status(404).json({ error: "Not found" });
res.status(201).send({ created: true });
```

### `res.redirect(url, status?)`

Redirect the client. Default status is `302`:

```js
res.redirect("/login"); // 302
res.redirect("/new-path", 301); // 301 permanent
```

---

## Semantic HTTP Methods

These pre-built methods set the status code and response body automatically.

### `res.success(data?, message?)`

`200 OK` with `{ success: true, message, data }`:

```js
res.success({ id: 1 }, "User created");
// { "success": true, "message": "User created", "data": { "id": 1 } }
```

### `res.created(data?, message?)`

`201 Created`:

```js
res.created({ id: 42 }, "Resource created");
```

### `res.badRequest(message?, errors?)`

`400 Bad Request`:

```js
res.badRequest("Invalid email");
res.badRequest("Validation failed", { email: "Required" });
```

### `res.unauthorized(message?)`

`401 Unauthorized`:

```js
res.unauthorized("Token expired");
```

### `res.forbidden(message?)`

`403 Forbidden`:

```js
res.forbidden("Admin access required");
```

### `res.notFound(message?)`

`404 Not Found`:

```js
res.notFound("User not found");
```

### `res.conflict(message?)`

`409 Conflict`:

```js
res.conflict("Email already registered");
```

### `res.serverError(error)`

`500 Internal Server Error`. Routes the error through the central error handler (respecting `setErrorHandler`):

```js
res.serverError(new Error("Database offline"));
```

---

## File Responses

### `res.sendFile(filePath)`

Serve a file from the configured public folder:

```js
app.setPublicFolder("public");

app.get("/download", (req, res) => {
  res.sendFile("reports/summary.pdf");
});
```

### `res.sendHtml(filename)`

Serve an HTML file from the public folder:

```js
res.sendHtml("index.html");
```

### `res.sendAbsoluteFile(absolutePath, opts?)`

Serve any file by its absolute path (not restricted to the public folder):

```js
res.sendAbsoluteFile("/var/data/export.csv");

// Force download with custom filename
res.sendAbsoluteFile("/var/data/export.csv", {
  download: true,
  filename: "my-export.csv",
});
```

---

## Setting Headers

Use the native Node.js methods directly:

```js
app.get("/cors", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.json({ ok: true });
});
```
