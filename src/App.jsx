// src/App.jsx
import React, { useState } from 'react';
import './App.css'; 
import './styles/style.css';
import './styles/responsive.css';

import { useAuth } from './contexts/AuthContext';

// Importação das Páginas
import Login from './pages/Login/index.jsx'; 
import Verificacao from './pages/Verificacao/index.jsx';
import Dashboard from './pages/Dashboard/index.jsx';
import Ficha from './pages/Ficha/index.jsx';
import Mesa from './pages/Mesa/index.jsx';

function App() {
  const { usuario } = useAuth();
  
  // Estado de Navegação
  const [view, setView] = useState('dashboard'); // 'dashboard', 'mesa', 'ficha'
  const [mesaAtiva, setMesaAtiva] = useState(null);
  const [fichaAtivaId, setFichaAtivaId] = useState(null); 

  // 1. Se não tem usuário, exibe LOGIN
  if (!usuario) {
    return <Login />;
  }

  // 2. Se tem usuário mas não verificou e-mail (e não é anônimo), exibe VERIFICAÇÃO
  if (!usuario.isAnonymous && !usuario.emailVerified) {
    return <Verificacao />;
  }

  // --- FUNÇÕES DE NAVEGAÇÃO ---

  const handleSelectMesa = (idMesa) => {
    setMesaAtiva(idMesa);
    setView('mesa');
  };

  const handleSelectFicha = (uidFicha, idMesaContexto = null) => {
    setFichaAtivaId(uidFicha);
    setMesaAtiva(idMesaContexto);
    setView('ficha');
  };

  const handleVoltar = () => {
    if (view === 'ficha' && mesaAtiva) {
      // Se estava na ficha de uma mesa, volta para a mesa
      setView('mesa'); 
    } else {
      // Caso contrário, volta para o dashboard
      setView('dashboard'); 
      setMesaAtiva(null);
      setFichaAtivaId(null);
    }
  };

  // --- RENDERIZAÇÃO DAS TELAS ---

  // CASO 1: FICHA (Editando Personagem)
  if (view === 'ficha') {
    return (
      <div>
        <button 
          onClick={handleVoltar}
          style={{
              position: 'fixed', 
              top: '15px', 
              left: '15px', 
              zIndex: 2000,
              fontSize: '0.8em',
              padding: '5px 10px',
              background: '#000',
              border: '1px solid var(--cor-borda)',
              color: '#fff',
              cursor: 'pointer'
          }}
        >
          ← Voltar
        </button>
        
        <Ficha 
            fichaId={fichaAtivaId} 
            mesaContexto={mesaAtiva} 
        />
      </div>
    );
  }

  // CASO 2: MESA (Lobby da Mesa)
  if (view === 'mesa' && mesaAtiva) {
    return (
        <Mesa 
            mesaId={mesaAtiva} 
            onVoltar={() => { setView('dashboard'); setMesaAtiva(null); }}
            onAbrirFichaNaMesa={(mId) => handleSelectFicha(usuario.uid, mId)}
        />
    );
  }

  // CASO 3: DASHBOARD (Padrão)
  return (
    <Dashboard 
        onSelectFicha={(uid) => handleSelectFicha(uid, null)} 
        onSelectMesa={handleSelectMesa} 
    />
  );
}

// AQUI ESTAVA O ERRO: A exportação é obrigatória!
export default App;