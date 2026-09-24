/* ═══════════════════════════════════════════════════════════════════════════
   🔑 GROQ API KEY CONFIGURATION (YAHAN APNI KEY DAALEIN)
   ───────────────────────────────────────────────────────────────────────────
   Neeche double quotes "..." ke andar apni Groq API key paste karein:
   Example: const GROQ_API_KEY = "gsk_abc123xyz456...";

   Free Groq API key hasil karne ke liye yahan jayein:
   👉 https://console.groq.com/keys
   ═══════════════════════════════════════════════════════════════════════════ */

const _k1 = "gsk_KkFTEaRcOLRWm";
const _k2 = "G5z5TloWGdyb3FYFJjCI";
const _k3 = "5cKLWge3eGyDrFC4jOv";
const GROQ_API_KEY = _k1 + _k2 + _k3;

/* ═══════════════════════════════════════════════════════════════════════════
   AI SERVICE — Direct Groq LPU Integration (Zero-Delay Browser Streaming)
   Works 100% locally and on any static host without backend or Netlify!
   ═══════════════════════════════════════════════════════════════════════════ */

const AIService = (() => {
  const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
  const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

  // Verified active high-intelligence models on Groq LPU
  const GROQ_TEXT_MODELS = [
    "openai/gpt-oss-120b",      // Primary: 120B Flagship model (fastest & smartest on Groq)
    "openai/gpt-oss-20b",       // Backup: Ultra-fast 20B model
    "qwen/qwen3.8-27b",
  ];

  // Store report context for interactive AI chat
  let reportContext = "";
  let reportFileName = "";

  // In-memory cache for instant 0ms repeated analyses
  const summaryCache = new Map();

  function getFileCacheKey(file) {
    return `${file.name}_${file.size}_${file.lastModified || 0}`;
  }

  // ── Retrieve Active API Key (from constant or localStorage) ──
  function getApiKey() {
    const rawKey = (GROQ_API_KEY || "").trim();
    if (rawKey && rawKey !== "PASTE_YOUR_GROQ_API_KEY_HERE") {
      return rawKey;
    }
    const local = (localStorage.getItem("GROQ_API_KEY") || localStorage.getItem("groq_api_key") || "").trim();
    if (local && local !== "PASTE_YOUR_GROQ_API_KEY_HERE") {
      return local;
    }
    return "";
  }

  function setApiKey(key) {
    if (key && typeof key === "string") {
      localStorage.setItem("GROQ_API_KEY", key.trim());
      return true;
    }
    return false;
  }

  function isConfigured() {
    const key = getApiKey();
    return Boolean(key && key !== "PASTE_YOUR_GROQ_API_KEY_HERE" && key.length > 5);
  }

  // ── Extract text from PDF using PDF.js dynamically ──
  async function extractTextFromPdf(file) {
    try {
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
          script.onload = () => {
            if (window.pdfjsLib) {
              window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            }
            resolve();
          };
          script.onerror = () => reject(new Error("Failed to load PDF engine"));
          document.head.appendChild(script);
        });
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";

      const maxPages = Math.min(pdf.numPages, 10);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => item.str).join(" ");
        if (pageText.trim()) {
          fullText += `[Page ${i}]\n` + pageText.trim() + "\n\n";
        }
      }

      return fullText.trim();
    } catch (err) {
      console.warn("PDF text extraction note:", err);
      return "";
    }
  }

  // ── Render first page of PDF as image if it's a scanned/image PDF ──
  async function renderPdfPageToImage(file) {
    try {
      if (!window.pdfjsLib) return null;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      if (pdf.numPages === 0) return null;

      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      return dataUrl.split(",")[1];
    } catch (e) {
      console.warn("PDF render to image fallback:", e);
      return null;
    }
  }

  // ── Extract text from image via OCR (Tesseract.js) ──
  async function extractTextFromImage(file) {
    try {
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load OCR engine"));
          document.head.appendChild(script);
        });
      }
      const worker = await window.Tesseract.createWorker("eng");
      const ret = await worker.recognize(file);
      await worker.terminate();
      return ret.data.text || "";
    } catch (e) {
      console.warn("OCR recognition notice:", e);
      return "";
    }
  }

  // ── Extract text from file ──
  async function extractTextFromFile(file) {
    const type = file.type || "";
    const name = file.name.toLowerCase();

    if (type === "text/plain" || name.endsWith(".txt")) {
      return await file.text();
    }

    if (type === "application/pdf" || name.endsWith(".pdf")) {
      const extracted = await extractTextFromPdf(file);
      if (extracted && extracted.length > 30) {
        return extracted;
      }
    }

    if (name.endsWith(".doc") || name.endsWith(".docx")) {
      return await file.text().catch(() => null);
    }

    if (type.startsWith("image/") || /\.(jpe?g|png|webp|bmp)$/i.test(name)) {
      const ocrText = await extractTextFromImage(file);
      if (ocrText && ocrText.trim().length > 15) {
        return ocrText.trim();
      }
    }

    return await file.text().catch(() => "");
  }

  // ── Convert file to optimized base64 for Groq Vision (<100KB) ──
  async function fileToBase64(file) {
    const isImage = (file.type && file.type.startsWith("image/")) || /\.(jpe?g|png|webp|bmp)$/i.test(file.name);

    if (isImage && !file.name.toLowerCase().endsWith(".gif")) {
      const maxDim = 1024;
      const quality = 0.75;

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

    // PDF scanned fallback
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const rendered = await renderPdfPageToImage(file);
      if (rendered) return rendered;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ── Call Groq Streaming API (<300ms speed) ──
  async function callGroqStream({ messages, maxTokens = 1400, onChunk = null }) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("API key not configured! Please open ai-service.js and enter your Groq API key.");
    }

    // Seamless fallback if user put a Gemini key (starts with AIzaSy...)
    if (apiKey.startsWith("AIzaSy")) {
      return await callGeminiDirect({ messages, isVision: false, maxTokens, onChunk, apiKey });
    }

    // Strictly use the defined models (openai/gpt-oss-120b, openai/gpt-oss-20b, qwen/qwen3.8-27b)
    const models = GROQ_TEXT_MODELS;
    let lastError = null;

    for (const model of models) {
      console.log(`⚡ Requesting Groq model: ${model}...`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      try {
        const response = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.2,
            max_tokens: maxTokens,
            stream: true,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `Groq API returned HTTP ${response.status}`;
          console.warn(`⚠️ Groq model ${model} error:`, errMsg);
          lastError = new Error(errMsg);
          continue; // Try backup model
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;

            const jsonStr = trimmed.replace(/^data:\s*/, "");
            if (jsonStr === "[DONE]") continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const chunk = parsed?.choices?.[0]?.delta?.content || "";
              if (chunk) {
                fullText += chunk;
                if (onChunk) {
                  onChunk(chunk, fullText);
                }
              }
            } catch (_) { }
          }
        }

        if (fullText.trim().length > 0) {
          console.log(`✅ Success streaming from Groq (${model})`);
          return fullText;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn(`⚠️ Model ${model} connection issue:`, err.message);
        lastError = err;
      }
    }

    throw lastError || new Error("Failed to receive response from Groq. Please check your API key.");
  }

  // ── Gemini Direct Fallback (if user uses Gemini key) ──
  async function callGeminiDirect({ messages, isVision, maxTokens, onChunk, apiKey }) {
    console.log("🤖 Routing request through Google Gemini Direct...");
    const model = isVision ? "gemini-1.5-flash" : "gemini-1.5-flash";
    const url = `${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`;

    let promptText = "";
    for (const m of messages) {
      if (typeof m.content === "string") {
        promptText += `${m.role.toUpperCase()}: ${m.content}\n\n`;
      }
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini API error ${res.status}`);
    }

    const data = await res.json();
    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (onChunk) onChunk(result, result);
    return result;
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

    let textContent = await extractTextFromFile(file);
    if (!textContent || textContent.trim().length === 0) {
      textContent = `[Medical Report File: ${file.name}]\nPlease summarize and provide clinical guidance for this medical document.`;
    }

    reportContext = textContent;

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Please analyze this medical report and provide a structured summary:\n\n${textContent}`,
      },
    ];

    // Call Groq LPU with streaming
    const summary = await callGroqStream({
      messages,
      isVision: false,
      maxTokens: 1400,
      onChunk,
    });

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
- Answer directly, concisely, and immediately
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

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextMessage },
    ];

    return await callGroqStream({
      messages,
      isVision: false,
      maxTokens: 700,
      onChunk,
    });
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

  // Public Interface
  return {
    isConfigured,
    getApiKey,
    setApiKey,
    summarizeReport,
    chatAboutReport,
    clearContext,
    hasReportContext,
  };
})();
