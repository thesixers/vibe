# Vibe Framework Releases

## v4.1.3 (Latest)

**Bug Fixes & Breaking Changes**

- **[Fix] Plugin Prefix Isolation:** `app.register()` with a `prefix` option no longer bleeds its prefix into subsequent un-awaited `register()` calls. The prefix is now restored synchronously after invoking the plugin function, so registration order no longer affects route paths.
- **[Fix] `req.ip` on Sync Fast Path:** `req.ip` is now resolved at the top of every request — including the sync GET fast path — so all handlers always have access to the real client IP.
- **[Fix] Process Listener Leak:** `uncaughtException` and `unhandledRejection` listeners are now registered only once via a module-level guard, preventing accumulation when `vibe()` is called multiple times (e.g. in tests).
- **[Removed] `autoRestart` config option:** Removed `{ autoRestart: true }` from `vibe()` config. It spawned a hidden cluster manager inside the process, doubling memory usage and conflicting with external process managers like PM2. Use PM2 or a similar tool for crash recovery in production. The `clusterize` export remains available for manual multi-core scaling.

**Features**

- **[New] Built-in CORS:** Added `cors()` — a zero-dependency CORS interceptor. Handles OPTIONS preflight automatically, supports wildcard, single/multiple origins, and dynamic origin functions. Options: `origin`, `methods`, `allowedHeaders`, `exposedHeaders`, `credentials`, `maxAge`.
- **[New] Built-in Rate Limiter:** Added `rateLimit()` — a zero-dependency sliding window rate limiter. Works as a global plugin or per-route interceptor. Keys by `req.ip` by default (proxy-aware), supports custom `keyBy`, `skip`, `message`, and `statusCode` options. Sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` headers automatically.
- **[Perf] Lazy `req.id` and `req.log`:** UUID generation and child logger creation are now deferred until first access. Routes that never touch `req.id` or `req.log` pay zero cost.
- **[Perf] Trie threshold lowered to 40:** Route matching switches to O(log n) trie matching earlier, benefiting apps with 40+ routes sooner.
- **[Improvement] Proxy-aware `req.ip`:** `req.ip` now checks `x-forwarded-for` and `x-real-ip` headers before falling back to `socket.remoteAddress`, so the real client IP is always correct behind Nginx or any reverse proxy.

## v4.1.2

**Features & Enhancements**

- **Logging Subsystem:** Color terminal output activated by default in development. Added support for native file streaming using `logFile` and unified `dest` routing.
- **Request Tracing:** Vibe HTTP lifecycle requests now include exact URI `url`, HTTP `method`, and requesting `sender` IP coordinates.
- **Auto-Crash Recovery:** Introduced `{ autoRestart: true }` in core Vibe configuration. This spins up a supervised abstraction layer on top of native `clusterize` methods. Uncaught exceptions gracefully cycle the process instead of destroying the runtime.
- **Documentation & Types:** `vibe.d.ts` expanded to cover new configurations.

## v4.1.1

- Fastify parity release introducing internal logger decorators and `req.log`.
- Refactored internal architecture for static paths against O(n) linear matching versus O(log n) `RouteTrie` arrays depending on scale threshold.

## v4.0.0

- Core rewrite focusing on zero-dependency footprint.
- Introduction of compiled schema serialization yielding 3x faster response times over native `JSON.stringify()`.
- Built-in LRU Cache and native cluster modules.
