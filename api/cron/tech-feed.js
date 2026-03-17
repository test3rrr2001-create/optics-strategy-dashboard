import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 光学機器・技術トレンドに関連するキーワード検索クエリ
    const techKeywords = [
      "光学機器 新技術 開発",
      "内視鏡 開発 AI",
      "顕微鏡 技術 特許",
      "レーザー 光学 新製品",
      "産総研 光学 研究",
      "理化学研究所 光学 発表",
      "医療用カメラ 技術 開発",
      "画像センサー 光学 新型",
    ];

    const errors = [];
    let addedCount = 0;

    for (const keyword of techKeywords) {
      try {
        const searchUrl =
          "https://news.google.com/rss/search?q=" +
          encodeURIComponent(keyword) +
          "&hl=ja&gl=JP&ceid=JP:ja";

        const response = await fetch(searchUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; TechFeedBot/1.0; +https://vercel.app)",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          errors.push(`${keyword}: HTTP ${response.status}`);
          continue;
        }

        const xmlText = await response.text();

        // <item> タグを抽出（属性付きにも対応）
        const items = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/g) || [];

        for (const item of items.slice(0, 5)) {
          const title = (item.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || "")
            .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
            .replace(/<[^>]+>/g, "")
            .trim();

          let url = "";
          const linkMatch = item.match(/<link>(.*?)<\/link>/);
          const linkHrefMatch = item.match(/<link[^>]+href=["'](.*?)["']/);
          if (linkMatch?.[1]) url = linkMatch[1];
          else if (linkHrefMatch?.[1]) url = linkHrefMatch[1];
          const finalUrl = url.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();

          const pubDateStr =
            item.match(/<pubDate[^>]*>(.*?)<\/pubDate>/)?.[1] || "";
          const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();

          if (!title || !finalUrl) continue;

          // tech_news テーブルに保存（law_news と同じ構造）
          const { error: dbError } = await supabase
            .from("tech_news")
            .upsert(
              {
                source: "技術トレンドニュース",
                title: title,
                url: finalUrl,
                tags: keyword,
                published_at: pubDate.toISOString(),
              },
              { onConflict: "url" }
            );

          if (!dbError) addedCount++;
          else errors.push(`DB: ${dbError.message}`);
        }
      } catch (fetchErr) {
        errors.push(`${keyword}: ${fetchErr.message}`);
      }
    }

    res.status(200).json({
      success: true,
      added: addedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
