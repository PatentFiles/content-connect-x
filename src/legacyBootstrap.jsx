import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// ── Theme initialisation: check localStorage first, then OS preference ──
// This runs synchronously before React mounts to prevent any flash.
const STORAGE_KEY = 'cc_theme';
const stored = localStorage.getItem(STORAGE_KEY);
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialTheme = stored ?? (prefersDark ? 'dark' : 'light');

if (initialTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

// Listen for OS changes only when the user hasn't set a manual preference
if (!stored) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)