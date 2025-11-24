// src/pages/Verificacao/index.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function Verificacao() {
  const { usuario, logout, checkVerification, resendEmail } = useAuth();
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    const verificado = await checkVerification();
    setLoading(false);
    if (verificado) {
      // O App.jsx vai detectar a mudança e redirecionar automaticamente
    } else {
      setMsg("O e-mail ainda não foi verificado. Tente novamente.");
    }
  };

  const handleResend = async () => {
    try {
      await resendEmail();
      setMsg("Novo e-mail enviado! Verifique sua caixa de entrada e SPAM.");
    } catch (e) {
      setMsg("Erro ao reenviar: " + e.message);
    }
  };

  return (
    <div className="login-container" style={{ flexDirection: 'column', color: '#fff' }}>
      <div className="box login-box" style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--cor-destaque)' }}>Verificação Pendente</h2>
        <p>Um link de acesso foi enviado para:</p>
        <h3 style={{ color: '#fff', margin: '10px 0' }}>{usuario?.email}</h3>
        
        <p style={{ fontSize: '0.9em', opacity: 0.8 }}>
          O Firebase usa um <strong>LINK</strong>, não um código. <br/>
          Clique no link recebido no e-mail e depois no botão abaixo.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          <button className="btn-login" onClick={handleCheck} disabled={loading}>
            {loading ? 'Verificando...' : 'JÁ CLIQUEI NO LINK'}
          </button>
          
          <button className="btn-login anon" onClick={handleResend}>
            Reenviar E-mail
          </button>
          
          <button 
            onClick={logout} 
            style={{ background: 'none', border: 'none', color: '#aaa', textDecoration: 'underline', cursor: 'pointer', marginTop: '10px' }}
          >
            Sair / Trocar Conta
          </button>
        </div>
        
        {msg && <p style={{ color: 'var(--cor-destaque)', marginTop: '15px' }}>{msg}</p>}
      </div>
    </div>
  );
}