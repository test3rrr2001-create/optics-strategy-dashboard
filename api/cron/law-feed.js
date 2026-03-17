import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 光学機器・医療機器に関連する法令・規制キーワード
    // Google News RSS は海外サーバーからでも確実に取得可能
    const lawKeywords = [
      { keyword: "薬機法 医療機器", category: "法改正", importance: "High" },
      { keyword: "医療機器 承認 厚生労働省", category: "薬事承認", importance: "Medium" },
      { keyword: "光学機器 規制", category: "一般通知", importance: "Low" },
      { keyword: "内視鏡 承認 PMDA", category: "薬事承認", importance: "Medium" },
      { keyword: "薬機法 改正", category: "法改正", importance: "High" },
      { keyword: "医療機器 安全性", category: "安全性情報", importance: "Medium" },
      { keyword: "レーザー 医療 規制", category: "一般通知", importance: "Low" },
      { keyword: "生体計測 医療機器 承認", category: "薬事承認", importance: "Medium" },
    ];

    const errors = [];
    let addedCount = 0;

    for (const kw of lawKeywords) {
      try {
        // Google News RSS Search（日本語、日本地域）
        const searchUrl =
          "https://news.google.com/rss/search?q=" +
          encodeURIComponent(kw.keyword) +
          "&hl=ja&gl=JP&ceid=JP:ja";

        const response = await fetch(searchUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; LawFeedBot/1.0; +https://vercel.app)",
          },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          errors.push(`${kw.keyword}: HTTP ${response.status}`);
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

          // 省庁名・ソース名の推定
          let source = "法令関連ニュース";
          if (title.includes("厚生労働省") || title.includes("mhlw")) source = "厚生労働省";
          else if (title.includes("PMDA") || title.includes("pmda")) source = "PMDA";
          else if (title.includes("経済産業省") || title.includes("meti")) source = "経済産業省";

          const { error: dbError } = await supabase
            .from("law_news")
            .upsert(
              {
                source: source,
                title: title,
                url: finalUrl,
                category: kw.category,
                importance: kw.importance,
                published_at: pubDate.toISOString(),
              },
              { onConflict: "url" }
            );

          if (!dbError) addedCount++;
          else errors.push(`DB: ${dbError.message}`);
        }
      } catch (fetchErr) {
        errors.push(`${kw.keyword}: ${fetchErr.message}`);
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
