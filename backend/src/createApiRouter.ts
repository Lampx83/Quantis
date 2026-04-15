import { Router } from "express"
import { query } from "./db.js"
import { requireAuth } from "./lib/requireAuth.js"
import * as auth from "./routes/auth.js"
import { getData, postData } from "./routes/data.js"
import { getSettings, putSettings } from "./routes/settings.js"
import { createOllamaProxyRouter } from "./routes/ollamaProxy.js"

/** Router mount tại /api/quantis — các route: /health, /data, /auth/*, /settings, /ollama/* */
export function createQuantisApiRouter(): Router {
  const r = Router()

  r.get("/health", async (_req, res) => {
    try {
      await query("SELECT 1")
      res.json({ status: "ok", service: "quantis", database: "connected", timestamp: new Date().toISOString() })
    } catch {
      res.status(503).json({ status: "error", service: "quantis", database: "disconnected" })
    }
  })

  r.get("/auth/config", auth.getConfig)
  r.get("/auth/me", auth.getMe)
  r.post("/auth/register", auth.register)
  r.post("/auth/login", auth.login)
  r.post("/auth/logout", auth.logout)
  r.get("/auth/sso", auth.ssoStart)
  r.get("/auth/sso/callback", auth.ssoCallback)

  r.get("/settings", getSettings)
  r.put("/settings", putSettings)

  r.use("/ollama", createOllamaProxyRouter())

  r.get("/data", requireAuth, getData)
  r.post("/data", requireAuth, postData)

  return r
}
