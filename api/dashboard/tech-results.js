import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // tech_news テーブルから取得
    const { data: techNews, error } = await supabase
      .from("tech_news")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    // タグ集計とタグ付け
    const tagCounts = {};
    const taggedNews = (techNews || []).map(news => {
      const title = (news.title || "").toLowerCase();
      let tags = [];
      if (title.includes("特許")) tags.push("特許公開");
      if (title.includes("ai") || title.includes("人工知能") || title.includes("ディープラーニング")) tags.push("AI/解析");
      if (title.includes("レーザー") || title.includes("センサー") || title.includes("レンズ")) tags.push("ハードウェア");
      if (title.includes("共同研究") || title.includes("提携") || title.includes("開発")) tags.push("R&D");
      if (title.includes("顕微鏡")) tags.push("顕微鏡技術");
      if (title.includes("内視鏡")) tags.push("内視鏡技術");
      if (title.includes("光学")) tags.push("光学技術");
      if (tags.length === 0) tags.push("新技術");

      tags.forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });

      return { ...news, tags };
    });

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([word, count]) => ({ word, count }));

    res.status(200).json({ news: taggedNews, tags: topTags });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
