-- =====================================================
-- 競合監視ダッシュボード: フル・データベース・スキーマ
-- ※ 既存のテーブルをすべて削除し、クリーンな状態で再作成します。
-- =====================================================

-- 既存テーブルの削除
DROP TABLE IF EXISTS page_changes CASCADE;
DROP TABLE IF EXISTS monitored_pages CASCADE;
DROP TABLE IF EXISTS daily_results CASCADE;
DROP TABLE IF EXISTS law_news CASCADE;
DROP TABLE IF EXISTS tech_news CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- ① プロジェクト・カテゴリ定義
CREATE TABLE projects (
  id      BIGSERIAL PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  status  TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初期カテゴリデータ
INSERT INTO projects (id, name) VALUES
  (1, '顕微鏡'),
  (2, '工業用内視鏡'),
  (3, '管内カメラ'),
  (4, '美容用');

-- ② ニュース収集結果 (一般ニュース・トレンド用)
CREATE TABLE daily_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  BIGINT REFERENCES projects(id) ON DELETE SET NULL,
  keyword     TEXT,
  title       TEXT NOT NULL,
  url         TEXT UNIQUE,
  source      TEXT,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ③ 法令監視ニュース
CREATE TABLE law_news (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT,           -- 例: '顕微鏡', '管内カメラ'
  source        TEXT,           -- 例: 'PMDA', '経産省'
  title         TEXT NOT NULL,
  url           TEXT UNIQUE,
  importance    TEXT NOT NULL DEFAULT 'Medium',
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ④ 技術トレンドニュース
CREATE TABLE tech_news (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  url           TEXT UNIQUE,
  source        TEXT,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ⑤ 競合ページ構成監視
CREATE TABLE monitored_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name TEXT NOT NULL,
  page_type     TEXT NOT NULL DEFAULT 'official',
  page_label    TEXT,
  url           TEXT NOT NULL UNIQUE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_content_hash TEXT,
  last_content  TEXT,
  last_scraped_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ⑥ 競合ページ変更履歴 (AI要約付)
CREATE TABLE page_changes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  detected_at   TIMESTAMPTZ DEFAULT NOW(),
  importance    TEXT NOT NULL DEFAULT 'Medium',
  summary       TEXT,
  raw_diff      TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE
);

-- インデックス作成
CREATE INDEX daily_results_project_id_idx ON daily_results(project_id);
CREATE INDEX daily_results_created_at_idx ON daily_results(created_at DESC);
CREATE INDEX law_news_published_at_idx ON law_news(published_at DESC);
CREATE INDEX tech_news_published_at_idx ON tech_news(published_at DESC);
CREATE INDEX page_changes_detected_at_idx ON page_changes (detected_at DESC);
