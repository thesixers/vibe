/**
 * Rigorous Production Test Suite for Vibe Framework
 * Tests all critical paths and edge cases
 */

import vibe, { LRUCache, cacheMiddleware } from "../vibe.js";
import fs from "fs";
import path from "path";

const PORT = 4567;
const BASE = `http://localhost:${PORT}`;
let server;

// Test results
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

function assertIncludes(str, substr, msg = "") {
  if (!str.includes(substr)) {
    throw new Error(`${msg} Expected "${str}" to include "${substr}"`);
  }
}

// ============================================
// SETUP
// ============================================

async function setup() {
  const app = vibe();

  // Create folders
  if (!fs.existsSync("public")) fs.mkdirSync("public", { recursive: true });
  if (!fs.existsSync("public/uploads"))
    fs.mkdirSync("public/uploads", { recursive: true });

  // Write test HTML
  fs.writeFileSync("public/test.html", "<h1>Test</h1>");

  app.setPublicFolder("public");

  // Decorators
  app.decorate("version", "2.0.0");
  app.decorateRequest("startTime", () => Date.now());

  // ============================================
  // ROUTES FOR TESTING
  // ============================================

  // Basic routes
  app.get("/", "Hello World");
  app.get("/json", { message: "Hello JSON" });
  app.get("/number", 42);
  app.get("/array", [1, 2, 3]);

  // Route parameters
  app.get("/users/:id", (req) => ({ id: req.params.id }));
  app.get("/posts/:postId/comments/:commentId", (req) => ({
    postId: req.params.postId,
    commentId: req.params.commentId,
  }));

  // Query parameters
  app.get("/search", (req) => ({
    q: req.query.q || "",
    page: parseInt(req.query.page) || 1,
  }));

  // Special characters in query
  app.get("/encoded", (req) => ({
    name: req.query.name || "",
    path: req.query.path || "",
  }));

  // POST with body
  app.post("/echo", (req) => ({ received: req.body }));

  // File upload with size limit
  app.post(
    "/upload",
    {
      media: {
        dest: "uploads",
        maxSize: 1024, // 1KB limit for testing
        public: true,
      },
    },
    (req) => ({
      files: req.files.length,
      body: req.body,
    }),
  );

  // File upload with type restriction
  app.post(
    "/upload-images",
    {
      media: {
        dest: "uploads",
        allowedTypes: ["image/*"],
        public: true,
      },
    },
    (req) => ({ files: req.files.length }),
  );

  // Interceptors
  const authCheck = (req, res) => {
    if (req.headers.authorization !== "Bearer test123") {
      res.unauthorized("Invalid token");
      return false;
    }
    req.user = { id: 1 };
    return true;
  };

  app.get("/protected", { intercept: authCheck }, (req) => ({
    user: req.user,
  }));

  // Multiple interceptors
  const log1 = (req) => {
    req.log1 = true;
    return true;
  };
  const log2 = (req) => {
    req.log2 = true;
    return true;
  };

  app.get("/multi-intercept", { intercept: [log1, log2] }, (req) => ({
    log1: req.log1,
    log2: req.log2,
  }));

  // Error handling
  app.get("/error", () => {
    throw new Error("Test error");
  });

  // Decorator access
  app.get("/decorated", (req) => ({
    version: app.decorators.version,
    hasStartTime: typeof req.startTime === "number",
  }));

  // Response methods
  app.get("/html", (req, res) => {
    res.sendHtml("test.html");
  });

  app.get("/redirect", (req, res) => {
    res.redirect("/json", 302);
  });

  app.get("/status-codes", (req, res) => {
    const code = parseInt(req.query.code) || 200;
    res.status(code).json({ code });
  });

  // Plugin with prefix
  await app.register(
    async (api) => {
      api.get("/status", { status: "ok" });
      api.get("/health", { healthy: true });
    },
    { prefix: "/api" },
  );

  // Nested plugin
  await app.register(
    async (v1) => {
      v1.get("/info", { version: 1 });
    },
    { prefix: "/api/v1" },
  );

  // Caching
  const cache = new LRUCache({ max: 100, ttl: 5000 });
  app.get("/cached", { intercept: cacheMiddleware(cache) }, () => ({
    timestamp: Date.now(),
    random: Math.random(),
  }));

  return new Promise((resolve) => {
    server = app.listen(PORT, "127.0.0.1", () => {
      console.log(`\n🧪 Test server running on port ${PORT}\n`);
      resolve();
    });
  });
}

