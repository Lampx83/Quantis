# Quantis & AI Portal — học theo SurveyLab

Tài liệu này tóm tắt **cách SurveyLab triển khai** (tham chiếu `Surveylab/backend/`, `Surveylab/src/`) và **cách Quantis đã căn chỉnh**, để cài lên **AI Portal** ổn định, **migration an toàn**, và **UX không “treo”** khi tác vụ lâu.

## 1. Backend: hai chế độ giống SurveyLab

| Khía cạnh | SurveyLab | Quantis (`backend/` PostgreSQL) |
|-----------|-----------|-------------------------|
| Standalone | `RUN_MODE=standalone`, `DATABASE_URL`, port riêng | Cổng mặc định **4003**, `ensure-db` có thể **CREATE DATABASE** nếu thiếu DB |
| Embed Portal | `embed.ts`: `DB_SCHEMA=surveylab`, `RUN_MODE=embedded`, `createEmbedRouter()` | `embed.ts`: `DB_SCHEMA=quantis`, `RUN_MODE=embedded`, `createEmbedRouter()` |
| Auth trên embed | `GET /api/auth/config` → `authEnabled: false` (tránh frontend gọi `/me` → Guest) | Router đầy đủ: embedded mode `authEnabled()` false trong `routes/auth.ts` |
| Dữ liệu user Portal | Header **`X-User-Id`** (UUID), logic trong `routes/data.ts` | Cùng mô hình: `routes/data.ts` ưu tiên header, upsert shadow `users` |
| Khởi động schema | `ensureDatabase()` async khi load embed (không chặn listen) | Giống vậy — **idempotent** (`CREATE IF NOT EXISTS` / kiểm tra bảng) |

**Nguyên tắc Portal:** mount router Quantis **sau khi** set `process.env` (hoặc bundle embed chỉ import `createEmbedRouter` đã set sẵn `RUN_MODE` / `DB_SCHEMA`), dùng **`PORTAL_DATABASE_URL`** (hoặc `DATABASE_URL`) trỏ vào **cùng PostgreSQL** với Portal, **schema tách** (`quantis` / `surveylab`).

## 2. Migration / schema

- **Nguồn sự thật:** file SQL trong `backend/schema/schema.sql` (placeholder `__SCHEMA__` → tên schema khi apply).
- **Không cần chạy tay** trên embed nếu `ensureDatabase()` được gọi (giống SurveyLab `ensure-db.ts`): áp dụng schema khi thiếu bảng chính (vd. `workspaces`).
- **Nâng cấp phiên bản:** thêm migration mới (ALTER / CREATE INDEX) vào `schema.sql` hoặc file migration riêng rồi mở rộng `ensure-db` — tránh phá dữ liệu user; ưu tiên **additive** (thêm cột nullable / bảng mới).

## 3. Frontend: base API và nhúng (SurveyLab → Quantis)

| SurveyLab | Quantis |
|-----------|---------|
| `VITE_SURVEYLAB_API_URL`, `__WRITE_API_BASE__`, `surveylab_api_base` (localStorage) | `VITE_QUANTIS_API_URL`, `__WRITE_API_BASE__`, `__PORTAL_USER__`, `embed-config.json`, `isPortalEmbed()` |
| `checkBackendHealth` — relative `/api/apps/...` + `origin` | `checkBackendAvailable` — `credentials: "include"` |

**Khuyến nghị khi pack lên Portal:** inject `__WRITE_API_BASE__` hoặc ship `embed-config.json` + postMessage `PORTAL_USER` sớm để **không chờ** vòng auth thừa.

## 4. Hiệu năng (không chậm vô cớ)

- **Embed:** `ensureDatabase()` chạy **background** — không đợi xong mới `listen` (SurveyLab/Quantis đều `.catch(log)`).
- **Payload:** Quantis `express.json({ limit: "50mb" })` cho bảng lớn; SurveyLab 10mb — chỉnh theo nhu cầu Portal / reverse proxy (`client_max_body_size`).
- **Frontend:** tránh **full-screen blocking** không cần thiết; với tác vụ lâu (đồng bộ workspace, parse file backend) dùng **thanh/banner loading** hoặc **overlay có nhãn** (xem code `App.tsx`: `workspacePullLoading`, `sidebarImportBusy`).
- **Đồng bộ:** debounce `saveData` (đã có) — tránh POST liên tục khi kéo thả / gõ.

## 5. Loading — tác vụ dài (checklist)

- **Auth / backend:** màn hình “Đang kết nối…” khi `useBackend && authLoading` (Quantis).
- **Đồng bộ workspace (GET /data):** banner “Đang tải workspace từ máy chủ…”.
- **Import Excel/SPSS/… qua backend:** overlay “Đang đọc file trên máy chủ…”.
- **Phân tích / AI:** nút disabled + “Đang xử lý…” / spinner (nhiều tab Analysis & AI Assist đã có).
- **Cài đặt / Ollama:** nút “Kiểm tra…” trạng thái loading (Settings modal).

## 6. Kiểm tra nhanh sau khi cài Portal

1. `GET .../health` hoặc root embed JSON `service: "quantis"`.
2. Trình duyệt: app mở không lỗi CORS; cookie / `credentials: "include"` đúng domain.
3. Request `GET .../api/quantis/data` có **`X-User-Id`** từ proxy (UUID).
4. Tạo dataset nhỏ → refresh → dữ liệu còn (đồng bộ user).
5. Mở **Cài đặt** → Kiểm tra backend + Ollama.

## 7. Tham chiếu mã SurveyLab (trong monorepo)

- `Surveylab/backend/src/embed.ts` — mẫu router embed tối giản + auth stub.
- `Surveylab/backend/src/ensure-db.ts` — migration / CREATE DATABASE standalone.
- `Surveylab/src/api.ts` — `getApiBase`, `checkBackendHealth`, `clearAllSurveylabStorage`.

Quantis tương đương: `backend/src/embed.ts`, `ensure-db.ts`, `src/api.ts`, `src/App.tsx`.
