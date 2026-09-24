/* ═══════════════════════════════════════════
   DASHBOARD — AI Report Analyzer & Chatbot
   ═══════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  // ── DOM Elements ──
  const reportInput = document.getElementById("reportInput");
  const uploadBox = document.getElementById("uploadBox");
  const uploadedFile = document.getElementById("uploadedFile");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const summaryPanel = document.getElementById("summaryPanel");
  const summaryEmpty = document.getElementById("summaryEmpty");
  const summaryLoading = document.getElementById("summaryLoading");
  const summaryBox = document.getElementById("summaryBox");
  const summaryError = document.getElementById("summaryError");
  const errorMessage = document.getElementById("errorMessage");
  const loadingText = document.getElementById("loadingText");
  const loadingBarFill = document.getElementById("loadingBarFill");
  const regenerateBtn = document.getElementById("regenerateBtn");
  const copySummaryBtn = document.getElementById("copySummaryBtn");
  const retryBtn = document.getElementById("retryBtn");
  const clearAllBtn = document.getElementById("clearAllBtn");
  const apiKeyBanner = document.getElementById("apiKeyBanner");
  const closeBanner = document.getElementById("closeBanner");

  // Chat elements
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const chatBox = document.getElementById("chatBox");
  const chatLauncher = document.getElementById("chatLauncher");
  const chatDrawer = document.getElementById("chatDrawer");
  const closeChat = document.getElementById("closeChat");
  const chatStatus = document.getElementById("chatStatus");
  const chatStatusText = document.getElementById("chatStatusText");
  const chatChips = document.getElementById("chatChips");
  const chatSendBtn = document.getElementById("chatSendBtn");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const chatBadge = document.getElementById("chatBadge");
  const navAIAssistant = document.getElementById("navAIAssistant");

  // State
  let currentFile = null;
  let isAnalyzing = false;
  let isChatting = false;

  // ══════════════════════════════════
  // API Key Banner
  // ══════════════════════════════════
  const bannerApiKeyInput = document.getElementById("bannerApiKeyInput");
  const bannerSaveKeyBtn = document.getElementById("bannerSaveKeyBtn");

  if (apiKeyBanner) {
    if (AIService.isConfigured()) {
      apiKeyBanner.style.display = "none";
    }
  }

  if (bannerSaveKeyBtn && bannerApiKeyInput) {
    bannerSaveKeyBtn.addEventListener("click", () => {
      const val = bannerApiKeyInput.value.trim();
      if (!val) {
        alert("Please enter a valid Groq API key (starts with gsk_...)");
        return;
      }
      AIService.setApiKey(val);
      apiKeyBanner.style.display = "none";
      alert("✅ Groq API Key successfully saved!");
    });
  }

  if (closeBanner) {
    closeBanner.addEventListener("click", () => {
      apiKeyBanner.style.display = "none";
    });
  }

  // ══════════════════════════════════
  // File Upload
  // ══════════════════════════════════
  if (reportInput) {
    reportInput.addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      currentFile = file;

      // Show file info
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const fileIcon = getFileIcon(file.type);

      uploadedFile.innerHTML = `
        <div class="file-info">
          <span class="file-icon">${fileIcon}</span>
          <div class="file-details">
            <span class="file-name">${file.name}</span>
            <span class="file-size">${sizeMB} MB • ${getFileType(file)}</span>
          </div>
          <button class="file-remove" id="removeFile" type="button">✕</button>
        </div>
      `;

      // Enable analyze button
      analyzeBtn.disabled = false;
      analyzeBtn.classList.add("ready");

      // Add remove handler
      document.getElementById("removeFile").addEventListener("click", () => {
        clearFile();
      });

      // Change upload box appearance
      uploadBox.classList.add("has-file");
    });
  }

  // Drag and drop
  if (uploadBox) {
    uploadBox.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadBox.classList.add("drag-over");
    });

    uploadBox.addEventListener("dragleave", () => {
      uploadBox.classList.remove("drag-over");
    });

    uploadBox.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadBox.classList.remove("drag-over");
      const file = e.dataTransfer.files[0];
      if (file) {
        // Create a new DataTransfer and set the file
        const dt = new DataTransfer();
        dt.items.add(file);
        reportInput.files = dt.files;
        reportInput.dispatchEvent(new Event("change"));
      }
    });
  }

  function clearFile() {
    currentFile = null;
    reportInput.value = "";
    uploadedFile.innerHTML = "";
    analyzeBtn.disabled = true;
    analyzeBtn.classList.remove("ready");
    uploadBox.classList.remove("has-file");
  }

  function getFileIcon(type) {
    if (type === "application/pdf") return "📕";
    if (type.startsWith("image/")) return "🖼️";
    if (type.includes("doc")) return "📘";
    return "📄";
  }

  function getFileType(file) {
    const type = file.type;
    if (type === "application/pdf") return "PDF Document";
    if (type === "image/png") return "PNG Image";
    if (type === "image/jpeg") return "JPEG Image";
    if (type === "image/webp") return "WebP Image";
    if (type.includes("doc")) return "Word Document";
    if (type === "text/plain") return "Text File";
    return "Document";
  }

  // ══════════════════════════════════
  // Analyze Report with AI
  // ══════════════════════════════════
  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", () => {
      if (currentFile && !isAnalyzing) {
        analyzeReport(currentFile);
      }
    });
  }

  async function analyzeReport(file) {
    if (!AIService.isConfigured()) {
      showError("API key not configured. Open ai-service.js and paste your Groq API key.");
      return;
    }

    isAnalyzing = true;
    showLoading();

    let hasStreamStarted = false;

    // Fast loading progression
    const loadingMessages = [
      "AI is reading your medical report...",
      "Extracting key clinical data...",
      "Analyzing lab values and findings...",
      "Generating structured summary...",
    ];

    let msgIndex = 0;
    const loadingInterval = setInterval(() => {
      msgIndex++;
      if (msgIndex < loadingMessages.length && !hasStreamStarted) {
        loadingText.textContent = loadingMessages[msgIndex];
        loadingBarFill.style.width = `${((msgIndex + 1) / loadingMessages.length) * 85}%`;
      }
    }, 1200);

    try {
      const summary = await AIService.summarizeReport(file, (chunk, full) => {
        if (!hasStreamStarted) {
          hasStreamStarted = true;
          clearInterval(loadingInterval);
          summaryLoading.style.display = "none";
          summaryEmpty.style.display = "none";
          summaryError.style.display = "none";
          summaryBox.style.display = "block";
          regenerateBtn.style.display = "none";
          copySummaryBtn.style.display = "none";
          summaryPanel.classList.remove("analyzing");
          summaryPanel.classList.add("has-summary");
        }
        summaryBox.innerHTML = formatSummary(full) + '<span class="streaming-cursor"></span>';
      });

      clearInterval(loadingInterval);
      showSummary(summary);

      // Update chat status
      updateChatStatus(true, file.name);

    } catch (error) {
      clearInterval(loadingInterval);
      console.error("Analysis error:", error);
      showError(error.message);
    } finally {
      isAnalyzing = false;
    }
  }

  // ── UI State Functions ──
  function showLoading() {
    summaryEmpty.style.display = "none";
    summaryBox.style.display = "none";
    summaryError.style.display = "none";
    summaryLoading.style.display = "flex";
    regenerateBtn.style.display = "none";
    copySummaryBtn.style.display = "none";
    loadingBarFill.style.width = "10%";
    loadingText.textContent = "AI is reading your medical report...";
    summaryPanel.classList.add("analyzing");
  }

  function showSummary(summaryText) {
    summaryLoading.style.display = "none";
    summaryEmpty.style.display = "none";
    summaryError.style.display = "none";
    summaryBox.style.display = "block";
    regenerateBtn.style.display = "inline-flex";
    copySummaryBtn.style.display = "inline-flex";
    summaryPanel.classList.remove("analyzing");
    summaryPanel.classList.add("has-summary");

    // Convert markdown-like formatting to HTML
    const html = formatSummary(summaryText);
    summaryBox.innerHTML = html;

    // Animate in
    summaryBox.classList.add("fade-in");
    setTimeout(() => summaryBox.classList.remove("fade-in"), 600);
  }

  function showError(message) {
    summaryLoading.style.display = "none";
    summaryEmpty.style.display = "none";
    summaryBox.style.display = "none";
    summaryError.style.display = "flex";
    errorMessage.textContent = message;
    summaryPanel.classList.remove("analyzing");
  }

  function showEmpty() {
    summaryLoading.style.display = "none";
    summaryBox.style.display = "none";
    summaryError.style.display = "none";
    summaryEmpty.style.display = "flex";
    regenerateBtn.style.display = "none";
    copySummaryBtn.style.display = "none";
    summaryPanel.classList.remove("analyzing", "has-summary");
  }

  // Format AI summary text to HTML
  function formatSummary(text) {
    let html = text;

    // Escape HTML first
    html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // Bold **text**
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Headers with emojis (like 🏥 **Patient Overview**)
    html = html.replace(
      /^([\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}])\s*(.+)$/gmu,
      '<div class="summary-section"><span class="section-emoji">$1</span><h3 class="section-title">$2</h3></div>'
    );

    // Bullet points
    html = html.replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>');
    // Wrap consecutive <li> in <ul>
    html = html.replace(/((<li>.*<\/li>\s*)+)/g, '<ul class="summary-list">$1</ul>');

    // Paragraphs (double newlines)
    html = html.replace(/\n\n/g, "</p><p>");

    // Single newlines within paragraphs
    html = html.replace(/\n/g, "<br>");

    // Wrap in paragraph if not already
    if (!html.startsWith("<")) {
      html = "<p>" + html + "</p>";
    }

    return `<div class="summary-formatted">${html}</div>`;
  }

  // ── Regenerate ──
  if (regenerateBtn) {
    regenerateBtn.addEventListener("click", () => {
      if (currentFile && !isAnalyzing) {
        analyzeReport(currentFile);
      }
    });
  }

  // ── Copy Summary ──
  if (copySummaryBtn) {
    copySummaryBtn.addEventListener("click", () => {
      const text = summaryBox.innerText;
      navigator.clipboard.writeText(text).then(() => {
        copySummaryBtn.innerHTML = "✓ Copied!";
        setTimeout(() => {
          copySummaryBtn.innerHTML = "📋 Copy";
        }, 2000);
      });
    });
  }

  // ── Retry ──
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      if (currentFile) {
        analyzeReport(currentFile);
      }
    });
  }

  // ── Clear All ──
  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      clearFile();
      showEmpty();
      AIService.clearContext();
      updateChatStatus(false);
      clearChatMessages();
    });
  }

  // ══════════════════════════════════
  // Chat
  // ══════════════════════════════════

  // Toggle chat drawer
  if (chatLauncher && chatDrawer) {
    chatLauncher.addEventListener("click", () => {
      chatDrawer.classList.toggle("open");
      if (chatBadge) chatBadge.style.display = "none";
    });
  }

  // Close chat
  if (closeChat && chatDrawer) {
    closeChat.addEventListener("click", () => {
      chatDrawer.classList.remove("open");
    });
  }

  // Open chat from nav
  if (navAIAssistant) {
    navAIAssistant.addEventListener("click", (e) => {
      e.preventDefault();
      chatDrawer.classList.add("open");
    });
  }

  // Update chat status
  function updateChatStatus(hasReport, fileName = "") {
    if (hasReport) {
      chatStatusText.textContent = `Report loaded: ${fileName}`;
      chatStatus.classList.add("active");
      // Show badge on chat launcher
      if (chatBadge && !chatDrawer.classList.contains("open")) {
        chatBadge.style.display = "inline";
      }
    } else {
      chatStatusText.textContent = "No report loaded";
      chatStatus.classList.remove("active");
    }
  }

  // Chat form submit
  if (chatForm) {
    chatForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const message = chatInput.value.trim();
      if (!message || isChatting) return;

      await sendChatMessage(message);
    });
  }

  // Quick action chips
  if (chatChips) {
    chatChips.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", async () => {
        const message = chip.dataset.msg;
        if (message && !isChatting) {
          await sendChatMessage(message);
        }
      });
    });
  }

  // Clear chat
  if (clearChatBtn) {
    clearChatBtn.addEventListener("click", () => {
      clearChatMessages();
    });
  }

  function clearChatMessages() {
    chatBox.innerHTML = `
      <div class="message bot">
        <div class="message-avatar">✦</div>
        <div class="message-content">
          <p>Hello! I'm your medical AI assistant. Upload a report and I can answer questions about it.</p>
        </div>
      </div>
    `;
  }

  // Helper to append a bot message container for streaming
  function appendBotMessagePlaceholder() {
    const el = document.createElement("div");
    el.className = "message bot";
    el.innerHTML = `
      <div class="message-avatar">✦</div>
      <div class="message-content"></div>
    `;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
    return el;
  }

  // Send chat message with live token streaming
  async function sendChatMessage(message) {
    if (!AIService.isConfigured()) {
      appendBotMessage("⚠️ API key not configured. Please open <code>ai-service.js</code> and paste your Groq API key.");
      return;
    }

    isChatting = true;
    chatInput.value = "";
    chatSendBtn.disabled = true;

    // Add user message
    appendUserMessage(message);

    // Show typing indicator initially
    const typingEl = showTypingIndicator();
    let botMsgEl = null;

    try {
      const response = await AIService.chatAboutReport(message, (chunk, full) => {
        if (typingEl && typingEl.parentNode) {
          removeTypingIndicator(typingEl);
        }
        if (!botMsgEl) {
          botMsgEl = appendBotMessagePlaceholder();
        }
        botMsgEl.querySelector(".message-content").innerHTML = formatChatResponse(full) + '<span class="streaming-cursor"></span>';
        chatBox.scrollTop = chatBox.scrollHeight;
      });

      if (typingEl && typingEl.parentNode) {
        removeTypingIndicator(typingEl);
      }
      if (botMsgEl) {
        botMsgEl.querySelector(".message-content").innerHTML = formatChatResponse(response);
      } else {
        appendBotMessage(formatChatResponse(response));
      }
      chatBox.scrollTop = chatBox.scrollHeight;
    } catch (error) {
      if (typingEl && typingEl.parentNode) {
        removeTypingIndicator(typingEl);
      }
      appendBotMessage(`⚠️ Error: ${error.message}. Please try again.`);
    } finally {
      isChatting = false;
      chatSendBtn.disabled = false;
      chatInput.focus();
    }
  }

  function appendUserMessage(text) {
    const el = document.createElement("div");
    el.className = "message user";
    el.innerHTML = `
      <div class="message-content">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function appendBotMessage(html) {
    const el = document.createElement("div");
    el.className = "message bot";
    el.innerHTML = `
      <div class="message-avatar">✦</div>
      <div class="message-content">
        ${html}
      </div>
    `;
    chatBox.appendChild(el);

    // Animate in
    el.classList.add("message-enter");
    setTimeout(() => el.classList.remove("message-enter"), 400);

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  function showTypingIndicator() {
    const el = document.createElement("div");
    el.className = "message bot typing-indicator";
    el.innerHTML = `
      <div class="message-avatar">✦</div>
      <div class="message-content">
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    chatBox.appendChild(el);
    chatBox.scrollTop = chatBox.scrollHeight;
    return el;
  }

  function removeTypingIndicator(el) {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  function formatChatResponse(text) {
    let html = escapeHtml(text);
    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Bullet points
    html = html.replace(/^[-•]\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/((<li>.*<\/li>\s*)+)/g, '<ul class="chat-list">$1</ul>');
    // Line breaks
    html = html.replace(/\n/g, "<br>");
    return `<p>${html}</p>`;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
});
