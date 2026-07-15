import React, { useEffect, useState } from 'react';
import AuthShell from '../../components/AuthShell.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useDialog } from '../../contexts/DialogContext.jsx';

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

  useEffect(() => {
    const previousTitle = document.title;
    document.title = isNewUser ? 'Criar conta - C.A.O.S.' : 'Acesso - C.A.O.S.';
    return () => {
      document.title = previousTitle;
    };
  }, [isNewUser]);

  const errorMessage = authError || localError;

  const handleGoogle = async () => {
    setLoading(true);
    setLocalError('');
    try {
      await loginGoogle();
    } catch (error) {
      console.error('Erro Google:', error);
      setLocalError(error.message);
      setLoading(false);
    }
  };

  const handleDevVisualMode = () => {
    try {
      window.localStorage.setItem('codexVisualMode', '1');
      window.location.reload();
    } catch {
      setLocalError('O navegador bloqueou o armazenamento local necessário para o modo visual.');
    }
  };

  const handleSubmitEmail = async (event) => {
    event.preventDefault();
    setLoading(true);
    setLocalError('');

    try {
      if (isNewUser) {
        if (!nome.trim()) throw new Error('Por favor, escolha um nome de usuário.');
        await criarContaEmail(email, senha, nome.trim());
        await showAlert(
          `Bem-vindo(a), ${nome.trim()}.\nVerifique seu e-mail para liberar o acesso.`,
          'Conta criada',
        );
        setIsNewUser(false);
        setLoading(false);
      } else {
        await loginEmail(email, senha);
      }
    } catch (error) {
      console.error('Erro Auth:', error);
      if (error.code === 'auth/invalid-credential') setLocalError('Credenciais inválidas.');
      else if (error.code === 'auth/email-already-in-use') setLocalError('Este e-mail já possui uma conta.');
      else setLocalError(error.message);
      setLoading(false);
    }
  };

  const alternarModo = () => {
    setIsNewUser((estadoAtual) => !estadoAtual);
    setLocalError('');
    setNome('');
  };

  return (
    <AuthShell
      eyebrow={isNewUser ? 'Novo registro' : 'Identificação do agente'}
      title={isNewUser ? 'Criar conta' : 'Acessar terminal'}
      description={isNewUser
        ? 'Registre sua identidade para criar e administrar fichas, mesas e recursos.'
        : 'Entre para continuar suas investigações e acessar seus registros.'}
      variant={isNewUser ? 'register' : 'access'}
      status={loading ? 'Autenticando...' : 'Canal protegido'}
    >
      {errorMessage && (
        <p className="auth-message auth-message--error" role="alert">
          <strong>Falha de acesso:</strong> {errorMessage}
        </p>
      )}

      <form onSubmit={handleSubmitEmail} className="auth-form">
        {isNewUser && (
          <label className="auth-field" htmlFor="auth-name">
            <span>Nome do agente</span>
            <input
              id="auth-name"
              type="text"
              placeholder="Como devemos chamar você?"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              required
              autoFocus
              autoComplete="nickname"
            />
          </label>
        )}

        <label className="auth-field" htmlFor="auth-email">
          <span>E-mail</span>
          <input
            id="auth-email"
            type="email"
            placeholder="agente@exemplo.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label className="auth-field" htmlFor="auth-password">
          <span>Senha</span>
          <input
            id="auth-password"
            type="password"
            placeholder="Sua credencial de acesso"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
            autoComplete={isNewUser ? 'new-password' : 'current-password'}
          />
        </label>

        <button className="auth-button auth-button--primary" type="submit" disabled={loading}>
          {loading ? 'Processando...' : (isNewUser ? 'Registrar identidade' : 'Entrar no sistema')}
        </button>

        <button type="button" onClick={alternarModo} className="auth-mode-switch" disabled={loading}>
          {isNewUser ? 'Já possui uma conta? Fazer login' : 'Primeiro acesso? Criar uma conta'}
        </button>

        <div className="auth-divider" aria-hidden="true"><span>ou</span></div>

        <button className="auth-button auth-button--google" onClick={handleGoogle} type="button" disabled={loading}>
          <b aria-hidden="true">G</b>
          Entrar com Google
        </button>

        {canUseDevVisualMode && (
          <button className="auth-button auth-button--dev" onClick={handleDevVisualMode} type="button" disabled={loading}>
            Abrir modo visual local
          </button>
        )}
      </form>
    </AuthShell>
  );
}
