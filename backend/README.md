# Quantis backend

Một package gồm **hai chế độ**:

| Lệnh | Mô tả |
|------|--------|
| `npm run build && npm start` | **PostgreSQL** — auth SurveyLab, `/data` theo user, embed AI Portal (`dist/embed.js`). Port mặc định **4003**. |
| `npm run start:json` | **JSON + proxy** — `data/store.json`, proxy Archive / Ollama / Python (`json-server.cjs`). Port mặc định **4001**. |

- Schema SQL: `schema/schema.sql`
- Biến môi trường: `.env.example`
- Portal: `import { createEmbedRouter } from "quantis-backend/embed"` hoặc đường dẫn file `dist/embed.js`
