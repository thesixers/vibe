# Vibe Documentation

Welcome to the full Vibe documentation. Vibe is a high-performance, minimal Node.js HTTP framework with zero dependencies and a clean ergonomic API.

## Pages

| Page                                              | Description                                      |
| :------------------------------------------------ | :----------------------------------------------- |
| [Getting Started](./getting-started.md)           | Installation, setup, and your first server       |
| [Routing](./routing.md)                           | Defining routes, parameters, wildcards           |
| [Request](./request.md)                           | The `req` object: params, query, body, files, IP |
| [Response](./response.md)                         | The `res` object: all response methods           |
| [Middleware / Interceptors](./interceptors.md)    | Global and route-level middleware                |
| [Logging](./logging.md)                           | Structured JSON logger, colors, lifecycle hooks  |
| [Error Handling](./error-handling.md)             | `throw`, `return Error`, `setErrorHandler`       |
| [Plugins](./plugins.md)                           | Encapsulated route groups via `register()`       |
| [Decorators](./decorators.md)                     | Extend `app`, `req`, and `res`                   |
| [File Uploads](./file-uploads.md)                 | Multipart parsing, size limits, allowed types    |
| [Static Files](./static-files.md)                 | Serving HTML and static assets                   |
| [Schema Serialization](./schema-serialization.md) | Fast JSON output with compiled schemas           |
| [Caching](./caching.md)                           | Built-in LRU response caching                    |
| [Clustering](./clustering.md)                     | Multi-process scaling with the cluster API       |
