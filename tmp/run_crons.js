import 'dotenv/config';
import lawFeed from '../api/cron/law-feed.js';
import techFeed from '../api/cron/tech-feed.js';

async function run() {
  const req = {};
  const res = {
    status: (code) => {
      return {
        json: (data) => console.log(`Status: ${code}, Body:`, data)
      };
    }
  };

  try {
    console.log("=== Running law-feed.js ===");
    await lawFeed(req, res);
    
    console.log("\n=== Running tech-feed.js ===");
    await techFeed(req, res);
    
    console.log("\nData population complete. Check your dashboard.");
  } catch (err) {
    console.error("Error during execution:", err);
  }
}

run();
