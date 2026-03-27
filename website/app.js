/* =============================================
   VIBE DOCS — APP.JS
   ============================================= */

const PAGES = {
  index: { title: "Documentation", label: "Home" },
  "getting-started": { title: "Getting Started", label: "Getting Started" },
  routing: { title: "Routing", label: "Routing" },
  request: { title: "Request", label: "Request" },
  response: { title: "Response", label: "Response" },
  interceptors: { title: "Interceptors", label: "Interceptors" },
  logging: { title: "Logging", label: "Logging" },
  "error-handling": { title: "Error Handling", label: "Error Handling" },
  plugins: { title: "Plugins", label: "Plugins" },
  decorators: { title: "Decorators", label: "Decorators" },
  "schema-serialization": { title: "Schema Serialization", label: "Schema" },
  "file-uploads": { title: "File Uploads", label: "File Uploads" },
  "static-files": { title: "Static Files", label: "Static Files" },
  caching: { title: "Caching", label: "Caching" },
  clustering: { title: "Clustering", label: "Clustering" },
};

// Resolve the path to the docs folder (one level up from website/)
const DOCS_BASE = "/docs/";

let currentPage = "getting-started";
const cache = {};

// -----------------------------------------------
// Markdown renderer config
// -----------------------------------------------
marked.setOptions({
  gfm: true,
  breaks: false,
});

// Custom renderer — adds IDs to headings and language labels to code blocks
const renderer = new marked.Renderer();

renderer.heading = function (text, level) {
  const id = text
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "");
  return `<h${level} id="${id}">${text}</h${level}>`;
};

renderer.code = function (code, lang) {
  const language = (lang || "text").trim();
  let highlighted;
  try {
    if (language && hljs.getLanguage(language)) {
      highlighted = hljs.highlight(code, { language }).value;
    } else {
      highlighted = hljs.highlightAuto(code).value;
    }
  } catch {
    highlighted = code;
  }
  const label =
    language !== "text" ? `<span class="code-lang">${language}</span>` : "";
  return `<pre>${label}<code class="hljs language-${language}">${highlighted}</code></pre>`;
};

marked.use({ renderer });

// -----------------------------------------------
// Fetch & render a page
// -----------------------------------------------
async function loadPage(page, pushState = true) {
  if (!PAGES[page]) page = "getting-started";

  currentPage = page;

  // Update active nav link
  document.querySelectorAll(".nav-link").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === page);
  });

  // Update breadcrumb
  const info = PAGES[page];
  document.getElementById("breadcrumb").innerHTML =
    `Vibe Docs <span>/ ${info.title}</span>`;

  // Page title
  document.title = `${info.title} — Vibe Docs`;

  // Push history
  if (pushState) {
    history.pushState({ page }, "", `#${page}`);
  }

  // Show loader
  const inner = document.getElementById("contentInner");
  inner.innerHTML = `<div class="loader"><div class="loader-dots"><span></span><span></span><span></span></div></div>`;

  // Fetch markdown (with cache)
  try {
    if (!cache[page]) {
      const url = `${DOCS_BASE}${page}.md`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      cache[page] = await res.text();
    }

    const html = marked.parse(cache[page]);
    inner.innerHTML = `<div class="markdown-body">${html}</div>`;

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "instant" });

    // Close mobile sidebar
    closeSidebar();
  } catch (err) {
    inner.innerHTML = `
      <div class="markdown-body">
        <h1>Page not found</h1>
        <p>Could not load <code>${page}.md</code>. Make sure the docs folder is at the right path relative to the website.</p>
        <blockquote>Tip: serve this folder with a local server, e.g. <code>npx serve .</code></blockquote>
      </div>`;
  }
}

// -----------------------------------------------
// Sidebar toggle (mobile)
// -----------------------------------------------
function openSidebar() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("overlay").classList.add("open");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("open");
}

// -----------------------------------------------
// Search (simple client-side filter on nav links)
// -----------------------------------------------
function initSearch() {
  const input = document.getElementById("searchInput");

  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll(".nav-link").forEach((link) => {
      const matches = !q || link.textContent.toLowerCase().includes(q);
      link.style.display = matches ? "" : "none";
    });
    document.querySelectorAll(".nav-section").forEach((section) => {
      const anyVisible = [...section.querySelectorAll(".nav-link")].some(
        (l) => l.style.display !== "none",
      );
      section.style.display = anyVisible ? "" : "none";
    });
  });

  // ⌘K / Ctrl+K shortcut
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      input.focus();
      input.select();
    }
    if (e.key === "Escape") {
      input.value = "";
      input.dispatchEvent(new Event("input"));
      input.blur();
    }
  });
}

// -----------------------------------------------
// Boot
// -----------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Nav link clicks
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      loadPage(link.dataset.page);
    });
  });

  // Logo click → getting-started
  document.querySelector(".logo").addEventListener("click", (e) => {
    e.preventDefault();
    loadPage("getting-started");
  });

  // Mobile toggle
  document.getElementById("menuBtn").addEventListener("click", openSidebar);
  document.getElementById("overlay").addEventListener("click", closeSidebar);

  // Browser back/forward
  window.addEventListener("popstate", (e) => {
    const page = e.state?.page || "getting-started";
    loadPage(page, false);
  });

  // Init search
  initSearch();

  // Load initial page from hash or default
  const hash = location.hash.slice(1);
  const initialPage = PAGES[hash] ? hash : "getting-started";
  loadPage(initialPage, false);
});
