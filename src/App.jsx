// src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css'; 
import './styles/style.css';
import './styles/responsive.css';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login/index.jsx'; 
import Verificacao from './pages/Verificacao/index.jsx';
import Dashboard from './pages/Dashboard/index.jsx';
import Ficha from './pages/Ficha/index.jsx';
import Mesa from './pages/Mesa/index.jsx';
import { db } from './lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';

function App() {
  const { usuario } = useAuth();
  
  const [view, setView] = useState('dashboard'); 
  const [mesaAtiva, setMesaAtiva] = useState(null);
  const [fichaPessoalId, setFichaPessoalId] = useState(null); 
  
  // Estados de Verificação de Nome
  const [verificandoNome, setVerificandoNome] = useState(true);
  const [precisaNome, setPrecisaNome] = useState(false);
  const [novoNomeInput, setNovoNomeInput] = useState('');

  // Verifica no banco se o usuário já configurou o nome
  useEffect(() => {
    async function checarNome() {
        if (usuario) {
            setVerificandoNome(true);
            try {
                const userDocRef = doc(db, "users", usuario.uid);
                const docSnap = await getDoc(userDocRef);
                
                // SE O DOCUMENTO NÃO EXISTE OU A FLAG 'nomeDefinido' É FALSA
                if (!docSnap.exists() || !docSnap.data()?.nomeDefinido) {
                    setPrecisaNome(true);
                    setNovoNomeInput(''); // FORÇA CAMPO VAZIO (Ignora nome do Google)
                } else {
                    setPrecisaNome(false);
                }
            } catch (e) {
                console.error("Erro ao verificar nome:", e);
                // Por segurança, se der erro na leitura, assume que precisa definir
                // Isso evita que o usuário entre sem nome em caso de falha de rede
                setPrecisaNome(true); 
            }
            setVerificandoNome(false);
        } else {
            setVerificandoNome(false);
        }
    }
    checarNome();
  }, [usuario]);

  const salvarNomePerfil = async (e) => {
      e.preventDefault();
      if (!novoNomeInput.trim()) return alert("O nome não pode ser vazio.");
      
      try {
          // 1. Salva no Auth (Perfil de Exibição)
          await updateProfile(usuario, { displayName: novoNomeInput });
          
          // 2. Salva flag no Banco de Dados para liberar o acesso futuro
          await setDoc(doc(db, "users", usuario.uid), { nomeDefinido: true }, { merge: true });
          
          setPrecisaNome(false);
          window.location.reload(); // Recarrega para garantir que o nome novo apareça em tudo
      } catch (err) {
          alert("Erro ao salvar: " + err.message);
      }
  };

  if (!usuario) return <Login />;
  
  // Tela de carregamento (Símbolo girando ou texto simples)
  if (verificandoNome) {
      return (
        <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'#020406', color:'#fff'}}>
            Carregando Perfil...
        </div>
      );
  }

  // --- TELA: DEFINIR NOME DE USUÁRIO (PERFIL) ---
  // Esta tela aparece se o Google logou mas não tem registro no nosso banco
  if (precisaNome) {
      return (
        <div className="login-container">
            {/* Reutiliza as classes do CSS de Login para manter o visual */}
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
                        />
                    </div>
                    <button className="btn-login primary">SALVAR PERFIL</button>
                </form>
            </div>
        </div>
      );
  }

  if (!usuario.emailVerified) return <Verificacao />;

  // --- NAVEGAÇÃO PADRÃO ---
  const irParaMesa = (id) => { setMesaAtiva(id); setView('mesa'); };
  const irParaFichaPessoal = (id) => { setFichaPessoalId(id); setView('ficha_pessoal'); };
  const voltarDashboard = () => { setView('dashboard'); setMesaAtiva(null); setFichaPessoalId(null); };

  if (view === 'mesa' && mesaAtiva) {
    return <Mesa mesaId={mesaAtiva} onVoltar={voltarDashboard} />;
  }

  if (view === 'ficha_pessoal') {
    return (
      <div>
        <button onClick={voltarDashboard} className="btn-voltar-flutuante">← Voltar</button>
        <Ficha fichaId={fichaPessoalId} />
      </div>
    );
  }

  return <Dashboard onSelectFicha={irParaFichaPessoal} onSelectMesa={irParaMesa} />;
}

export default App;