// src/App.jsx
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';

// Contextos
import { FichaProvider } from './contexts/FichaContext.jsx';

// Componentes Globais
import BackgroundDinamico from './components/BackgroundDinamico.jsx'; 
import AuthShell from './components/AuthShell.jsx';
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
  <div className="app-loading-screen" role="status" aria-live="polite">
      <img src="/assets/images/SimboloSemafinidade.webp" alt="" aria-hidden="true" />
      <span>Carregando sistema...</span>
  </div>
);

function App() {
  const { usuario, loading: authLoading, devVisualMode } = useAuth();
  
  const [verificandoNome, setVerificandoNome] = useState(true);
  const [precisaNome, setPrecisaNome] = useState(false);
  const [novoNomeInput, setNovoNomeInput] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [erroNome, setErroNome] = useState('');

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
                setNovoNomeInput(usuario.displayName || '');
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
      const nome = novoNomeInput.trim();
      if (!nome) {
          setErroNome('Digite o nome que será exibido nas suas fichas e mesas.');
          return;
      }

      setSalvandoNome(true);
      setErroNome('');
      try {
          await updateProfile(usuario, { displayName: nome });
          await setDoc(doc(db, "users", usuario.uid), { 
              nomeDefinido: true,
              nome,
              email: usuario.email
          }, { merge: true });
          setPrecisaNome(false);
      } catch (err) {
          setErroNome(`Não foi possível salvar o perfil: ${err.message}`);
      } finally {
          setSalvandoNome(false);
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
        <>
            <BotaoEconomia />
            <AuthShell
              eyebrow="Configuração inicial"
              title="Defina seu nome"
              description="Esse nome identifica você para os demais agentes e mestres dentro do sistema."
              variant="profile"
              status={salvandoNome ? 'Gravando perfil...' : 'Perfil pendente'}
            >
                {erroNome && <p className="auth-message auth-message--error" role="alert">{erroNome}</p>}
                <form onSubmit={salvarNomePerfil} className="auth-form">
                    <label className="auth-field" htmlFor="profile-display-name">
                        <span>Nome do agente</span>
                        <input
                          id="profile-display-name"
                          type="text"
                          placeholder="Seu nome ou apelido"
                          value={novoNomeInput}
                          onChange={(event) => setNovoNomeInput(event.target.value)}
                          required
                          autoFocus
                          autoComplete="nickname"
                        />
                        <small className="auth-field__hint">Você poderá usar o nome adotado pela sua mesa.</small>
                    </label>
                    <button className="auth-button auth-button--primary" type="submit" disabled={salvandoNome}>
                      {salvandoNome ? 'Salvando...' : 'Confirmar identidade'}
                    </button>
                </form>
            </AuthShell>
        </>
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
