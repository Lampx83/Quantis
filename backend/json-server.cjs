/**
 * Backend Quantis (riêng): API lưu datasets/workflows vào file JSON + proxy Archive/Ollama/Python.
 * PostgreSQL + Portal: `npm run build && npm start` trong cùng thư mục backend — xem docs/QUANTIS-DATABASE.md.
 * Proxy Archive NEU: /api/quantis/archive/* -> archive.neu.edu.vn/api/v1/* (tránh CORS và route 422).
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const FormData = require("form-data");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const cookieSession = require("cookie-session");

const PORT = Number(process.env.PORT) || 4001;
const ARCHIVE_NEU_URL = (process.env.ARCHIVE_NEU_URL || "https://archive.neu.edu.vn").replace(/\/+$/, "");
/** Chỉ khi đặt env; không mặc định URL ngoài. Ưu tiên ollamaUpstreamUrl trong settings.json (lưu từ Cấu hình kết nối). */
const OLLAMA_URL = String(process.env.OLLAMA_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
const ARCHIVE_NEU_TOKEN = process.env.ARCHIVE_NEU_TOKEN || "";
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const USER_STORES_DIR = path.join(DATA_DIR, "user-stores");

const QUANTIS_AUTH_ENABLED = process.env.QUANTIS_AUTH_ENABLED === "1" || process.env.QUANTIS_AUTH_ENABLED === "true";
const QUANTIS_AUTH_REQUIRED = process.env.QUANTIS_AUTH_REQUIRED === "1" || process.env.QUANTIS_AUTH_REQUIRED === "true";
const QUANTIS_SSO_LABEL = process.env.QUANTIS_SSO_LABEL || "Đăng nhập SSO";
const QUANTIS_SSO_REDIRECT_URL = (process.env.QUANTIS_SSO_REDIRECT_URL || "").trim();
const SESSION_SECRET = process.env.SESSION_SECRET || "quantis-dev-secret-change-in-production";
const ADMIN_EMAILS = new Set(
  (process.env.QUANTIS_ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(
  cookieSession({
    name: "quantis_session",
    keys: [SESSION_SECRET],
    maxAge: 7 * 24 * 3600 * 1000,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "1" || process.env.COOKIE_SECURE === "true",
  })
);

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
      <li><strong>Proxy Ollama (AI):</strong> Chuyển tiếp <code>/api/quantis/ollama/*</code> tới Ollama theo <code>settings.json → ollamaUpstreamUrl</code> (Cấu hình kết nối) hoặc <code>OLLAMA_URL</code> nếu có, tránh CORS.</li>
      <li><strong>Proxy phân tích (tùy chọn):</strong> Khi cấu hình <code>ANALYZE_PYTHON_URL</code>, chuyển tiếp <code>/api/quantis/analyze/*</code> tới backend Python (R/stats).</li>
    </ul>
  </section>

  <section>
    <h2>Các API có sẵn</h2>
    <ul>
      <li><span class="method get">GET</span> <code>/api/quantis/health</code> — Kiểm tra backend còn sống. Trả về <code>{ "status": "ok", "service": "quantis" }</code>.</li>
      <li><span class="method get">GET</span> <code>/api/quantis/data</code> — Lấy toàn bộ datasets và workflows (JSON).</li>
      <li><span class="method post">POST</span> <code>/api/quantis/data</code> — Lưu datasets và workflows. Body: <code>{ "datasets": [...], "workflows": [...] }</code>.</li>
      <li><span class="method post">POST</span> <code>/api/quantis/parse-file</code> — Parse file (Excel, ODS, SPSS, Stata, SAS, R) thành bảng. Gửi multipart <code>file</code>. Cần Python backend (<code>ANALYZE_PYTHON_URL</code>).</li>
      <li><span class="method any">*</span> <code>/api/quantis/archive/*</code> — Proxy tới Archive NEU (<code>api/v1/*</code>). Dùng để tìm kiếm và tải dataset vào Quantis.</li>
      <li><span class="method any">*</span> <code>/api/quantis/ollama/*</code> — Proxy tới Ollama (ưu tiên cấu hình admin / <code>settings.json</code>, sau đó <code>OLLAMA_URL</code>).</li>
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

  <p style="color: #94a3b8; font-size: 0.85rem;">Chế độ JSON (json-server.cjs) — không cần PostgreSQL. Production: cùng package <code>backend/</code> chạy <code>npm run build && npm start</code> với Postgres. Frontend: <code>VITE_QUANTIS_API_URL</code>.</p>
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
      { method: "POST", path: "/api/quantis/parse-file", description: "Parse file (Excel, ODS, SPSS, Stata, SAS, R) — multipart file, cần ANALYZE_PYTHON_URL" },
      { method: "GET", path: "/api/quantis/settings", description: "Cấu hình dùng chung (Archive, AI, …)" },
      { method: "PUT", path: "/api/quantis/settings", description: "Lưu cấu hình dùng chung", body: { archiveUrl: "...", archiveFileUrl: "...", aiApiUrl: "...", defaultAiModel: "..." } },
      { method: "GET", path: "/api/quantis/auth/config", description: "Cấu hình đăng nhập (khi QUANTIS_AUTH_ENABLED)" },
      { method: "GET", path: "/api/quantis/auth/me", description: "User hiện tại (session cookie)" },
      { method: "POST", path: "/api/quantis/auth/register", description: "Đăng ký email/mật khẩu" },
      { method: "POST", path: "/api/quantis/auth/login", description: "Đăng nhập" },
      { method: "POST", path: "/api/quantis/auth/logout", description: "Đăng xuất" },
      { method: "GET", path: "/api/quantis/auth/sso", description: "Redirect SSO (khi QUANTIS_SSO_REDIRECT_URL)" },
      { method: "*", path: "/api/quantis/archive/*", description: "Proxy Archive NEU" },
      { method: "*", path: "/api/quantis/ollama/*", description: "Proxy Ollama (settings ollamaUpstreamUrl || OLLAMA_URL)" },
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

/** Hai prefix: dev trực tiếp và khi frontend base = .../api/quantis/backend */
const API_ROOTS = ["/api/quantis", "/api/quantis/backend/api/quantis"];

function dual(method, pathSuffix, ...handlers) {
  const m = String(method).toLowerCase();
  for (const root of API_ROOTS) {
    app[m](root + pathSuffix, ...handlers);
  }
}

function safeUserId(id) {
  if (!id || typeof id !== "string") return null;
  const s = id.trim();
  if (!/^[a-f0-9-]{36}$/i.test(s)) return null;
  return s;
}

function readUsersFile() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf8");
      const data = JSON.parse(raw);
      return Array.isArray(data.users) ? data.users : [];
    }
  } catch (e) {
    console.warn("readUsersFile:", e.message);
  }
  return [];
}

