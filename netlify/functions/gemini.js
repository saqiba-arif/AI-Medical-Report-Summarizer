/* ═══════════════════════════════════════════
   NETLIFY SERVERLESS FUNCTION (BACKUP PROXY)
   Supports Groq and Gemini with multi-key auto detection
   ═══════════════════════════════════════════ */

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_API_BASE = "https://api.groq.com/openai/v1/chat/completions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-goog-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: { message: "Method not allowed" } }),
    };
  }

  // Multi-key candidate discovery
  const ENV_KEY_NAMES = ["Api_key", "API_KEY", "api_key", "GROQ_API_KEY", "GEMINI_API_KEY"];
  let API_KEY =
    event.headers["x-goog-api-key"] ||
    (event.headers["authorization"] ? event.headers["authorization"].replace(/^Bearer\s+/i, "") : "") ||
    "";

  if (!API_KEY) {
    for (const name of ENV_KEY_NAMES) {
      if (process.env[name]) {
        API_KEY = process.env[name];
        break;
      }
    }
  }

  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({
        error: { message: "Api_key is not configured in Netlify environment variables." },
      }),
    };
  }

  try {
    const { model, requestBody } = JSON.parse(event.body || "{}");

    if (!requestBody) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify({ error: { message: "Missing requestBody" } }),
      };
    }

    // ⚡ Groq Engine
    if (API_KEY.startsWith("gsk_")) {
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
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

      if (hasImage && imagePart) {
        messages.push({
          role: "user",
          content: [
            { type: "text", text: textContent.trim() || "Please analyze this medical report." },
            {
              type: "image_url",
              image_url: { url: `data:${imagePart.mimeType};base64,${imagePart.data}` },
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
        }),
      });

      const responseText = await groqRes.text().catch(() => "");
      return {
        statusCode: groqRes.status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: responseText,
      };
    }

    // 🤖 Gemini Engine
    let res = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok && (res.status === 404 || res.status === 400)) {
      for (const engine of ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]) {
        try {
          const fbRes = await fetch(`${GEMINI_API_BASE}/${engine}:generateContent`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": API_KEY,
            },
            body: JSON.stringify(requestBody),
          });
          if (fbRes.ok) {
            res = fbRes;
            break;
          }
        } catch (_) {}
      }
    }

    const responseText = await res.text().catch(() => "");
    return {
      statusCode: res.status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: responseText,
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: { message: err.message || "Internal server error" } }),
    };
  }
};
