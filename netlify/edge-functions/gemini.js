/* ═══════════════════════════════════════════
   NETLIFY EDGE FUNCTION — Gemini API Proxy
   Edge Functions have 30s timeout (vs 10s for regular functions)
   ═══════════════════════════════════════════ */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export default async (request, context) => {
  // ── Handle CORS preflight ──
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }

  // ── Only allow POST ──
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { message: "Method not allowed" } }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // ── Check API key from environment ──
  const API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!API_KEY) {
    return new Response(
      JSON.stringify({
        error: { message: "GEMINI_API_KEY environment variable is not configured on the server." },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // ── Parse request from frontend ──
    const { model, requestBody } = await request.json();

    if (!model || !requestBody) {
      return new Response(
        JSON.stringify({ error: { message: "Missing 'model' or 'requestBody' in request." } }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
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

    // ── Return Gemini's response ──
    return new Response(JSON.stringify(responseData), {
      status: geminiResponse.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("❌ Edge function error:", error);
    return new Response(
      JSON.stringify({ error: { message: error.message || "Internal server error" } }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const config = {
  path: "/api/gemini",
};
