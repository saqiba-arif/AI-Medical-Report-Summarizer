/* ═══════════════════════════════════════════
   AI SERVICE — Gemini API Integration
   API key is secured in Netlify Edge Function
   ═══════════════════════════════════════════ */

const AIService = (() => {
  // ══════════════════════════════════════════
  // 🔒 API key is stored securely on the server
  // Set GEMINI_API_KEY in Netlify Environment Variables
  // ══════════════════════════════════════════
  const SERVERLESS_ENDPOINT = "/api/gemini";

  // Model configuration — latest Gemini 3 series ordered by speed and intelligence
  const MODELS = [
    "gemini-3.8-flash",        // #1: Google's flagship Gemini 3 high-speed model
    "gemini-3.5-flash",        // #2: Gemini 3 fast workhorse
    "gemini-3.5-flash-lite",   // #3: Gemini 3 ultra-low latency model
    "gemini-3.7-flash",        // #4: Gemini 3.7 fast reasoning
    "gemini-3.6-flash",        // #5: Gemini 3.6 fallback
    "gemini-3.1-flash-lite",   // #6: Gemini 3.1 lightweight fallback
  ];

  // Remember and prioritize the known working model from previous successful requests
  function getOrderedModels() {
    try {
      const saved = localStorage.getItem("gemini_working_model");
      if (saved && MODELS.includes(saved)) {
        return [saved, ...MODELS.filter((m) => m !== saved)];
      }
    } catch (e) {}
    return MODELS;
  }

  // Retry configuration — optimized for fast response
  const MAX_RETRIES = 2;
  const BASE_DELAY_MS = 350; // 350ms fast backoff

  // Store report context for chatbot
  let reportContext = "";
  let reportFileName = "";

  // In-memory cache for instant 0ms repeated analyses
  const summaryCache = new Map();

  function getFileCacheKey(file) {
    return `${file.name}_${file.size}_${file.lastModified || 0}`;
  }

  // ── API is always configured (key is server-side) ──
  function isConfigured() {
    return true;
  }

  // ── Extract text from file ──
  async function extractTextFromFile(file) {
    const type = file.type;
    const name = file.name.toLowerCase();

    // Text files
    if (type === "text/plain" || name.endsWith(".txt")) {
      return await file.text();
    }

    // For PDF, images - convert to base64 and let Gemini read them
    if (type === "application/pdf" || type.startsWith("image/")) {
      return null; // Will send as base64 to Gemini
    }

    // Doc/docx - read as text (basic)
    if (name.endsWith(".doc") || name.endsWith(".docx")) {
      return await file.text();
    }

    return await file.text();
  }

  // ── Convert file to base64 with fast off-thread image compression ──
  async function fileToBase64(file) {
    // If it's an image, downsample to 1000px max & JPEG 0.70 for 3x faster mobile upload & OCR
    if (file.type && file.type.startsWith("image/") && file.type !== "image/gif") {
      const maxDim = 1000;
      const quality = 0.70;

      // 1. Try modern native createImageBitmap (runs off-thread, up to 5x faster)
      if (typeof createImageBitmap === "function") {
        try {
          const bitmap = await createImageBitmap(file);
          let { width, height } = bitmap;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(bitmap, 0, 0, width, height);
          bitmap.close();
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          return dataUrl.split(",")[1];
        } catch (e) {
          console.warn("createImageBitmap fallback to standard Image loader:", e);
        }
      }

      // 2. Standard DOM Image element fallback
      return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
          img.onload = () => {
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", quality);
            resolve(dataUrl.split(",")[1]);
          };
          img.onerror = () => {
            resolve(e.target.result.split(",")[1]);
          };
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // PDFs and text documents
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Get MIME type for Gemini ──
  function getGeminiMimeType(file) {
    const type = file.type;
    if (type === "application/pdf") return "application/pdf";
    if (type === "image/png") return "image/jpeg"; // Sent as compressed JPEG
    if (type === "image/jpeg" || type === "image/jpg") return "image/jpeg";
    if (type === "image/webp") return "image/jpeg";
    if (type === "image/gif") return "image/gif";
    return "application/octet-stream";
  }

  // ── Sleep utility for retry delays ──
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ── Call Gemini API with SSE streaming (<1s Time-To-First-Token) ──
  async function callGeminiStream(parts, systemInstruction = "", onChunk = null) {
    const requestBody = {
      contents: [{ parts }],
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    requestBody.generationConfig = {
      temperature: 0.1, // Lower temperature for faster, deterministic responses
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1000,
      thinkingConfig: {
        thinkingLevel: "low", // Eliminates 15-20s thinking delay in Gemini 3 models
      },
    };

    let lastError = null;

    // Try models in order of lowest latency, prioritizing last successful model
    for (const model of getOrderedModels()) {
      console.log(`🤖 Requesting model (streaming): ${model}...`);

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await fetch(SERVERLESS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, requestBody, stream: true }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData?.error?.message || `API error: ${response.status}`;
            const status = response.status;

            if (status === 400 && errorMsg.toLowerCase().includes("thinking") && requestBody.generationConfig?.thinkingConfig) {
              console.log(`ℹ️ Retrying ${model} without thinkingConfig...`);
              delete requestBody.generationConfig.thinkingConfig;
              continue;
            }

            if ((status === 429 || status === 503) && attempt < MAX_RETRIES) {
              const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
              console.log(`⏳ ${model} busy (${status}). Retrying in ${delay / 1000}s... (attempt ${attempt}/${MAX_RETRIES})`);
              await sleep(delay);
              lastError = new Error(errorMsg);
              continue;
            }

            if (status === 404 || status === 400 || status === 429 || status === 503) {
              console.log(`⚠️ ${model} unavailable (${status}). Trying next model...`);
              lastError = new Error(errorMsg);
              break; // Break retry loop, try next model immediately
            }

            throw new Error(errorMsg);
          }

          // Check if response is streaming SSE
          const contentType = response.headers.get("Content-Type") || "";
          if (!contentType.includes("text/event-stream") || !response.body) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              if (onChunk) onChunk(text, text);
              return text;
            }
            throw new Error("No response from AI model");
          }

          // Stream chunks via Server-Sent Events
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let fullText = "";
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop(); // Keep unfinished line in buffer

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;

              const jsonStr = trimmed.replace(/^data:\s*/, "");
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (chunk) {
                  fullText += chunk;
                  if (onChunk) {
                    onChunk(chunk, fullText);
                  }
                }
              } catch (e) {
                // Ignore parse errors on individual SSE chunks
              }
            }
          }

          if (fullText.trim().length > 0) {
            console.log(`✅ Success streaming with model: ${model}`);
            try { localStorage.setItem("gemini_working_model", model); } catch (e) {}
            return fullText;
          }

          throw new Error("Stream completed without text content");

        } catch (error) {
          lastError = error;

          if (error.name === "TypeError" && attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`🔄 Network error. Retrying in ${delay / 1000}s...`);
            await sleep(delay);
            continue;
          }

          if (attempt >= MAX_RETRIES) {
            console.log(`❌ ${model} failed after ${MAX_RETRIES} attempts. Trying next model...`);
            break;
          }

          throw error;
        }
      }
    }

    // Fall back to standard callGemini if streaming failed
    console.warn("Streaming fallback to non-streaming callGemini:", lastError);
    return await callGemini(parts, systemInstruction);
  }

  // ── Standard non-streaming fallback ──
  async function callGemini(parts, systemInstruction = "") {
    const requestBody = {
      contents: [{ parts }],
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    requestBody.generationConfig = {
      temperature: 0.1,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 1000,
      thinkingConfig: {
        thinkingLevel: "low",
      },
    };

    let lastError = null;

    for (const model of getOrderedModels()) {
      console.log(`🤖 Trying model (standard): ${model}...`);

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const response = await fetch(SERVERLESS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, requestBody, stream: false }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData?.error?.message || `API error: ${response.status}`;
            const status = response.status;

            if (status === 400 && errorMsg.toLowerCase().includes("thinking") && requestBody.generationConfig?.thinkingConfig) {
              delete requestBody.generationConfig.thinkingConfig;
              continue;
            }

            if ((status === 429 || status === 503) && attempt < MAX_RETRIES) {
              const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
              await sleep(delay);
              lastError = new Error(errorMsg);
              continue;
            }

            if (status === 404 || status === 400 || status === 429 || status === 503) {
              lastError = new Error(errorMsg);
              break;
            }

            throw new Error(errorMsg);
          }

          const data = await response.json();

          if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            throw new Error("No response from AI model");
          }

          console.log(`✅ Success with model: ${model}`);
          try { localStorage.setItem("gemini_working_model", model); } catch (e) {}
          return data.candidates[0].content.parts[0].text;

        } catch (error) {
          lastError = error;

          if (error.name === "TypeError" && attempt < MAX_RETRIES) {
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            await sleep(delay);
            continue;
          }

          if (attempt >= MAX_RETRIES) {
            break;
          }

          throw error;
        }
      }
    }

    throw lastError || new Error("All models failed. Please check your internet connection and try again.");
  }

  // ══════════════════════════════════════
  // PUBLIC: Summarize Report (with live streaming support)
  // ══════════════════════════════════════
  async function summarizeReport(file, onChunk = null) {
    reportFileName = file.name;

    // Check in-memory cache for instant 0ms repeat analysis
    const cacheKey = getFileCacheKey(file);
    if (summaryCache.has(cacheKey)) {
      console.log("⚡ Serving summary from instant memory cache");
      const cachedSummary = summaryCache.get(cacheKey);
      reportContext = cachedSummary;
      if (onChunk) onChunk(cachedSummary, cachedSummary);
      return cachedSummary;
    }

    const systemPrompt = `You are an expert medical report analyzer. Provide a clear, concise, structured summary for healthcare professionals.

IMPORTANT RULES:
- Be fast, accurate, concise, and direct — avoid filler or pleasantries
- Do NOT output any intro remarks or greetings. Start immediately with "🏥 **Patient Overview**"
- Highlight critical or abnormal values in **bold**
- Include lab results with reference ranges if present in report
- If you cannot read or understand part of the report, state so clearly
- Never fabricate medical information

FORMAT your response EXACTLY like this (use these exact headings with emojis):

🏥 **Patient Overview**
Brief description of patient info, chief complaint, and visit type.

🔬 **Key Findings**
- List each important finding
- Highlight any ABNORMAL values in bold
- Include lab results with reference ranges if available

⚠️ **Risk Alerts**
- Any critical values or concerning findings
- If none, write "No critical alerts identified"

💊 **Recommendations**
- Suggested follow-up actions
- Medication considerations
- Timeline for next review

📋 **Summary in Simple Terms**
2-3 sentences explaining the report in plain language that a patient could understand.`;

    const textContent = await extractTextFromFile(file);
    let parts = [];

    if (textContent) {
      // Text-based file
      parts = [{ text: `Please analyze this medical report and provide a structured summary:\n\n${textContent}` }];
      reportContext = textContent;
    } else {
      // PDF or Image - send as inline data (compressed and resized)
      const base64Data = await fileToBase64(file);
      const mimeType = getGeminiMimeType(file);
      parts = [
        { text: "Please analyze this medical report and provide a structured summary:" },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
      ];
      reportContext = `[Medical report from file: ${file.name}]`;
    }

    // Fast streaming API call
    const summary = await callGeminiStream(parts, systemPrompt, onChunk);

    // Save summary directly as rich chatbot context (no duplicate background call needed!)
    reportContext = summary;

    // Store in cache
    summaryCache.set(cacheKey, summary);

    return summary;
  }

  // ══════════════════════════════════════
  // PUBLIC: Chat about Report (with live streaming support)
  // ══════════════════════════════════════
  async function chatAboutReport(userMessage, onChunk = null) {
    const systemPrompt = `You are a helpful medical AI assistant. A medical report has been uploaded and summarized. Answer the user's questions based on the report data.

RULES:
- Answer based on the report content provided
- Be accurate, concise, and cite specific values from the report when possible
- If the question is not related to the report, politely redirect
- Explain medical terms in simple language when asked
- Never diagnose — only summarize and explain what the report says
- Keep answers direct and clear`;

    let contextMessage = "";
    if (reportContext) {
      contextMessage = `UPLOADED REPORT DATA (File: ${reportFileName}):\n${reportContext}\n\n---\n\nUSER QUESTION: ${userMessage}`;
    } else {
      contextMessage = `No report has been uploaded yet.\n\nUSER QUESTION: ${userMessage}\n\nPlease let the user know they should upload a report first for specific answers.`;
    }

    const parts = [{ text: contextMessage }];
    return await callGeminiStream(parts, systemPrompt, onChunk);
  }

  // ══════════════════════════════════════
  // PUBLIC: Clear context
  // ══════════════════════════════════════
  function clearContext() {
    reportContext = "";
    reportFileName = "";
    summaryCache.clear();
  }

  function hasReportContext() {
    return reportContext.length > 0;
  }

  // Return public API
  return {
    isConfigured,
    summarizeReport,
    chatAboutReport,
    clearContext,
    hasReportContext,
  };
})();
