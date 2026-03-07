# Triển khai Backend Quantis (Docker / Portainer)

Hướng dẫn đưa backend Quantis (Node + Python) lên máy chủ chạy Docker/Portainer, làm backend cho ứng dụng Quantis (frontend có thể host trên AI Portal hoặc nơi khác).

## CI/CD: Tự động build và push lên Docker Hub (GitHub Actions)

Khi code được đẩy lên branch **main** (hoặc chạy thủ công workflow), GitHub Actions sẽ build hai image và push lên Docker Hub:

- `DOCKERHUB_USER/quantis-backend:latest`
- `DOCKERHUB_USER/quantis-python:latest`

**Cấu hình một lần trên GitHub repo Quantis:**

1. Vào **Settings** → **Secrets and variables** → **Actions**.
2. Thêm hai secrets:
   - **DOCKERHUB_USER**: tên đăng nhập Docker Hub.
   - **DOCKERHUB_TOKEN**: Access Token (hoặc mật khẩu) Docker Hub (tạo tại [Docker Hub → Account Settings → Security](https://hub.docker.com/settings/security)).
3. Push code lên branch `main` → workflow chạy và đẩy image lên Docker Hub.

Sau đó trên server/Portainer có thể dùng file `docker-compose.deploy.yml` (kéo image từ Docker Hub, không cần source code). Trong file đó thay `YOUR_DOCKERHUB_USER` bằng username Docker Hub của bạn.

## Deploy nhanh trong Portainer (chỉ cần đường dẫn Git)

Chỉ cần tạo stack từ Git repository, không cần clone hay paste file:

1. Đăng nhập Portainer → **Stacks** → **Add stack**.
2. Đặt tên stack (vd. `quantis`).
3. Chọn **Git repository**.
4. Điền:
   - **Repository URL:** `https://github.com/Lampx83/Quantis`
   - **Compose path:** `portainer-stack.yml`
   - **Branch:** `main`
5. (Tùy chọn) **Environment variables** — nếu dùng Docker Hub user khác hoặc Ollama khác:
   - `DOCKERHUB_USER` = username Docker Hub (mặc định: Lampx83)
   - `OLLAMA_UPSTREAM_URL` = URL Ollama (mặc định: `http://host.docker.internal:8002`)
6. **Deploy the stack**.

Portainer sẽ kéo file `portainer-stack.yml` từ repo và dùng image đã build sẵn trên Docker Hub. Backend lộ ra **cổng 4000**. Kiểm tra: `http://<host>:4000/api/quantis/health` → `{"status":"ok","service":"quantis"}`.

## Cách 1: Deploy bằng Portainer (Stack — Web editor)

1. Đăng nhập Portainer trên máy chủ của bạn.
2. Vào **Stacks** → **Add stack**.
3. Đặt tên stack (ví dụ `quantis`).
4. Chọn **Web editor**, dán nội dung file `docker-compose.yml` (ở thư mục gốc Quantis) — dùng khi bạn cần build tại chỗ từ source.
5. Chỉnh **Environment variables** (nếu cần):
   - `OLLAMA_UPSTREAM_URL`: URL Ollama trên host (nếu chạy port khác mặc định, đổi đúng port, vd. `http://host.docker.internal:8002`).
   - `ARCHIVE_NEU_TOKEN`: Chỉ thêm nếu Archive NEU yêu cầu token.
6. **Deploy the stack**.
7. Kiểm tra: mở `<URL-backend>:3001` → trang thông tin backend; `<URL-backend>:3001/api/quantis/health` → `{"status":"ok","service":"quantis"}`.

**Lưu ý:** Portainer cần có source của project (repo Quantis) trên server hoặc bạn paste nội dung `docker-compose.yml` vào Web editor. Nếu build image trên máy khác rồi push lên registry thì có thể dùng image thay vì build (xem Cách 2).

## Cách 2: Build image trên máy local rồi đẩy lên registry

Trên máy có source Quantis:

```bash
cd /path/to/Quantis

# Build image
docker compose build

# Tag và push lên registry
docker tag quantis-backend:latest <registry>/quantis-backend:latest
docker tag quantis-python:latest <registry>/quantis-python:latest
docker push <registry>/quantis-backend:latest
docker push <registry>/quantis-python:latest
```

Trên máy chủ (hoặc trong Portainer), tạo stack dùng `image: <registry>/quantis-backend:latest` (và tương tự cho Python), bỏ bước `build`.

## Cách 3: Chạy docker compose trên server

Trên máy chủ đã có source Quantis:

```bash
# Vào thư mục gốc Quantis
cd /path/to/Quantis

# Build và chạy
docker compose up -d --build

# Kiểm tra
curl http://localhost:3001/api/quantis/health
```

## Cấu hình Frontend sau khi backend chạy

- Backend API (Node) lắng nghe tại port **3001** trong container. Khi deploy bằng **portainer-stack.yml** thì port trên host là **4000** (vd. `http://<host>:4000`).
- Frontend Quantis (AI Portal hoặc static host) cần trỏ tới URL backend:
  - Build với: `VITE_QUANTIS_API_URL=http://<host>:4000` khi dùng Portainer stack (cổng 4000), hoặc `http://<host>:3001` nếu deploy bằng docker-compose khác.
  - Hoặc dùng domain/proxy: `VITE_QUANTIS_API_URL=https://quantis-api.example.com` (proxy trỏ về backend:3001).

Sau khi build lại frontend với biến môi trường trên và đưa lên AI Portal, ứng dụng Quantis sẽ dùng backend đó (lưu data, proxy Archive, proxy Ollama, phân tích Python).

## Các service trong stack

| Service          | Port (host) | Mô tả |
|------------------|------------|--------|
| quantis-backend  | 3001       | Node: API lưu datasets/workflows, proxy Archive NEU, proxy Ollama, proxy phân tích Python. |
| quantis-python   | (nội bộ)   | FastAPI: phân tích thống kê (scipy, statsmodels, pandas). Chỉ backend Node gọi. |

## Dữ liệu lưu trữ

- Datasets và workflows được lưu trong **volume** `quantis-data` (trong container Node mount tại `/app/data`, file `store.json`).
- Volume được Docker quản lý; khi xóa stack cần giữ volume nếu muốn giữ dữ liệu (trong Portainer: Volumes → không xóa volume `quantis_quantis-data` khi xóa stack).

## Sửa port hoặc Ollama

- Trong stack Portainer có thể thêm/sửa biến môi trường:
  - `PORT`: port của backend Node (mặc định 3001).
  - `OLLAMA_UPSTREAM_URL`: URL Ollama (vd. `http://host.docker.internal:8002` nếu Ollama chạy port 8002 trên host).
- Sau khi sửa, **Re-deploy** stack.
