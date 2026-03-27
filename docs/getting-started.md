# Getting Started

## Installation

```bash
npm install vibe-gx
```

## Your First Server

```js
import vibe from "vibe-gx";

const app = vibe();

app.get("/", () => ({ message: "Hello from Vibe!" }));

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

## Configuration

Pass a config object to `vibe()` to configure the app:

```js
const app = vibe({
  logger: {
    lifecycle: true, // Log request start/end times
    prettyPrint: true, // Human-readable terminal output in development
  },
});
```

### Full Config Reference

| Option               | Type                      | Default          | Description                                                            |
| :------------------- | :------------------------ | :--------------- | :--------------------------------------------------------------------- |
| `logger`             | `LoggerConfig \| boolean` | `{}`             | Logger configuration. Set `false` to disable.                          |
| `logger.lifecycle`   | `boolean`                 | `false`          | Auto-log request start and completion                                  |
| `logger.prettyPrint` | `boolean`                 | `false`          | Format logs as readable terminal lines                                 |
| `logger.level`       | `string`                  | `"info"`         | Minimum log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `logger.stream`      | `WritableStream`          | `process.stdout` | Custom output stream                                                   |

## Listening

```js
// With port only
app.listen(3000);

// With port, host, and callback
app.listen(3000, "0.0.0.0", () => {
  console.log("Server ready");
});

// Listen on all interfaces (IPv4 + IPv6)
app.listen(3000, "::");
```

## ES Modules

Vibe is fully ESM-native. Make sure your `package.json` has:

```json
{
  "type": "module"
}
```

## Running with `--watch`

```bash
node --watch server.js
```

Vibe handles graceful shutdown automatically when using `--watch`, `nodemon`, or cluster restarts — preventing zombie port occupation.
