/**
 * Vibe Demo Server
 * Tests all framework features with 10+ routes
 */

import vibe, {
  LRUCache,
  cacheMiddleware,
  clusterize,
  isPrimary,
  getWorkerId,
} from "./vibe.js";
import { adapt } from "./utils/helpers/adapt.js";
import fs from "fs";
import path from "path";

// ============================================
// SETUP
// ============================================

const app = vibe();
const cache = new LRUCache({ max: 100, ttl: 30000 }); // 30s cache

// Create public folder if not exists
if (!fs.existsSync("public")) {
  fs.mkdirSync("public");
}
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Write a simple HTML file
fs.writeFileSync(
  "public/index.html",
  `
<!DOCTYPE html>
<html>
<head>
  <title>Vibe Demo</title>
  <style>
    body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
    h1 { color: #6366f1; }
    .route { background: #f1f5f9; padding: 10px; margin: 10px 0; border-radius: 8px; }
    code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>🚀 Vibe Demo Server</h1>
  <p>Testing all framework features</p>
  
  <h2>Available Routes</h2>
  <div class="route"><code>GET /</code> - Static string response</div>
  <div class="route"><code>GET /json</code> - JSON response</div>
  <div class="route"><code>GET /users/:id</code> - Route parameters</div>
  <div class="route"><code>GET /search?q=term</code> - Query parameters</div>
  <div class="route"><code>POST /echo</code> - JSON body echo</div>
  <div class="route"><code>POST /upload</code> - File upload</div>
  <div class="route"><code>GET /protected</code> - Auth interceptor</div>
  <div class="route"><code>GET /api/v1/status</code> - Plugin with prefix</div>
  <div class="route"><code>GET /cached</code> - Cached response</div>
  <div class="route"><code>GET /html</code> - HTML file response</div>
  <div class="route"><code>GET /error</code> - Error handling</div>
  <div class="route"><code>GET /decorated</code> - Decorators demo</div>
</body>
</html>
`,
);

app.setPublicFolder("public");

// ============================================
// DECORATORS
// ============================================

// App decorator - shared config
app.decorate("config", {
  name: "Vibe Demo",
  version: "2.0.0",
  env: process.env.NODE_ENV || "development",
});

// Request decorator - add timestamp to all requests
app.decorateRequest("timestamp", () => Date.now());

// Reply decorator - custom property (functions need to be used differently)
app.decorateReply("customProp", { added: true, via: "decorator" });

// ============================================
// GLOBAL INTERCEPTOR (Logger)
// ============================================

app.plugin((req, res) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${req.method}] ${req.url} - ${res.statusCode} (${duration}ms)`,
    );
  });
});

// ============================================
// AUTH INTERCEPTOR
// ============================================

const authCheck = (req, res) => {
  const token = req.headers["authorization"];
  if (!token || token !== "Bearer secret123") {
    res.unauthorized("Invalid or missing token");
    return false;
  }
  req.user = { id: 1, name: "Demo User" };
  return true;
};

// ============================================
// ROUTES
// ============================================

// 1. Static string response
app.get("/", "Welcome to Vibe Demo Server! 🚀");

// 2. JSON response (just return object)
app.get("/json", {
  success: true,
  message: "Hello from Vibe!",
  framework: "vibe",
  version: "2.0.0",
});

// 3. Route parameters
app.get("/users/:id", (req) => ({
  userId: req.params.id,
  requestedAt: new Date().toISOString(),
}));

// 4. Multiple route parameters
app.get("/posts/:postId/comments/:commentId", (req) => ({
  postId: req.params.postId,
  commentId: req.params.commentId,
}));

// 5. Query parameters
app.get("/search", (req) => ({
  query: req.query.q || "",
  page: parseInt(req.query.page) || 1,
  limit: parseInt(req.query.limit) || 10,
  results: [],
}));

// 6. POST with JSON body
app.post("/echo", (req) => ({
  received: req.body,
  timestamp: Date.now(),
}));

// 7. File upload
app.post(
  "/upload",
  {
    media: {
      dest: "uploads",
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
    },
  },
  (req) => ({
    message: "Upload successful",
    files: req.files,
    body: req.body,
  }),
);

// 8. Protected route with interceptor
app.get("/protected", { intercept: authCheck }, (req) => ({
  message: "You have access!",
  user: req.user,
}));

// 9. Cached response
app.get("/cached", { intercept: cacheMiddleware(cache) }, () => ({
  data: "This response is cached for 30 seconds",
  generatedAt: new Date().toISOString(),
  random: Math.random(),
}));

// 10. HTML file response
app.get("/html", (req, res) => {
  res.sendHtml("index.html");
});

// 11. Error handling demo
app.get("/error", () => {
  throw new Error("This is a demo error!");
});

// 12. Decorator demo
app.get("/decorated", (req, res) => {
  return {
    appConfig: app.decorators.config,
    requestTimestamp: req.timestamp,
    message: "Decorators are working!",
  };
});

// ============================================
// PLUGIN WITH PREFIX
// ============================================

await app.register(
  async (api) => {
    // GET /api/v1/status
    api.get("/status", {
      status: "ok",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });

    // GET /api/v1/health
    api.get("/health", {
      healthy: true,
      checks: {
        memory: "ok",
        uptime: "ok",
      },
    });

    // GET /api/v1/info
    api.get("/info", (req) => ({
      name: "Vibe Demo API",
      version: "1.0.0",
      endpoints: ["/status", "/health", "/info"],
    }));
  },
  { prefix: "/api/v1" },
);

// Admin auth check
const adminCheck = (req, res) => {
  const adminToken = req.headers["x-admin-token"];
  if (adminToken !== "admin-secret") {
    res.forbidden("Admin access required");
    return false;
  }
  return true;
};

await app.register(
  async (admin) => {
    // GET /admin/dashboard (with interceptor)
    admin.get(
      "/dashboard",
      { intercept: adminCheck },
      {
        totalUsers: 1250,
        activeUsers: 89,
        revenue: "$12,500",
      },
    );

    // GET /admin/settings (with interceptor)
    admin.get(
      "/settings",
      { intercept: adminCheck },
      {
        siteName: "Vibe Demo",
        maintenanceMode: false,
      },
    );
  },
  { prefix: "/admin" },
);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           🚀 VIBE DEMO SERVER RUNNING                  ║
╠═══════════════════════════════════════════════════════╣
║  URL: http://localhost:${PORT}                          ║
║  Mode: ${app.decorators.config.env.padEnd(20)}          ║
║                                                       ║
║  Routes:                                              ║
║    GET  /              - Static string                ║
║    GET  /json          - JSON response                ║
║    GET  /users/:id     - Route params                 ║
║    GET  /search?q=     - Query params                 ║
║    POST /echo          - JSON body                    ║
║    POST /upload        - File upload                  ║
║    GET  /protected     - Auth required                ║
║    GET  /cached        - Cached response              ║
║    GET  /html          - HTML file                    ║
║    GET  /error         - Error demo                   ║
║    GET  /decorated     - Decorators                   ║
║    GET  /api/v1/*      - Plugin routes                ║
║    GET  /admin/*       - Nested plugin                ║
║                                                       ║
║  Auth Header: Authorization: Bearer secret123         ║
║  Admin Header: x-admin-token: admin-secret            ║
╚═══════════════════════════════════════════════════════╝
  `);
});
