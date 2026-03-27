# Clustering

Vibe has built-in support for Node.js cluster mode, allowing you to scale across all CPU cores with minimal configuration.

## Import

```js
import { cluster, isPrimary, isWorker } from "vibe-gx";
```

## Basic Usage

```js
import vibe from "vibe-gx";
import { cluster } from "vibe-gx";

cluster(() => {
  // This runs in each worker process
  const app = vibe();

  app.get("/", () => ({ worker: process.pid }));

  app.listen(3000);
});
```

Vibe automatically forks one worker per CPU core. On an 8-core machine you get 8 worker processes all sharing port `3000`.

## `cluster(workerFn, options?)`

| Option          | Type       | Default            | Description                                                |
| :-------------- | :--------- | :----------------- | :--------------------------------------------------------- |
| `workers`       | `number`   | `os.cpus().length` | Number of worker processes to fork                         |
| `onFork`        | `function` | —                  | Called in the primary process each time a worker is forked |
| `onExit`        | `function` | —                  | Called when a worker exits (before restart)                |
| `restartOnExit` | `boolean`  | `true`             | Automatically restart crashed workers                      |

## Custom Worker Count

```js
cluster(
  () => {
    const app = vibe();
    app.get("/", handler);
    app.listen(3000);
  },
  { workers: 4 },
);
```

## Primary vs Worker Detection

```js
import { isPrimary, isWorker } from "vibe-gx";

if (isPrimary) {
  console.log("I am the primary process, PID:", process.pid);
}

if (isWorker) {
  console.log("I am a worker, PID:", process.pid);
}
```

These are thin aliases over `cluster.isPrimary` and `cluster.isWorker` from Node's built-in `cluster` module.

## Running Setup Only on Primary

Sometimes you want to run one-time tasks (migrations, cache warm-up) only on the primary process:

```js
import { isPrimary } from "vibe-gx";

if (isPrimary) {
  await db.migrate();
  await warmUpCache();
}

cluster(() => {
  const app = vibe();
  // ...workers start after primary setup
  app.listen(3000);
});
```

## Handling Worker Crashes

Workers automatically restart when they crash. Use `onExit` to log the event:

```js
cluster(
  () => {
    const app = vibe();
    app.listen(3000);
  },
  {
    onExit: (worker, code, signal) => {
      console.error(
        `Worker ${worker.process.pid} died (${signal || code}). Restarting...`,
      );
    },
  },
);
```

## Zero-Downtime Reloads

Use a process manager like `PM2` in cluster mode for production-grade zero-downtime reloads on top of Vibe's built-in cluster:

```json
// ecosystem.config.json
{
  "apps": [
    {
      "name": "vibe-app",
      "script": "server.js",
      "instances": "max",
      "exec_mode": "cluster"
    }
  ]
}
```

Or use Vibe's native cluster and send `SIGUSR2` to the primary to roll-restart workers gracefully.

## Worker Pool (Connection Pooling)

For workloads that benefit from a shared thread pool (e.g. CPU-intensive tasks), Vibe also exposes a `WorkerPool`:

```js
import { createPool } from "vibe-gx";

const pool = createPool({
  script: "./workers/image-processor.js",
  size: 4,
});

app.post("/resize", async (req) => {
  const result = await pool.run({ buffer: req.body.image });
  return result;
});
```

> The worker pool uses Node.js `worker_threads` under the hood, keeping CPU work off the event loop.
