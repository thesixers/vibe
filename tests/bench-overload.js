/**
 * OVERLOAD Benchmark — Vibe vs Fastify vs Express vs Hono
 * 20,000 requests × 200 concurrent connections
 */
import http from "http";
import fs from "fs";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 4000;
const REQUESTS = 20000;
const CONCURRENCY = 200;

http.globalAgent.maxSockets = CONCURRENCY + 50;

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
    req.setTimeout(15000, () => reject(new Error("Timeout")));
  });
}

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

function calcStats(arr) {
  const times = arr.map((r) => r.time).sort((a, b) => a - b);
  const total = times.reduce((a, b) => a + b, 0);
  const errors = arr.filter((r) => r.status >= 500).length;
  return {
    avg: total / times.length,
    min: times[0],
    max: times[times.length - 1],
    p50: times[Math.floor(times.length * 0.5)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
    rps: Math.floor(arr.length / (total / 1000 / CONCURRENCY)),
    errors,
  };
}

const servers = {
  Vibe: `
import vibe from "../vibe.js";
const app = vibe();
app.get("/", "Hello World");
app.get("/json", {
  schema: {
    response: {
      type: "object",
      properties: {
        message: { type: "string" },
        framework: { type: "string" }
      }
    }
  }
}, (req, res) => ({ message: "Hello", framework: "Vibe" }));
app.get("/users/:id", {
  schema: {
    response: {
      type: "object",
      properties: {
        id: { type: "string" },
        fw: { type: "string" }
      }
    }
  }
}, (req) => ({ id: req.params.id, fw: "Vibe" }));
app.listen(${PORT}, "127.0.0.1", () => console.log("READY"));
`,
  Fastify: `
import Fastify from "fastify";
const app = Fastify({ logger: false });
app.get("/", () => "Hello World");
app.get("/json", () => ({ message: "Hello", framework: "Fastify" }));
app.get("/users/:id", (req) => ({ id: req.params.id, fw: "Fastify" }));
app.listen({ port: ${PORT}, host: "127.0.0.1" }).then(() => console.log("READY"));
`,
  Express: `
import express from "express";
const app = express();
app.get("/", (req, res) => res.send("Hello World"));
app.get("/json", (req, res) => res.json({ message: "Hello", framework: "Express" }));
app.get("/users/:id", (req, res) => res.json({ id: req.params.id, fw: "Express" }));
app.listen(${PORT}, "127.0.0.1", () => console.log("READY"));
`,
  Hono: `
import { Hono } from "hono";
import { serve } from "@hono/node-server";
const app = new Hono();
app.get("/", (c) => c.text("Hello World"));
app.get("/json", (c) => c.json({ message: "Hello", framework: "Hono" }));
app.get("/users/:id", (c) => c.json({ id: c.req.param("id"), fw: "Hono" }));
serve({ fetch: app.fetch, port: ${PORT}, hostname: "127.0.0.1" }, () => console.log("READY"));
`,
};

async function runBenchmarks() {
  console.log(
    "\n╔══════════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║     🔥 OVERLOAD BENCHMARK — STRESS TEST                        ║",
  );
  console.log(
    "║     Vibe · Fastify · Express · Hono                            ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════════╝\n",
  );
  console.log(
    `  Config: ${REQUESTS.toLocaleString()} requests × ${CONCURRENCY} concurrent\n`,
  );

  const results = {};

  for (const [name, code] of Object.entries(servers)) {
    console.log(`  🔥 Stress testing ${name}...`);

    const serverFile = path.join(__dirname, `_temp_${name.toLowerCase()}.mjs`);
    fs.writeFileSync(serverFile, code);

    try {
      const proc = spawn("node", [serverFile], {
        cwd: path.join(__dirname, ".."),
        stdio: ["pipe", "pipe", "pipe"],
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error(`${name} timeout`)),
          15000,
        );
        proc.stdout.on("data", (d) => {
          if (d.toString().includes("READY")) {
            clearTimeout(timeout);
            resolve();
          }
        });
        proc.stderr.on("data", (d) => {
          const msg = d.toString().trim();
          if (msg) console.log(`     stderr: ${msg}`);
        });
        proc.on("error", reject);
      });

      console.log(`     ✅ Server started`);

      // Heavy warmup
      console.log(`     Warming up (2000 requests)...`);
      await benchmark("/", 2000, 100);

      console.log(`     Testing / (${REQUESTS.toLocaleString()} requests)...`);
      const staticRes = await benchmark("/", REQUESTS, CONCURRENCY);

      console.log(
        `     Testing /json (${REQUESTS.toLocaleString()} requests)...`,
      );
      const jsonRes = await benchmark("/json", REQUESTS, CONCURRENCY);

      console.log(
        `     Testing /users/123 (${REQUESTS.toLocaleString()} requests)...`,
      );
      const paramRes = await benchmark("/users/123", REQUESTS, CONCURRENCY);

      results[name] = {
        static: calcStats(staticRes),
        json: calcStats(jsonRes),
        params: calcStats(paramRes),
      };

      console.log(`     ✅ Done\n`);
      proc.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.log(`     ❌ Error: ${err.message}\n`);
      results[name] = null;
    } finally {
      try {
        fs.unlinkSync(serverFile);
      } catch {}
    }
  }

  const W = 96;
  console.log("\n" + "═".repeat(W));
  console.log(
    "  📊 OVERLOAD RESULTS  (lower latency = better · higher RPS = better)",
  );
  console.log("═".repeat(W));

  const printTable = (title, key) => {
    console.log(`\n  ${title}`);
    console.log("  " + "─".repeat(W - 4));
    console.log(
      `  ${"Framework".padEnd(12)} │ ${"Avg (ms)".padEnd(10)} │ ${"P50".padEnd(8)} │ ${"P95".padEnd(8)} │ ${"P99".padEnd(8)} │ ${"Max".padEnd(10)} │ ${"RPS".padEnd(12)} │ ${"Errors".padEnd(6)}`,
    );
    console.log("  " + "─".repeat(W - 4));

    const sorted = Object.entries(results)
      .filter(([, d]) => d)
      .sort((a, b) => b[1][key].rps - a[1][key].rps);

    for (const [name, data] of sorted) {
      const d = data[key];
      const marker = sorted[0][0] === name ? " 🏆" : "";
      console.log(
        `  ${(name + marker).padEnd(16)} │ ${d.avg.toFixed(2).padEnd(10)} │ ${d.p50.toFixed(2).padEnd(8)} │ ${d.p95.toFixed(2).padEnd(8)} │ ${d.p99.toFixed(2).padEnd(8)} │ ${d.max.toFixed(0).padEnd(10)} │ ${d.rps.toLocaleString().padEnd(12)} │ ${d.errors}`,
      );
    }
  };

  printTable("🚀 Static Text (GET /)", "static");
  printTable("📦 JSON Response (GET /json)", "json");
  printTable("🔗 Parameterized (GET /users/:id)", "params");

  console.log("\n" + "═".repeat(W));
  console.log("  📈 COMPARISON SUMMARY (JSON route RPS)");
  console.log("═".repeat(W));

  const vibeJson = results.Vibe?.json?.rps || 0;
  for (const [name, data] of Object.entries(results)) {
    if (data && name !== "Vibe") {
      const otherRps = data.json.rps || 1;
      const ratio = (vibeJson / otherRps).toFixed(2);
      const indicator = vibeJson > otherRps ? "⚡ faster" : "slower";
      console.log(`  Vibe vs ${name.padEnd(8)}: ${ratio}x ${indicator}`);
    }
  }

  console.log("\n" + "═".repeat(W));
  console.log("  ✅ Overload benchmark complete!");
  console.log("═".repeat(W) + "\n");
}

runBenchmarks().catch(console.error);