function writeUsersFile(users) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2), "utf8");
}

function readUserStore(userId) {
  const id = safeUserId(userId);
  if (!id) return { datasets: [], workflows: [] };
  const f = path.join(USER_STORES_DIR, `${id}.json`);
  try {
    if (fs.existsSync(f)) {
      const raw = fs.readFileSync(f, "utf8");
      const data = JSON.parse(raw);
      return {
        datasets: Array.isArray(data.datasets) ? data.datasets : [],
        workflows: Array.isArray(data.workflows) ? data.workflows : [],
      };
    }
  } catch (e) {
    console.warn("readUserStore:", e.message);
  }
  return { datasets: [], workflows: [] };
}

function writeUserStore(userId, datasets, workflows) {
  const id = safeUserId(userId);
  if (!id) throw new Error("Invalid user id");
  if (!fs.existsSync(USER_STORES_DIR)) fs.mkdirSync(USER_STORES_DIR, { recursive: true });
  const f = path.join(USER_STORES_DIR, `${id}.json`);
  fs.writeFileSync(f, JSON.stringify({ datasets, workflows }, null, 2), "utf8");
}

function isAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return ADMIN_EMAILS.size > 0 && ADMIN_EMAILS.has(e);
}

function authActive() {
  return QUANTIS_AUTH_ENABLED;
}

