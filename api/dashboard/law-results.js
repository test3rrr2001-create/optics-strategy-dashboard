import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: lawNews, error } = await supabase
      .from("law_news")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.status(200).json(lawNews);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
