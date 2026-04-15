/**
 * AI Portal: mount router dùng PORTAL_DATABASE_URL, schema riêng quantis (không đụng ai_portal).
 * Giống SurveyLab embed: /api/data → Quantis: /api/quantis/* trên cùng mount prefix Portal quy ước.
 */
import express from "express"
import { ensureDatabase } from "./ensure-db.js"
import { createQuantisApiRouter } from "./createApiRouter.js"

/** Luôn quantis — tránh kế thừa DB_SCHEMA từ app embed khác (vd. surveylab) trong cùng process Portal. */
process.env.DB_SCHEMA = "quantis"
process.env.RUN_MODE = "embedded"

const api = createQuantisApiRouter()

export function createEmbedRouter(): express.Router {
  const router = express.Router({ mergeParams: true })
  router.use(express.json({ limit: "50mb" }))

  router.get("/", (_req, res) => {
    res.json({
      service: "quantis",
      status: "ok",
      message: "Quantis API (AI Portal). GET /api/quantis/health — dữ liệu: /api/quantis/data (cần X-User-Id).",
      timestamp: new Date().toISOString(),
    })
  })

  /** Khi Portal mount router tại .../api/quantis/backend → URL đầy đủ .../backend/api/quantis/data */
  router.use("/api/quantis", api)

  ensureDatabase().catch((err) => console.error("[quantis-embed] ensureDatabase failed:", err))
  return router
}

export default createEmbedRouter
