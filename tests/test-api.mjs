import fetch from 'node-fetch';

const GEMINI_API_KEY = "AIzaSyCSLQdbFvGFo4CTDQPefc0nFTGmcKb1NdE";
const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const prompt = "テストです。JSON形式で { \"test\": \"ok\" } とだけ返してください。";

async function test() {
  try {
    const apiResponse = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const apiJson = await apiResponse.json();
    console.log("Status:", apiResponse.status);
    console.log("Response:", JSON.stringify(apiJson, null, 2));
  } catch(e) {
    console.error(e);
  }
}
test();
