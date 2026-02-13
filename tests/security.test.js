/**
 * Test for file upload security fix
 * Verifies that routes without media config reject multipart uploads
 */

import vibe from "../vibe.js";
import { strictEqual } from "assert";

const app = vibe();
const PORT = 45678;

// Route WITHOUT media config - should reject file uploads
app.post("/no-media", async (req) => {
  return { body: req.body };
});

// Route WITH media config - should accept file uploads
app.post(
  "/with-media",
  {
    media: {
      dest: "test-uploads",
      maxSize: 5 * 1024 * 1024,
    },
  },
  async (req) => {
    return { files: req.files, body: req.body };
  },
);

app.listen(PORT, async () => {
  const BASE = `http://localhost:${PORT}`;
  let passed = 0;
  let failed = 0;

  console.log("\n🔒 Testing File Upload Security\n");

  // Test 1: Multipart upload to route WITHOUT media config should be rejected
  try {
    const formData = new FormData();
    formData.append("field", "value");
    formData.append("file", new Blob(["test content"]), "test.txt");

    const res = await fetch(`${BASE}/no-media`, {
      method: "POST",
      body: formData,
    });

    strictEqual(res.status, 400, "Should return 400 Bad Request");
    const json = await res.json();
    strictEqual(json.error, "Bad Request", "Should return error message");
    console.log("✅ Test 1: Route without media config rejects uploads");
    passed++;
  } catch (err) {
    console.log("❌ Test 1 failed:", err.message);
    failed++;
  }

  // Test 2: JSON POST to route without media config should still work
  try {
    const res = await fetch(`${BASE}/no-media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });

    strictEqual(res.status, 200, "Should return 200 OK for JSON");
    const json = await res.json();
    strictEqual(json.body.name, "test", "Should receive JSON body");
    console.log("✅ Test 2: JSON POST to route without media works");
    passed++;
  } catch (err) {
    console.log("❌ Test 2 failed:", err.message);
    failed++;
  }

  // Test 3: Multipart upload to route WITH media config should work
  try {
    const formData = new FormData();
    formData.append("field", "value");
    formData.append("file", new Blob(["test content"]), "test.txt");

    const res = await fetch(`${BASE}/with-media`, {
      method: "POST",
      body: formData,
    });

    strictEqual(res.status, 200, "Should return 200 OK");
    const json = await res.json();
    strictEqual(Array.isArray(json.files), true, "Should have files array");
    strictEqual(json.body.field, "value", "Should parse form fields");
    console.log("✅ Test 3: Route with media config accepts uploads");
    passed++;
  } catch (err) {
    console.log("❌ Test 3 failed:", err.message);
    failed++;
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
});
