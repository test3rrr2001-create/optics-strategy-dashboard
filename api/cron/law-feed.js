import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // 認証チェック（Vercel Cronなどの場合はヘッダー等で簡易ガードが可能ですが、
  // ここではシンプルに実装します）
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 監視対象のRSSフィードリスト
    const feeds = [
      { name: "厚生労働省 (新着情報)", url: "https://www.mhlw.go.jp/stf/news.rdf" },
      { name: "PMDA (新着情報)", url: "https://www.pmda.go.jp/rss_015.xml" },
      { name: "経済産業省 (新着情報)", url: "https://www.meti.go.jp/ml_index_release_atom.xml" }
    ];

    // 光学機器に関連するキーワード
    const targetKeywords = ["光学", "内視鏡", "顕微鏡", "レーザー", "医療機器", "薬機法", "承認", "ME機器"];

    let addedCount = 0;

    for (const feed of feeds) {
      console.log(`Fetching ${feed.name}...`);
      const response = await fetch(feed.url);
      if (!response.ok) {
        console.error(`Failed to fetch ${feed.name}: ${response.status}`);
        continue;
      }
      const xmlText = await response.text();

      // パース処理の強化
      // <item> や <entry> タグの後に属性（rdf:about等）がある場合にも対応
      const items = xmlText.match(/<(item|entry)[^>]*>[\s\S]*?<\/\1>/g) || [];

      for (const item of items) {
        // titleタグに属性がある場合やCDATAにも対応
        const title = (item.match(/<title[^>]*>(.*?)<\/title>/)?.[1] || "")
          .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
          .replace(/<[^>]+>/g, '')
          .trim();
        
        // Link extraction for RSS 1.0, 2.0 and Atom
        let url = "";
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const linkHrefMatch = item.match(/<link[^>]+href=["'](.*?)["']/);
        
        if (linkMatch && linkMatch[1]) {
          url = linkMatch[1];
        } else if (linkHrefMatch && linkHrefMatch[1]) {
          url = linkHrefMatch[1];
        }
        
        const finalUrl = url.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();

        // 日付タグのバリエーションに対応
        const pubDateStr = item.match(/<(pubDate|dc:date|published|updated)[^>]*>(.*?)<\/\1>/)?.[2] || "";
        const pubDate = pubDateStr ? new Date(pubDateStr) : new Date();

        // キーワードによるフィルタリング
        const isRelevant = targetKeywords.some(kw => title.includes(kw));
        
        if (isRelevant && finalUrl) {
          // 重要度の判定（簡易ロジック）
          let importance = "Low";
          if (title.includes("緊急") || title.includes("停止") || title.includes("重要")) importance = "High";
          else if (title.includes("改正") || title.includes("承認")) importance = "Medium";

          // カテゴリの判定
          let category = "一般通知";
          if (title.includes("承認")) category = "薬事承認";
          else if (title.includes("改正")) category = "法改正";
          else if (title.includes("安全性")) category = "安全性情報";

          // データベース保存（重複はURLで弾く）
          const { error } = await supabase.from("law_news").upsert({
            source: feed.name,
            title: title,
            url: finalUrl,
            category: category,
            importance: importance,
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
