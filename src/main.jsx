// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

// CSS
import './styles/style.css'
import './styles/responsive.css'

import { AuthProvider } from './contexts/AuthContext';
import { DialogProvider } from './contexts/DialogContext'; // [NOVO] Importar Contexto
import SystemDialog from './components/SystemDialog';       // [NOVO] Importar Componente Visual

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        {/* O DialogProvider envolve o App inteiro agora */}
        <DialogProvider>
          <SystemDialog /> {/* O diálogo fica disponível globalmente */}
          <App />
        </DialogProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)