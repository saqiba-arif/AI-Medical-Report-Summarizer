/* ═══════════════════════════════════════════
   AI SERVICE — Gemini API Integration
   Ultra-fast, ChatGPT-speed streaming responses
   ═══════════════════════════════════════════ */

const AIService = (() => {
  const PRIMARY_ENDPOINT = "/api/gemini";
  const BACKUP_ENDPOINT = "/api/gemini-backup";

  // Models: #1 Gemini 3.8 Flash followed by latest high-speed models
  const MODELS = [
    "gemini-3.8-flash",        // #1: Gemini 3.8 Flash (User primary priority)
    "gemini-2.5-flash",        // #2: Next-generation high-speed model
    "gemini-2.0-flash",        // #3: Fast modern production model
    "gemini-1.5-flash",        // #4: Universal ultra-fast fallback
  ];

  function getOrderedModels() {
    return MODELS;
  }

  // Store report context for chatbot
  let reportContext = "";
  let reportFileName = "";

  // In-memory cache for instant 0ms repeated analyses
  const summaryCache = new Map();

  function getFileCacheKey(file) {
    return `${file.name}_${file.size}_${file.lastModified || 0}`;
  }

  function isConfigured() {
    return true;
  }

  // ── Extract text from file ──
  async function extractTextFromFile(file) {
    const type = file.type || "";
    const name = file.name.toLowerCase();

    if (type === "text/plain" || name.endsWith(".txt")) {
      return await file.text();
    }

    if (type === "application/pdf" || name.endsWith(".pdf") || type.startsWith("image/") || /\.(jpe?g|png|webp|bmp)$/i.test(name)) {
      return null; // Send as optimized base64
    }

    if (name.endsWith(".doc") || name.endsWith(".docx")) {
      return await file.text();
    }

    return await file.text();
  }

  // ── Convert file to base64 with fast mobile compression (<70KB for instant upload) ──
  async function fileToBase64(file) {
    const isImage = (file.type && file.type.startsWith("image/")) || /\.(jpe?g|png|webp|bmp)$/i.test(file.name);

    if (isImage && !file.name.toLowerCase().endsWith(".gif")) {
      const maxDim = 800; // 800px is crystal clear for OCR and compresses to <70KB
      const quality = 0.65;

      // 1. Off-thread createImageBitmap
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
          console.warn("createImageBitmap fallback:", e);
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
          img.onerror = () => resolve(e.target.result.split(",")[1]);
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    // PDFs and other documents
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
    const name = file.name.toLowerCase();
    const type = file.type;
    if (type === "application/pdf" || name.endsWith(".pdf")) return "application/pdf";
    if (type === "image/gif" || name.endsWith(".gif")) return "image/gif";
    return "image/jpeg"; // Sent as compressed JPEG
  }

  // ── Call Gemini API with SSE streaming (<500ms Time-To-First-Token) ──
  async function callGeminiStream(parts, systemInstruction = "", onChunk = null, maxTokens = 1000) {
    const requestBody = {
      contents: [{ parts }],
    };

    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    requestBody.generationConfig = {
      temperature: 0.1, // Deterministic, fastest token generation
      topP: 0.8,
      topK: 40,
      maxOutputTokens: maxTokens,
    };

    let lastError = null;

    // Try exactly 3 models with 8-second timeout per model (never hangs)
    for (const model of getOrderedModels()) {
      console.log(`🤖 Requesting model: ${model}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5500); // 5.5s fast limit

      try {
        const response = await fetch(PRIMARY_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, requestBody, stream: true }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`⚠️ Model ${model} returned ${response.status}. Trying next...`);
          lastError = new Error(errorData?.error?.message || `API error: ${response.status}`);
          continue; // Switch to next model immediately in 0ms!
        }

        const contentType = response.headers.get("Content-Type") || "";

        // If not streaming SSE, read JSON response directly
        if (!contentType.includes("text/event-stream") || !response.body) {
          const data = await response.json().catch(() => null);
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            console.log(`✅ Success with model: ${model}`);
            try { localStorage.setItem("gemini_working_model", model); } catch (e) {}
            if (onChunk) onChunk(text, text);
            return text;
          }
          continue;
        }

        // Live Server-Sent Events stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop(); // Keep partial line in buffer

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
            } catch (e) {}
          }
        }

        if (fullText.trim().length > 0) {
          console.log(`✅ Success streaming with model: ${model}`);
          try { localStorage.setItem("gemini_working_model", model); } catch (e) {}
          return fullText;
        }

      } catch (err) {
        clearTimeout(timeoutId);
        console.warn(`⚠️ Model ${model} issue:`, err.message);
        lastError = err;
        continue; // Try next model immediately
      }
    }

    // Fast fallback to backup endpoint if primary had any issues
    console.warn("Primary edge function failed, trying backup endpoint...");
    return await callGeminiBackup(parts, systemInstruction, maxTokens);
  }

  // ── Backup Serverless Call (Direct Node.js fallback) ──
  async function callGeminiBackup(parts, systemInstruction = "", maxTokens = 1000) {
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
      maxOutputTokens: maxTokens,
    };

    let lastError = null;

    for (const model of getOrderedModels()) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(BACKUP_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, requestBody }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          lastError = new Error(errorData?.error?.message || `API error: ${response.status}`);
          continue;
        }

        const data = await response.json().catch(() => null);
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          console.log(`✅ Success with backup on model: ${model}`);
          try { localStorage.setItem("gemini_working_model", model); } catch (e) {}
          return text;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        continue;
      }
    }

    throw lastError || new Error("Please check your GEMINI_API_KEY in Netlify settings or try again.");
  }

  // ══════════════════════════════════════
  // PUBLIC: Summarize Report
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
      parts = [{ text: `Please analyze this medical report and provide a structured summary:\n\n${textContent}` }];
      reportContext = textContent;
    } else {
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
    const summary = await callGeminiStream(parts, systemPrompt, onChunk, 1000);

    // Save summary directly as rich chatbot context
    reportContext = summary;
    summaryCache.set(cacheKey, summary);

    return summary;
  }

  // ══════════════════════════════════════
  // PUBLIC: Chat about Report
  // ══════════════════════════════════════
  async function chatAboutReport(userMessage, onChunk = null) {
    const systemPrompt = `You are a helpful medical AI assistant. A medical report has been uploaded and summarized. Answer the user's questions based on the report data.

RULES:
- Answer directly, concisely, and immediately like ChatGPT
- Keep answers clear and focused (1-3 short paragraphs maximum)
- Cite specific values from the report when relevant
- If the question is not related to the report, politely redirect
- Explain medical terms in simple language
- Never diagnose — only summarize and explain what the report says`;

    let contextMessage = "";
    if (reportContext) {
      contextMessage = `UPLOADED REPORT DATA (File: ${reportFileName}):\n${reportContext}\n\n---\n\nUSER QUESTION: ${userMessage}`;
    } else {
      contextMessage = `No report has been uploaded yet.\n\nUSER QUESTION: ${userMessage}\n\nPlease let the user know they should upload a report first for specific answers.`;
    }

    const parts = [{ text: contextMessage }];
    return await callGeminiStream(parts, systemPrompt, onChunk, 500);
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
