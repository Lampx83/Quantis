# Quantis — lưu trữ PostgreSQL (giống mô hình SurveyLab)

## Hai chế độ

| Chế độ | Database | Schema | Auth dữ liệu |
|--------|----------|--------|----------------|
| **Standalone** | PostgreSQL riêng (vd. DB `quantis`) | `quantis` (mặc định, đổi `DB_SCHEMA`) | Session + bảng `users` (đăng ký/đăng nhập/SSO OIDC như SurveyLab) |
| **AI Portal (embed)** | Cùng DB với Portal | Schema riêng **`quantis`** — không ghi vào `ai_portal` | Header **`X-User-Id`** (UUID user Portal); tự upsert shadow row trong `quantis.users` |

### Frontend: nhận biết embed vs standalone

- `isPortalEmbed()` (`src/api.ts`) = `true` nếu có một trong: `window.__WRITE_API_BASE__`, `window.__PORTAL_USER__` (có `id`), `window.__QUANTIS_PORTAL_EMBED__ === true`, iframe + `window.__PORTAL_BASE_PATH__`, hoặc URL chứa `/embed/quantis`.
- **Tắt** nhận diện (host độc lập nhưng path trùng): `window.__QUANTIS_PORTAL_EMBED__ = false` trước khi app mount.
- **`embed-config.json`**: sau khi tải, gán `__PORTAL_BASE_PATH__` (nếu chưa có) và dispatch `quantis-embed-config-loaded` để auth/sync chạy lại.
- **Backend PostgreSQL (embed)**: `GET .../auth/config` trả `authEnabled: false` — không hiện gate đăng nhập Quantis; `/data` dựa **`X-User-Id`** do proxy Portal gắn.
- **Iframe**: luôn lắng nghe `postMessage` `PORTAL_USER` và gửi `QUANTIS_NEED_PORTAL_USER` / `SURVEYLAB_NEED_PORTAL_USER` (tương thích SurveyLab).

## Bảng (schema `quantis`)

- **`users`** — tài khoản standalone + bản ghi shadow cho user Portal (khi sync data).
- **`workspaces`** — một dòng / user: `datasets`, `workflows` (JSONB).
- **`global_workspace`** — một dòng `id=1`: dữ liệu chung khi standalone không bắt buộc đăng nhập.
- **`app_settings`** — một dòng `id=1`: cấu hình chung (Archive URL, AI, …).

File SQL: `backend/schema/schema.sql` (placeholder `__SCHEMA__` → tên schema khi apply).

## Code backend (`Quantis/backend/`)

- **PostgreSQL:** `src/*.ts`, `npm run build && npm start` (port mặc định **4003**).
- **JSON + proxy (dev):** `json-server.cjs`, `npm run start:json` hoặc `npm run dev` (port **4001**).
- Entry Portal: **`createEmbedRouter()`** trong `dist/embed.js` — giống SurveyLab (`embed.ts`).
- Frontend: `VITE_QUANTIS_API_URL` trỏ tới host có prefix `/api/quantis` (standalone) hoặc mount Portal `.../api/quantis/backend` + đường dẫn `.../api/quantis/data`.

## Biến môi trường quan trọng

- `DATABASE_URL` hoặc `PORTAL_DATABASE_URL` (embed).
- `RUN_MODE=standalone` | `embedded` — nên set **trước** khi load module embed (process env của Portal).
- `DB_SCHEMA=quantis`
- Auth (PostgreSQL): `AUTH_ENABLED`, `AUTH_REQUIRED`, `SESSION_SECRET`, `ADMIN_EMAILS`, SSO `SSO_*` (xem `backend/.env.example`).

## SSO callback (standalone)

Đăng ký trong IdP URL dạng:

`https://<host>:<port>/api/quantis/auth/sso/callback`

---

Xem thêm: [QUANTIS-PORTAL-AND-SURVEYLAB.md](./QUANTIS-PORTAL-AND-SURVEYLAB.md) — học theo SurveyLab (embed, migration, hiện năng, loading).
