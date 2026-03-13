import { createClient } from "@supabase/supabase-js";

// ストップワード（共通化したいが、ひとまずここにも定義）
const STOPWORDS = new Set([
  "の","に","は","を","た","が","で","て","と","し","れ","さ","ある","いる","も","する","から","な",
  "こと","として","い","や","れる","など","なっ","ない","この","ため","その","あっ","よう","また",
  "もの","という","あり","まで","られ","なる","へ","か","だ","これ","によって","により","おり","より",
  "による","ず","なり","られる","において","ば","なかっ","なく","しかし","について","せ","だっ","その後",
  "できる","それ","う","ので","なお","のみ","でき","き","つ","における","および","いう","さらに","でも"
]);

function extractWords(text) {
  if (!text) return [];
  // ひらがなや記号を境目として、漢字・カタカナ・英数字の連続を抽出
  const words = text.match(/[a-zA-Z0-9\u4E00-\u9FFF\u30A0-\u30FF\-]+/g) || [];
  return words.filter(w => {
    // 1文字だけの言葉や、数字だけのものはノイズになりやすいので除外
    if (w.length < 2) return false;
    if (/^[0-9]+$/.test(w)) return false;
    return !STOPWORDS.has(w);
  });
}

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 直近30日のニュースから頻出ワードを「トレンド」として集計
    const { data: rows, error } = await supabase
      .from("daily_results")
      .select("project_id, title")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const PROJECT_ID_TO_KEY = { 1: "microscope", 2: "industrial_endoscope", 3: "pipe_camera", 4: "beauty" };
    const analysis = {};

    rows.forEach(row => {
      const key = PROJECT_ID_TO_KEY[row.project_id];
      if (!key) return;
      if (!analysis[key]) analysis[key] = {};
      const words = extractWords(row.title);
      words.forEach(w => {
        analysis[key][w] = (analysis[key][w] || 0) + 1;
      });
    });

    const trends = {};
    let hasRealData = false;

    Object.keys(PROJECT_ID_TO_KEY).forEach(id => {
      const key = PROJECT_ID_TO_KEY[id];
      const freq = analysis[key] || {};
      const sorted = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word, count]) => ({
          word,
          change_rate: "New",
          news_count: count,
          memo: "最近のタイトルから自動抽出"
        }));
      
      if (sorted.length > 0) {
        trends[key] = sorted;
        hasRealData = true;
      }
    });

    // データが全くない場合はダミーデータを返す（サンプルとして表示）
    if (!hasRealData) {
      const dummyTrends = {
        microscope: [
          { word: "デジタル病理AI", change_rate: "+185%", news_count: 14, memo: "スマート病院構想に関連して急増" },
          { word: "手術用顕微鏡 4K", change_rate: "+120%", news_count: 8, memo: "微細外科手術の需要増" }
        ],
        industrial_endoscope: [
          { word: "配管自動点検ロボット", change_rate: "+210%", news_count: 18, memo: "インフラ老朽化対策で急浮上" }
        ],
        pipe_camera: [
          { word: "下水道法改正", change_rate: "+315%", news_count: 25, memo: "自治体の点検義務強化に関する報道" }
        ],
        beauty: [
          { word: "スマホ肌診断", change_rate: "+250%", news_count: 32, memo: "D2Cコスメブランドの導入拡大" }
        ]
      };
      return res.status(200).json({ trends: dummyTrends, is_sample: true });
    }

    res.status(200).json({ trends, is_sample: false });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
