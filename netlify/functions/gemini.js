/* ═══════════════════════════════════════════
   NETLIFY SERVERLESS FUNCTION — Gemini API Proxy
   Keeps API key secure on the backend
   ═══════════════════════════════════════════ */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// CORS headers for all responses
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  // ── Handle CORS preflight ──
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  // ── Only allow POST ──
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: { message: "Method not allowed" } }),
    };
  }

  // ── Check API key from environment ──
  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: {
          message: "GEMINI_API_KEY environment variable is not configured on the server.",
        },
      }),
    };
  }

  try {
    // ── Parse request from frontend ──
    const { model, requestBody } = JSON.parse(event.body);

    if (!model || !requestBody) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: { message: "Missing 'model' or 'requestBody' in request." },
        }),
      };
    }

    // ── Forward request to Gemini API ──
    const apiUrl = `${API_BASE}/${model}:generateContent`;
    console.log(`🤖 Proxying request to model: ${model}`);

    const geminiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await geminiResponse.json();

    // ── Return Gemini's response with same status code ──
    return {
      statusCode: geminiResponse.status,
      headers: CORS_HEADERS,
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    console.error("❌ Serverless function error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: { message: error.message || "Internal server error" },
      }),
    };
  }
};
