import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: keywords } = await supabase
      .from("keywords")
      .select("id, keyword, project_id")
      .eq("active", true);

    for (const k of keywords) {
      const searchUrl =
        "https://news.google.com/rss/search?q=" +
        encodeURIComponent(k.keyword) +
        "&hl=ja&gl=JP&ceid=JP:ja";

      const rss = await fetch(searchUrl).then(r => r.text());

      const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)];

      for (const item of items.slice(0, 3)) {
        const block = item[1];

        const title = block.match(/<title>(.*?)<\/title>/)?.[1] || "";
        const link = block.match(/<link>(.*?)<\/link>/)?.[1] || "";
        const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";

await supabase
  .from("daily_results")
  .upsert(
    {
      project_id: k.project_id,
      keyword: k.keyword,
      title,
      url: link,
      source: "google_news",
      published_at: pubDate ? new Date(pubDate) : null
    },
    {
      onConflict: "project_id,keyword,url",
      ignoreDuplicates: true
    }
  );

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
