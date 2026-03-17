import dotenv from 'dotenv';
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log("Starting test with:");
console.log("SUPABASE_URL (exists):", !!SUPABASE_URL);
console.log("GEMINI_API_KEY (prefix):", GEMINI_API_KEY?.substring(0, 10));

async function runTest() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Fetching news from Supabase...");
    const { data: news, error: newsError } = await supabase
      .from("daily_results")
      .select("title, project_id, keyword")
      .order("created_at", { ascending: false })
      .limit(30);

    if (newsError) {
        console.error("Supabase Error:", newsError);
        return;
    }
    console.log(`Found ${news.length} news items.`);

    const newsText = news.map(n => `- ${n.title} (キーワード: ${n.keyword})`).join("\n");
    const prompt = `
あなたは光学機器業界の戦略分析エキスパートです。
以下の最新ニュースリストを元に、全分野における「今月の重要シグナル」と「推奨アクション」を日本語で作成してください。

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

    const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    console.log("Calling Gemini API...");
    const apiResponse = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const apiJson = await apiResponse.json();
    if (!apiResponse.ok) {
      console.error("Gemini API Error Detail:", JSON.stringify(apiJson, null, 2));
      return;
    }

    console.log("Success! AI Response:");
    console.log(JSON.stringify(apiJson, null, 2));

  } catch (error) {
    console.error("Execution Error:", error);
  }
}

runTest();
