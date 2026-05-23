// src/App.jsx
import React, { useState, useEffect, Suspense, lazy } from 'react';
import './App.css'; 
import './styles/style.css';
import './styles/responsive.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';

// Contextos
import { FichaProvider } from './contexts/FichaContext.jsx';

// Componentes Globais
import BackgroundDinamico from './components/BackgroundDinamico.jsx'; 
import BotaoEconomia from './components/BotaoEconomia.jsx'; // <--- IMPORTAÇÃO ADICIONADA

// Páginas - IMPORTAÇÃO OTIMIZADA (Lazy)
const Login = lazy(() => import('./pages/Login/index.jsx'));
const Verificacao = lazy(() => import('./pages/Verificacao/index.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard/index.jsx'));
const Ficha = lazy(() => import('./pages/Ficha/index.jsx'));
const Mesa = lazy(() => import('./pages/Mesa/index.jsx'));

// Firebase
import { db } from './lib/firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

// Componente de Carregamento Reutilizável
const TelaCarregamento = () => (
  <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#020406', color:'#fff', flexDirection: 'column', gap: '15px'}}>
      <img src="/assets/images/SimboloSemafinidade.webp" style={{width:'50px', opacity:0.5, animation: 'spin 2s linear infinite'}} alt="Carregando" />
      <span style={{fontFamily: 'monospace', fontSize: '0.8em', color: '#666'}}>CARREGANDO SISTEMA...</span>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

function App() {
  const { usuario, loading: authLoading, devVisualMode } = useAuth();
  
  const [verificandoNome, setVerificandoNome] = useState(true);
  const [precisaNome, setPrecisaNome] = useState(false);
  const [novoNomeInput, setNovoNomeInput] = useState('');

  // --- EFEITO: VERIFICAR NOME ---
  useEffect(() => {
    if (authLoading) return;
    if (!usuario) {
        setVerificandoNome(false);
        return;
    }
    if (devVisualMode) {
        setPrecisaNome(false);
        setVerificandoNome(false);
        return;
    }

    async function checarNome() {
        setVerificandoNome(true);
        try {
            const userDocRef = doc(db, "users", usuario.uid);
            const docSnap = await getDoc(userDocRef);
            
            if (!docSnap.exists() || !docSnap.data()?.nomeDefinido) {
                setPrecisaNome(true);
                setNovoNomeInput('');
            } else {
                setPrecisaNome(false);
            }
        } catch (e) {
            console.error("Erro ao verificar nome:", e);
            setPrecisaNome(true);
        }
        setVerificandoNome(false);
    }
    checarNome();
  }, [usuario, authLoading, devVisualMode]);

  // --- SALVAR NOME ---
  const salvarNomePerfil = async (e) => {
      e.preventDefault();
      if (!novoNomeInput || !novoNomeInput.trim()) return alert("Nome inválido.");
      
      try {
          await updateProfile(usuario, { displayName: novoNomeInput.trim() });
          await setDoc(doc(db, "users", usuario.uid), { 
              nomeDefinido: true,
              nome: novoNomeInput.trim(),
              email: usuario.email
          }, { merge: true });
          setPrecisaNome(false);
          window.location.reload(); 
      } catch (err) {
          alert("Erro: " + err.message);
      }
  };

  // 1. Loading Inicial (Auth)
  if (authLoading || (usuario && verificandoNome)) {
      return <TelaCarregamento />;
  }

  // 2. Login (Fundo próprio)
  if (!usuario) {
      return (
        <Suspense fallback={<TelaCarregamento />}>
            {/* Botão de economia disponível no Login também */}
            <BotaoEconomia /> 
            <Login />
        </Suspense>
      );
  }

  // 3. Bloqueio de Nome
  if (precisaNome) {
      return (
        <div className="login-container">
            <BotaoEconomia />
            <div className="box login-box">
                <h2 style={{color: 'var(--cor-destaque)'}}>CRIAÇÃO DE PERFIL</h2>
                <p style={{marginBottom: '20px', color: '#ccc'}}>Defina seu <strong>Nome de Usuário</strong>.</p>
                <form onSubmit={salvarNomePerfil} className="login-actions">
                    <div className="input-group">
                        <input type="text" placeholder="Seu apelido" value={novoNomeInput} onChange={e => setNovoNomeInput(e.target.value)} required autoFocus />
                    </div>
                    <button className="btn-login primary" type="submit">SALVAR</button>
                </form>
            </div>
        </div>
      );
  }

  // 4. Verificação de E-mail
  if (!usuario.emailVerified) {
      return (
        <Suspense fallback={<TelaCarregamento />}>
            <BotaoEconomia />
            <Verificacao />
        </Suspense>
      );
  }

  // --- APP PRINCIPAL ---
  return (
      <>
        {/* Adiciona o fundo dinâmico atrás de tudo */}
        <BackgroundDinamico />
        
        {/* Adiciona o botão flutuante de economia */}
        <BotaoEconomia />
        
        {/* Suspense envolve todas as rotas para mostrar carregamento na troca de página */}
        <Suspense fallback={<TelaCarregamento />}>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/mesa/:mesaId" element={<Mesa />} />
                <Route path="/ficha/:fichaId" element={
                <FichaProvider>
                    <div className='ficha-wrapper'>
                        <Ficha />
                    </div>
                </FichaProvider>
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
      </>
  );
}

export default App;
