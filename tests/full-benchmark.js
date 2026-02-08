/**
 * Full Framework Comparison Benchmark
 * Higher iterations for stable numbers
 */
import http from "http";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4000;
const REQUESTS = 5000; // More requests for stable numbers
const CONCURRENCY = 50; // Higher concurrency

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
    req.setTimeout(10000, () => reject(new Error("Timeout")));
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
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
    rps: Math.floor(arr.length / (total / 1000 / CONCURRENCY)),
  };
}

// Server configs
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
  console.log("\\n🔬 FULL FRAMEWORK COMPARISON BENCHMARK\\n");
  console.log(
    `Config: ${REQUESTS.toLocaleString()} requests, ${CONCURRENCY} concurrent\\n`,
  );
  console.log("=".repeat(80));

  const results = {};

  for (const [name, code] of Object.entries(servers)) {
    console.log(`\\n📦 Testing ${name}...`);

    const serverFile = path.join(__dirname, `_temp_${name.toLowerCase()}.mjs`);
    fs.writeFileSync(serverFile, code);

    try {
      const proc = spawn("node", [serverFile], {
        cwd: path.join(__dirname, ".."),
        stdio: ["pipe", "pipe", "pipe"],
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Server start timeout")),
          15000,
        );
        proc.stdout.on("data", (d) => {
          if (d.toString().includes("READY")) {
            clearTimeout(timeout);
            resolve();
          }
        });
        proc.stderr.on("data", (d) =>
          console.log(`   stderr: ${d.toString().trim()}`),
        );
        proc.on("error", reject);
      });

      console.log(`   ✅ Server started`);

      // Warmup
      console.log(`   Warming up (500 requests)...`);
      await benchmark("/", 500, 50);

      // Run benchmarks
      console.log(`   Testing / (${REQUESTS} requests)...`);
      const staticRes = await benchmark("/", REQUESTS, CONCURRENCY);

      console.log(`   Testing /json (${REQUESTS} requests)...`);
      const jsonRes = await benchmark("/json", REQUESTS, CONCURRENCY);

      console.log(`   Testing /users/123 (${REQUESTS} requests)...`);
      const paramRes = await benchmark("/users/123", REQUESTS, CONCURRENCY);

      results[name] = {
        static: calcStats(staticRes),
        json: calcStats(jsonRes),
        params: calcStats(paramRes),
      };

      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      results[name] = null;
    } finally {
      try {
        fs.unlinkSync(serverFile);
      } catch {}
    }
  }

  // Print results
  console.log("\\n\\n" + "=".repeat(80));
  console.log("📊 FINAL RESULTS");
  console.log("=".repeat(80));

  const printTable = (title, key) => {
    console.log(`\\n${title}`);
    console.log("-".repeat(80));
    console.log(
      `${"Framework".padEnd(12)} | ${"Avg (ms)".padEnd(10)} | ${"P50".padEnd(8)} | ${"P95".padEnd(8)} | ${"P99".padEnd(8)} | ${"RPS".padEnd(12)}`,
    );
    console.log("-".repeat(80));
    for (const [name, data] of Object.entries(results)) {
      if (data) {
        const d = data[key];
        console.log(
          `${name.padEnd(12)} | ${d.avg.toFixed(2).padEnd(10)} | ${d.p50.toFixed(2).padEnd(8)} | ${d.p95.toFixed(2).padEnd(8)} | ${d.p99.toFixed(2).padEnd(8)} | ${d.rps.toLocaleString().padEnd(12)}`,
        );
      }
    }
  };

  printTable("🚀 Static Response (GET /)", "static");
  printTable("📦 JSON Response (GET /json)", "json");
  printTable("🔗 Params Response (GET /users/:id)", "params");

  // Summary comparison
  console.log("\\n" + "=".repeat(80));
  console.log("📈 COMPARISON SUMMARY");
  console.log("=".repeat(80));

  const vibeJson = results.Vibe?.json?.rps || 0;
  const expressJson = results.Express?.json?.rps || 1;
  const fastifyJson = results.Fastify?.json?.rps || 1;

  const vibeParams = results.Vibe?.params?.rps || 0;
  const expressParams = results.Express?.params?.rps || 1;
  const fastifyParams = results.Fastify?.params?.rps || 1;

  console.log(`\\n📦 JSON Routes:`);
  console.log(`   Vibe vs Express: ${(vibeJson / expressJson).toFixed(2)}x`);
  console.log(`   Vibe vs Fastify: ${(vibeJson / fastifyJson).toFixed(2)}x`);

  console.log(`\\n🔗 Params Routes:`);
  console.log(
    `   Vibe vs Express: ${(vibeParams / expressParams).toFixed(2)}x`,
  );
  console.log(
    `   Vibe vs Fastify: ${(vibeParams / fastifyParams).toFixed(2)}x`,
  );

  console.log("\\n" + "=".repeat(80));
  console.log("✅ Benchmark complete!\\n");
}

runBenchmarks().catch(console.error);
