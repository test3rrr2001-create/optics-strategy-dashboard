-- =====================================================
-- 競合ページ監視機能: Supabaseテーブル作成スクリプト
-- Supabase Dashboard > SQL Editor に貼り付けて実行してください
-- =====================================================

-- ① 監視対象URLリスト
CREATE TABLE IF NOT EXISTS monitored_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_name TEXT NOT NULL,           -- 例: 'オリンパス'
  page_type     TEXT NOT NULL DEFAULT 'official',
                                           -- 'official'=公式, 'retailer'=販売店
  page_label    TEXT,                      -- 例: '価格ページ', '新製品情報', '採用ページ'
  url           TEXT NOT NULL UNIQUE,      -- 監視対象URL
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_content_hash TEXT,                  -- 前回取得テキストのハッシュ（差分検知用）
  last_scraped_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- サンプルデータ（後で好きなURLに書き換えてください）
INSERT INTO monitored_pages (competitor_name, page_type, page_label, url) VALUES
  ('サンプル競合A', 'official', '製品一覧',     'https://example-competitor-a.com/products'),
  ('サンプル競合A', 'official', '価格・仕様',   'https://example-competitor-a.com/price'),
  ('サンプル競合B', 'official', 'トップページ',  'https://example-competitor-b.com/'),
  ('サンプル競合B', 'retailer',  '販売店価格',   'https://example-retailer.com/items/sample-product')
ON CONFLICT (url) DO NOTHING;

-- ② AI解析済みの変更履歴
CREATE TABLE IF NOT EXISTS page_changes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       UUID NOT NULL REFERENCES monitored_pages(id) ON DELETE CASCADE,
  detected_at   TIMESTAMPTZ DEFAULT NOW(),
  importance    TEXT NOT NULL DEFAULT 'Medium', -- 'High' / 'Medium' / 'Low'
  summary       TEXT,                           -- AIによる変化の要約
  raw_diff      TEXT,                           -- 実際のテキスト差分（詳細確認用）
  is_read       BOOLEAN NOT NULL DEFAULT FALSE  -- 既読フラグ（ダッシュボード用）
);

-- パフォーマンス用インデックス
CREATE INDEX IF NOT EXISTS page_changes_detected_at_idx ON page_changes (detected_at DESC);
CREATE INDEX IF NOT EXISTS page_changes_is_read_idx     ON page_changes (is_read);
CREATE INDEX IF NOT EXISTS page_changes_page_id_idx     ON page_changes (page_id);
