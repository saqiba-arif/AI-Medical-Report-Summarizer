/* ═══════════════════════════════════════════
   NETLIFY SERVERLESS FUNCTION (BACKUP PROXY)
   Runs on Node.js runtime with full process.env access
   ═══════════════════════════════════════════ */

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-goog-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: { message: "Method not allowed" } }),
    };
  }

  // Get API key from environment
  const API_KEY =
    event.headers["x-goog-api-key"] ||
    (event.headers["authorization"] ? event.headers["authorization"].replace(/^Bearer\s+/i, "") : "") ||
    process.env.GEMINI_API_KEY ||
    "";

  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({
        error: { message: "GEMINI_API_KEY is not configured in Netlify environment variables." },
      }),
    };
  }

  try {
    const { model, requestBody } = JSON.parse(event.body || "{}");

    if (!model || !requestBody) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        body: JSON.stringify({ error: { message: "Missing 'model' or 'requestBody'" } }),
      };
    }

    let res = await fetch(`${API_BASE}/${model}:generateContent`, {
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
          const fbRes = await fetch(`${API_BASE}/${engine}:generateContent`, {
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
    let responseData = {};
    try {
      responseData = JSON.parse(responseText);
    } catch (_) {
      responseData = { error: { message: responseText || `Google API error: ${res.status}` } };
    }

    return {
      statusCode: res.status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify(responseData),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      body: JSON.stringify({ error: { message: err.message || "Internal server error" } }),
    };
  }
};
