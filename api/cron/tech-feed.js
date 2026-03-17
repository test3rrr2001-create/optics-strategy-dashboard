import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 技術・R&D系のRSSフィードリスト
    const feeds = [
      { name: "産総研 (AIST)", url: "https://news.google.com/rss/search?q=%E7%94%A3%E7%B7%8F%E7%A0%94+%E3%83%97%E3%83%AC%E3%82%B9%E3%83%AA%E3%83%AA%E3%83%BC%E3%82%B9&hl=ja&gl=JP&ceid=JP:ja" },
      { name: "理化学研究所", url: "https://news.google.com/rss/search?q=%E7%90%86%E5%8C%96%E5%AD%A6%E7%A0%94%E7%A9%B6%E6%89%80+%E3%83%97%E3%83%AC%E3%82%B9%E3%83%AA%E3%83%AA%E3%83%BC%E3%82%B9&hl=ja&gl=JP&ceid=JP:ja" },
      { name: "特許・技術ニュース (Google)", url: "https://news.google.com/rss/search?q=%E5%85%89%E5%AD%A6+%E7%89%B9%E8%A8%B1+OR+%E5%86%85%E8%A6%96%E9%8F%A1+%E7%89%B9%E8%A8%B1&hl=ja&gl=JP&ceid=JP:ja" }
    ];

    // 技術関連のキーワード
    const techKeywords = ["特許", "開発", "新技術", "AI", "画像認識", "センサー", "レーザー", "内視鏡", "顕微鏡", "光学", "発表"];

    let addedCount = 0;

    for (const feed of feeds) {
      console.log(`Fetching ${feed.name}...`);
      const response = await fetch(feed.url);
      if (!response.ok) {
        console.error(`Failed to fetch ${feed.name}: ${response.status}`);
        continue;
      }
      const xmlText = await response.text();

      const items = xmlText.match(/<(item|entry)>[\s\S]*?<\/\1>/g) || [];

      for (const item of items) {
        let title = (item.match(/<title>(.*?)<\/title>/)?.[1] || "")
          .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
          .replace(/<[^>]+>/g, '')
          .trim();

        let url = "";
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const linkHrefMatch = item.match(/<link[^>]+href=["'](.*?)["']/);
        
        if (linkMatch && linkMatch[1]) {
          url = linkMatch[1];
        } else if (linkHrefMatch && linkHrefMatch[1]) {
          url = linkHrefMatch[1];
        }
        const finalUrl = url.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();

        const pubDateStr = item.match(/<(pubDate|dc:date|published|updated)>(.*?)<\/\1>/)?.[2] || "";
        const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();

        // キーワードによるフィルタリング（Google Newsベースなので緩めにチェック）
        const isRelevant = techKeywords.some(kw => title.includes(kw));
        
        if (isRelevant && finalUrl) {
          // 既存の daily_results テーブルに tech_trend という特集プロジェクトとして保存
          const { error } = await supabase.from("daily_results").upsert({
            title: title,
            url: finalUrl,
            source: feed.name,
            keyword: "技術トレンド", // タグとして利用
            published_at: pubDate.toISOString()
          }, { onConflict: 'url' });

          if (!error) addedCount++;
          else console.error(`DB Error: ${error.message}`);
        }
      }
    }

    res.status(200).json({ success: true, added: addedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
