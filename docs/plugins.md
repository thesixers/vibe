# Plugin System

Plugins let you group related routes and middleware into encapsulated units, optionally scoped under a URL prefix.

## Basic Plugin

```js
app.register(
  async (api) => {
    api.get("/status", () => ({ status: "ok" }));
    api.get("/health", () => ({ healthy: true }));
  },
  { prefix: "/api" },
);

// Routes registered: GET /api/status, GET /api/health
```

## Plugin Callback

The plugin function receives the same API as the main `app`, so you can use all the same methods:

```js
app.register(
  async (api) => {
    // Routes
    api.get("/list", handler);
    api.post("/create", handler);

    // Interceptors scoped to this plugin only
    api.plugin(authMiddleware);

    // Nested plugins
    api.register(
      async (subApi) => {
        subApi.get("/nested", handler);
      },
      { prefix: "/sub" },
    );
  },
  { prefix: "/v1" },
);
```

## Prefix

All routes inside a registered plugin are prefixed automatically:

```js
app.register(
  async (api) => {
    api.get("/users", listUsers); // GET /admin/users
    api.post("/users", createUser); // POST /admin/users
    api.del("/users/:id", deleteUser); // DELETE /admin/users/:id
  },
  { prefix: "/admin" },
);
```

## Scoped Interceptors

Middleware registered inside a plugin via `api.plugin()` only applies to routes within that plugin:

```js
app.register(
  async (api) => {
    api.plugin(requireAuth); // Only runs for routes in this plugin

    api.get("/profile", (req) => req.user);
    api.put("/profile", (req) => updateProfile(req.body));
  },
  { prefix: "/account" },
);

// This route is NOT protected by requireAuth
app.get("/public", () => ({ open: true }));
```

## Nested Plugins

Plugins can be nested to any depth:

```js
app.register(
  async (v1) => {
    v1.get("/status", () => ({ version: 1 }));

    v1.register(
      async (users) => {
        users.plugin(requireAuth);
        users.get("/", listUsers);
        users.get("/:id", getUser);
        users.post("/", createUser);
      },
      { prefix: "/users" },
    );

    v1.register(
      async (posts) => {
        posts.get("/", listPosts);
        posts.get("/:id", getPost);
      },
      { prefix: "/posts" },
    );
  },
  { prefix: "/api/v1" },
);
```

## Using `include()` (Legacy)

`include()` is an older alternative to `register()` for grouping routes by prefix:

```js
app.include("/users", (router) => {
  router.get("/", listUsers); // GET /users
  router.get("/:id", getUser); // GET /users/:id
  router.post("/", createUser); // POST /users
});
```

## Organizing Large Apps

A recommended pattern for larger codebases:

```js
// routes/users.js
export async function usersPlugin(api) {
  api.plugin(requireAuth);
  api.get("/", listUsers);
  api.get("/:id", getUser);
  api.post("/", createUser);
}

// routes/posts.js
export async function postsPlugin(api) {
  api.get("/", listPosts);
  api.get("/:id", getPost);
}

// server.js
import { usersPlugin } from "./routes/users.js";
import { postsPlugin } from "./routes/posts.js";

app.register(usersPlugin, { prefix: "/api/users" });
app.register(postsPlugin, { prefix: "/api/posts" });
```