function registerAuthRoutes(root) {
  const r = `${root}/auth`;

  app.get(`${r}/config`, (_req, res) => {
    if (!authActive()) {
      res.json({ authEnabled: false, ssoEnabled: false, ssoLabel: "", authRequired: false });
      return;
    }
    res.json({
      authEnabled: true,
      ssoEnabled: Boolean(QUANTIS_SSO_REDIRECT_URL),
      ssoLabel: QUANTIS_SSO_LABEL,
      authRequired: QUANTIS_AUTH_REQUIRED,
    });
  });

  app.get(`${r}/me`, (req, res) => {
    if (!authActive()) {
      res.status(401).json({ error: "Auth not enabled" });
      return;
    }
    const userId = safeUserId(req.session?.userId);
    if (!userId) {
      res.status(401).json({ error: "Not logged in" });
      return;
    }
    const users = readUsersFile();
    const u = users.find((x) => x.id === userId);
    if (!u) {
      req.session = null;
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({
      user: {
        id: u.id,
        email: u.email,
        name: u.name || undefined,
        isAdmin: isAdminEmail(u.email),
      },
    });
  });

  app.post(`${r}/register`, async (req, res) => {
    if (!authActive()) {
      res.status(400).json({ error: "Auth not enabled" });
      return;
    }
    try {
      const email = (req.body?.email && String(req.body.email).trim().toLowerCase()) || "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      const name = (req.body?.name && String(req.body.name).trim()) || "";

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: "Email không hợp lệ" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "Mật khẩu tối thiểu 6 ký tự" });
        return;
      }
      const users = readUsersFile();
      if (users.some((x) => x.email === email)) {
        res.status(409).json({ error: "Email đã được đăng ký" });
        return;
      }
      const id = crypto.randomUUID();
      const hash = await bcrypt.hash(password, 10);
      users.push({ id, email, passwordHash: hash, name: name || null });
      writeUsersFile(users);
      req.session.userId = id;
      res.json({
        user: {
          id,
          email,
          name: name || undefined,
          isAdmin: isAdminEmail(email),
        },
      });
    } catch (e) {
      console.error("[quantis-auth] register:", e);
      res.status(500).json({ error: "Lỗi đăng ký" });
    }
  });

  app.post(`${r}/login`, async (req, res) => {
    if (!authActive()) {
      res.status(400).json({ error: "Auth not enabled" });
      return;
    }
    try {
      const email = (req.body?.email && String(req.body.email).trim().toLowerCase()) || "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!email || !password) {
        res.status(400).json({ error: "Email và mật khẩu không được để trống" });
        return;
      }
      const users = readUsersFile();
      const u = users.find((x) => x.email === email);
      if (!u || !u.passwordHash) {
        res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
        return;
      }
      const ok = await bcrypt.compare(password, u.passwordHash);
      if (!ok) {
        res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
        return;
      }
      req.session.userId = u.id;
      res.json({
        user: {
          id: u.id,
          email: u.email,
          name: u.name || undefined,
          isAdmin: isAdminEmail(u.email),
        },
      });
    } catch (e) {
      console.error("[quantis-auth] login:", e);
      res.status(500).json({ error: "Lỗi đăng nhập" });
    }
  });

  app.post(`${r}/logout`, (req, res) => {
    req.session = null;
    res.json({ ok: true });
  });

  app.get(`${r}/sso`, (req, res) => {
    if (!authActive()) {
      res.status(400).json({ error: "Auth not enabled" });
      return;
    }
    if (!QUANTIS_SSO_REDIRECT_URL) {
      res.status(503).json({ error: "SSO chưa được cấu hình" });
      return;
    }
    res.redirect(302, QUANTIS_SSO_REDIRECT_URL);
  });
}

