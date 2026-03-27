# File Uploads

Vibe handles multipart file uploads with built-in parsing, size limits, and MIME type validation — no external package needed.

## Basic Upload

Configure a route with `media` options to enable file parsing:

```js
app.post("/upload", { media: { dest: "uploads" } }, (req) => {
  const [file] = req.files;
  return {
    filename: file.filename,
    size: file.size,
    type: file.type,
  };
});
```

## Media Options

| Option         | Type       | Default           | Description                            |
| :------------- | :--------- | :---------------- | :------------------------------------- |
| `dest`         | `string`   | required          | Folder to save uploaded files          |
| `maxSize`      | `number`   | `10485760` (10MB) | Maximum file size in bytes             |
| `allowedTypes` | `string[]` | all               | Allowed MIME types. Supports wildcards |
| `public`       | `boolean`  | `true`            | Save inside the public folder path     |

## Multiple Files

`req.files` is always an array — loop over it to handle multiple uploads:

```js
app.post(
  "/gallery",
  {
    media: { dest: "uploads/gallery" },
  },
  (req) => {
    const saved = req.files.map((f) => ({
      name: f.filename,
      original: f.originalName,
      size: f.size,
      path: f.filePath,
    }));
    return { uploaded: saved };
  },
);
```

## Size Limits

```js
app.post(
  "/avatar",
  {
    media: {
      dest: "uploads/avatars",
      maxSize: 2 * 1024 * 1024, // 2MB
    },
  },
  (req) => {
    return { file: req.files[0].filename };
  },
);
```

If the file exceeds `maxSize`, Vibe automatically returns `413 Payload Too Large`.

## Type Restrictions

Use MIME type strings or wildcards:

```js
app.post(
  "/docs",
  {
    media: {
      dest: "uploads/docs",
      allowedTypes: ["application/pdf", "application/msword"],
    },
  },
  handler,
);

// Images only (wildcard)
app.post(
  "/image",
  {
    media: {
      dest: "uploads/images",
      allowedTypes: ["image/*"], // matches image/jpeg, image/png, etc.
    },
  },
  handler,
);
```

If the file type is not allowed, Vibe returns `415 Unsupported Media Type`.

## Mixed Body + File

The form body fields are still accessible on `req.body` alongside `req.files`:

```js
app.post(
  "/profile",
  {
    media: { dest: "uploads/avatars", allowedTypes: ["image/*"] },
  },
  (req) => {
    const { displayName, bio } = req.body;
    const [avatar] = req.files;
    return { displayName, bio, avatar: avatar.filename };
  },
);
```

## The `UploadedFile` Object

| Property       | Type     | Description                                 |
| :------------- | :------- | :------------------------------------------ |
| `filename`     | `string` | Saved filename (e.g. `"avatar-a7x92b.png"`) |
| `originalName` | `string` | Original filename as uploaded               |
| `type`         | `string` | MIME type (e.g. `"image/png"`)              |
| `filePath`     | `string` | Absolute path on disk                       |
| `size`         | `number` | File size in bytes                          |

## With Interceptor (Auth + Upload)

```js
app.post(
  "/secure-upload",
  {
    intercept: requireAuth,
    media: {
      dest: "uploads/secure",
      maxSize: 5 * 1024 * 1024,
      allowedTypes: ["image/*", "application/pdf"],
    },
  },
  (req) => {
    return { user: req.user.id, file: req.files[0].filename };
  },
);
```

## Saving Outside the Public Folder

Set `public: false` to save relative to the current working directory instead:

```js
app.post(
  "/private-upload",
  {
    media: { dest: "private/data", public: false },
  },
  handler,
);
```

## Streaming Large Files

For very large files, enable streaming mode and handle chunks manually:

```js
app.post(
  "/stream-upload",
  {
    media: { streaming: true },
  },
  (req) => {
    return new Promise((resolve, reject) => {
      req.on("file", (field, fileStream, info) => {
        const dest = fs.createWriteStream(`./tmp/${info.filename}`);
        fileStream.pipe(dest);
        dest.on("finish", () => resolve({ saved: info.filename }));
      });
    });
  },
);
```
