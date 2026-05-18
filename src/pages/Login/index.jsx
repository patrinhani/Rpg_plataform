// src/pages/Login/index.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useDialog } from '../../contexts/DialogContext';
import './Login.css';

export default function Login() {
  const { loginGoogle, loginEmail, criarContaEmail, authError } = useAuth();
  const { showAlert } = useDialog();
  const canUseDevVisualMode = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  
  const [nome, setNome] = useState(''); 
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [isNewUser, setIsNewUser] = useState(false); 
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // --- ESTADO DO PARALAXE ---
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // EFEITO: Captura Movimento (Mouse ou Celular)
  useEffect(() => {
    // 1. Lógica para Mouse (Desktop)
    const handleMouseMove = (e) => {
      const x = (window.innerWidth - e.pageX * 2) / 25; // Sensibilidade
      const y = (window.innerHeight - e.pageY * 2) / 25;
      setOffset({ x, y });
    };

    // 2. Lógica para Giroscópio (Mobile)
    const handleOrientation = (e) => {
      // Limita os valores para o fundo não "fugir" da tela se inclinar muito
      let x = e.gamma; // Inclinação Esquerda/Direita (-90 a 90)
      let y = e.beta;  // Inclinação Frente/Trás (-180 a 180)

      // Ajustes finos para a posição de "segurar o celular" (aprox 45 graus)
      if (y > 90) y = 90;
      if (y < -90) y = -90;
      
      // Multiplicador de sensibilidade para mobile
      const mobileSensibilidade = 1.5; 
      
      setOffset({ 
        x: x * mobileSensibilidade, 
        y: (y - 45) * mobileSensibilidade // Remove 45deg para compensar a posição natural de segurar
      });
    };

    // Adiciona os ouvintes
    window.addEventListener('mousemove', handleMouseMove);
    
    // Tenta adicionar suporte a orientação (Android funciona direto, iOS pode precisar de permissão)
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  const errorMessage = authError || localError;

  // ... (Funções de Login mantidas iguais: handleGoogle, handleSubmitEmail) ...
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

  const handleDevVisualMode = () => {
    window.localStorage.setItem('codexVisualMode', '1');
    window.location.reload();
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
              await showAlert(`Bem-vindo(a), ${nome}.\nVerifique seu e-mail para liberar o acesso.`, "Conta Criada!");
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
      
      {/* --- NOVO: CAMADA DE PARALAXE --- */}
      {/* Movemos o estilo para cá para ser dinâmico via React State */}
      <div 
        className="parallax-layer" 
        style={{ 
          transform: `translate(${offset.x}px, ${offset.y}px)` 
        }}
      >
        <img 
          src="/assets/images/Character.webp" 
          alt="Símbolo de Fundo" 
          className="login-bg-symbol" 
        />
      </div>

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

            {canUseDevVisualMode && (
              <button className="btn-login dev-visual" onClick={handleDevVisualMode} type="button" disabled={loading}>
                Modo Visual Local
              </button>
            )}
            
        </form>
        
        <div style={{ marginTop: '30px', opacity: 0.4, fontSize: '0.65em', fontFamily: 'monospace', color: '#aaa', lineHeight: '1.4' }}>
            SISTEMA C.A.O.S. v3.4
        </div>
      </div>
    </div>
  );
}