for (const root of API_ROOTS) {
  registerAuthRoutes(root);
}

function resolveDataForRequest(req) {
  if (authActive() && safeUserId(req.session?.userId)) {
    return { mode: "user", userId: safeUserId(req.session.userId) };
  }
  return { mode: "global" };
}

function handleGetData(req, res) {
  try {
    if (authActive() && QUANTIS_AUTH_REQUIRED && !safeUserId(req.session?.userId)) {
      res.status(401).json({ error: "Cần đăng nhập" });
      return;
    }
    const ctx = resolveDataForRequest(req);
    if (ctx.mode === "user") {
      const store = readUserStore(ctx.userId);
      res.json({ datasets: store.datasets, workflows: store.workflows });
      return;
    }
    const store = readStore();
    res.json({ datasets: store.datasets, workflows: store.workflows });
  } catch (e) {
    console.error("GET data:", e);
    res.status(500).json({ error: e.message });
  }
}

function handlePostData(req, res) {
  try {
    if (authActive() && QUANTIS_AUTH_REQUIRED && !safeUserId(req.session?.userId)) {
      res.status(401).json({ error: "Cần đăng nhập" });
      return;
    }
    const datasets = Array.isArray(req.body?.datasets) ? req.body.datasets : [];
    const workflows = Array.isArray(req.body?.workflows) ? req.body.workflows : [];
    const ctx = resolveDataForRequest(req);
    if (ctx.mode === "user") {
      writeUserStore(ctx.userId, datasets, workflows);
    } else {
      writeStore(datasets, workflows);
    }
    res.json({ status: "ok" });
  } catch (e) {
    console.error("POST data:", e);
    res.status(500).json({ error: e.message });
  }
}

function handleGetSettings(req, res) {
  try {
    const settings = readSettings();
    res.json(settings);
  } catch (e) {
    console.error("GET settings:", e);
    res.status(500).json({ error: e.message });
  }
}

function handlePutSettings(req, res) {
  try {
    const body = req.body || {};
    const current = readSettings();
    const settings = {
      backendApiUrl: body.backendApiUrl !== undefined ? (body.backendApiUrl || null) : current.backendApiUrl,
      archiveUrl: body.archiveUrl !== undefined ? (body.archiveUrl || null) : current.archiveUrl,
      archiveFileUrl: body.archiveFileUrl !== undefined ? (body.archiveFileUrl || null) : current.archiveFileUrl,
      aiApiUrl: body.aiApiUrl !== undefined ? (body.aiApiUrl || null) : current.aiApiUrl,
      ollamaUpstreamUrl: body.ollamaUpstreamUrl !== undefined ? (body.ollamaUpstreamUrl || null) : current.ollamaUpstreamUrl,
      defaultAiModel: body.defaultAiModel !== undefined ? (body.defaultAiModel || null) : current.defaultAiModel,
    };
    writeSettings(settings);
    res.json({ status: "ok", settings });
  } catch (e) {
    console.error("PUT settings:", e);
    res.status(500).json({ error: e.message });
  }
}

dual("get", "/health", (req, res) => {
  res.json({ status: "ok", service: "quantis" });
});

dual("get", "/data", handleGetData);
dual("post", "/data", handlePostData);
dual("get", "/settings", handleGetSettings);
dual("put", "/settings", handlePutSettings);

