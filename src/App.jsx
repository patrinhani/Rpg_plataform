// src/App.jsx
import React, { useState } from 'react';
import './App.css'; 
import './styles/style.css';
import './styles/responsive.css';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login/index.jsx'; 
import Verificacao from './pages/Verificacao/index.jsx';
import Dashboard from './pages/Dashboard/index.jsx';
import Ficha from './pages/Ficha/index.jsx';
import Mesa from './pages/Mesa/index.jsx';

function App() {
  const { usuario } = useAuth();
  
  const [view, setView] = useState('dashboard'); 
  const [mesaAtiva, setMesaAtiva] = useState(null);
  const [fichaPessoalId, setFichaPessoalId] = useState(null); 

  if (!usuario) return <Login />;
  if (!usuario.isAnonymous && !usuario.emailVerified) return <Verificacao />;

  // Navegação
  const irParaMesa = (id) => { setMesaAtiva(id); setView('mesa'); };
  const irParaFichaPessoal = (id) => { setFichaPessoalId(id); setView('ficha_pessoal'); };
  const voltarDashboard = () => { setView('dashboard'); setMesaAtiva(null); setFichaPessoalId(null); };

  // RENDERIZAÇÃO

  // 1. MESA (Agora ela gerencia suas próprias fichas internamente)
  if (view === 'mesa' && mesaAtiva) {
    return <Mesa mesaId={mesaAtiva} onVoltar={voltarDashboard} />;
  }

  // 2. FICHA PESSOAL (Offline)
  if (view === 'ficha_pessoal') {
    return (
      <div>
        <button onClick={voltarDashboard} className="btn-voltar-flutuante">← Voltar</button>
        <Ficha fichaId={fichaPessoalId} />
      </div>
    );
  }

  // 3. DASHBOARD
  return <Dashboard onSelectFicha={irParaFichaPessoal} onSelectMesa={irParaMesa} />;
}

export default App;