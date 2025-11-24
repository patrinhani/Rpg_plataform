// src/pages/Login/index.jsx
import React, { useState } from 'react';
// Ajuste o caminho do contexto (sobe 2 níveis: ../../)
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';


export default function Login() {
  const { 
      loginGoogle, 
      loginAnonimo, 
      loginEmail,      // NOVO
      criarContaEmail  // NOVO
  } = useAuth();
  
  // NOVOS ESTADOS PARA O FORMULÁRIO
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isNewUser, setIsNewUser] = useState(false); // true = Criar Conta, false = Logar
  const [loading, setLoading] = useState(false);


  const handleGoogle = async () => {
    try {
      setLoading(true);
      await loginGoogle();
      // Não precisa de setLoading(false) aqui, pois o redirect acontece
    } catch (error) {
      setLoading(false);
      console.error("Erro ao iniciar o Login Google (Redirect):", error);
      alert("Falha ao iniciar o Login Google.");
    }
  };

  const handleAnonimo = async () => {
    try {
      setLoading(true);
      await loginAnonimo();
    } catch (error) {
      setLoading(false);
      console.error("Erro no Login Anônimo:", error);
      alert("Falha ao logar como Convidado.");
    }
  };
  
  // NOVO: Handler para o formulário de E-mail/Senha
  const handleSubmitEmail = async (e) => {
      e.preventDefault();
      setLoading(true);

      try {
          if (isNewUser) {
              await criarContaEmail(email, senha);
          } else {
              await loginEmail(email, senha);
          }
      } catch (error) {
          setLoading(false);
          const errorCode = error.code;
          let errorMessage = "Ocorreu um erro desconhecido.";

          // Tratamento de erros comuns de E-mail/Senha
          if (errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found') {
              errorMessage = "E-mail ou senha incorretos.";
          } else if (errorCode === 'auth/email-already-in-use') {
              errorMessage = "Este e-mail já está em uso.";
          } else if (errorCode === 'auth/weak-password') {
              errorMessage = "A senha deve ter pelo menos 6 caracteres.";
          } else if (errorCode === 'auth/invalid-email') {
              errorMessage = "O formato do e-mail é inválido.";
          } else {
              console.error(errorCode, error.message);
              errorMessage = `Erro de autenticação: ${errorCode.replace('auth/', '')}`;
          }

          alert(errorMessage);
      }
  };


  return (
    <div className="login-container">
      <div className="box login-box">
        <img 
          src="/assets/images/SimboloSemafinidade.webp" 
          alt="Ordo Realitas" 
          className="login-logo"
        />
        
        <h1>SISTEMA DA ORDEM</h1>
        <p>Acesso Restrito a Agentes Autorizados</p>

        {/* --- NOVO: FORMULÁRIO DE E-MAIL/SENHA --- */}
        <form onSubmit={handleSubmitEmail} className="login-actions">
            
            <input
                type="email"
                placeholder="E-mail do Agente"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
            <input
                type="password"
                placeholder="Senha (Mínimo 6 caracteres)"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
            />
            
            <button className="btn-login" type="submit" disabled={loading}>
                {loading ? 'Acessando...' : isNewUser ? 'Criar Conta' : 'Logar'}
            </button>
            
            <a 
                href="#"
                onClick={() => setIsNewUser(!isNewUser)}
                style={{
                    fontSize: '0.9em',
                    color: 'var(--cor-texto-label)',
                    textDecoration: 'none',
                    marginTop: '5px'
                }}
            >
                {isNewUser ? 'Já tenho uma conta. Logar.' : 'Não tem conta? Criar Conta.'}
            </a>

            <div style={{ marginTop: '20px', marginBottom: '10px', color: 'var(--cor-texto-label)' }}>
                — OU —
            </div>

            {/* --- Opções Adicionais (Google e Anônimo) --- */}
            <button 
                className="btn-login google" 
                onClick={handleGoogle}
                type="button"
                disabled={loading}
            >
                <span style={{marginRight: '10px'}}>G</span> Entrar com Google
            </button>
            
            <button 
                className="btn-login anon" 
                onClick={handleAnonimo}
                type="button"
                disabled={loading}
            >
                Entrar como Convidado
            </button>
        </form>
        {/* --- FIM DO FORMULÁRIO --- */}
        
        <small style={{opacity: 0.5, marginTop: '20px', display: 'block'}}>
          v1.0 - Conexão Segura Firebase
        </small>
      </div>
    </div>
  );
}