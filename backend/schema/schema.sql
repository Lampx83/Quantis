-- Quantis: __SCHEMA__ → tên schema (mặc định quantis) — DB riêng standalone hoặc schema trên DB AI Portal
CREATE SCHEMA IF NOT EXISTS __SCHEMA__;

CREATE TABLE IF NOT EXISTS __SCHEMA__.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name TEXT,
  sso_provider TEXT,
  sso_sub TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quantis_users_sso_unique ON __SCHEMA__.users(sso_provider, sso_sub) WHERE sso_provider IS NOT NULL AND sso_sub IS NOT NULL;

-- Workspace theo user (UUID = user Surveylab-style hoặc UUID từ Portal; không dùng FK tới users để embed an toàn)
CREATE TABLE IF NOT EXISTS __SCHEMA__.workspaces (
  user_id UUID PRIMARY KEY,
  datasets JSONB NOT NULL DEFAULT '[]'::jsonb,
  workflows JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quantis_workspaces_updated ON __SCHEMA__.workspaces(updated_at);

-- Một bản ghi toàn cục khi standalone không bắt buộc đăng nhập (tương tự store.json)
CREATE TABLE IF NOT EXISTS __SCHEMA__.global_workspace (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  datasets JSONB NOT NULL DEFAULT '[]'::jsonb,
  workflows JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cấu hình dùng chung (Archive URL, AI, …) — một dòng
CREATE TABLE IF NOT EXISTS __SCHEMA__.app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quantis_users_email ON __SCHEMA__.users(email);

-- Admin-curated sample datasets, browsable/importable by every user (xem thêm 002_sample_datasets.sql
-- cho migration thủ công trên DB đã tồn tại từ trước — schema.sql chỉ tự áp dụng khi DB chưa có bảng workspaces).
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
