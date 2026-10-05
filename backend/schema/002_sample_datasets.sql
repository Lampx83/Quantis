-- Quantis: admin-curated sample datasets, browsable/importable by every user.
-- __SCHEMA__ → schema name (mặc định "quantis"), thay thế giống schema.sql / db.ts withSchema().
-- Standalone migration: chạy tay trên DB đã có (schema.sql chỉ tự áp dụng khi DB CHƯA có bảng workspaces).
--
-- rows_data: chỉ chứa các dòng DỮ LIỆU (không gồm header), dạng JSON array-of-arrays string[][].
-- header: dòng tiêu đề cột, lưu riêng (text[]) cho tiện hiển thị/soạn CSV mà không phải bóc tách rows_data[0].
CREATE TABLE IF NOT EXISTS __SCHEMA__.sample_datasets (
  id text PRIMARY KEY,
  name text NOT NULL,
  domain text,
  description text,
  tags text[] NOT NULL DEFAULT '{}',
  header text[] NOT NULL DEFAULT '{}',
  rows_data jsonb NOT NULL DEFAULT '[]',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quantis_sample_datasets_order ON __SCHEMA__.sample_datasets(display_order);