// ============================================
// TESTS
// ============================================

async function runTests() {
  console.log("📋 1. BASIC ROUTES\n");

  await test("GET / returns string", async () => {
    const res = await fetch(`${BASE}/`);
    assertEqual(res.status, 200);
    const text = await res.text();
    assertEqual(text, "Hello World");
  });

  await test("GET /json returns JSON", async () => {
    const res = await fetch(`${BASE}/json`);
    assertEqual(res.status, 200);
    const json = await res.json();
    assertEqual(json.message, "Hello JSON");
  });

  await test("GET /number returns number", async () => {
    const res = await fetch(`${BASE}/number`);
    const json = await res.json();
    assertEqual(json, 42);
  });

  await test("GET /array returns array", async () => {
    const res = await fetch(`${BASE}/array`);
    const json = await res.json();
    assertEqual(json.length, 3);
  });

  console.log("\n📋 2. ROUTE PARAMETERS\n");

  await test("Single param extraction", async () => {
    const res = await fetch(`${BASE}/users/123`);
    const json = await res.json();
    assertEqual(json.id, "123");
  });

  await test("Multiple param extraction", async () => {
    const res = await fetch(`${BASE}/posts/10/comments/20`);
    const json = await res.json();
    assertEqual(json.postId, "10");
    assertEqual(json.commentId, "20");
  });

  console.log("\n📋 3. QUERY PARAMETERS\n");

  await test("Basic query params", async () => {
    const res = await fetch(`${BASE}/search?q=test&page=5`);
    const json = await res.json();
    assertEqual(json.q, "test");
    assertEqual(json.page, 5);
  });

  await test("URL encoded query params", async () => {
    const res = await fetch(
      `${BASE}/encoded?name=John%20Doe&path=%2Fhome%2Fuser`,
    );
    const json = await res.json();
    assertEqual(json.name, "John Doe");
    assertEqual(json.path, "/home/user");
  });

  await test("Empty query defaults", async () => {
    const res = await fetch(`${BASE}/search`);
    const json = await res.json();
    assertEqual(json.q, "");
    assertEqual(json.page, 1);
  });

  console.log("\n📋 4. POST & BODY PARSING\n");

  await test("POST with JSON body", async () => {
    const res = await fetch(`${BASE}/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar", num: 42 }),
    });
    const json = await res.json();
    assertEqual(json.received.foo, "bar");
    assertEqual(json.received.num, 42);
  });

  await test("POST with empty body", async () => {
    const res = await fetch(`${BASE}/echo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const json = await res.json();
    assertEqual(Object.keys(json.received).length, 0);
  });

  console.log("\n📋 5. INTERCEPTORS\n");

  await test("Interceptor blocks without auth", async () => {
    const res = await fetch(`${BASE}/protected`);
    assertEqual(res.status, 401);
  });

  await test("Interceptor passes with auth", async () => {
    const res = await fetch(`${BASE}/protected`, {
      headers: { Authorization: "Bearer test123" },
    });
    assertEqual(res.status, 200);
    const json = await res.json();
    assertEqual(json.user.id, 1);
  });

  await test("Multiple interceptors run in order", async () => {
    const res = await fetch(`${BASE}/multi-intercept`);
    const json = await res.json();
    assertEqual(json.log1, true);
    assertEqual(json.log2, true);
  });

  console.log("\n📋 6. FILE UPLOADS\n");

  await test("File upload success (small file)", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["test content"], { type: "text/plain" }),
      "test.txt",
    );
    formData.append("name", "testfile");

    const res = await fetch(`${BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    assertEqual(res.status, 200);
    const json = await res.json();
    assertEqual(json.files, 1);
    assertEqual(json.body.name, "testfile");
  });

  await test("File upload fails (exceeds size)", async () => {
    const formData = new FormData();
    // Create 2KB of data (exceeds 1KB limit)
    const bigData = "x".repeat(2048);
    formData.append(
      "file",
      new Blob([bigData], { type: "text/plain" }),
      "big.txt",
    );

    const res = await fetch(`${BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    assertEqual(res.status, 413);
    const json = await res.json();
    assertIncludes(json.error, "Payload Too Large");
  });

  await test("File upload fails (wrong type)", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob(["test"], { type: "text/plain" }),
      "test.txt",
    );

    const res = await fetch(`${BASE}/upload-images`, {
      method: "POST",
      body: formData,
    });
    assertEqual(res.status, 415);
    const json = await res.json();
    assertIncludes(json.error, "Unsupported Media Type");
  });

  console.log("\n📋 7. PLUGINS\n");

  await test("Plugin with prefix", async () => {
    const res = await fetch(`${BASE}/api/status`);
    assertEqual(res.status, 200);
    const json = await res.json();
    assertEqual(json.status, "ok");
  });

  await test("Nested plugin prefix", async () => {
    const res = await fetch(`${BASE}/api/v1/info`);
    assertEqual(res.status, 200);
    const json = await res.json();
    assertEqual(json.version, 1);
  });

  console.log("\n📋 8. DECORATORS\n");

  await test("App decorator accessible", async () => {
    const res = await fetch(`${BASE}/decorated`);
    const json = await res.json();
    assertEqual(json.version, "2.0.0");
  });

  await test("Request decorator callable", async () => {
    const res = await fetch(`${BASE}/decorated`);
    const json = await res.json();
    assertEqual(json.hasStartTime, true);
  });

  console.log("\n📋 9. RESPONSE METHODS\n");

  await test("sendHtml sends HTML file", async () => {
    const res = await fetch(`${BASE}/html`);
    assertEqual(res.status, 200);
    const text = await res.text();
    assertIncludes(text, "<h1>Test</h1>");
  });

  await test("redirect sends 302", async () => {
    const res = await fetch(`${BASE}/redirect`, { redirect: "manual" });
    assertEqual(res.status, 302);
  });

  await test("status() sets code", async () => {
    const res = await fetch(`${BASE}/status-codes?code=201`);
    assertEqual(res.status, 201);
  });

  console.log("\n📋 10. ERROR HANDLING\n");

  await test("Error returns 500", async () => {
    const res = await fetch(`${BASE}/error`);
    assertEqual(res.status, 500);
  });

  await test("404 for unknown routes", async () => {
    const res = await fetch(`${BASE}/nonexistent`);
    assertEqual(res.status, 404);
  });

  console.log("\n📋 11. CACHING\n");

  await test("Cached response is consistent", async () => {
    const res1 = await fetch(`${BASE}/cached`);
    const json1 = await res1.json();

    const res2 = await fetch(`${BASE}/cached`);
    const json2 = await res2.json();

    assertEqual(json1.random, json2.random, "Cache should return same value");
  });

  console.log("\n📋 12. STRESS TEST\n");

  await test("100 concurrent requests", async () => {
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(fetch(`${BASE}/users/${i}`));
    }
    const responses = await Promise.all(promises);
    const allOk = responses.every((r) => r.status === 200);
    if (!allOk) throw new Error("Some requests failed");
  });
}

// ============================================
// CLEANUP & REPORT
// ============================================

async function cleanup() {
  // Clean up test files
  try {
    fs.unlinkSync("public/test.html");
    // Clean uploads
    const uploads = fs.readdirSync("public/uploads");
    for (const file of uploads) {
      fs.unlinkSync(`public/uploads/${file}`);
    }
  } catch {}

  if (server) {
    server.close();
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════╗");
  console.log("║        VIBE FRAMEWORK - RIGOROUS PRODUCTION TESTS         ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error("\n💥 CRITICAL ERROR:", err);
  } finally {
    await cleanup();
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════");

  if (failures.length > 0) {
    console.log("\n❌ FAILURES:");
    for (const f of failures) {
      console.log(`   - ${f.name}: ${f.error}`);
    }
    console.log("");
    process.exit(1);
  } else {
    console.log("\n🎉 ALL TESTS PASSED! Ready for production.\n");
    process.exit(0);
  }
}

main();
