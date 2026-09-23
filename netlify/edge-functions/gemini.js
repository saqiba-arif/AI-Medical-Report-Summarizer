/* ═══════════════════════════════════════════
   NETLIFY EDGE FUNCTION — AI API Proxy
   Supports both Groq and Gemini automatically based on Api_key
   ═══════════════════════════════════════════ */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_API_BASE = "https://api.groq.com/openai/v1/chat/completions";

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

  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: { message: "Method not allowed" } }),
      {
        status: 405,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  // ── Extract API key safely from headers or Netlify environment variables ──
  // Checks Api_key (from Netlify screenshot), GROQ_API_KEY, GEMINI_API_KEY, API_KEY
  const ENV_KEY_NAMES = ["Api_key", "API_KEY", "api_key", "GROQ_API_KEY", "GEMINI_API_KEY"];
  let API_KEY =
    request.headers.get("x-goog-api-key") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";

  if (!API_KEY) {
    for (const name of ENV_KEY_NAMES) {
      try {
        if (typeof Netlify !== "undefined" && Netlify.env && typeof Netlify.env.get === "function") {
          const val = Netlify.env.get(name);
          if (val) { API_KEY = val; break; }
        }
      } catch (_) {}
      try {
        if (typeof Deno !== "undefined" && Deno.env && typeof Deno.env.get === "function") {
          const val = Deno.env.get(name);
          if (val) { API_KEY = val; break; }
        }
      } catch (_) {}
    }
  }

  if (!API_KEY) {
    return new Response(
      JSON.stringify({
        error: { message: "Api_key is not configured in Netlify environment variables." },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      }
    );
  }

  try {
    const { model, requestBody, stream } = await request.json();

    if (!requestBody) {
      return new Response(
        JSON.stringify({ error: { message: "Missing requestBody in request." } }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        }
      );
    }

    // ══════════════════════════════════════
    // ⚡ GROQ ENGINE (When Api_key is Groq gsk_...)
    // ══════════════════════════════════════
    if (API_KEY.startsWith("gsk_")) {
      console.log("⚡ Executing via ultra-fast Groq LPU engine...");
      const systemPrompt = requestBody.systemInstruction?.parts?.[0]?.text || "";
      const userParts = requestBody.contents?.[0]?.parts || [];

      let hasImage = false;
      let textContent = "";
      let imagePart = null;

      for (const part of userParts) {
        if (part.text) {
          textContent += part.text + "\n";
        } else if (part.inlineData) {
          hasImage = true;
          imagePart = part.inlineData;
        }
      }

      const messages = [];
      if (systemPrompt) {
        messages.push({ role: "system", content: systemPrompt });
      }

      if (hasImage && imagePart) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: textContent.trim() || "Please analyze this medical report." },
            {
              type: "image_url",
              image_url: {
                url: `data:${imagePart.mimeType};base64,${imagePart.data}`,
              },
            },
          ],
        });
      } else {
        messages.push({ role: "user", content: textContent.trim() });
      }

      const groqModel = hasImage ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";

      const groqRes = await fetch(GROQ_API_BASE, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: groqModel,
          messages: messages,
          temperature: 0.2,
          max_tokens: requestBody.generationConfig?.maxOutputTokens || 1000,
          stream: !!stream,
        }),
      });

      if (!groqRes.ok) {
        const errorText = await groqRes.text().catch(() => "");
        return new Response(JSON.stringify({ error: { message: errorText || `Groq error: ${groqRes.status}` } }), {
          status: groqRes.status,
          headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      if (stream) {
        return new Response(groqRes.body, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            ...CORS_HEADERS,
          },
        });
      }

      const groqData = await groqRes.json().catch(() => ({}));
      return new Response(JSON.stringify(groqData), {
        status: 200,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // ══════════════════════════════════════
    // 🤖 GEMINI ENGINE (When Api_key is Google Gemini)
    // ══════════════════════════════════════
    async function executeGemini(targetModel, isStream) {
      const endpoint = isStream ? "streamGenerateContent?alt=sse" : "generateContent";
      let res = await fetch(`${GEMINI_API_BASE}/${targetModel}:${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      // If requested model returns 404 or 400, seamlessly route to active engine
      if (!res.ok && (res.status === 404 || res.status === 400)) {
        for (const engine of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]) {
          try {
            const fallbackRes = await fetch(`${GEMINI_API_BASE}/${engine}:${endpoint}`, {
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

    // Standard non-streaming mode
    console.log(`🤖 Proxying standard request for: ${model}`);
    const geminiResponse = await executeGemini(model, false);

    const responseText = await geminiResponse.text().catch(() => "");
    let responseData = {};
    try {
      responseData = JSON.parse(responseText);
    } catch (_) {
      responseData = { error: { message: responseText || `Google API error: ${geminiResponse.status}` } };
    }

    return new Response(JSON.stringify(responseData), {
      status: geminiResponse.status,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS,
      },
    });

  } catch (error) {
    console.error("❌ Proxy error:", error);
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
