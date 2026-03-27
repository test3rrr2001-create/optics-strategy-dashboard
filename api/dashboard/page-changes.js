/**
 * /api/dashboard/page-changes.js
 * 競合ページの変更履歴をフロントエンドに返すAPIエンドポイント
 *
 * GET /api/dashboard/page-changes
 *   → 最新の未読 + 既読含む直近30件の変更履歴を返す
 *
 * POST /api/dashboard/page-changes  { id: "<uuid>" }
 *   → 指定レコードを既読に更新
 *
 * GET /api/dashboard/page-changes?unread=true
 *   → 未読のみ返す（通知バッジ用）
 */

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // POST: 既読マーク
  if (req.method === "POST") {
    const { id } = req.body || {};
    if (!id) return res.status(400).json({ error: "id is required" });

    const { error } = await supabase
      .from("page_changes")
      .update({ is_read: true })
      .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  // GET: 変更履歴取得
  const unreadOnly = req.query.unread === "true";

  let query = supabase
    .from("page_changes")
    .select(`
      id,
      detected_at,
      importance,
      summary,
      is_read,
      monitored_pages (
        competitor_name,
        page_label,
        url
      )
    `)
    .order("detected_at", { ascending: false });

  if (unreadOnly) {
    query = query.eq("is_read", false);
  } else {
    query = query.limit(30);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  // 未読件数も一緒に返す
  const { count: unreadCount } = await supabase
    .from("page_changes")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  return res.status(200).json({
    changes: data || [],
    unread_count: unreadCount || 0,
  });
}
