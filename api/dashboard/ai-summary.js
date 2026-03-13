import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const project = req.query.project || "";
    
    // 1. 最新のニュース記事と言葉のトレンドを取得（AIのインプットにする）
    let query = supabase
      .from("daily_results")
      .select("title, project_id, keyword")
      .order("created_at", { ascending: false })
      .limit(30);

    if (project) query = query.eq("project_id", project);
    const { data: news, error: newsError } = await query;
    if (newsError) throw newsError;

    // 2. プロンプトの作成
    const newsText = news.map(n => `- ${n.title} (キーワード: ${n.keyword})`).join("\n");
    const projectNames = { 1: "顕微鏡", 2: "工業用内視鏡", 3: "管内カメラ", 4: "美容用" };
    const currentProject = projectNames[project] || "全分野";

    const prompt = `
あなたは光学機器業界（顕微鏡、工業用内視鏡、管内カメラ、美容機器）の戦略分析エキスパートです。
以下の最新ニュースリストを元に、${currentProject}分野における「今月の重要シグナル」と「推奨アクション」を日本語で作成してください。

【最新ニュース】
${newsText}

【出力形式】
JSON形式で以下の構造で出力してください。
{
  "summary": "全体の状況を一言で要約（40文字以内）",
  "signals": ["重要な予兆1", "重要な予兆2", ...],
  "actions": ["推奨される具体的な打ち手1", "推奨される具体的な打ち手2", ...]
}
不要な解説やMarkdownのバックティックス（\`\`\`jsonなど）は含めず、純粋なJSON文字列のみを返してください。
`;

    // 3. Gemini API (Google AI Studio) の呼び出し
    // 本来は process.env.GEMINI_API_KEY を使うべきだが、指示に従い提供されたキーを直接使用
    const GEMINI_API_KEY = "AIzaSyCSLQdbFvGFo4CTDQPefc0nFTGmcKb1NdE";
    const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const apiResponse = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const apiJson = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error("Gemini API Error:", apiJson);
      
      const status = apiResponse.status;
      if (status === 429) {
        throw new Error("APIの利用制限（リクエスト過多）に到達しました。しばらく待ってから再度お試しください。");
      }
      
      throw new Error(apiJson.error?.message || "AIの生成に失敗しました");
    }

    let rawText = apiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("AIから有効なテキストが返却されませんでした。");

    // バックティックスや不要な改行をトリミング
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const result = JSON.parse(rawText);

    res.status(200).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
