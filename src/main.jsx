import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// 1. Importe seus novos arquivos de CSS aqui
import './styles/style.css'
import './styles/responsive.css'

// 2. O resto do arquivo permanece como o Vite o criou
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)