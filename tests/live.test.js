/**
 * Vibe Framework Live Server Test
 * Starts server and makes actual HTTP requests
 */
import vibe from "../vibe.js";
import http from "http";

const PORT = 3456;
const app = vibe();

// Setup routes
app.get("/", "Hello Vibe!");
app.get("/json", { message: "works" });
app.get("/users/:id", (req, res) => ({ userId: req.params.id }));
app.post("/echo", (req, res) => ({ received: req.body }));
app.get(
  "/protected",
  {
    intercept: (req, res) => {
      if (!req.headers.authorization) {
        res.unauthorized("No token");
        return false;
      }
      return true;
    },
  },
  (req, res) => ({ secret: "data" }),
);

// Plugin with prefix
await app.register(
  async (app) => {
    app.get("/status", { status: "ok" });
  },
  { prefix: "/api" },
);

// Decorators
app.decorate("config", { env: "test" });
app.decorateRequest("timestamp", Date.now());

// Global plugin for logging
app.plugin((req, res) => {
  console.log(`  📥 ${req.method} ${req.url}`);
});

// Setup cookie test routes
app.get("/cookies/set", (req, res) => {
  res.setCookie("theme", "midnight")
     .setCookie("session", "xyz987", { httpOnly: true, secure: true, maxAge: 3600 });
  return { ok: true };
});

app.get("/cookies/get", (req, res) => {
  return { cookies: req.cookies };
});

app.get("/cookies/clear", (req, res) => {
  res.clearCookie("session");
  return { ok: true };
});

// Helper to make HTTP requests
function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port: PORT,
      path,
      method,
      headers: { "Content-Type": "application/json", ...headers },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, body: data, headers: res.headers });
        }
      });
    });

    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Run tests
async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = "") {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.log(`  ❌ ${message} ${details}`);
      failed++;
    }
  }

  console.log("\n🚀 Starting live server tests...\n");

  // Test 1: Basic GET
  console.log("📋 Test 1: Basic GET /");
  let res = await request("GET", "/");
  assert(res.status === 200, "Status 200", `got ${res.status}`);
  assert(res.body === "Hello Vibe!", "Body matches", `got ${res.body}`);

  // Test 2: JSON response
  console.log("\n📋 Test 2: JSON GET /json");
  res = await request("GET", "/json");
  assert(res.status === 200, "Status 200");
  assert(res.body.message === "works", "JSON body correct");

  // Test 3: Route params
  console.log("\n📋 Test 3: Route params GET /users/123");
  res = await request("GET", "/users/123");
  assert(res.status === 200, "Status 200");
  assert(res.body.userId === "123", "Param extracted correctly");

  // Test 4: POST with body
  console.log("\n📋 Test 4: POST /echo with body");
  res = await request("POST", "/echo", { test: "data", num: 42 });
  assert(res.status === 200, "Status 200");
  assert(res.body.received?.test === "data", "Body parsed correctly");

  // Test 5: Interceptor blocks
  console.log("\n📋 Test 5: Interceptor blocks GET /protected");
  res = await request("GET", "/protected");
  assert(res.status === 401, "Status 401 Unauthorized", `got ${res.status}`);

  // Test 6: Interceptor passes
  console.log("\n📋 Test 6: Interceptor passes GET /protected");
  res = await request("GET", "/protected", null, {
    Authorization: "Bearer token",
  });
  assert(res.status === 200, "Status 200");
  assert(res.body.secret === "data", "Handler executed");

  // Test 7: Plugin prefix
  console.log("\n📋 Test 7: Plugin prefix GET /api/status");
  res = await request("GET", "/api/status");
  assert(res.status === 200, "Status 200");
  assert(res.body.status === "ok", "Plugin route works");

  // Test 8: 404 handling
  console.log("\n📋 Test 8: 404 GET /nonexistent");
  res = await request("GET", "/nonexistent");
  assert(res.status === 404, "Status 404", `got ${res.status}`);

  // Test 9: setCookie
  console.log("\n📋 Test 9: setCookie GET /cookies/set");
  res = await request("GET", "/cookies/set");
  assert(res.status === 200, "Status 200");
  const setCookieHeader = res.headers["set-cookie"];
  assert(Array.isArray(setCookieHeader), "Set-Cookie header is an array");
  assert(setCookieHeader && setCookieHeader.length === 2, "Two cookies set");
  assert(
    setCookieHeader && setCookieHeader[0].startsWith("theme=midnight"),
    "First cookie theme set correctly",
    `got ${setCookieHeader ? setCookieHeader[0] : null}`
  );
  assert(
    setCookieHeader && setCookieHeader[1].includes("session=xyz987") && setCookieHeader[1].includes("HttpOnly") && setCookieHeader[1].includes("Secure"),
    "Second cookie session set with options correctly",
    `got ${setCookieHeader ? setCookieHeader[1] : null}`
  );

  // Test 10: getCookies (reading req.cookies)
  console.log("\n📋 Test 10: getCookies GET /cookies/get");
  res = await request("GET", "/cookies/get", null, {
    Cookie: "theme=midnight; session=xyz987; user=joe"
  });
  assert(res.status === 200, "Status 200");
  assert(res.body.cookies?.theme === "midnight", "Parsed cookie theme matches");
  assert(res.body.cookies?.session === "xyz987", "Parsed cookie session matches");
  assert(res.body.cookies?.user === "joe", "Parsed cookie user matches");

  // Test 11: clearCookie
  console.log("\n📋 Test 11: clearCookie GET /cookies/clear");
  res = await request("GET", "/cookies/clear");
  assert(res.status === 200, "Status 200");
  const clearCookieHeader = res.headers["set-cookie"];
  assert(
    clearCookieHeader && clearCookieHeader.includes("session=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/"),
    "Session cookie cleared correctly",
    `got ${clearCookieHeader}`
  );

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`📊 Live Test Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50));

  if (failed === 0) {
    console.log("\n🎉 All live tests passed!\n");
  } else {
    console.log("\n⚠️  Some tests failed.\n");
  }

  return failed;
}

// Start server and run tests
console.log(`\n🔧 Starting server on port ${PORT}...`);

app.listen(PORT, "127.0.0.1", async () => {
  console.log(`✅ Server running at http://127.0.0.1:${PORT}`);

  // Wait a moment for server to be ready
  await new Promise((r) => setTimeout(r, 100));

  const failures = await runTests();

  console.log("🛑 Shutting down...\n");
  process.exit(failures > 0 ? 1 : 0);
});
