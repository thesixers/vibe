/**
 * Static File Serving Test
 * Tests that files in the public folder are accessible via /public/* routes
 */
import vibe from "../vibe.js";
import http from "http";

const app = vibe();
const PORT = 3456;

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

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${PORT}${path}`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, data, headers: res.headers }),
        );
      })
      .on("error", reject);
  });
}

console.log("\n🧪 Static File Serving Test Suite\n");

// Start server
app.listen(PORT, async () => {
  try {
    // ==========================================
    // Test 1: Access text file
    // ==========================================
    console.log("📋 Test 1: Access Text File");
    const textRes = await makeRequest("/public/hello.txt");
    assert(textRes.status === 200, "Status 200 for text file");
    assert(textRes.data.includes("Hello"), "Text file content received");
    assert(
      textRes.headers["content-type"]?.includes("text/plain"),
      "Correct MIME type for .txt",
    );

    // ==========================================
    // Test 2: Access JSON file
    // ==========================================
    console.log("\n📋 Test 2: Access JSON File");
    const jsonRes = await makeRequest("/public/data.json");
    assert(jsonRes.status === 200, "Status 200 for JSON file");
    assert(
      jsonRes.headers["content-type"]?.includes("application/json"),
      "Correct MIME type for .json",
    );

    // ==========================================
    // Test 3: Access HTML file
    // ==========================================
    console.log("\n📋 Test 3: Access HTML File");
    const htmlRes = await makeRequest("/public/index.html");
    assert(htmlRes.status === 200, "Status 200 for HTML file");
    assert(
      htmlRes.headers["content-type"]?.includes("text/html"),
      "Correct MIME type for .html",
    );

    // ==========================================
    // Test 4: Access image file
    // ==========================================
    console.log("\n📋 Test 4: Access Image File");
    const imgRes = await makeRequest("/public/1356899.jpeg");
    assert(imgRes.status === 200, "Status 200 for image file");
    assert(
      imgRes.headers["content-type"]?.includes("image/jpeg"),
      "Correct MIME type for .jpeg",
    );

    // ==========================================
    // Test 5: Non-existent file returns 404
    // ==========================================
    console.log("\n📋 Test 5: Non-existent File");
    const notFoundRes = await makeRequest("/public/nonexistent.txt");
    assert(notFoundRes.status === 404, "Status 404 for missing file");

    // ==========================================
    // Test 6: Path traversal blocked
    // ==========================================
    console.log("\n📋 Test 6: Security - Path Traversal");
    const traversalRes = await makeRequest("/public/../vibe.js");
    assert(
      traversalRes.status === 403 || traversalRes.status === 404,
      "Path traversal blocked (403 or 404)",
    );

    // ==========================================
    // Summary
    // ==========================================
    console.log("\n" + "=".repeat(50));
    console.log(
      `📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`,
    );
    console.log("=".repeat(50));

    if (testsFailed === 0) {
      console.log("\n🎉 All static file tests passed!\n");
      process.exit(0);
    } else {
      console.log("\n⚠️  Some tests failed. Please review.\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Test execution failed:", error.message);
    process.exit(1);
  }
});
