/* ═══════════════════════════════════════════
   AI SERVICE — Gemini API Integration
   API key is secured in Netlify serverless function
   ═══════════════════════════════════════════ */

const AIService = (() => {
  // ══════════════════════════════════════════
  // 🔒 API key is stored securely on the server
  // Set GEMINI_API_KEY in Netlify Environment Variables
  // ══════════════════════════════════════════
  const SERVERLESS_ENDPOINT = "/api/gemini";

  // Model configuration — fallback chain (tries each in order)
  const MODELS = [
    "gemini-3.8-flash",        // Latest GA — fastest & most capable
    "gemini-3.5-flash-lite",        // Frontier intelligence fallback
    "gemini-3.1-flash-lite",   // Efficient high-volume fallback
  ];

  // Retry configuration — optimized for fast response
  const MAX_RETRIES = 2;
  const BASE_DELAY_MS = 800; // 800ms fast retry delay

  // Store report context for chatbot
  let reportContext = "";
  let reportFileName = "";

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

  // ── Convert file to base64 (with fast client-side image compression for speed) ──
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      // If it's an image, resize it client-side to speed up upload & AI latency
      if (file.type && file.type.startsWith("image/") && file.type !== "image/gif") {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
          img.onload = () => {
            const maxDim = 1600;
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
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            resolve(dataUrl.split(",")[1]);
          };
          img.onerror = () => {
            resolve(e.target.result.split(",")[1]);
          };
          img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      // PDFs and text documents
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

  // ── Call Gemini API via serverless function with model fallback + retry ──
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
      temperature: 0.2,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 2048, // Reduced for much faster output generation
    };

    let lastError = null;

    // Try each model in the fallback chain
    for (const model of MODELS) {
      console.log(`🤖 Trying model: ${model}...`);

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Call our secure serverless function (API key is on the server)
          const response = await fetch(SERVERLESS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, requestBody }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData?.error?.message || `API error: ${response.status}`;
            const status = response.status;

            // Rate limit or overload — retry same model with quick backoff
            if ((status === 429 || status === 503) && attempt < MAX_RETRIES) {
              const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
              console.log(`⏳ ${model} busy (${status}). Retrying in ${delay / 1000}s... (attempt ${attempt}/${MAX_RETRIES})`);
              await sleep(delay);
              lastError = new Error(errorMsg);
              continue;
            }

            // Model not found or unavailable — skip to next model immediately
            if (status === 404 || status === 400) {
              console.log(`⚠️ ${model} unavailable (${status}). Trying next model...`);
              lastError = new Error(errorMsg);
              break;
            }

            if (status === 429 || status === 503) {
              console.log(`⚠️ ${model} still overloaded. Trying next model...`);
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
          return data.candidates[0].content.parts[0].text;

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

    throw lastError || new Error("All models failed. Please check your internet connection and try again.");
  }

  // ══════════════════════════════════════
  // PUBLIC: Summarize Report
  // ══════════════════════════════════════
  async function summarizeReport(file) {
    reportFileName = file.name;

    const systemPrompt = `You are an expert medical report analyzer. Your job is to read medical reports and provide clear, structured summaries for healthcare professionals.

IMPORTANT RULES:
- Be accurate, concise, and professional
- Highlight critical/abnormal values
- Use clear medical terminology with plain language explanations
- If you cannot read or understand part of the report, say so
- Never make up medical information

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
    let base64Data = null;

    if (textContent) {
      // Text-based file
      parts = [{ text: `Please analyze this medical report and provide a structured summary:\n\n${textContent}` }];
      reportContext = textContent;
    } else {
      // PDF or Image - send as inline data
      base64Data = await fileToBase64(file);
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
      // Immediately set initial context to avoid delay
      reportContext = `[Medical report from file: ${file.name}]`;
    }

    // Single fast API call to summarize
    const summary = await callGemini(parts, systemPrompt);

    // Set summary as chatbot context immediately so the user doesn't wait
    reportContext = summary;

    // Asynchronously extract deeper raw text in background (non-blocking)
    if (!textContent && base64Data) {
      const mimeType = getGeminiMimeType(file);
      const extractParts = [
        { text: "Extract ALL raw text content from this medical report. Return only the text:" },
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        },
      ];
      // Run in background without await so UI returns instantly
      callGemini(extractParts)
        .then((extracted) => {
          if (extracted) reportContext = extracted;
        })
        .catch(() => {
          // Keep summary as context
        });
    }

    return summary;
  }

  // ══════════════════════════════════════
  // PUBLIC: Chat about Report
  // ══════════════════════════════════════
  async function chatAboutReport(userMessage) {
    const systemPrompt = `You are a helpful medical AI assistant. A medical report has been uploaded and you have its content. Answer the user's questions based on the report data.

RULES:
- Answer based on the report content provided
- Be accurate and cite specific values from the report when possible
- If the question is not related to the report, politely redirect
- Explain medical terms in simple language when asked
- Never diagnose — only summarize and explain what the report says
- Keep answers concise but thorough
- Use bullet points for clarity when appropriate
- If you don't have enough information from the report, say so honestly`;

    let contextMessage = "";
    if (reportContext) {
      contextMessage = `UPLOADED REPORT CONTENT (File: ${reportFileName}):\n${reportContext}\n\n---\n\nUSER QUESTION: ${userMessage}`;
    } else {
      contextMessage = `No report has been uploaded yet.\n\nUSER QUESTION: ${userMessage}\n\nPlease let the user know they should upload a report first for specific answers, but answer general medical questions if you can.`;
    }

    const parts = [{ text: contextMessage }];
    return await callGemini(parts, systemPrompt);
  }

  // ══════════════════════════════════════
  // PUBLIC: Clear context
  // ══════════════════════════════════════
  function clearContext() {
    reportContext = "";
    reportFileName = "";
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
