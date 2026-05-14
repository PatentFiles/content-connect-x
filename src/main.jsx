import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// ── System theme: auto-apply dark/light class based on prefers-color-scheme ──
// The app is dark-first, but we respect the OS preference.
// We add the `dark` class to <html> when the OS is in dark mode and remove it
// when the OS is in light mode, then listen for live changes.
function applySystemTheme(mq) {
  if (mq.matches) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

const darkMQ = window.matchMedia('(prefers-color-scheme: dark)');
// Apply immediately so there's no flash
applySystemTheme(darkMQ);
// Re-apply whenever the user changes their OS theme
darkMQ.addEventListener('change', applySystemTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)