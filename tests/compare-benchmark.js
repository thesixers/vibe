/**
 * Framework Comparison Benchmark
 * Compares Vibe vs Express vs Fastify using autocannon-style testing
 */
import http from "http";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4000;
const REQUESTS = 2000;
const CONCURRENCY = 20;

// HTTP request helper
function makeRequest(reqPath) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint();
    const req = http.get(`http://127.0.0.1:${PORT}${reqPath}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const end = process.hrtime.bigint();
        resolve({
          status: res.statusCode,
          time: Number(end - start) / 1_000_000,
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(5000, () => reject(new Error("Timeout")));
  });
}

// Run concurrent requests
async function benchmark(reqPath, count, concurrency) {
  const results = [];
  const batches = Math.ceil(count / concurrency);

  for (let b = 0; b < batches; b++) {
    const batchSize = Math.min(concurrency, count - b * concurrency);
    const promises = Array(batchSize)
      .fill()
      .map(() => makeRequest(reqPath));
    const batch = await Promise.all(promises);
    results.push(...batch);
  }

  return results;
}

// Calculate stats
function calcStats(arr) {
  const times = arr.map((r) => r.time).sort((a, b) => a - b);
  const total = times.reduce((a, b) => a + b, 0);
  return {
    avg: total / times.length,
    min: times[0],
    max: times[times.length - 1],
    p50: times[Math.floor(times.length * 0.5)],
    p99: times[Math.floor(times.length * 0.99)],
    rps: Math.floor(REQUESTS / (total / 1000 / CONCURRENCY)),
  };
}

// Create server files
const servers = {
  Vibe: `
import vibe from "../vibe.js";
const app = vibe();
app.get("/", "Hello World");
app.get("/json", { message: "Hello", framework: "Vibe" });
app.get("/users/:id", (req) => ({ id: req.params.id, fw: "Vibe" }));
app.listen(${PORT}, "127.0.0.1", () => console.log("READY"));
`,
  Express: `
import express from "express";
const app = express();
app.get("/", (req, res) => res.send("Hello World"));
app.get("/json", (req, res) => res.json({ message: "Hello", framework: "Express" }));
app.get("/users/:id", (req, res) => res.json({ id: req.params.id, fw: "Express" }));
app.listen(${PORT}, "127.0.0.1", () => console.log("READY"));
`,
  Fastify: `
import Fastify from "fastify";
const app = Fastify();
app.get("/", () => "Hello World");
app.get("/json", () => ({ message: "Hello", framework: "Fastify" }));
app.get("/users/:id", (req) => ({ id: req.params.id, fw: "Fastify" }));
app.listen({ port: ${PORT}, host: "127.0.0.1" }).then(() => console.log("READY"));
`,
};

async function runBenchmarks() {
  console.log("🔬 Framework Comparison Benchmark\n");
  console.log(`Config: ${REQUESTS} requests, ${CONCURRENCY} concurrent\n`);
  console.log("=".repeat(70));

  const results = {};

  for (const [name, code] of Object.entries(servers)) {
    console.log(`\n📦 Testing ${name}...`);

    // Write temp server file
    const serverFile = path.join(__dirname, `_temp_${name.toLowerCase()}.mjs`);
    fs.writeFileSync(serverFile, code);

    try {
      // Start server
      const proc = spawn("node", [serverFile], {
        cwd: path.join(__dirname, ".."),
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Wait for READY
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Server start timeout")),
          10000,
        );
        proc.stdout.on("data", (d) => {
          if (d.toString().includes("READY")) {
            clearTimeout(timeout);
            resolve();
          }
        });
        proc.stderr.on("data", (d) => {
          console.log(`   stderr: ${d.toString().trim()}`);
        });
        proc.on("error", reject);
      });

      console.log(`   ✅ Server started`);

      // Warmup
      console.log(`   Warming up...`);
      await benchmark("/", 100, 10);

      // Run benchmarks
      console.log(`   Testing / (static)...`);
      const staticRes = await benchmark("/", REQUESTS, CONCURRENCY);

      console.log(`   Testing /json...`);
      const jsonRes = await benchmark("/json", REQUESTS, CONCURRENCY);

      console.log(`   Testing /users/123...`);
      const paramRes = await benchmark("/users/123", REQUESTS, CONCURRENCY);

      results[name] = {
        static: calcStats(staticRes),
        json: calcStats(jsonRes),
        params: calcStats(paramRes),
      };

      // Kill server
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      results[name] = null;
    } finally {
      // Cleanup temp file
      try {
        fs.unlinkSync(serverFile);
      } catch {}
    }
  }

  // Print results
  console.log("\n\n" + "=".repeat(70));
  console.log("📊 RESULTS (lower latency = better, higher RPS = better)");
  console.log("=".repeat(70));

  const printTable = (title, key) => {
    console.log(`\n${title}`);
    console.log("-".repeat(70));
    console.log(
      `${"Framework".padEnd(12)} | ${"Avg (ms)".padEnd(10)} | ${"P50".padEnd(10)} | ${"P99".padEnd(10)} | ${"RPS".padEnd(10)}`,
    );
    console.log("-".repeat(70));
    for (const [name, data] of Object.entries(results)) {
      if (data) {
        const d = data[key];
        console.log(
          `${name.padEnd(12)} | ${d.avg.toFixed(2).padEnd(10)} | ${d.p50.toFixed(2).padEnd(10)} | ${d.p99.toFixed(2).padEnd(10)} | ${d.rps.toLocaleString().padEnd(10)}`,
        );
      }
    }
  };

  printTable("🚀 Static Response (GET /)", "static");
  printTable("📦 JSON Response (GET /json)", "json");
  printTable("🔗 Params Response (GET /users/:id)", "params");

  console.log("\n" + "=".repeat(70));
  console.log("✅ Benchmark complete!\n");

  // Summary
  const vibeRps = results.Vibe?.json?.rps || 0;
  const expressRps = results.Express?.json?.rps || 1;
  const fastifyRps = results.Fastify?.json?.rps || 1;

  console.log("📈 Summary:");
  console.log(`   Vibe vs Express: ${(vibeRps / expressRps).toFixed(2)}x`);
  console.log(`   Vibe vs Fastify: ${(vibeRps / fastifyRps).toFixed(2)}x\n`);
}

runBenchmarks().catch(console.error);
