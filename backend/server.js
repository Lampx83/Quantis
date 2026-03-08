/**
 * Backend Quantis (riêng): API lưu datasets/workflows vào file JSON.
 * Chạy độc lập, không cần PostgreSQL. Frontend trỏ VITE_QUANTIS_API_URL tới đây.
 * Proxy Archive NEU: /api/quantis/archive/* -> archive.neu.edu.vn/api/v1/* (tránh CORS và route 422).
 */
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 4001;
const ARCHIVE_NEU_URL = (process.env.ARCHIVE_NEU_URL || "https://archive.neu.edu.vn").replace(/\/+$/, "");
const OLLAMA_URL = (process.env.OLLAMA_URL || "https://research.neu.edu.vn/ollama").replace(/\/+$/, "");
const ARCHIVE_NEU_TOKEN = process.env.ARCHIVE_NEU_TOKEN || "";
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));

// Trang thông tin backend khi truy cập root
const INFO_HTML = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quantis Backend</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1e293b; line-height: 1.6; }
    h1 { color: #0f172a; font-size: 1.5rem; margin-bottom: 0.5rem; }
    .subtitle { color: #64748b; font-size: 0.95rem; margin-bottom: 1.5rem; }
    section { margin-bottom: 1.5rem; }
    section h2 { font-size: 1rem; color: #334155; margin-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.25rem; }
    ul { margin: 0; padding-left: 1.25rem; }
    li { margin-bottom: 0.35rem; }
    code { background: #f1f5f9; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    .method { display: inline-block; min-width: 3.5rem; font-weight: 600; }
    .method.get { color: #059669; }
    .method.post { color: #2563eb; }
    .method.any { color: #7c3aed; }
    a { color: #2563eb; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>Quantis Backend</h1>
  <p class="subtitle">API server cho ứng dụng Quantis — phân tích định lượng và thống kê</p>

  <section>
    <h2>Backend dùng để làm gì?</h2>
    <ul>
      <li><strong>Lưu trữ dữ liệu:</strong> Lưu datasets và workflows của Quantis vào file JSON (<code>backend/data/store.json</code>), đồng bộ với frontend qua API.</li>
      <li><strong>Proxy Archive NEU:</strong> Chuyển tiếp các request tới Archive NEU (<code>/api/quantis/archive/*</code>) để tìm và tải dataset, tránh CORS.</li>
      <li><strong>Proxy Ollama (AI):</strong> Chuyển tiếp <code>/api/quantis/ollama/*</code> tới Ollama (<code>OLLAMA_URL</code>), tránh CORS khi frontend gọi từ trình duyệt.</li>
      <li><strong>Proxy phân tích (tùy chọn):</strong> Khi cấu hình <code>ANALYZE_PYTHON_URL</code>, chuyển tiếp <code>/api/quantis/analyze/*</code> tới backend Python (R/stats).</li>
    </ul>
  </section>

  <section>
    <h2>Các API có sẵn</h2>
    <ul>
      <li><span class="method get">GET</span> <code>/api/quantis/health</code> — Kiểm tra backend còn sống. Trả về <code>{ "status": "ok", "service": "quantis" }</code>.</li>
      <li><span class="method get">GET</span> <code>/api/quantis/data</code> — Lấy toàn bộ datasets và workflows (JSON).</li>
      <li><span class="method post">POST</span> <code>/api/quantis/data</code> — Lưu datasets và workflows. Body: <code>{ "datasets": [...], "workflows": [...] }</code>.</li>
      <li><span class="method any">*</span> <code>/api/quantis/archive/*</code> — Proxy tới Archive NEU (<code>api/v1/*</code>). Dùng để tìm kiếm và tải dataset vào Quantis.</li>
      <li><span class="method any">*</span> <code>/api/quantis/ollama/*</code> — Proxy tới Ollama (cấu hình <code>OLLAMA_URL</code>). Tránh CORS khi dùng AI từ trình duyệt.</li>
      <li><span class="method any">*</span> <code>/api/quantis/analyze/*</code> — Proxy tới backend phân tích Python (nếu đã cấu hình <code>ANALYZE_PYTHON_URL</code>).</li>
    </ul>
  </section>

  <section>
    <h2>Liên kết nhanh</h2>
    <ul>
      <li><a href="/api/quantis/health">/api/quantis/health</a> — Health check</li>
      <li><a href="/api/quantis/data">/api/quantis/data</a> — Xem dữ liệu hiện tại (JSON)</li>
      <li><a href="/api/quantis/settings">/api/quantis/settings</a> — Cấu hình dùng chung (Archive, AI, …)</li>
    </ul>
  </section>

  <p style="color: #94a3b8; font-size: 0.85rem;">Quantis backend — chạy độc lập, không cần PostgreSQL. Frontend cấu hình <code>VITE_QUANTIS_API_URL</code> trỏ tới URL này.</p>
</body>
</html>
`;

app.get("/", (req, res) => {
  res.type("html").send(INFO_HTML);
});

// GET /api/quantis — JSON info cho client
app.get("/api/quantis", (req, res) => {
  res.json({
    service: "quantis-backend",
    description: "API server cho ứng dụng Quantis: lưu datasets/workflows, proxy Archive NEU, proxy phân tích (Python).",
    endpoints: [
      { method: "GET", path: "/api/quantis/health", description: "Health check" },
      { method: "GET", path: "/api/quantis/data", description: "Lấy datasets và workflows" },
      { method: "POST", path: "/api/quantis/data", description: "Lưu datasets và workflows", body: { datasets: "[]", workflows: "[]" } },
      { method: "GET", path: "/api/quantis/settings", description: "Cấu hình dùng chung (Archive, AI, …)" },
      { method: "PUT", path: "/api/quantis/settings", description: "Lưu cấu hình dùng chung", body: { archiveUrl: "...", archiveFileUrl: "...", aiApiUrl: "...", defaultAiModel: "..." } },
      { method: "*", path: "/api/quantis/archive/*", description: "Proxy Archive NEU" },
      { method: "*", path: "/api/quantis/ollama/*", description: "Proxy Ollama AI (OLLAMA_URL)" },
      { method: "*", path: "/api/quantis/analyze/*", description: "Proxy backend phân tích (khi cấu hình ANALYZE_PYTHON_URL)" },
    ],
    docs: "Truy cập GET / để xem trang thông tin đầy đủ.",
  });
});

function readStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, "utf8");
      const data = JSON.parse(raw);
      return {
        datasets: Array.isArray(data.datasets) ? data.datasets : [],
        workflows: Array.isArray(data.workflows) ? data.workflows : [],
      };
    }
  } catch (e) {
    console.warn("readStore:", e.message);
  }
  return { datasets: [], workflows: [] };
}

function writeStore(datasets, workflows) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      STORE_FILE,
      JSON.stringify({ datasets, workflows }, null, 2),
      "utf8"
    );
  } catch (e) {
    console.error("writeStore:", e.message);
    throw e;
  }
}

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, "utf8");
      const data = JSON.parse(raw);
      if (data && typeof data === "object") return data;
    }
  } catch (e) {
    console.warn("readSettings:", e.message);
  }
  // Khi chưa có settings.json: nếu deploy research.neu.edu.vn thì trả về mặc định để người dùng không cần cấu hình
  const researchDeploy = process.env.RESEARCH_NEU_DEPLOY === "1" || process.env.RESEARCH_NEU_DEPLOY === "true";
  if (researchDeploy) {
    const base = (process.env.RESEARCH_NEU_BASE_URL || "https://research.neu.edu.vn").replace(/\/+$/, "");
    return {
      backendApiUrl: `${base}/api/quantis/backend`,
      archiveUrl: `${base}/api/archive`,
      archiveFileUrl: `${base}/api/archive-file`,
      aiApiUrl: `${base}/ollama/v1`,
      defaultAiModel: "qwen3:8b",
    };
  }
  return {};
}

function writeSettings(settings) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf8");
  } catch (e) {
    console.error("writeSettings:", e.message);
    throw e;
  }
}

// GET /api/quantis/health
app.get("/api/quantis/health", (req, res) => {
  res.json({ status: "ok", service: "quantis" });
});

// GET /api/quantis/data
app.get("/api/quantis/data", (req, res) => {
  try {
    const store = readStore();
    res.json({ datasets: store.datasets, workflows: store.workflows });
  } catch (e) {
    console.error("GET /api/quantis/data:", e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/quantis/data
app.post("/api/quantis/data", (req, res) => {
  try {
    const datasets = Array.isArray(req.body?.datasets) ? req.body.datasets : [];
    const workflows = Array.isArray(req.body?.workflows) ? req.body.workflows : [];
    writeStore(datasets, workflows);
    res.json({ status: "ok" });
  } catch (e) {
    console.error("POST /api/quantis/data:", e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/quantis/settings — Cấu hình dùng chung cho tất cả tài khoản (lưu trong data/settings.json; có thể thay bằng DB)
app.get("/api/quantis/settings", (req, res) => {
  try {
    const settings = readSettings();
    res.json(settings);
  } catch (e) {
    console.error("GET /api/quantis/settings:", e);
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/quantis/settings — Lưu cấu hình dùng chung
app.put("/api/quantis/settings", (req, res) => {
  try {
    const body = req.body || {};
    const current = readSettings();
    const settings = {
      backendApiUrl: body.backendApiUrl !== undefined ? (body.backendApiUrl || null) : current.backendApiUrl,
      archiveUrl: body.archiveUrl !== undefined ? (body.archiveUrl || null) : current.archiveUrl,
      archiveFileUrl: body.archiveFileUrl !== undefined ? (body.archiveFileUrl || null) : current.archiveFileUrl,
      aiApiUrl: body.aiApiUrl !== undefined ? (body.aiApiUrl || null) : current.aiApiUrl,
      defaultAiModel: body.defaultAiModel !== undefined ? (body.defaultAiModel || null) : current.defaultAiModel,
    };
    writeSettings(settings);
    res.json({ status: "ok", settings });
  } catch (e) {
    console.error("PUT /api/quantis/settings:", e);
    res.status(500).json({ error: e.message });
  }
});

const ANALYZE_PYTHON_URL = (process.env.ANALYZE_PYTHON_URL || "").replace(/\/+$/, "");

// Proxy phân tích: /api/quantis/analyze/* -> Python backend (khi ANALYZE_PYTHON_URL được cấu hình)
app.use("/api/quantis/analyze", async (req, res) => {
  if (!ANALYZE_PYTHON_URL) {
    return res.status(503).json({ error: "Analysis backend not configured", detail: "Set ANALYZE_PYTHON_URL to enable Python analysis." });
  }
  const pathAndQuery = req.url.startsWith("/") ? req.url : "/" + req.url;
  const targetUrl = `${ANALYZE_PYTHON_URL}/api/quantis/analyze${pathAndQuery}`;
  const headers = { ...req.headers, host: new URL(ANALYZE_PYTHON_URL).host };
  delete headers["origin"];
  delete headers["referer"];
  try {
    const opt = { method: req.method, headers, redirect: "follow" };
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body != null && typeof req.body === "object" && !Array.isArray(req.body) && !Buffer.isBuffer(req.body)) {
        opt.body = JSON.stringify(req.body);
        if (!headers["content-type"]) headers["content-type"] = "application/json";
      } else if (Buffer.isBuffer(req.body) || (typeof req.body === "object" && req.body?.length)) {
        opt.body = req.body;
      }
    }
    const proxyRes = await fetch(targetUrl, opt);
    const contentType = proxyRes.headers.get("content-type") || "";
    res.status(proxyRes.status);
    proxyRes.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      if (lower !== "transfer-encoding" && lower !== "connection") res.setHeader(k, v);
    });
    if (contentType.includes("application/json")) {
      return res.json(await proxyRes.json());
    }
    const buf = Buffer.from(await proxyRes.arrayBuffer());
    res.send(buf);
  } catch (e) {
    console.error("Analysis proxy error:", e.message);
    res.status(502).json({ error: "Analysis backend unreachable", detail: e.message });
  }
});

// Proxy Ollama: /api/quantis/ollama/* -> OLLAMA_URL/* (tránh CORS khi frontend gọi từ browser)
app.use("/api/quantis/ollama", async (req, res) => {
  const pathAndQuery = req.url.startsWith("/") ? req.url : "/" + req.url;
  const targetUrl = `${OLLAMA_URL}${pathAndQuery}`;
  const headers = { ...req.headers, host: new URL(OLLAMA_URL).host };
  delete headers["origin"];
  delete headers["referer"];
  try {
    const opt = { method: req.method, headers, redirect: "follow" };
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body != null && typeof req.body === "object" && !Array.isArray(req.body) && !Buffer.isBuffer(req.body)) {
        opt.body = JSON.stringify(req.body);
        if (!headers["content-type"]) headers["content-type"] = "application/json";
      } else if (Buffer.isBuffer(req.body) || (typeof req.body === "object" && req.body?.length)) {
        opt.body = req.body;
      }
    }
    const proxyRes = await fetch(targetUrl, opt);
    const contentType = proxyRes.headers.get("content-type") || "";
    res.status(proxyRes.status);
    proxyRes.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      if (lower === "transfer-encoding" || lower === "connection") return;
      if (lower.startsWith("access-control-")) return;
      res.setHeader(k, v);
    });
    if (contentType.includes("application/json")) {
      return res.json(await proxyRes.json());
    }
    const buf = Buffer.from(await proxyRes.arrayBuffer());
    res.send(buf);
  } catch (e) {
    console.error("Ollama proxy error:", e.message);
    res.status(502).json({ error: "Ollama proxy failed", detail: e.message });
  }
});

// Proxy Archive NEU: /api/quantis/archive/* -> archive.neu.edu.vn/api/v1/*
// Tránh CORS và lỗi 422 do route API gốc (path request_id nhầm "search").
app.use("/api/quantis/archive", async (req, res) => {
  const pathAndQuery = req.url.startsWith("/") ? req.url : "/" + req.url;
  const targetUrl = `${ARCHIVE_NEU_URL}/api/v1${pathAndQuery}`;
  const headers = { ...req.headers, host: new URL(ARCHIVE_NEU_URL).host };
  delete headers["origin"];
  delete headers["referer"];
  if (ARCHIVE_NEU_TOKEN) headers["authorization"] = `Bearer ${ARCHIVE_NEU_TOKEN}`;
  try {
    const opt = { method: req.method, headers, redirect: "follow" };
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.body != null && typeof req.body === "object" && !Array.isArray(req.body) && !Buffer.isBuffer(req.body)) {
        opt.body = JSON.stringify(req.body);
        if (!headers["content-type"]) headers["content-type"] = "application/json";
      } else if (Buffer.isBuffer(req.body) || (typeof req.body === "object" && req.body?.length)) {
        opt.body = req.body;
      }
    }
    const proxyRes = await fetch(targetUrl, opt);
    const contentType = proxyRes.headers.get("content-type") || "";
    res.status(proxyRes.status);
    proxyRes.headers.forEach((v, k) => {
      const lower = k.toLowerCase();
      if (lower !== "transfer-encoding" && lower !== "connection") res.setHeader(k, v);
    });
    res.setHeader("X-Archive-Target-URL", targetUrl);
    res.setHeader("X-Archive-Target-Method", req.method);
    res.setHeader("Access-Control-Expose-Headers", "X-Archive-Target-URL, X-Archive-Target-Method");
    if (contentType.includes("application/json")) {
      return res.json(await proxyRes.json());
    }
    const buf = Buffer.from(await proxyRes.arrayBuffer());
    res.send(buf);
  } catch (e) {
    console.error("Archive proxy error:", e.message);
    res.setHeader("X-Archive-Target-URL", targetUrl);
    res.setHeader("X-Archive-Target-Method", req.method);
    res.setHeader("Access-Control-Expose-Headers", "X-Archive-Target-URL, X-Archive-Target-Method");
    res.status(502).json({ error: "Archive proxy failed", detail: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Quantis backend: http://localhost:${PORT}`);
  console.log(`  GET  /              — Trang thông tin backend (mục đích + danh sách API)`);
  console.log(`  GET  /api/quantis   — Thông tin API (JSON)`);
  console.log(`  GET  /api/quantis/health`);
  console.log(`  GET  /api/quantis/data`);
  console.log(`  POST /api/quantis/data`);
  console.log(`  GET  /api/quantis/settings`);
  console.log(`  PUT  /api/quantis/settings`);
  if (process.env.RESEARCH_NEU_DEPLOY === "1" || process.env.RESEARCH_NEU_DEPLOY === "true") {
    console.log(`  [research.neu.edu.vn] Mặc định: khi chưa có settings.json, GET /api/quantis/settings trả về cấu hình research (người dùng không cần cấu hình).`);
  }
  if (ANALYZE_PYTHON_URL) console.log(`  *    /api/quantis/analyze/* -> ${ANALYZE_PYTHON_URL}/api/quantis/analyze/*`);
  console.log(`  *    /api/quantis/ollama/* -> ${OLLAMA_URL}/*`);
  console.log(`  *    /api/quantis/archive/* -> ${ARCHIVE_NEU_URL}/api/v1/*`);
});
