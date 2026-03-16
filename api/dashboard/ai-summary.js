import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const project = req.query.project || "";
    
    // 1. キャッシュの確認（直近12時間以内のデータがあればそれを使う）
    const cacheLimit = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data: cachedData, error: cacheError } = await supabase
      .from("ai_summaries")
      .select("summary_json")
      .eq("project_id", project)
      .gt("created_at", cacheLimit)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!cacheError && cachedData && cachedData.length > 0) {
      console.log("Using cached AI summary for project:", project || "all");
      return res.status(200).json(cachedData[0].summary_json);
    }

    // 2. 最新のニュース記事と言葉のトレンドを取得（AIのインプットにする）
    let query = supabase
      .from("daily_results")
      .select("title, project_id, keyword")
      .order("created_at", { ascending: false })
      .limit(30);

    if (project) query = query.eq("project_id", project);
    const { data: news, error: newsError } = await query;
    if (newsError) throw newsError;

    // 3. プロンプトの作成
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

    // 4. Gemini API (Google AI Studio) の呼び出し
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("サーバーサイドのAPIキー設定が不足しています。");
    }
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
      if (status === 401 || status === 403) {
        throw new Error(`APIキーが無効、または権限がありません (Status: ${status})。設定を確認してください。`);
      }
      if (status === 429) {
        throw new Error("APIの利用制限（リクエスト過多）に到達しました。しばらく待ってから再度お試しください。");
      }
      
      throw new Error(apiJson.error?.message || `AIの生成に失敗しました (Status: ${status})`);
    }

    let rawText = apiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error("Gemini API Empty Response:", apiJson);
      throw new Error("AIから有効なテキストが返却されませんでした。内容をご確認ください。");
    }

    // バックティックスや不要な改行をトリミング（JSONとしてパースできるよう調整）
    rawText = rawText.trim();
    if (rawText.startsWith("```json")) {
      rawText = rawText.replace(/^```json/, "").replace(/```$/, "").trim();
    } else if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```/, "").replace(/```$/, "").trim();
    }
    
    let result;
    try {
      result = JSON.parse(rawText);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw Text:", rawText);
      // JSONではない場合、テキストをsummaryに入れて返す
      result = {
        summary: rawText.slice(0, 40),
        signals: ["解析エラーが発生しました"],
        actions: ["プロンプトの出力を確認してください"]
      };
    }

    // 5. 結果をキャッシュに保存
    try {
      await supabase.from("ai_summaries").insert({
        project_id: project,
        summary_json: result
      });
    } catch (dbError) {
      console.warn("Cache Save Error:", dbError);
      // キャッシュ保存失敗はAPI応答自体には影響させない
    }

    res.status(200).json(result);
  } catch (e) {
    console.error("AI Summary API Error:", e);
    res.status(500).json({ error: e.message || "予期せぬエラーが発生しました" });
  }
}
