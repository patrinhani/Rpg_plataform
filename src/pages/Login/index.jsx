// src/pages/Login/index.jsx
import React from 'react';
// Ajuste o caminho do contexto (sobe 2 níveis: ../../)
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';


export default function Login() {
  const { loginGoogle, loginAnonimo } = useAuth();

  const handleGoogle = async () => {
    try {
      await loginGoogle();
    } catch (error) {
      console.error("Erro no Login Google:", error);
      alert("Falha ao logar com Google. Verifique o console.");
    }
  };

  const handleAnonimo = async () => {
    try {
      await loginAnonimo();
    } catch (error) {
      console.error("Erro no Login Anônimo:", error);
    }
  };

  return (
    <div className="login-container">
      <div className="box login-box">
        {/* Símbolo do Tema (ajuste o caminho se necessário) */}
        <img 
          src="/assets/images/SimboloSemafinidade.webp" 
          alt="Ordo Realitas" 
          className="login-logo"
        />
        
        <h1>SISTEMA DA ORDEM</h1>
        <p>Acesso Restrito a Agentes Autorizados</p>

        <div className="login-actions">
          <button className="btn-login google" onClick={handleGoogle}>
            <span style={{marginRight: '10px'}}>G</span> Entrar com Google
          </button>
          
          <button className="btn-login anon" onClick={handleAnonimo}>
            Entrar como Convidado
          </button>
        </div>
        
        <small style={{opacity: 0.5, marginTop: '20px', display: 'block'}}>
          v1.0 - Conexão Segura Firebase
        </small>
      </div>
    </div>
  );
}