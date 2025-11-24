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
  signInWithEmailAndPassword,
  sendEmailVerification // Importado para enviar o e-mail
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
  async function criarContaEmail(email, senha) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      
      // PASSO 1: Enviar e-mail de verificação imediatamente
      await sendEmailVerification(userCredential.user); 

      return userCredential;
  }

  // NOVO: Função para logar com E-mail e Senha
  async function loginEmail(email, senha) {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      
      // PASSO 2: Checar se o e-mail foi verificado
      if (!userCredential.user.emailVerified) {
          // Se não foi verificado, força o logout (para não manter a sessão)
          await signOut(auth);
          // Lança um erro customizado para ser tratado no front-end
          throw new Error("auth/email-not-verified"); 
      }
      
      return userCredential;
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
    getRedirectResult(auth)
      .then((result) => {
        if (result && result.user) {
            // Se logado com sucesso via redirect
        }
      })
      .catch(error => {
          console.error("Erro após redirecionamento:", error);
      });

    // Monitorar o estado de autenticação (mantém a persistência)
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
    criarContaEmail,
    loginEmail,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}