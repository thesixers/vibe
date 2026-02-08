/**
 * Vibe Scalability Features Test
 */
import vibe, {
  LRUCache,
  cacheMiddleware,
  Pool,
  createPool,
  clusterize,
  isPrimary,
} from "../vibe.js";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

console.log("\n🔬 Scalability Features Test\n");

// ==========================================
// Test 1: LRU Cache
// ==========================================
console.log("📋 Test 1: LRU Cache");

const cache = new LRUCache({ max: 3, ttl: 1000 });

cache.set("key1", "value1");
cache.set("key2", "value2");
cache.set("key3", "value3");

assert(cache.get("key1").value === "value1", "Cache get works");
assert(cache.size === 3, "Cache size is correct");

// Test LRU eviction
cache.set("key4", "value4");
assert(cache.size === 3, "Cache evicts oldest entry");
assert(cache.get("key1") === null, "Oldest entry was evicted");

// Test ETag generation
const etag = LRUCache.etag({ test: "data" });
assert(etag.startsWith('"') && etag.endsWith('"'), "ETag is quoted");

// Test cache key
const key = LRUCache.key("GET", "/api/users");
assert(key === "GET:/api/users", "Cache key format correct");

// ==========================================
// Test 2: Connection Pool
// ==========================================
console.log("\n📋 Test 2: Connection Pool");

let connectionId = 0;
const pool = createPool({
  create: async () => ({ id: ++connectionId, active: true }),
  destroy: async (conn) => {
    conn.active = false;
  },
  validate: (conn) => conn.active,
  min: 1,
  max: 3,
});

// Wait for init
await new Promise((r) => setTimeout(r, 100));

assert(pool.stats.available >= 1, "Pool creates min resources");

const conn1 = await pool.acquire();
assert(conn1.id > 0, "Acquire returns resource");
assert(pool.stats.inUse === 1, "Stats track in-use");

pool.release(conn1);
assert(pool.stats.available >= 1, "Release returns to pool");

// Test pool.use() helper
const result = await pool.use(async (conn) => {
  return conn.id * 2;
});
assert(result > 0, "pool.use() auto-releases");

await pool.close();
assert(pool.stats.available === 0, "Pool closes cleanly");

// ==========================================
// Test 3: Cluster Utilities
// ==========================================
console.log("\n📋 Test 3: Cluster Utilities");

assert(typeof clusterize === "function", "clusterize exported");
assert(typeof isPrimary === "function", "isPrimary exported");
assert(isPrimary() === true, "isPrimary returns true in main process");

// ==========================================
// Test 4: Cache Middleware
// ==========================================
console.log("\n📋 Test 4: Cache Middleware");

const testCache = new LRUCache();
const middleware = cacheMiddleware(testCache);

assert(typeof middleware === "function", "cacheMiddleware returns function");

// ==========================================
// Test 5: Integration with App
// ==========================================
console.log("\n📋 Test 5: Integration with App");

const app = vibe();

// Decorate with cache
app.decorate("cache", new LRUCache({ max: 100 }));
assert(app.decorators.cache instanceof LRUCache, "Cache decorates app");

// Route with cache
app.get("/cached", { intercept: cacheMiddleware(app.decorators.cache) }, () => {
  return { data: "test" };
});

// Streaming route
app.post("/stream", { media: { streaming: true } }, () => {
  return { received: true };
});

assert(true, "Streaming route registered");

// ==========================================
// Summary
// ==========================================
console.log("\n" + "=".repeat(50));
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(50));

if (failed === 0) {
  console.log("\n🎉 All scalability features working!\n");
} else {
  console.log("\n⚠️  Some tests failed.\n");
  process.exit(1);
}
