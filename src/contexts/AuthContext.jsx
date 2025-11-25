// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, googleProvider } from '../lib/firebase';
import { 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile 
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // 1. Login Google
  async function loginGoogle() {
    setAuthError(null);
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error("Login cancelado (janela fechada).");
      }
      throw error;
    }
  }
  
  // 2. Criar Conta Email (ATUALIZADO: Recebe 'nome')
  async function criarContaEmail(email, senha, nome) {
      setAuthError(null);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        
        // Define o nome escolhido pelo usuário no perfil do Firebase
        if (nome) {
            await updateProfile(userCredential.user, { 
                displayName: nome 
            });
        }

        // Tenta enviar o e-mail
        try {
            await sendEmailVerification(userCredential.user);
        } catch (emailError) {
            console.warn("Aviso: E-mail de verificação não enviado:", emailError);
        }
        
        return userCredential;
      } catch (error) {
        console.error("Erro crítico na criação:", error);
        throw error;
      }
  }

  // 3. Login Email
  async function loginEmail(email, senha) {
      setAuthError(null);
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      
      // Trava de segurança (opcional em dev)
      // if (!userCredential.user.emailVerified) {
      //    await signOut(auth);
      //    throw new Error("auth/email-not-verified"); 
      // }
      
      return userCredential;
  }

  function loginAnonimo() {
    setAuthError(null);
    return signInAnonymously(auth);
  }

  function logout() {
    return signOut(auth);
  }

  // Monitoramento
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user || null);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    usuario,
    authError,
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