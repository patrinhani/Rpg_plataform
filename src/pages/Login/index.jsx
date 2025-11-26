// src/pages/Login/index.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const { 
      loginGoogle, 
      loginEmail,
      criarContaEmail,
      authError 
  } = useAuth();
  
  const [nome, setNome] = useState(''); 
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
  
  const handleSubmitEmail = async (e) => {
      e.preventDefault();
      setLoading(true);
      setLocalError('');

      try {
          if (isNewUser) {
              if (!nome.trim()) {
                  throw new Error("Por favor, escolha um Nome de Usuário.");
              }
              await criarContaEmail(email, senha, nome);
              // Não fazemos logout aqui para o fluxo seguir para a verificação
              alert(`✅ CONTA CRIADA!\nBem-vindo(a), ${nome}.\nVerifique seu e-mail para liberar o acesso.`);
              setIsNewUser(false);
              setLoading(false);
          } else {
              await loginEmail(email, senha);
          }
      } catch (error) {
          setLoading(false);
          console.error("Erro Auth:", error);
          if (error.code === 'auth/invalid-credential') setLocalError("Credenciais inválidas.");
          else if (error.code === 'auth/email-already-in-use') setLocalError("Este e-mail já tem conta.");
          else setLocalError(error.message);
      }
  };

  return (
    <div className="login-container">
      <div className={`box login-box ${isNewUser ? 'mode-register' : 'mode-login'}`}>
        
        <img src="/assets/images/SimboloSemafinidade.webp" alt="Ordo Realitas" className="login-logo" />
        
        <h1>{isNewUser ? 'CRIAR CONTA' : 'LOGIN C.A.O.S.'}</h1>
        <p className="subtitulo">
            {isNewUser ? 'REGISTRO DE USUÁRIO' : 'IDENTIFICAÇÃO'}
        </p>

        {errorMessage && (
            <div style={{ backgroundColor: 'rgba(255, 50, 50, 0.15)', borderLeft: '4px solid #ff4444', color: '#ffcccc', padding: '10px', marginBottom: '20px', fontSize: '0.9em', textAlign: 'left', borderRadius: '4px' }}>
                <strong>ERRO:</strong> {errorMessage}
            </div>
        )}

        <form onSubmit={handleSubmitEmail} className="login-actions">
            
            {/* CAMPO DE NOME DE USUÁRIO */}
            {isNewUser && (
                <div className="input-group">
                    <input
                        type="text"
                        placeholder="Nome de Usuário (Seu apelido)"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        autoFocus
                        autoComplete="off"
                    />
                </div>
            )}

            <div className="input-group">
                <input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            
            <div className="input-group">
                <input type="password" placeholder="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
            
            <button className="btn-login primary" type="submit" disabled={loading}>
                {loading ? 'PROCESSANDO...' : (isNewUser ? 'CRIAR CONTA' : 'ENTRAR')}
            </button>
            
            <div style={{ marginTop: '10px' }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setIsNewUser(!isNewUser); setLocalError(''); setNome(''); }} className="toggle-link">
                    {isNewUser ? 'Já tem conta? Fazer Login.' : 'Não tem conta? Criar agora.'}
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
            
        </form>
        
        <div style={{ marginTop: '30px', opacity: 0.4, fontSize: '0.65em', fontFamily: 'monospace', color: '#aaa', lineHeight: '1.4' }}>
            SISTEMA C.A.O.S. v3.4
        </div>
      </div>
    </div>
  );
}