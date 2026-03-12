export default async function handler(req, res) {
  try {
    // 検索急上昇ワードのダミーデータ（将来的にGoogle Trends APIや自社DB集計と連携予定）
    const dummyTrends = {
      microscope: [
        { word: "デジタル病理AI", change_rate: "+185%", news_count: 14, memo: "スマート病院構想に関連して急増" },
        { word: "手術用顕微鏡 4K", change_rate: "+120%", news_count: 8, memo: "微細外科手術の需要増" },
        { word: "蛍光顕微鏡", change_rate: "+65%", news_count: 5, memo: "バイオ研究分野で安定した伸び" }
      ],
      industrial_endoscope: [
        { word: "配管自動点検ロボット", change_rate: "+210%", news_count: 18, memo: "インフラ老朽化対策で急浮上" },
        { word: "極細径内視鏡", change_rate: "+145%", news_count: 11, memo: "EVモーター検査用途" },
        { word: "AI欠陥判定", change_rate: "+90%", news_count: 22, memo: "製造ラインの省人化による恒常的ニーズ" }
      ],
      pipe_camera: [
        { word: "下水道法改正", change_rate: "+315%", news_count: 25, memo: "自治体の点検義務強化に関する報道" },
        { word: "管内カメラ ドローン", change_rate: "+170%", news_count: 9, memo: "新技術の試験導入ニュース" },
        { word: "非破壊検査", change_rate: "+85%", news_count: 14, memo: "関連キーワードとしての出現増加" }
      ],
      beauty: [
        { word: "スマホ肌診断", change_rate: "+250%", news_count: 32, memo: "D2Cコスメブランドの導入拡大" },
        { word: "マイクロスコープ 頭皮", change_rate: "+130%", news_count: 15, memo: "美容室の単価向上メニューとして注目" },
        { word: "非接触スキンケア", change_rate: "+75%", news_count: 8, memo: "継続的な衛生意識の高まり" }
      ]
    };

    // ランダムな遅延を入れてAPI通信っぽくする（不要なら削除可）
    await new Promise((resolve) => setTimeout(resolve, 300));

    res.status(200).json({ trends: dummyTrends });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
