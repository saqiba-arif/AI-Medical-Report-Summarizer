/* ═══════════════════════════════════════════
   AI Medical Report Summarizer - PWA Registration & Install Handler
   ═══════════════════════════════════════════ */

// ── 1. Register Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        console.log('PWA: Service Worker registered successfully', reg.scope);
      })
      .catch((err) => {
        console.log('PWA: Service Worker registration error', err);
      });
  });
}

// ── 2. Handle Install Prompt ──
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent mini-infobar on mobile
  e.preventDefault();
  deferredPrompt = e;

  // Show any elements configured for install prompt
  const installButtons = document.querySelectorAll('[data-pwa-install]');
  installButtons.forEach((btn) => {
    btn.style.display = 'inline-flex';
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('PWA install outcome:', outcome);
      deferredPrompt = null;
    });
  });
});

window.addEventListener('appinstalled', () => {
  console.log('PWA: App installed successfully on mobile device');
  deferredPrompt = null;
});
