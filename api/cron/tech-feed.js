import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 技術・R&D系のRSSフィードリスト
    const feeds = [
      { name: "産総研 (AIST)", url: "https://www.aist.go.jp/aist_j/news/rss.xml" },
      { name: "理化学研究所", url: "https://www.riken.jp/pr/news/index.xml" },
      { name: "特許・技術ニュース (Google)", url: "https://news.google.com/rss/search?q=%E5%85%89%E5%AD%A6+%E7%89%B9%E8%A8%B1+OR+%E5%86%85%E8%A6%96%E9%8F%A1+%E7%89%B9%E8%A8%B1&hl=ja&gl=JP&ceid=JP:ja" }
    ];

    // 技術関連のキーワード
    const techKeywords = ["特許", "開発", "新技術", "AI", "画像認識", "センサー", "レーザー", "内視鏡", "顕微鏡", "光学"];

    let addedCount = 0;

    for (const feed of feeds) {
      console.log(`Fetching ${feed.name}...`);
      const response = await fetch(feed.url);
      const xmlText = await response.text();

      const items = xmlText.match(/<(item|entry)>[\s\S]*?<\/\1>/g) || [];

      for (const item of items) {
        let title = (item.match(/<title>(.*?)<\/title>/)?.[1] || "").replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1");
        // Title HTML cleanup
        title = title.replace(/<[^>]+>/g, '').trim();

        const urlMatch = item.match(/<(link|link href=)>(.*?)<\/\1>/)?.[2] || item.match(/link="(.*?)"/)?.[1] || "";
        const finalUrl = urlMatch.includes("href=") ? urlMatch.match(/href="(.*?)"/)?.[1] : urlMatch.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1");

        const pubDateStr = item.match(/<(pubDate|dc:date|published|updated)>(.*?)<\/\1>/)?.[2] || "";
        const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();

        // キーワードによるフィルタリング（Google News以外は簡易チェック）
        const isRelevant = feed.name.includes("Google") || techKeywords.some(kw => title.includes(kw));
        
        if (isRelevant && finalUrl) {
          // 既存の daily_results テーブルに tech_trend という特集プロジェクトとして保存
          const { error } = await supabase.from("daily_results").upsert({
            title: title.trim(),
            url: finalUrl.trim(),
            source: feed.name,
            keyword: "技術トレンド", // タグとして利用
            project_id: "tech_trend", // 特別なプロジェクトID
            published_at: pubDate.toISOString()
          }, { onConflict: 'url' });

          if (!error) addedCount++;
        }
      }
    }

    res.status(200).json({ success: true, added: addedCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
