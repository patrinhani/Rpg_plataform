// src/main.jsx
import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// CSS
import './App.css'

const AuthenticatedAppShell = lazy(() => import('./AuthenticatedAppShell.jsx'))
const StandaloneVtt = lazy(() => import('./features/vtt-lab/VttLabIntegrated.jsx'))
const isStandaloneVtt = /^\/vtt-lab\/?$/.test(window.location.pathname)

const entryLoading = (
  <div className="app-loading-screen" role="status" aria-live="polite">
    <img src="/assets/images/optimized/SimboloSemafinidade-320.webp" alt="" aria-hidden="true" />
    <span>Carregando sistema...</span>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={entryLoading}>
        {isStandaloneVtt ? <StandaloneVtt /> : <AuthenticatedAppShell />}
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>
)
