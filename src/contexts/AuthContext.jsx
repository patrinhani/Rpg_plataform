// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  signInWithRedirect,
  getRedirectResult,
  // NOVO: Funções de E-mail/Senha
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';

const AuthContext = createContext();

// Hook para facilitar o uso em outros arquivos
export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  // Função de Login com Google (Redirect)
  function loginGoogle() {
    return signInWithRedirect(auth, googleProvider);
  }
  
  // NOVO: Função para criar conta com E-mail e Senha
  function criarContaEmail(email, senha) {
      return createUserWithEmailAndPassword(auth, email, senha);
  }

  // NOVO: Função para logar com E-mail e Senha
  function loginEmail(email, senha) {
      return signInWithEmailAndPassword(auth, email, senha);
  }

  // Função de Login Anônimo
  function loginAnonimo() {
    return signInAnonymously(auth);
  }

  // Função de Logout
  function logout() {
    return signOut(auth);
  }

  // Monitora e lida com o resultado do redirecionamento
  useEffect(() => {
    // 1. Tenta obter o resultado do login após um redirecionamento
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
            // Logado com sucesso após redirect.
        }
      })
      .catch(error => {
          console.error("Erro após redirecionamento:", error);
      });

    // 2. Monitorar o estado de autenticação (mantém a persistência)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    usuario,
    loginGoogle,
    loginAnonimo,
    criarContaEmail, // NOVO: Adicionado ao contexto
    loginEmail,      // NOVO: Adicionado ao contexto
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}