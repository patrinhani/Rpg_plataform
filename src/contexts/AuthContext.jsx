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
  updateProfile // <--- IMPORTANTE
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  async function loginGoogle() {
    setAuthError(null);
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') throw new Error("Login cancelado.");
      throw error;
    }
  }
  
  async function criarContaEmail(email, senha) {
      setAuthError(null);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        
        // --- NOVO: Define um nome padrão (ex: Agente Silva) ---
        const nomePadrao = "Agente " + email.split('@')[0];
        await updateProfile(userCredential.user, { displayName: nomePadrao });
        // ------------------------------------------------------

        try {
            await sendEmailVerification(userCredential.user);
        } catch (err) { console.warn(err); }
        
        return userCredential;
      } catch (error) {
        console.error("Erro crítico:", error);
        throw error;
      }
  }

  async function loginEmail(email, senha) {
      setAuthError(null);
      return signInWithEmailAndPassword(auth, email, senha);
  }

  function loginAnonimo() {
    setAuthError(null);
    return signInAnonymously(auth);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
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