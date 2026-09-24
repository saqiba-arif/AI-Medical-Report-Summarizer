/* ═══════════════════════════════════════════
   AI Medical Report Summarizer - PWA Registration & Install Handler
   ═══════════════════════════════════════════ */

let deferredPrompt = null;

// ── 1. Register Service Worker ──
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

// ── 2. Capture beforeinstallprompt ──
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('PWA: Install prompt captured');
  updateInstallButtons(true);
});

window.addEventListener('appinstalled', () => {
  console.log('PWA: App successfully installed!');
  deferredPrompt = null;
  const modal = document.getElementById('pwaInstallModal');
  if (modal) modal.classList.remove('active');
  alert('🎉 AI Medical Report Summarizer has been installed on your device!');
});

function updateInstallButtons(isReady) {
  const buttons = document.querySelectorAll('#mainInstallBtn, [data-pwa-install]');
  buttons.forEach((btn) => {
    btn.classList.add('ready');
  });
}

// ── 3. Handle Install Click ──
function triggerPwaInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      console.log('User install choice:', choiceResult.outcome);
      if (choiceResult.outcome === 'accepted') {
        deferredPrompt = null;
      }
    });
  } else {
    // If native prompt is not available, show guide modal
    openPwaModal();
  }
}

function openPwaModal() {
  const modal = document.getElementById('pwaInstallModal');
  if (modal) {
    modal.classList.add('active');
  }
}

function closePwaModal() {
  const modal = document.getElementById('pwaInstallModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// ── 4. Setup Event Listeners on DOM Load ──
document.addEventListener('DOMContentLoaded', () => {
  const installButtons = document.querySelectorAll('#mainInstallBtn, [data-pwa-install]');
  installButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      triggerPwaInstall();
    });
  });

  const modalCloseBtn = document.getElementById('pwaModalClose');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closePwaModal);
  }

  const modalOverlay = document.getElementById('pwaInstallModal');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closePwaModal();
    });
  }

  // Detect iOS and highlight iPhone steps
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIOS) {
    const iosCard = document.getElementById('pwaStepIos');
    const androidCard = document.getElementById('pwaStepAndroid');
    if (iosCard) iosCard.style.borderColor = 'rgba(6, 214, 160, 0.4)';
    if (androidCard) androidCard.style.opacity = '0.7';
  }
});
