# Cài đặt Backend Quantis để dùng với AI Portal (Research)

Ứng dụng Quantis khi cài lên AI Portal (pack → cài từ Admin) chỉ gồm **frontend**. Để dùng lưu data, phân tích Python, Archive NEU, Ollama, bạn cần chạy **backend Quantis** (Node, và tùy chọn backend Python) rồi cấu hình địa chỉ đó trong Quantis.

## Tổng quan

- **AI Portal** (Research): frontend port **3000**, backend (ai-portal-backend) port **3001**.
- **Backend Quantis**: Node (API + proxy) chạy port **4001**; backend Python (phân tích) port **4000**.
- Trong ứng dụng Quantis (mở từ AI Portal), mục **Cài đặt → Địa chỉ backend Quantis** phải trỏ tới URL mà **trình duyệt** gọi được (Node Quantis).

## Cách 1: Cùng server với AI Portal — Backend Quantis một port riêng

Backend Quantis (Node) chạy trên **cùng máy** với AI Portal, lộ port **4001**. Người dùng cấu hình "Địa chỉ backend Quantis" = `http://<IP-hoặc-domain>:4001` (hoặc HTTPS nếu có reverse proxy cho 4001).

### Bước 1: Chạy stack Quantis trên server (cùng host với AI Portal)

Trên server đã chạy AI Portal (Research), thêm stack Quantis:

**Nếu dùng Docker Compose trực tiếp:**

```bash
# Clone Quantis (nếu chưa có)
git clone https://github.com/Lampx83/Quantis.git
cd Quantis

# Dùng docker-compose: Node 4001:4001, Python 4000:8000
docker compose -f docker-compose.yml up -d --build

# Kiểm tra
curl http://localhost:4001/api/quantis/health   # Node
curl http://localhost:4000/health                 # Python (nếu bật)
```

**Nếu dùng Portainer:** Tạo stack từ Git, Compose path `portainer-stack.yml`. Backend Node lộ cổng **4001** trên host.

Sau khi chạy, từ máy trong LAN hoặc qua domain:
- Backend Quantis (Node): `http://<IP-server>:4001` hoặc `https://quantis-api.xxx.com` nếu bạn cấu hình proxy.
- Backend Python (phân tích): chỉ cần Node gọi được (trong Docker cùng stack thì `ANALYZE_PYTHON_URL=http://quantis-python:8000`), không cần user cấu hình.

### Bước 2: Cấu hình trong ứng dụng Quantis (trên AI Portal)

1. Mở AI Portal → vào ứng dụng **Quantis** (sau khi đã cài gói).
2. Vào **Cài đặt** (hoặc mục cấu hình backend).
3. **Địa chỉ backend Quantis (phân tích định lượng):** nhập URL backend **Node**:
   - Cùng LAN, không proxy: `http://<IP-server>:4001`
   - Có domain/proxy: `https://quantis-api.yourdomain.com` (proxy trỏ về `http://127.0.0.1:4001`).

Lưu lại. Khi đó Quantis sẽ gọi `/api/quantis/health`, `/api/quantis/data`, `/api/quantis/analyze/*` về địa chỉ này; Node sẽ proxy phân tích sang Python nếu đã cấu hình `ANALYZE_PYTHON_URL`.

---

## Cách 2: Cùng server + Nginx — Backend Quantis qua cùng domain với AI Portal

