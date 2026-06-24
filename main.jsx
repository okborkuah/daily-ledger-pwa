import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// ── Storage shim ─────────────────────────────────────────
// Replaces Claude's window.storage API with localStorage
// so the app works identically when deployed as a standalone PWA.
window.storage = {
  get: async (key) => {
    const value = localStorage.getItem(key)
    if (value === null) return null
    return { key, value }
  },
  set: async (key, value) => {
    localStorage.setItem(key, value)
    return { key, value }
  },
  delete: async (key) => {
    localStorage.removeItem(key)
    return { key, deleted: true }
  },
  list: async (prefix = '') => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix))
    return { keys }
  },
}

// ── Service Worker ────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.log('SW registration failed:', err))
  })
}

// ── Mount ─────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
