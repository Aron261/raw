import React from 'react'
import ReactDOM from 'react-dom/client'
// Tipografía autoalojada: Archivo lo lleva todo (de la microcopia 500 al
// número héroe 900) y Space Mono solo los datos. Anton se retiró con el
// rediseño: dos familias de titular competían en la misma tarjeta.
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/700.css'
import '@fontsource/archivo/800.css'
import '@fontsource/archivo/900.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'
import App from './App.jsx'
import './index.css'

// Tras un deploy, una pestaña abierta puede pedir un chunk de ruta cuyo hash ya
// no existe; el fallback SPA le devuelve index.html y el import dinámico
// revienta en el ErrorBoundary como si fuera un bug. No lo es: la app nueva
// está a una recarga de distancia, así que se recarga sola una vez.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  const KEY = 'raw.chunkReloadAt'
  const last = Number(sessionStorage.getItem(KEY) || 0)
  if (Date.now() - last < 30_000) return   // sin bucles: una recarga cada 30 s
  sessionStorage.setItem(KEY, String(Date.now()))
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
