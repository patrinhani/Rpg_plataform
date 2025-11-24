// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// CSS
import './styles/style.css'
import './styles/responsive.css'

import { AuthProvider } from './contexts/AuthContext';

// ATENÇÃO: StrictMode removido para estabilizar a autenticação
ReactDOM.createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
)