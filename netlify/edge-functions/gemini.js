/* ═══════════════════════════════════════════
   NETLIFY EDGE FUNCTION — Gemini API Proxy
   Edge Functions have 30s timeout (vs 10s for regular functions)
   ═══════════════════════════════════════════ */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-goog-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async (request, context) => {
  // ── Handle CORS preflight ──
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }

  // ── Only allow POST ──
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { message: "Method not allowed" } }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  // ── Extract API key safely from headers, Netlify.env, or Deno.env ──
  let API_KEY =
    request.headers.get("x-goog-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!API_KEY) {
    try {
      if (typeof Netlify !== "undefined" && Netlify.env && typeof Netlify.env.get === "function") {
        API_KEY = Netlify.env.get("GEMINI_API_KEY") || "";
      }
    } catch (_) {}
  }

  if (!API_KEY) {
    try {
      if (typeof Deno !== "undefined" && Deno.env && typeof Deno.env.get === "function") {
        API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
      }
    } catch (_) {}
  }

  if (!API_KEY) {
    return new Response(
      JSON.stringify({
        error: { message: "GEMINI_API_KEY is not configured in Netlify environment variables." },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  try {
    // ── Parse request from frontend ──
    const { model, requestBody, stream } = await request.json();

    if (!model || !requestBody) {
      return new Response(
        JSON.stringify({ error: { message: "Missing 'model' or 'requestBody' in request." } }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    // ── Helper to fetch from Gemini with seamless engine fallback if model not found ──
    async function executeGemini(targetModel, isStream) {
      const endpoint = isStream ? "streamGenerateContent?alt=sse" : "generateContent";
      let res = await fetch(`${API_BASE}/${targetModel}:${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      // If requested model returns 404 or 400, seamlessly route to active high-speed engine
      if (!res.ok && (res.status === 404 || res.status === 400)) {
        for (const engine of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]) {
          try {
            const fallbackRes = await fetch(`${API_BASE}/${engine}:${endpoint}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": API_KEY,
              },
              body: JSON.stringify(requestBody),
            });
            if (fallbackRes.ok) return fallbackRes;
          } catch (_) {}
        }
      }
      return res;
    }

    // ── Streaming mode via SSE for real-time response (< 1s first token) ──
    if (stream) {
      console.log(`🤖 Proxying stream request for: ${model}`);
      const geminiResponse = await executeGemini(model, true);

      if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text().catch(() => "");
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (_) {
          errorData = { error: { message: errorText || `Google API error: ${geminiResponse.status}` } };
        }
        return new Response(JSON.stringify(errorData), {
          status: geminiResponse.status,
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        });
      }

      return new Response(geminiResponse.body, {
        status: geminiResponse.status,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
          ...CORS_HEADERS,
        },
      });
    }

    // ── Standard non-streaming mode ──
    console.log(`🤖 Proxying standard request for: ${model}`);
    const geminiResponse = await executeGemini(model, false);

    const responseText = await geminiResponse.text().catch(() => "");
    let responseData = {};
    try {
      responseData = JSON.parse(responseText);
    } catch (_) {
      responseData = { error: { message: responseText || `Google API error: ${geminiResponse.status}` } };
    }

    // ── Return Gemini's response ──
    return new Response(JSON.stringify(responseData), {
      status: geminiResponse.status,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    console.error("❌ Edge function error:", error);
    return new Response(
      JSON.stringify({ error: { message: error.message || "Internal server error" } }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }
};

export const config = {
  path: "/api/gemini",
};
