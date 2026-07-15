import React, { useEffect, useState } from 'react';
import AuthShell from '../../components/AuthShell.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function Verificacao() {
  const { usuario, logout, checkVerification, resendEmail } = useAuth();
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [activeAction, setActiveAction] = useState('');

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Verificar e-mail - C.A.O.S.';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const handleCheck = async () => {
    setActiveAction('check');
    setMessage('');
    try {
      const verified = await checkVerification();
      if (!verified) {
        setMessageTone('error');
        setMessage('O e-mail ainda não foi verificado. Abra o link recebido e tente novamente.');
      }
    } catch (error) {
      setMessageTone('error');
      setMessage(`Não foi possível consultar a verificação: ${error.message}`);
    } finally {
      setActiveAction('');
    }
  };

  const handleResend = async () => {
    setActiveAction('resend');
    setMessage('');
    try {
      await resendEmail();
      setMessageTone('success');
      setMessage('Um novo e-mail foi enviado. Confira também a pasta de spam.');
    } catch (error) {
      setMessageTone('error');
      setMessage(`Não foi possível reenviar: ${error.message}`);
    } finally {
      setActiveAction('');
    }
  };

  return (
    <AuthShell
      eyebrow="Confirmação de identidade"
      title="Verifique seu e-mail"
      description="A ativação protege suas fichas e confirma que este canal pertence a você."
      variant="verification"
      status={activeAction ? 'Consultando serviço...' : 'Aguardando confirmação'}
    >
      <span className="auth-email-chip">{usuario?.email}</span>

      <ol className="auth-steps">
        <li>Abra a mensagem enviada pelo sistema na sua caixa de entrada.</li>
        <li>Clique no link de verificação fornecido pelo Firebase.</li>
        <li>Retorne a esta tela e confirme a ativação.</li>
      </ol>

      {message && (
        <p
          className={`auth-message auth-message--${messageTone}`}
          role={messageTone === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {message}
        </p>
      )}

      <div className="auth-action-stack">
        <button
          type="button"
          className="auth-button auth-button--primary"
          onClick={handleCheck}
          disabled={Boolean(activeAction)}
        >
          {activeAction === 'check' ? 'Verificando...' : 'Já verifiquei o e-mail'}
        </button>

        <button
          type="button"
          className="auth-button auth-button--secondary"
          onClick={handleResend}
          disabled={Boolean(activeAction)}
        >
          {activeAction === 'resend' ? 'Reenviando...' : 'Reenviar e-mail'}
        </button>

        <button type="button" className="auth-button auth-button--quiet" onClick={logout} disabled={Boolean(activeAction)}>
          Sair e trocar de conta
        </button>
      </div>
    </AuthShell>
  );
}
