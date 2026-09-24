/* ═══════════════════════════════════════════
   AI Medical Report Summarizer - PWA Registration & Install Handler
   ═══════════════════════════════════════════ */

let deferredPrompt = null;

// ── 1. Early capture of beforeinstallprompt ──
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome from showing its mini-infobar automatically
  e.preventDefault();
  // Stash the event so the install button can trigger it
  deferredPrompt = e;
  console.log('PWA: Install prompt captured successfully');
  updateInstallButtons(true);
});

// ── 2. Register Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        console.log('PWA: Service Worker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('PWA: Service Worker registration note:', err);
      });
  });
}

// ── 3. App Installed Event Listener ──
window.addEventListener('appinstalled', () => {
  console.log('PWA: App successfully installed to device!');
  deferredPrompt = null;
  closePwaModal();
  alert('🎉 App successfully installed!');
});

function updateInstallButtons(isReady) {
  const buttons = document.querySelectorAll('#mainInstallBtn, [data-pwa-install]');
  buttons.forEach((btn) => {
    btn.classList.add('ready');
  });
}

// ── 4. Handle Install Click ──
function triggerPwaInstall() {
  // Check if already running inside installed standalone app
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) {
    alert('✅ App is already installed on your device!');
    return;
  }

  // Check if inside Hugging Face or any iframe
  const isIframe = window.self !== window.top;

  // If native prompt is ready (direct access on Android Chrome/Edge), prompt immediately!
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      console.log('User install choice:', choiceResult.outcome);
      if (choiceResult.outcome === 'accepted') {
        deferredPrompt = null;
        closePwaModal();
      }
    });
    return;
  }

  // If inside iframe or prompt is not yet ready, open modal
  openPwaModal(isIframe);
}

function openPwaModal(isIframe) {
  const modal = document.getElementById('pwaInstallModal');
  if (!modal) return;

  const iframeCard = document.getElementById('pwaStepIframe');
  const androidCard = document.getElementById('pwaStepAndroid');
  const iosCard = document.getElementById('pwaStepIos');

  if (isIframe && iframeCard) {
    iframeCard.style.display = 'block';
  } else if (iframeCard) {
    iframeCard.style.display = 'none';
  }

  // Detect iOS and style accordingly
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    if (iosCard) iosCard.style.borderColor = 'rgba(6, 214, 160, 0.4)';
    if (androidCard) androidCard.style.opacity = '0.6';
  } else {
    if (androidCard) androidCard.style.borderColor = 'rgba(59, 130, 246, 0.6)';
    if (iosCard) iosCard.style.opacity = '0.6';
  }

  modal.classList.add('active');
}

function closePwaModal() {
  const modal = document.getElementById('pwaInstallModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// ── 5. Setup Event Listeners on DOM Load ──
function initPwaButtons() {
  const installButtons = document.querySelectorAll('#mainInstallBtn, [data-pwa-install]');
  installButtons.forEach((btn) => {
    btn.removeEventListener('click', triggerPwaInstallHandler);
    btn.addEventListener('click', triggerPwaInstallHandler);
  });

  const modalCloseBtn = document.getElementById('pwaModalClose');
  if (modalCloseBtn) {
    modalCloseBtn.removeEventListener('click', closePwaModal);
    modalCloseBtn.addEventListener('click', closePwaModal);
  }

  const modalOverlay = document.getElementById('pwaInstallModal');
  if (modalOverlay) {
    modalOverlay.removeEventListener('click', modalOverlayClickHandler);
    modalOverlay.addEventListener('click', modalOverlayClickHandler);
  }
}

function triggerPwaInstallHandler(e) {
  e.preventDefault();
  triggerPwaInstall();
}

function modalOverlayClickHandler(e) {
  const modalOverlay = document.getElementById('pwaInstallModal');
  if (e.target === modalOverlay) closePwaModal();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPwaButtons);
} else {
  initPwaButtons();
}
