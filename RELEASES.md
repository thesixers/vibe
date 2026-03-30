# Vibe Framework Releases

## v4.1.2 (Latest)

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
