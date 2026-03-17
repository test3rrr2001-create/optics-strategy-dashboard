import dotenv from 'dotenv';
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkCache() {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    console.log("Checking ai_summaries table...");
    const { data, error } = await supabase
      .from("ai_summaries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
        console.error("Supabase Error:", error);
        return;
    }

    console.log(`Found ${data.length} cache entries.`);
    data.forEach(entry => {
        console.log(`- Project: ${entry.project_id || 'all'}, Created: ${entry.created_at}`);
    });

  } catch (error) {
    console.error("Execution Error:", error);
  }
}

checkCache();
