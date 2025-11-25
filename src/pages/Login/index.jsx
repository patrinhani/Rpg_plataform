// src/pages/Login/index.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const { 
      loginGoogle, 
      loginAnonimo, 
      loginEmail,
      criarContaEmail,
      logout,
      authError 
  } = useAuth();
  
  const [nome, setNome] = useState(''); // NOVO ESTADO
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isNewUser, setIsNewUser] = useState(false); 
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const errorMessage = authError || localError;

  const handleGoogle = async () => {
    setLoading(true);
    setLocalError('');
    try {
      await loginGoogle();
    } catch (error) {
      console.error("Erro Google:", error);
      setLoading(false);
      setLocalError(error.message);
    }
  };

  const handleAnonimo = async () => {
    setLoading(true);
    try {
      await loginAnonimo();
    } catch (error) {
      setLoading(false);
      setLocalError("Erro no login anônimo: " + error.message);
    }
  };
  
  const handleSubmitEmail = async (e) => {
      e.preventDefault();
      setLoading(true);
      setLocalError('');

      try {
          if (isNewUser) {
              // Validação do Nome
              if (!nome.trim()) {
                  throw new Error("Por favor, digite seu Nome de Agente.");
              }

              // Passa o nome para a função de criação
              await criarContaEmail(email, senha, nome);
              
              await logout(); 
              
              alert(`✅ AGENTE ${nome.toUpperCase()} REGISTRADO!\n\nVerifique seu e-mail (${email}) para validar o acesso.\n(Verifique a pasta SPAM)`);
              setIsNewUser(false);
              setLoading(false);
          } else {
              await loginEmail(email, senha);
          }
      } catch (error) {
          setLoading(false);
          console.error("Erro Auth:", error);
          
          // Tratamento de erros (mantido igual)
          if (error.message === "Por favor, digite seu Nome de Agente.") {
              setLocalError(error.message);
          } else if (error.code === 'auth/email-not-verified' || error.message.includes('email-not-verified')) {
              setLocalError("⚠️ Acesso Negado: E-mail pendente de verificação.");
          } else if (error.code === 'auth/weak-password') {
              setLocalError("Senha insegura (mínimo 6 caracteres).");
          } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
              setLocalError("Credenciais inválidas.");
          } else if (error.code === 'auth/email-already-in-use') {
               setLocalError("Este agente já consta no banco de dados.");
          } else if (error.code === 'auth/invalid-email') {
               setLocalError("Formato de e-mail inválido.");
          } else {
              setLocalError(error.message);
          }
      }
  };

  return (
    <div className="login-container">
      <div className={`box login-box ${isNewUser ? 'mode-register' : 'mode-login'}`}>
        
        <img 
          src="/assets/images/SimboloSemafinidade.webp" 
          alt="Ordo Realitas" 
          className="login-logo"
        />
        
        <h1>{isNewUser ? 'RECRUTAMENTO' : 'ACESSO AO C.A.O.S.'}</h1>
        <p className="subtitulo">
            {isNewUser 
                ? 'NOVO AGENTE // CRIAÇÃO DE CREDENCIAL' 
                : 'IDENTIFICAÇÃO REQUERIDA'}
        </p>

        {errorMessage && (
            <div style={{
                backgroundColor: 'rgba(255, 50, 50, 0.15)', 
                borderLeft: '4px solid #ff4444', 
                color: '#ffcccc', 
                padding: '10px', 
                marginBottom: '20px',
                fontSize: '0.9em',
                textAlign: 'left',
                borderRadius: '4px'
            }}>
                <strong>ERRO:</strong> {errorMessage}
            </div>
        )}

        <form onSubmit={handleSubmitEmail} className="login-actions">
            
            {/* CAMPO DE NOME (Só aparece no Registro) */}
            {isNewUser && (
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Nome de Agente"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        autoFocus
                    />
                </div>
            )}

            <div className="input-group">
                <input
                    type="email"
                    placeholder="E-mail Operacional"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            
            <div className="input-group">
                <input
                    type="password"
                    placeholder={isNewUser ? "Definir Senha (Mín. 6 dígitos)" : "Senha de Acesso"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                />
            </div>
            
            <button className="btn-login primary" type="submit" disabled={loading}>
                {loading 
                    ? 'PROCESSANDO...' 
                    : (isNewUser ? 'REGISTRAR AGENTE' : 'CONECTAR')
                }
            </button>
            
            <div style={{ marginTop: '10px' }}>
                <a 
                    href="#" 
                    onClick={(e) => { 
                        e.preventDefault(); 
                        setIsNewUser(!isNewUser); 
                        setLocalError(''); 
                        if (!isNewUser) setNome(''); // Limpa nome se mudar de modo
                    }}
                    className="toggle-link"
                >
                    {isNewUser 
                        ? 'Já possui credencial? Conectar.' 
                        : 'Não possui acesso? Iniciar Recrutamento.'}
                </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '15px 0' }}>
                <div style={{ flex: 1, height: '1px', background: '#333' }}></div>
                <span style={{ color: '#555', fontSize: '0.8em' }}>OU</span>
                <div style={{ flex: 1, height: '1px', background: '#333' }}></div>
            </div>

            <button className="btn-login google" onClick={handleGoogle} type="button" disabled={loading}>
                <span style={{fontWeight: 'bold', color: '#4285F4', marginRight: '8px'}}>G</span> Entrar com Google
            </button>
            
            <button className="btn-login anon" onClick={handleAnonimo} type="button" disabled={loading}>
                Acesso Visitante (Sem Salvar)
            </button>
        </form>
        
        <div style={{
            marginTop: '30px', 
            opacity: 0.4, 
            fontSize: '0.65em', 
            fontFamily: 'monospace',
            color: '#aaa',
            lineHeight: '1.4'
        }}>
            SISTEMA C.A.O.S. v3.0 <br/> 
            CENTRAL DE ANÁLISE DE OCORRÊNCIAS SOBRENATURAIS <br/>
            CONEXÃO SEGURA
        </div>
      </div>
    </div>
  );
}