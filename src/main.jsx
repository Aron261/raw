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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
