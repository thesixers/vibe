/**
 * Demo Server Test Script
 * Tests all routes in the demo server
 */

const BASE = "http://localhost:4000";

async function test(name, url, options = {}) {
  try {
    const res = await fetch(BASE + url, options);
    const contentType = res.headers.get("content-type") || "";
    let body;

    if (contentType.includes("json")) {
      body = await res.json();
    } else {
      body = await res.text();
      if (body.length > 100) body = body.slice(0, 100) + "...";
    }

    const status = res.status === (options.expectedStatus || 200) ? "✅" : "❌";
    console.log(`${status} ${name}`);
    console.log(`   Status: ${res.status}`);
    console.log(`   Response: ${JSON.stringify(body).slice(0, 80)}...`);
    console.log("");
    return res.status === (options.expectedStatus || 200);
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${err.message}`);
    console.log("");
    return false;
  }
}

async function runTests() {
  console.log("\n🧪 DEMO SERVER TEST SUITE\n");
  console.log("=".repeat(50) + "\n");

  let passed = 0;
  let failed = 0;

  // 1. Static string
  if (await test("1. Static string (GET /)", "/")) passed++;
  else failed++;

  // 2. JSON response
  if (await test("2. JSON response (GET /json)", "/json")) passed++;
  else failed++;

  // 3. Route params
  if (await test("3. Route params (GET /users/42)", "/users/42")) passed++;
  else failed++;

  // 4. Multiple params
  if (
    await test(
      "4. Multiple params (GET /posts/1/comments/5)",
      "/posts/1/comments/5",
    )
  )
    passed++;
  else failed++;

  // 5. Query params
  if (
    await test(
      "5. Query params (GET /search?q=vibe&page=2)",
      "/search?q=vibe&page=2",
    )
  )
    passed++;
  else failed++;

  // 6. POST JSON body
  if (
    await test("6. POST JSON (POST /echo)", "/echo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello Vibe!" }),
    })
  )
    passed++;
  else failed++;

  // 7. Protected (no auth - should fail)
  if (
    await test("7. Protected no auth (GET /protected)", "/protected", {
      expectedStatus: 401,
    })
  )
    passed++;
  else failed++;

  // 8. Protected with auth
  if (
    await test("8. Protected with auth (GET /protected)", "/protected", {
      headers: { Authorization: "Bearer secret123" },
    })
  )
    passed++;
  else failed++;

  // 9. Cached response
  if (await test("9. Cached response (GET /cached)", "/cached")) passed++;
  else failed++;

  // 10. HTML file
  if (await test("10. HTML file (GET /html)", "/html")) passed++;
  else failed++;

  // 11. Decorators
  if (await test("11. Decorators (GET /decorated)", "/decorated")) passed++;
  else failed++;

  // 12. API plugin
  if (await test("12. API status (GET /api/v1/status)", "/api/v1/status"))
    passed++;
  else failed++;

  // 13. API health
  if (await test("13. API health (GET /api/v1/health)", "/api/v1/health"))
    passed++;
  else failed++;

  // 14. Admin (no auth - should fail)
  if (
    await test("14. Admin no auth (GET /admin/dashboard)", "/admin/dashboard", {
      expectedStatus: 403,
    })
  )
    passed++;
  else failed++;

  // 15. Admin with auth
  if (
    await test(
      "15. Admin with auth (GET /admin/dashboard)",
      "/admin/dashboard",
      {
        headers: { "x-admin-token": "admin-secret" },
      },
    )
  )
    passed++;
  else failed++;

  // 16. Error handling
  if (
    await test("16. Error handling (GET /error)", "/error", {
      expectedStatus: 500,
    })
  )
    passed++;
  else failed++;

  // 17. 404
  if (
    await test("17. 404 Not Found (GET /nonexistent)", "/nonexistent", {
      expectedStatus: 404,
    })
  )
    passed++;
  else failed++;

  // Summary
  console.log("=".repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED! Vibe is working perfectly.\n");
  } else {
    console.log("❌ Some tests failed. Check the output above.\n");
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
