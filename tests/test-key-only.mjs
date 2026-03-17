import fetch from 'node-fetch';

const GEMINI_API_KEY = "AIzaSyBFSuk2NpH5L6NDrDXT0zcVYZsYhcpKwUY";
const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const prompt = "Please respond with 'API Key is working' in a JSON object like { \"status\": \"ok\", \"message\": \"...\" }";

async function test() {
  console.log("Testing API Key:", GEMINI_API_KEY);
  try {
    const apiResponse = await fetch(apiURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const apiJson = await apiResponse.json();
    console.log("Status Code:", apiResponse.status);
    console.log("Response Body:", JSON.stringify(apiJson, null, 2));

    if (apiResponse.ok) {
        console.log("SUCCESS: The API key is valid.");
    } else {
        console.log("FAILURE: The API key might be invalid or have restrictions.");
    }
  } catch(e) {
    console.error("Connection Error:", e);
  }
}
test();
