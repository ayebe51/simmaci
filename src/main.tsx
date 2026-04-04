// ── Self-Healing: Clear corrupted storage before anything else ──
(function() {
  const USER_KEY = 'user_data';
  const raw = localStorage.getItem(USER_KEY);
  if (raw === 'undefined' || raw === 'null') {
    console.warn('SIMMACI: Corrupted user_data detected, clearing storage...');
    localStorage.removeItem(USER_KEY);
  }
})();

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
