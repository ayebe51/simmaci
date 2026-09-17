// ── Self-Healing: Clear corrupted storage before anything else ──
(function() {
  const USER_KEY = 'user_data';
  const raw = localStorage.getItem(USER_KEY);
  if (raw === 'undefined' || raw === 'null') {
    console.warn('SIMMACI: Corrupted user_data detected, clearing storage...');
    localStorage.removeItem(USER_KEY);
  }
})();

// ── Auto-recover from dynamic import chunk mismatches after redeploy ──
window.addEventListener('vite:preloadError', (event) => {
  const reloadKey = 'simmaci_preload_reload';
  const lastReload = sessionStorage.getItem(reloadKey);
  const now = Date.now();
  
  // Anti-loop: Allow at most 1 automatic reload attempt within 30 seconds
  if (!lastReload || now - parseInt(lastReload, 10) > 30000) {
    sessionStorage.setItem(reloadKey, String(now));
    console.warn('SIMMACI: Versi aplikasi baru terdeteksi via preloadError. Memuat ulang halaman...');
    
    // Check if user is actively typing or inside a modal
    const activeEl = document.activeElement;
    const isTyping = activeEl && (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName) || activeEl.getAttribute('contenteditable') === 'true');
    const isModalOpen = !!document.querySelector('[role="dialog"], [role="alertdialog"]');

    if (!isTyping && !isModalOpen) {
      window.location.reload();
    } else {
      console.warn('SIMMACI: Pengguna sedang aktif. Menunda reload otomatis preloadError...');
    }
  } else {
    console.warn('SIMMACI: Preload error berulang dalam 30 detik. Menghentikan reload untuk mencegah infinite loop.');
  }
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import './index.css'
import App from './App.tsx'

Sentry.init({
  dsn: "https://7264a06587c65306915112521c7ba1f1@o4508930438103040.ingest.us.sentry.io/4508930452390400",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
