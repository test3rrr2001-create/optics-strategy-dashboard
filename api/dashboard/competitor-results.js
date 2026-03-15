import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1. 競合企業リストを取得
    const { data: competitors, error: compError } = await supabase
      .from("competitors")
      .select("*");
    
    if (compError) throw compError;

    // 2. 既存のニュースから競合名が含まれるものを抽出
    // 本当は全文検索が望ましいが、簡易的にタイトルにキーワードが含まれるものを取得
    // ここでは各社の search_query を使って OR 検索（LIKE）を行う必要があるが
    // Supabase JS クライアントで複雑な OR LIKE は手間なため、
    // まずは直近100件のニュースを取得してメモリ上でフィルタリングする
    const { data: allNews, error: newsError } = await supabase
      .from("daily_results")
      .select("*, projects(name)")
      .order("published_at", { ascending: false })
      .limit(200);

    if (newsError) throw newsError;

    const results = competitors.map(comp => {
      // search_query を分割 (OR で区切られている想定)
      const keywords = comp.search_query.split(" OR ").map(k => k.trim().toLowerCase());
      
      const filteredNews = allNews.filter(news => {
        const title = (news.title || "").toLowerCase();
        return keywords.some(k => title.includes(k));
      });

      return {
        competitor_name: comp.name,
        color: comp.color,
        news: filteredNews.slice(0, 10) // 各社最新10件まで
      };
    });

    res.status(200).json({ competitors: results });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
