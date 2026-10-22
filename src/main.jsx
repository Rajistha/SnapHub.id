import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Setelah deploy baru, tab lama bisa meminta file yang sudah diganti. Muat ulang satu kali saja.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('chunkReloaded')) return
  sessionStorage.setItem('chunkReloaded', '1')
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
