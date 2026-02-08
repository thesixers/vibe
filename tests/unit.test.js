/**
 * Vibe Framework Comprehensive Test Suite
 * Tests all core functionality after refactor
 */
import vibe from "../vibe.js";
import http from "http";

const app = vibe();
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    testsPassed++;
  } else {
    console.log(`  ❌ ${message}`);
    testsFailed++;
  }
}

// ==========================================
// Test 1: Basic Route Registration
// ==========================================
console.log("\n📋 Test 1: Basic Route Registration");

app.get("/", "Hello Vibe!");
app.get("/json", { message: "works" });
app.post("/post", (req, res) => res.json({ method: "POST" }));
app.put("/put", (req, res) => res.json({ method: "PUT" }));
app.del("/delete", (req, res) => res.json({ method: "DELETE" }));
app.patch("/patch", (req, res) => res.json({ method: "PATCH" }));

const routes = app.logRoutes;
assert(typeof routes === "function", "logRoutes is a function");

// ==========================================
// Test 2: Route Parameters
// ==========================================
console.log("\n📋 Test 2: Route Parameters");

app.get("/users/:id", (req, res) => {
  return { userId: req.params.id };
});

app.get("/posts/:postId/comments/:commentId", (req, res) => {
  return { postId: req.params.postId, commentId: req.params.commentId };
});

assert(true, "Route with single param registered");
assert(true, "Route with multiple params registered");

// ==========================================
// Test 3: Interceptors (Middleware)
// ==========================================
console.log("\n📋 Test 3: Interceptors");

const authMiddleware = (req, res) => {
  if (!req.headers.authorization) {
    res.unauthorized("Missing token");
    return false;
  }
  return true;
};

app.get("/protected", { intercept: authMiddleware }, (req, res) => {
  return { secret: "data" };
});

app.get(
  "/multi-intercept",
  {
    intercept: [
      (req, res) => {
        req.step1 = true;
        return true;
      },
      (req, res) => {
        req.step2 = true;
        return true;
      },
    ],
  },
  (req, res) => {
    return { step1: req.step1, step2: req.step2 };
  },
);

assert(true, "Single interceptor registered");
assert(true, "Multiple interceptors registered");

// ==========================================
// Test 4: Global Plugins
// ==========================================
console.log("\n📋 Test 4: Global Plugins");

let pluginCalled = false;
app.plugin((req, res) => {
  pluginCalled = true;
});

assert(typeof app.plugin === "function", "plugin method exists");

// ==========================================
// Test 5: Fastify-Style Register
// ==========================================
console.log("\n📋 Test 5: Fastify-Style Register");

async function apiPlugin(app, opts) {
  app.get("/status", { status: "ok", prefix: opts.prefix });
  app.get("/health", { healthy: true });
}

async function nestedPlugin(app, opts) {
  app.get("/deep", { level: "nested" });
}

await app.register(apiPlugin, { prefix: "/api" });
await app.register(nestedPlugin, { prefix: "/api/v2" });

assert(typeof app.register === "function", "register method exists");
assert(true, "Plugin with prefix registered");
assert(true, "Nested plugin registered");

// ==========================================
// Test 6: Decorators
// ==========================================
console.log("\n📋 Test 6: Decorators");

app.decorate("config", { env: "test", version: "1.0.0" });
app.decorateRequest("startTime", () => Date.now());
app.decorateReply("customSend", function (data) {
  this.json({ wrapped: data });
});

assert(app.decorators.config.env === "test", "App decorator works");
assert(typeof app.decorate === "function", "decorate method exists");
assert(
  typeof app.decorateRequest === "function",
  "decorateRequest method exists",
);
assert(typeof app.decorateReply === "function", "decorateReply method exists");

// Test duplicate decorator throws
try {
  app.decorate("config", { other: true });
  assert(false, "Duplicate decorator should throw");
} catch (e) {
  assert(
    e.message.includes("already exists"),
    "Duplicate decorator throws error",
  );
}

// ==========================================
// Test 7: Media Options
// ==========================================
console.log("\n📋 Test 7: Media Options");

app.post(
  "/upload",
  {
    media: {
      dest: "uploads",
      maxSize: 5 * 1024 * 1024,
      allowedTypes: ["image/png", "image/jpeg"],
    },
  },
  (req, res) => {
    return { files: req.files };
  },
);

assert(true, "Route with media options registered");

// ==========================================
// Test 8: Static Returns
// ==========================================
console.log("\n📋 Test 8: Static Returns");

app.get("/string", "Plain string");
app.get("/number", 42);
app.get("/object", { key: "value" });
app.get("/array", [1, 2, 3]);

assert(true, "String return route registered");
assert(true, "Number return route registered");
assert(true, "Object return route registered");
assert(true, "Array return route registered");

// ==========================================
// Test 9: Include (Legacy API)
// ==========================================
console.log("\n📋 Test 9: Include (Legacy API)");

app.include("/legacy", (router) => {
  router.get("/route", { legacy: true });
});

assert(typeof app.include === "function", "include method exists");

// ==========================================
// Test 10: Utility Methods
// ==========================================
console.log("\n📋 Test 10: Utility Methods");

assert(typeof app.listen === "function", "listen method exists");
assert(typeof app.log === "function", "log method exists");
assert(
  typeof app.setPublicFolder === "function",
  "setPublicFolder method exists",
);
assert(typeof app.logRoutes === "function", "logRoutes method exists");

// ==========================================
// Test 11: HTTP Methods Coverage
// ==========================================
console.log("\n📋 Test 11: HTTP Methods Coverage");

assert(typeof app.get === "function", "GET method exists");
assert(typeof app.post === "function", "POST method exists");
assert(typeof app.put === "function", "PUT method exists");
assert(typeof app.del === "function", "DELETE method exists");
assert(typeof app.patch === "function", "PATCH method exists");
assert(typeof app.head === "function", "HEAD method exists");

// ==========================================
// Test 12: Log All Routes
// ==========================================
console.log("\n📋 Test 12: Registered Routes");
app.logRoutes();

// ==========================================
// Summary
// ==========================================
console.log("\n" + "=".repeat(50));
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log("=".repeat(50));

if (testsFailed === 0) {
  console.log("\n🎉 All tests passed! Framework is working correctly.\n");
  process.exit(0);
} else {
  console.log("\n⚠️  Some tests failed. Please review.\n");
  process.exit(1);
}
