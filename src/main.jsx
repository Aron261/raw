import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted type system: Anton (display), Archivo (body/numerals), Space Mono (data)
import '@fontsource/anton/400.css'
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
