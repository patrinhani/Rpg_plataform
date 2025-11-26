// src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css'; 
import './styles/style.css';
import './styles/responsive.css';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'; // Importar Rotas e Hooks
import { useAuth } from './contexts/AuthContext';

// Páginas
import Login from './pages/Login/index.jsx'; 
import Verificacao from './pages/Verificacao/index.jsx';
import Dashboard from './pages/Dashboard/index.jsx';
import Ficha from './pages/Ficha/index.jsx';
import Mesa from './pages/Mesa/index.jsx';

// Firebase e Firestore
import { db } from './lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

function App() {
  const { usuario, loading: authLoading } = useAuth();
  
  // Estados para verificação de nome
  const [verificandoNome, setVerificandoNome] = useState(true);
  const [precisaNome, setPrecisaNome] = useState(false);
  const [novoNomeInput, setNovoNomeInput] = useState('');

  // --- EFEITO: VERIFICAR NOME DE USUÁRIO ---
  useEffect(() => {
    // Se o Auth ainda está carregando, não faz nada
    if (authLoading) return;

    // Se não tem usuário, também não precisa verificar
    if (!usuario) {
        setVerificandoNome(false);
        return;
    }

    async function checarNome() {
        setVerificandoNome(true);
        try {
            const userDocRef = doc(db, "users", usuario.uid);
            const docSnap = await getDoc(userDocRef);
            
            // REGRA: Se o documento não existe OU a flag 'nomeDefinido' é falsa/inexistente
            // O operador ?. garante que não quebra se .data() for undefined
            if (!docSnap.exists() || !docSnap.data()?.nomeDefinido) {
                setPrecisaNome(true);
                setNovoNomeInput(''); // Força o campo a começar vazio
            } else {
                setPrecisaNome(false);
            }
        } catch (e) {
            console.error("Erro ao verificar nome:", e);
            // Por segurança, se der erro (ex: rede), assume que precisa verificar para não liberar acesso indevido
            setPrecisaNome(true);
        }
        setVerificandoNome(false);
    }

    checarNome();
  }, [usuario, authLoading]);

  // --- FUNÇÃO: SALVAR NOME OBRIGATÓRIO ---
  const salvarNomePerfil = async (e) => {
      e.preventDefault();
      
      if (!novoNomeInput || !novoNomeInput.trim()) {
          return alert("Por favor, escolha um nome válido.");
      }
      
      try {
          // 1. Salva no Auth do Firebase (Perfil de Exibição)
          await updateProfile(usuario, { displayName: novoNomeInput.trim() });
          
          // 2. Salva a flag no Firestore para liberar o acesso futuro
          // Usamos setDoc com merge: true para criar ou atualizar o documento
          await setDoc(doc(db, "users", usuario.uid), { 
              nomeDefinido: true,
              nome: novoNomeInput.trim(), // Salva o nome no banco também por garantia
              email: usuario.email
          }, { merge: true });
          
          setPrecisaNome(false);
          
          // Recarrega a página para garantir que o novo nome seja propagado em todos os componentes/contextos
          window.location.reload(); 
      } catch (err) {
          console.error("Erro ao salvar perfil:", err);
          alert("Erro ao salvar: " + err.message);
      }
  };

  // --- RENDERIZAÇÃO CONDICIONAL (BLOQUEIOS) ---
  
  // 1. Tela de Carregamento (Enquanto Auth carrega ou verifica o nome)
  if (authLoading || (usuario && verificandoNome)) {
      return (
        <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#020406', color:'#fff', flexDirection: 'column', gap: '15px'}}>
            <img src="/assets/images/SimboloSemafinidade.webp" style={{width:'50px', opacity:0.5, animation: 'spin 2s linear infinite'}} alt="Carregando" />
            <span style={{fontFamily: 'monospace', fontSize: '0.8em', color: '#666'}}>CARREGANDO SISTEMA...</span>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      );
  }

  // 2. Tela de Login (Se não estiver autenticado)
  if (!usuario) {
      return <Login />;
  }

  // 3. Tela de Bloqueio: Definir Nome (Se logou mas não tem nome no banco)
  if (precisaNome) {
      return (
        <div className="login-container">
            <div className="box login-box">
                <h2 style={{color: 'var(--cor-destaque)'}}>CRIAÇÃO DE PERFIL</h2>
                <p style={{marginBottom: '20px', color: '#ccc', lineHeight: '1.5'}}>
                    Para acessar o sistema, defina seu <strong>Nome de Usuário</strong>.<br/>
                    <em style={{fontSize: '0.8em', color: '#888'}}>(Este será seu nome de jogador nas mesas)</em>
                </p>
                
                <form onSubmit={salvarNomePerfil} className="login-actions">
                    <div className="input-group">
                        <input 
                            type="text" 
                            placeholder="Digite seu apelido / nick" 
                            value={novoNomeInput} 
                            onChange={e => setNovoNomeInput(e.target.value)}
                            required
                            autoFocus
                            autoComplete="off"
                            style={{textAlign: 'center', fontSize: '1.2em', fontWeight: 'bold', letterSpacing: '1px'}}
                        />
                    </div>
                    <button className="btn-login primary" type="submit">SALVAR PERFIL</button>
                </form>
            </div>
        </div>
      );
  }

  // 4. Tela de Verificação de E-mail (Se tiver nome, mas email não verificado)
  if (!usuario.emailVerified) {
      return <Verificacao />;
  }

  // --- SISTEMA DE ROTAS (APP LIBERADO) ---
  return (
    <Routes>
      {/* Rota Principal: Dashboard */}
      <Route path="/" element={<Dashboard />} />
      
      {/* Rota da Mesa (com ID dinâmico) */}
      <Route path="/mesa/:mesaId" element={<Mesa />} />
      
      {/* Rota da Ficha Pessoal (com ID dinâmico) */}
      {/* Envolvemos em uma div wrapper para aplicar estilos globais se necessário */}
      <Route path="/ficha/:fichaId" element={
         <div className='ficha-wrapper'>
            <Ficha />
         </div>
      } />
      
      {/* Redireciona qualquer rota desconhecida para o Dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;