const ANALYZE_PYTHON_URL = (process.env.ANALYZE_PYTHON_URL || "").replace(/\/+$/, "");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Handler dùng chung cho parse-file (path gốc và path khi embed: /api/quantis/backend/...)
async function handleParseFile(req, res) {
  if (!ANALYZE_PYTHON_URL) {
    return res.status(503).json({ error: "Parse file requires Python backend", detail: "Set ANALYZE_PYTHON_URL to enable parsing Excel, ODS, SPSS, Stata, SAS, R files." });
  }
  const file = req.file;
  if (!file || !file.buffer) {
    return res.status(400).json({ error: "No file uploaded", detail: "Send a multipart field named 'file'." });
  }
  try {
    const form = new FormData();
    form.append("file", file.buffer, { filename: file.originalname || "data", contentType: file.mimetype || "application/octet-stream" });
    const body = form.getBuffer();
    const headers = { ...form.getHeaders(), "Content-Length": String(body.length) };
    // Gọi Python (base có thể là http://host:8000 hoặc http://host:8000/api/quantis/backend-python)
    const proxyRes = await fetch(`${ANALYZE_PYTHON_URL}/parse-file`, {
      method: "POST",
      body,
      headers,
    });
    const json = await proxyRes.json().catch(() => ({ detail: "Invalid JSON from Python" }));
    if (!proxyRes.ok) {
      console.error("[parse-file] Python returned", proxyRes.status, json?.detail || json?.error || json);
      return res.status(proxyRes.status).json(json);
    }
    res.json(json);
  } catch (e) {
    console.error("Parse-file proxy error:", e.message);
    res.status(502).json({ error: "Parse file backend unreachable", detail: e.message });
  }
}

// POST /api/quantis/parse-file — upload file, proxy tới Python để parse (Excel, ODS, SPSS, Stata, SAS, R)
app.post("/api/quantis/parse-file", upload.single("file"), handleParseFile);

// Khi embed trong Portal: frontend base = /api/quantis/backend → gọi /api/quantis/backend/api/quantis/parse-file (proxy có thể forward nguyên path)
app.post("/api/quantis/backend/api/quantis/parse-file", upload.single("file"), handleParseFile);

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

function effectiveOllamaUpstream() {
  try {
    const s = readSettings();
    const u = s.ollamaUpstreamUrl != null ? String(s.ollamaUpstreamUrl).trim() : "";
    if (u) return u.replace(/\/+$/, "").replace(/\/v1$/i, "");
  } catch (_) {
    /* ignore */
  }
  return OLLAMA_URL.replace(/\/+$/, "").replace(/\/v1$/i, "");
}

function createOllamaProxyHandler() {
  return async (req, res) => {
    const upstream = effectiveOllamaUpstream();
    if (!upstream || !String(upstream).trim()) {
      return res.status(503).json({
        error: "Ollama upstream not configured",
        detail: "Set ollamaUpstreamUrl in Quantis admin (Cấu hình kết nối) or OLLAMA_URL env.",
      });
    }
    const pathAndQuery = req.url.startsWith("/") ? req.url : "/" + req.url;
    const targetUrl = `${upstream}${pathAndQuery}`;
    let host;
    try {
      host = new URL(upstream).host;
    } catch (e) {
      return res.status(500).json({ error: "Invalid ollamaUpstreamUrl in settings", detail: String(e.message || e) });
    }
    const headers = { ...req.headers, host };
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
  };
}

// Proxy Ollama: frontend chỉ gọi backend; upstream từ settings.ollamaUpstreamUrl hoặc OLLAMA_URL
app.use("/api/quantis/ollama", createOllamaProxyHandler());
app.use("/api/quantis/backend/api/quantis/ollama", createOllamaProxyHandler());

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
  console.log(`  *    /api/quantis/ollama/* -> (settings.ollamaUpstreamUrl || OLLAMA_URL)/*`);
  console.log(`  *    /api/quantis/backend/api/quantis/ollama/* -> (tương tự)`);
  console.log(`  *    /api/quantis/archive/* -> ${ARCHIVE_NEU_URL}/api/v1/*`);
  if (QUANTIS_AUTH_ENABLED) {
    console.log(`  [auth] QUANTIS_AUTH_ENABLED — đăng ký/đăng nhập, lưu workspace theo user (data/user-stores/).`);
    if (QUANTIS_AUTH_REQUIRED) console.log(`  [auth] QUANTIS_AUTH_REQUIRED — GET/POST /data bắt buộc đăng nhập.`);
  }
});
