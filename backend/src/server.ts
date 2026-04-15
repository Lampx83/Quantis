/**
 * Quantis PostgreSQL API — standalone (PORT mặc định 4003).
 * Frontend: VITE_QUANTIS_API_URL=http://localhost:4003
 * Chế độ JSON + proxy: dùng `npm run start:json` (json-server.cjs).
 */
import "./env.js"
import express from "express"
import cors from "cors"
import { PORT } from "./env.js"
import { ensureDatabase } from "./ensure-db.js"
import { createSessionMiddleware } from "./lib/session.js"
import { createQuantisApiRouter } from "./createApiRouter.js"

const app = express()
app.set("trust proxy", 1)
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: "50mb" }))
app.use(createSessionMiddleware())
app.use("/api/quantis", createQuantisApiRouter())

app.get("/", (_req, res) => {
  res.json({
    service: "quantis-backend",
    storage: "postgresql",
    message: "Quantis API — dùng /api/quantis/health, /api/quantis/data, /api/quantis/auth/*",
    timestamp: new Date().toISOString(),
  })
})

async function start() {
  await ensureDatabase()
  app.listen(PORT, () => {
    console.log("[quantis-backend] PostgreSQL listening on port", PORT, "schema:", process.env.DB_SCHEMA || "quantis")
  })
}

start().catch((err) => {
  console.error("[quantis-backend] start failed:", err)
  process.exit(1)
})
