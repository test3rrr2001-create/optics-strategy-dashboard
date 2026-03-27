/**
 * /api/cron/page-monitor.js
 * 競合ページ差分監視 & AI要約 Cronジョブ
 * Vercel Cronから毎日 03:00 (UTC) に起動される
 *
 * 処理フロー:
 * 1. monitored_pages から監視対象URLを取得
 * 2. 各URLのHTMLをfetchし、本文テキストを抽出
 * 3. 前回の内容（ハッシュ）と比較して差分を検出
 * 4. 差分がある場合のみ OpenAI API でノイズ除去・要約・重要度判定
 * 5. 結果を page_changes テーブルに保存
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// HTMLタグを除去してプレーンテキストを抽出するユーティリティ
function extractText(html) {
  return html
    // <script> と <style> ブロックをごっそり削除
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // コメントを削除
    .replace(/<!--[\s\S]*?-->/g, "")
    // 残りのHTMLタグを削除
    .replace(/<[^>]+>/g, " ")
    // 連続する空白・改行を1つのスペースへ
    .replace(/\s+/g, " ")
    .trim();
}

// テキストのSHA-256ハッシュを生成（差分検知用）
function hashText(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// テキストの差分を簡易的に抽出（行単位）
function extractDiff(oldText, newText) {
  const oldLines = new Set(oldText.split(". "));
  const newLines = newText.split(". ");
  const added = newLines.filter((line) => line.length > 20 && !oldLines.has(line));
  return added.slice(0, 50).join("\n"); // 最大50行分の差分を返す
}

// OpenAI API でノイズ除去・要約・重要度判定
async function analyzeWithAI(diffText, pageLabel, competitorName) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-dummy-key-for-now";

  // ダミーキーの場合はスキップ
  if (OPENAI_API_KEY === "sk-dummy-key-for-now" || !OPENAI_API_KEY.startsWith("sk-")) {
    return {
      summary: `【API未設定】差分検知済み: ${pageLabel}（${competitorName}）のページに変化がありました。OPENAI_API_KEY を環境変数に設定すると自動要約が有効になります。`,
      importance: "Medium",
    };
  }

  const prompt = `
あなたは自社（光学機器メーカー）を守り、競合を冷酷に分析する「鬼の事業戦略アドバイザー」です。
以下は競合他社「${competitorName}」の「${pageLabel}」ページで検知された変化です。

## 検知された変化テキスト:
${diffText.slice(0, 2000)}

## 指示:
1. 広告バナー、単なる日付更新、求人など、自社のシェアに直結しないノイズは完全に無視してください。
2. 変化が「自社のどの製品のシェア・利益に悪影響（または好機）をもたらすか」を鋭く指摘してください。ただの要約は無価値です。
3. 必ず「明日、我が社の営業・マーケ・開発チームは何をすべきか（打ち手）」を具体的に命令してください。
4. 以下のJSON形式のみで回答してください（マークダウン不要）:

{"importance":"High|Medium|Low","summary":"[影響] 競合が〇〇を発表。当社の主力モデルのパイが奪われる危険大。\n[打ち手] 直ちに販売店へ〇〇のインセンティブを提示せよ。"}

重要度の基準:
- High: 自社の売上に直結するクリティカルな脅威（競合の破壊的価格設定、新製品発表、新技術ラインナップ追加）。即座の対応が必要。
- Medium: 競合の注力分野のシフト、中規模なモデルチェンジ、新たなキャンペーンなど。
- Low: 軽微な変更。無視してよいレベル。
`.trim();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // コスト効率重視。精度を上げたい場合は gpt-4o に変更
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    return {
      summary: parsed.summary || "（要約取得失敗）",
      importance: ["High", "Medium", "Low"].includes(parsed.importance)
        ? parsed.importance
        : "Medium",
    };
  } catch (err) {
    console.error("OpenAI API error:", err);
    return { summary: "AI要約エラー（API呼び出し失敗）", importance: "Medium" };
  }
}

export default async function handler(req, res) {
  // Vercel Cron からの呼び出しを確認（セキュリティ）
  const authHeader = req.headers["authorization"];
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // 監視対象URLを取得（active=trueのみ）
  const { data: pages, error: fetchError } = await supabase
    .from("monitored_pages")
    .select("*")
    .eq("active", true);

  if (fetchError) {
    console.error("monitored_pages fetch error:", fetchError);
    return res.status(500).json({ error: fetchError.message });
  }

  const results = { checked: 0, changed: 0, errors: [] };

  for (const page of pages || []) {
    try {
      // HTMLを取得
      const response = await fetch(page.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CompetitorMonitor/1.0; +internal)",
        },
        signal: AbortSignal.timeout(10000), // 10秒タイムアウト
      });

      if (!response.ok) {
        results.errors.push({ url: page.url, reason: `HTTP ${response.status}` });
        continue;
      }

      const html = await response.text();
      const text = extractText(html);
      const currentHash = hashText(text);

      results.checked++;

      // 前回と同じなら何もしない
      if (page.last_content_hash === currentHash) {
        // ハッシュ更新のみ（last_scraped_at を更新）
        await supabase
          .from("monitored_pages")
          .update({ last_scraped_at: new Date().toISOString() })
          .eq("id", page.id);
        continue;
      }

      // ===== 差分あり =====
      results.changed++;

      // 差分テキストを生成（前回テキストがない場合は最初のスナップショット）
      const rawDiff = page.last_content
        ? extractDiff(page.last_content, text)
        : text.slice(0, 1000) + "（初回スナップショット）";

      // AIで要約・重要度判定
      const { summary, importance } = await analyzeWithAI(
        rawDiff,
        page.page_label || page.url,
        page.competitor_name
      );

      // page_changes に記録
      await supabase.from("page_changes").insert({
        page_id: page.id,
        importance,
        summary,
        raw_diff: rawDiff.slice(0, 5000), // 最大5000文字保存
      });

      // monitored_pages のハッシュとテキストを更新
      await supabase
        .from("monitored_pages")
        .update({
          last_content_hash: currentHash,
          last_content: text,
          last_scraped_at: new Date().toISOString(),
        })
        .eq("id", page.id);

    } catch (err) {
      console.error(`Error processing ${page.url}:`, err);
      results.errors.push({ url: page.url, reason: err.message });
    }
  }

  return res.status(200).json({
    ok: true,
    checked: results.checked,
    changed: results.changed,
    errors: results.errors,
  });
}
