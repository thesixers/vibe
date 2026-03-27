# Schema Serialization

Vibe supports pre-compiled JSON serializers for routes that output high-volume data. This can significantly improve throughput by skipping the generalized `JSON.stringify` and replacing it with a schema-optimized serializer generated at startup.

## Basic Usage

Define a `schema.response` on a route:

```js
app.get(
  "/users",
  {
    schema: {
      response: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
            email: { type: "string" },
          },
        },
      },
    },
  },
  async () => {
    return await db.getAllUsers();
  },
);
```

Vibe compiles the schema into a fast serializer function at startup. All responses from that route are serialized using this optimized path.

## Property Types

| Type        | Example value |
| :---------- | :------------ |
| `"string"`  | `"Alice"`     |
| `"number"`  | `42`, `3.14`  |
| `"integer"` | `42`          |
| `"boolean"` | `true`        |
| `"array"`   | `[...]`       |
| `"object"`  | `{...}`       |

## Nested Objects

```js
app.get(
  "/product/:id",
  {
    schema: {
      response: {
        type: "object",
        properties: {
          id: { type: "number" },
          name: { type: "string" },
          price: { type: "number" },
          seller: {
            type: "object",
            properties: {
              id: { type: "number" },
              name: { type: "string" },
            },
          },
          tags: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
  async (req) => {
    return await db.getProduct(req.params.id);
  },
);
```

## Arrays of Objects

```js
app.get(
  "/leaderboard",
  {
    schema: {
      response: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rank: { type: "number" },
            name: { type: "string" },
            score: { type: "number" },
          },
        },
      },
    },
  },
  async () => db.getLeaderboard(),
);
```

## When to Use

Schema serialization is most impactful when:

- Returning large arrays (hundreds/thousands of items)
- Running many requests per second on the same endpoint
- The response shape is well-defined and consistent

For small payloads or highly dynamic responses, the standard `JSON.stringify` path is perfectly fine.

## Schema + Interceptor

Schema and `intercept` can be combined on the same route:

```js
app.get(
  "/secure-data",
  {
    intercept: requireAuth,
    schema: {
      response: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            value: { type: "string" },
          },
        },
      },
    },
  },
  async () => db.getSecureData(),
);
```
