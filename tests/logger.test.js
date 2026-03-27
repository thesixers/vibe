import vibe from "../vibe.js";
import { Logger, createLogger } from "../utils/core/logger.js";
import http from "http";

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
    return true;
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
    return false;
  }
}

function assertEqual(actual, expected, msg = "") {
  if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

// Memory Stream for capturing logs without hitting process.stdout
class MemoryStream {
  constructor() {
    this.buffer = [];
  }
  write(chunk) {
    this.buffer.push(chunk);
  }
  getLines() {
    const raw = this.buffer.join("");
    return raw.split("\n").filter(Boolean);
  }
  clear() {
    this.buffer = [];
  }
}

console.log("\n🔬 Structured Logger Tests\n");

async function runTests() {
  const stream = new MemoryStream();

  console.log("📋 1. Core Logger Functionality\n");

  await test("Logger cleanly prefixes basic log styles", async () => {
    stream.clear();
    const logger = createLogger({ stream });
    logger.info("Hello world");

    const lines = stream.getLines();
    assertEqual(lines.length, 1);

    const parsed = JSON.parse(lines[0]);
    assertEqual(parsed.level, 30);
    assertEqual(parsed.msg, "Hello world");
  });

  await test("Logger JSON formats Error objects with stack automatically", async () => {
    stream.clear();
    const logger = createLogger({ stream });
    const err = new Error("Something broke");
    logger.error(err);

    const lines = stream.getLines();
    const parsed = JSON.parse(lines[0]);
    assertEqual(parsed.level, 50);
    if (!parsed.err.stack.includes("Something broke"))
      throw new Error("Missing JSON natively serialized stack trace");
  });

  await test("Child logger merges bindings natively into context", async () => {
    stream.clear();
    const parent = createLogger({ bindings: { app: "vibe" }, stream });
    const child = parent.child({ reqId: "123" });

    child.info("Test");
    const lines = stream.getLines();
    const parsed = JSON.parse(lines[0]);
    assertEqual(parsed.app, "vibe");
    assertEqual(parsed.reqId, "123");
  });

  console.log("\n📋 2. Server Integration\n");

  await test("Lifecycle requests generate fastify json styling natively", async () => {
    stream.clear();

    // Create actual vibe app with our stream logger and lifecycle=true
    const app = vibe({
      logger: { lifecycle: true, stream },
    });

    app.get("/test", (req, res) => {
      req.log.warn("Handler log");
      return new Error("Fastify return error intercept!");
    });

    const server = await new Promise((resolve) => {
      const s = app.listen(8765, "127.0.0.1", () => resolve(s));
    });

    // Make request
    const res = await fetch("http://127.0.0.1:8765/test");

    // Close server
    await new Promise((r) => setTimeout(r, 50));

    const lines = stream.getLines();
    assertEqual(lines.length, 4);

    const l1 = JSON.parse(lines[0]);
    assertEqual(l1.msg, "Incoming request");

    const l2 = JSON.parse(lines[1]);
    assertEqual(l2.msg, "Handler log");
    assertEqual(l2.level, 40);

    const l3 = JSON.parse(lines[2]);
    assertEqual(l3.level, 50);
    if (!l3.err.stack.includes("Fastify return error intercept!")) {
      throw new Error("Pino error structure missing");
    }

    const l4 = JSON.parse(lines[3]);
    assertEqual(l4.type, "res");
    assertEqual(l4.statusCode, 500);
  });

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50));

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