Nếu bạn muốn **không lộ port 4001** và dùng chung domain với Research (vd. `https://research.neu.edu.vn`), cấu hình Nginx proxy **/api/quantis/** sang backend Quantis (port 4001). Khi đó người dùng chỉ cần đặt "Địa chỉ backend Quantis" = **https://research.neu.edu.vn** (gốc Portal).

### Điều kiện

- AI Portal (Research) đã chạy; Nginx đang proxy `/` → frontend (3000), `/api/` → ai-portal-backend (3001).
- Backend Quantis (Node) chạy trên cùng server, port **4001**.

### Cấu hình Nginx

Thêm **location** cho `/api/quantis/` **trước** block `location /api/` (để Nginx ưu tiên path dài hơn):

```nginx
server {
    listen 80;   # hoặc 443 ssl
    server_name research.yourdomain.com;
    client_max_body_size 50m;

    # (1) Proxy /api/quantis/* sang Backend Quantis (port 4001)
    location /api/quantis/ {
        client_max_body_size 50m;
        proxy_pass http://127.0.0.1:4001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # (2) Các API khác của AI Portal vẫn đi backend 3001
    location /api/ {
        client_max_body_size 50m;
        proxy_pass http://127.0.0.1:3001;
        # ... (giữ nguyên như hiện tại)
    }

    location / {
        # ... frontend 3000
    }
}
```

Sau đó: `sudo nginx -t && sudo systemctl reload nginx`.

### Cấu hình trong ứng dụng Quantis

- **Địa chỉ backend Quantis:** `https://research.yourdomain.com` (hoặc `http://...` nếu chưa HTTPS).  
Không cần ghi port hay path; frontend sẽ gọi `https://research.yourdomain.com/api/quantis/health`, `.../api/quantis/data`, `.../api/quantis/analyze/*`, Nginx sẽ chuyển xuống 4001.

---

## Tóm tắt

| Cách | Backend Quantis | Cấu hình "Địa chỉ backend Quantis" trong Quantis |
|------|------------------|--------------------------------------------------|
| **1. Port riêng** | Chạy Node port 4001 (cùng host với AI Portal) | `http://<IP>:4001` hoặc `https://quantis-api.domain.com` |
| **2. Cùng domain (Nginx)** | Node port 4001; Nginx proxy `/api/quantis/` → 4001 | `https://research.yourdomain.com` |

Backend Python (phân tích) được cấu hình **trên server** (biến `ANALYZE_PYTHON_URL` trong container/stack Quantis), không cấu hình ở frontend. Người dùng chỉ cần cấu hình **một** địa chỉ backend Quantis (Node).

---

## Cấu hình Backend Python khi chạy local (development)

Để app hiển thị "Backend phân tích (Python/R) đã kết nối" và dùng phân tích thống kê qua Python:

1. **Chạy backend Python** (FastAPI) trên port **4000**:
   ```bash
   cd backend-python
   pip install -r requirements.txt   # nếu chưa cài
   uvicorn main:app --reload --port 4000
   ```
   Kiểm tra: `curl http://localhost:4000/api/quantis/analyze/health` → `{"status":"ok",...}`

2. **Cấu hình backend Node** để proxy sang Python:
   - Vào thư mục `backend`, tạo file `.env` từ mẫu:
     ```bash
     cd backend
     cp .env.example .env
     ```
   - Trong `backend/.env` đảm bảo có dòng:
     ```
     ANALYZE_PYTHON_URL=http://localhost:4000
     ```
   - Cài thêm dependency (nếu chưa): `npm install`
   - Khởi động lại backend Node (từ thư mục gốc: `npm run start` hoặc `cd backend && npm run dev`).

3. **Frontend**: trong Cài đặt, **Địa chỉ backend Quantis** trỏ tới backend Node (vd. `http://localhost:4001`). Không cần cấu hình URL Python ở frontend — Node tự proxy `/api/quantis/analyze/*` sang `ANALYZE_PYTHON_URL`.

Sau khi cấu hình đúng, trang Cài đặt sẽ hiển thị "Backend phân tích (Python/R) đã kết nối". Nếu không set `ANALYZE_PYTHON_URL` hoặc Python không chạy, app vẫn chạy bình thường và dùng tính toán trên trình duyệt.

---

## Mặc định khi chạy trên research.neu.edu.vn

Khi người dùng **không chỉnh** gì trong Cài đặt và truy cập từ **research.neu.edu.vn**, ứng dụng tự dùng:

| Thành phần | URL mặc định |
|------------|----------------|
| Backend Quantis (Node) | https://research.neu.edu.vn/api/quantis/backend |
| Backend Python (phân tích) | https://research.neu.edu.vn/api/quantis/backend-python (proxy qua Node khi cấu hình ANALYZE_PYTHON_URL) |
| Ollama (API AI) | https://research.neu.edu.vn/ollama/v1 |
| Archive (tìm kiếm dataset) | https://research.neu.edu.vn/api/archive/ |
| Archive file (tải file) | https://research.neu.edu.vn/api/archive-file/ |
| Mô hình AI mặc định | qwen3:8b |

Chỉ cần đảm bảo server research.neu.edu.vn đã cấu hình proxy tương ứng. **Để người dùng hoàn toàn không cần mở Cài đặt**, khi deploy backend Node lên research.neu.edu.vn hãy đặt biến môi trường:

- **`RESEARCH_NEU_DEPLOY=1`** — Khi chưa có file `data/settings.json`, GET `/api/quantis/settings` sẽ trả về sẵn các URL mặc định (backend, archive, archive-file, ollama, mô hình qwen3:8b). Mọi client lần đầu mở app sẽ nhận cấu hình này, không cần chỉnh gì.
- **`RESEARCH_NEU_BASE_URL`** (tùy chọn) — Base URL, mặc định `https://research.neu.edu.vn`. Chỉ cần đổi nếu dùng domain/port khác.

Ví dụ Docker / systemd: `RESEARCH_NEU_DEPLOY=1` (và nếu cần `RESEARCH_NEU_BASE_URL=https://research.neu.edu.vn`). Sau khi có người bấm Lưu trong Cài đặt, backend sẽ ghi `settings.json` và dùng file đó thay vì mặc định.

---

## Cấu hình dùng chung (mọi tài khoản)

Khi đã cấu hình **Địa chỉ backend Quantis** và backend đang chạy, các mục trong **Cài đặt** (Backend Quantis, Archive, Archive file, API AI, Mô hình AI) khi bấm **Lưu** sẽ được ghi lên server (file `backend/data/settings.json`). Cấu hình này **áp dụng cho tất cả tài khoản** dùng cùng instance backend. Khi mở ứng dụng, frontend tải cấu hình từ `GET /api/quantis/settings` và ưu tiên dùng thay cho localStorage. Nếu không kết nối được backend thì chỉ lưu trên trình duyệt (theo từng máy). Để dùng cơ sở dữ liệu thật (PostgreSQL, MongoDB…) thay cho file JSON, có thể sửa backend đọc/ghi từ DB trong `readSettings` / `writeSettings`.

Nếu Quantis chạy trên research.neu.edu.vn và dùng proxy same-origin để tải file (path `/api/archive-file`), proxy **bắt buộc** gửi đúng header **Host** khi forward tới MinIO (trùng với Host dùng lúc ký presigned URL), nếu không sẽ lỗi **SignatureDoesNotMatch**. Chi tiết và ví dụ Nginx: [ARCHIVE-FILE-PROXY.md](./ARCHIVE-FILE-PROXY.md).
