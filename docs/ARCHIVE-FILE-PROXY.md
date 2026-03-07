# Proxy tải file Archive — sửa lỗi SignatureDoesNotMatch

Khi deploy lên server (vd. research.neu.edu.vn), tải file từ Archive có thể trả về XML lỗi từ S3/MinIO:

```xml
<Code>SignatureDoesNotMatch</Code>
<Message>The request signature we calculated does not match the signature you provided.</Message>
```

Trên localhost thì tải file vẫn bình thường.

## Nguyên nhân

Presigned URL (có tham số `X-Amz-*`) được **ký với một Host cụ thể** (vd. `files-archive.neu.edu.vn`). Khi proxy trên server chuyển tiếp request tới MinIO/S3 mà gửi **Host khác** (vd. `research.neu.edu.vn` hoặc `101.96.66.222:8013`), MinIO tính lại chữ ký theo Host đó → không khớp → `SignatureDoesNotMatch`.

Trên localhost, Vite proxy đã set đúng `Host: files-archive.neu.edu.vn` (xem `vite.config.ts`), nên không lỗi.

## Cách sửa (phía server)

Proxy xử lý **/api/archive-file** phải **gửi đúng Host** khi forward tới backend file (MinIO/8013). Host phải trùng với Host dùng lúc tạo presigned URL — thường là `files-archive.neu.edu.vn` (hoặc host do bên vận hành Archive cung cấp).

### Nginx

Thêm (hoặc sửa) `location` cho `/api/archive-file`, **đặt trước** `location /api/`:

```nginx
# Proxy tải file Archive — BẮT BUỘC set Host đúng để presigned URL không lỗi SignatureDoesNotMatch
location /api/archive-file/ {
    proxy_pass http://101.96.66.222:8013;   # hoặc upstream MinIO tương ứng
    proxy_http_version 1.1;
    proxy_set_header Host "files-archive.neu.edu.vn";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass_request_headers on;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
}
```

Quan trọng: **`proxy_set_header Host "files-archive.neu.edu.vn";`** — nếu presigned URL được ký với host khác, hãy thay đúng host đó.

Sau đó: `sudo nginx -t && sudo systemctl reload nginx`.

### Node / middleware khác

Nếu dùng Node hoặc gateway khác để proxy `/api/archive-file`:

- Khi gửi request tới MinIO/8013, set header **Host** = host dùng lúc ký presigned URL (vd. `files-archive.neu.edu.vn`).
- Giữ nguyên path và query string (có `X-Amz-*`) từ request gốc.

## Kiểm tra

Sau khi sửa, mở Quantis trên research.neu.edu.vn → chọn dataset từ Archive → xem trước / tải file. Nếu vẫn lỗi, kiểm tra với bên vận hành Archive xem presigned URL được ký với Host nào và cấu hình proxy trùng Host đó.
