
import fetch from "node-fetch";

const feeds = [
  { name: "厚生労働省 (新着情報)", url: "https://www.mhlw.go.jp/stf/news.rdf" },
  { name: "PMDA (新着情報)", url: "https://www.pmda.go.jp/rss_015.xml" },
  { name: "経済産業省 (新着情報)", url: "https://www.meti.go.jp/ml_index_release_atom.xml" }
];

const targetKeywords = ["光学", "内視鏡", "顕微鏡", "レーザー", "医療機器", "薬機法", "承認", "ME機器"];

async function test() {
  for (const feed of feeds) {
    console.log(`\n--- Fetching ${feed.name} (${feed.url}) ---`);
    try {
      const response = await fetch(feed.url);
      if (!response.ok) {
        console.error(`Error: ${response.status} ${response.statusText}`);
        continue;
      }
      const xmlText = await response.text();
      
      // Improved parsing logic
      const items = xmlText.match(/<(item|entry)>[\s\S]*?<\/\1>/g) || [];
      console.log(`Found ${items.length} items.`);

      let matchCount = 0;
      for (const item of items) {
        const title = (item.match(/<title>(.*?)<\/title>/)?.[1] || "")
          .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
          .replace(/<[^>]+>/g, '')
          .trim();
        
        // Link extraction for RSS 1.0, 2.0 and Atom
        let url = "";
        const linkMatch = item.match(/<link>(.*?)<\/link>/);
        const linkHrefMatch = item.match(/<link[^>]+href=["'](.*?)["']/);
        
        if (linkMatch && linkMatch[1]) {
          url = linkMatch[1];
        } else if (linkHrefMatch && linkHrefMatch[1]) {
          url = linkHrefMatch[1];
        }
        
        url = url.replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1").trim();

        const isRelevant = targetKeywords.some(kw => title.includes(kw));
        
        if (isRelevant) {
          console.log(`  [Match] TITLE: ${title}`);
          console.log(`          URL:   ${url}`);
          matchCount++;
        }
      }
      console.log(`Total relevant items: ${matchCount}`);
    } catch (e) {
      console.error(`Fetch error: ${e.message}`);
    }
  }
}

test();
