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
   - `OLLAMA_URL` = URL Ollama (mặc định: `https://research.neu.edu.vn/ollama`)
6. **Deploy the stack**.

Portainer sẽ kéo file `portainer-stack.yml` từ repo và dùng image đã build sẵn trên Docker Hub. Backend **Node** lộ cổng **4001**, backend **Python** (phân tích) lộ cổng **4000**. Kiểm tra:
- Node: `curl http://<host>:4001/api/quantis/health` → `{"status":"ok","service":"quantis"}`
- Python: `curl http://<host>:4000/health` → `{"status":"ok","service":"quantis-analysis","engine":"python"}`

## Cách 1: Deploy bằng Portainer (Stack — Web editor)

1. Đăng nhập Portainer trên máy chủ của bạn.
2. Vào **Stacks** → **Add stack**.
3. Đặt tên stack (ví dụ `quantis`).
4. Chọn **Web editor**, dán nội dung file `docker-compose.yml` (ở thư mục gốc Quantis) — dùng khi bạn cần build tại chỗ từ source.
5. Chỉnh **Environment variables** (nếu cần):
   - `OLLAMA_URL`: URL Ollama (mặc định: https://research.neu.edu.vn/ollama).
   - `ARCHIVE_NEU_TOKEN`: Chỉ thêm nếu Archive NEU yêu cầu token.
6. **Deploy the stack**.
7. Kiểm tra: mở `<URL-backend>:4001` → trang thông tin backend; `<URL-backend>:4001/api/quantis/health` → `{"status":"ok","service":"quantis"}`.

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
curl http://localhost:4001/api/quantis/health
```

## Cấu hình Frontend sau khi backend chạy

- Backend **Node** (API) lắng nghe port **4001** trong container; khi deploy bằng **portainer-stack.yml** thì port trên host cũng là **4001**.
- Backend **Python** (phân tích) chạy port **8000** trong container, map ra host **4000**.
- Frontend Quantis (AI Portal hoặc static host) cần trỏ tới URL backend **Node**:
  - Build với: `VITE_QUANTIS_API_URL=http://<host>:4001` khi dùng Portainer stack hoặc docker-compose.
  - Hoặc dùng domain/proxy: `VITE_QUANTIS_API_URL=https://quantis-api.example.com` (proxy trỏ về backend Node).

Sau khi build lại frontend với biến môi trường trên và đưa lên AI Portal, ứng dụng Quantis sẽ dùng backend đó (lưu data, proxy Archive, proxy Ollama, phân tích Python).

## Các service trong stack

| Service          | Port (trong container) | Port (host) | Mô tả |
|------------------|-------------------------|-------------|--------|
| quantis-backend  | 4001                    | 4001        | Node: API lưu datasets/workflows, proxy Archive NEU, proxy Ollama, proxy phân tích Python. |
| quantis-python   | 8000                    | 4000        | FastAPI: phân tích thống kê (scipy, statsmodels, pandas). Backend Node gọi nội bộ; host có thể gọi trực tiếp qua 4000. |

## Dữ liệu lưu trữ

- Datasets và workflows được lưu trong **volume** `quantis-data` (trong container Node mount tại `/app/data`, file `store.json`).
- Volume được Docker quản lý; khi xóa stack cần giữ volume nếu muốn giữ dữ liệu (trong Portainer: Volumes → không xóa volume `quantis_quantis-data` khi xóa stack).

## Sửa port hoặc Ollama

- Trong stack Portainer có thể thêm/sửa biến môi trường:
  - `PORT`: port của backend Node (mặc định 4001).
  - `OLLAMA_URL`: URL Ollama (vd. https://research.neu.edu.vn/ollama).
- Sau khi sửa, **Re-deploy** stack.

## Xử lý lỗi "Connection reset by peer" khi curl localhost:4000

Lỗi `curl: (56) Recv failure: Connection reset by peer` khi gọi `curl localhost:4000` thường do container Python không chạy ổn định hoặc không lắng nghe đúng. Lần lượt kiểm tra:

1. **Container có đang chạy không**
   ```bash
   docker ps -a | grep quantis-python
   ```
   Nếu trạng thái không phải `Up` hoặc container liên tục restart → xem bước 2.

2. **Xem log container Python**
   ```bash
   docker logs quantis-python
   docker logs --tail 100 quantis-python
   ```
   Tìm lỗi khi khởi động (thiếu thư viện, import error, crash). Nếu thấy lỗi ngay khi start (vd. `ModuleNotFoundError`, `ImportError`) → cần sửa image (build lại và push lên Docker Hub).

3. **Thử gọi từ trong container**
   ```bash
   docker exec quantis-python curl -s http://127.0.0.1:8000/health
   ```
   - Nếu **trong container** cũng lỗi hoặc không phản hồi → app trong container bị lỗi (xem log ở bước 2).
   - Nếu **trong container** trả về JSON đúng → app chạy ổn, vấn đề có thể là port mapping hoặc firewall trên host (ít gặp với localhost).

4. **Đảm bảo đúng cổng và stack**
   - Với **portainer-stack.yml** hiện tại: cổng **4000** trên host map vào **8000** của container Python. Backend Node ở cổng **4001**.
   - Nếu bạn đang dùng stack cũ (Node 4000:3001) thì `curl localhost:4000` đang gọi **Node**, không phải Python; dùng `curl localhost:4001` cho Node và cần cập nhật stack để Python lộ 4000.

5. **Build lại image và deploy lại**
   Nếu image Python trên Docker Hub được build từ code cũ hoặc lỗi, trên repo Quantis chạy lại GitHub Actions (hoặc build local rồi push), sau đó trên Portainer: **Pull and redeploy** stack để kéo image mới.

6. **Log thấy "Uvicorn running on http://0.0.0.0:4000" trong container**
   Nghĩa là image đang chạy được build từ **code cũ** (uvicorn lắng cổng **4000** trong container), trong khi **portainer-stack.yml** map `4000:8000` (host 4000 → container 8000). Trong container không có process nào lắng 8000 → kết nối từ host bị **connection reset by peer**.

   **Cách xử lý:**
   - **Cách đúng (khuyến nghị):** Trên repo Quantis, chạy lại GitHub Actions (Actions → workflow build Docker) để build lại image `quantis-python` với Dockerfile mới (--port 8000). Trên server/Portainer: **Pull and redeploy** stack. Sau đó `curl localhost:4000/health` sẽ hoạt động.
   - **Cách tạm (chưa rebuild được):** Trong Portainer sửa stack: `quantis-python` đổi `ports` thành `"4000:4000"` và đổi `ANALYZE_PYTHON_URL` (trong service quantis-backend) thành `"http://quantis-python:4000"`. Redeploy. Image cũ lắng 4000 trong container nên map 4000:4000 và Node gọi quantis-python:4000.
