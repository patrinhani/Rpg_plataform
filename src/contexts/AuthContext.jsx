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
  sendEmailVerification 
} from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  // Começa true para segurar a renderização até o Firebase responder
  const [loading, setLoading] = useState(true); 
  const [authError, setAuthError] = useState(null);

  // --- FUNÇÕES DE LOGIN (MANTIDAS IGUAIS) ---
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
        const cred = await createUserWithEmailAndPassword(auth, email, senha);
        try { await sendEmailVerification(cred.user); } catch(e) { console.warn(e); }
        return cred;
      } catch (error) { throw error; }
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

  // --- MONITORAMENTO DE ESTADO ---
  useEffect(() => {
    // O onAuthStateChanged dispara automaticamente ao carregar a página
    // se houver um usuário salvo no LocalStorage (graças ao firebase.js)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Lógica de e-mail verificado (opcional para desenvolvimento)
        // const isPassword = user.providerData.some(p => p.providerId === 'password');
        // if (isPassword && !user.emailVerified) { setUsuario(null); } else {
            setUsuario(user);
        // }
      } else {
        setUsuario(null);
      }
      
      // SÓ AQUI liberamos a aplicação
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

  // --- TELA DE CARREGAMENTO (Splash Screen) ---
  // Enquanto o Firebase verifica o LocalStorage, mostramos isso:
  if (loading) {
    return (
      <div style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#020406',
        color: 'var(--cor-destaque)',
        fontFamily: '"Special Elite", monospace'
      }}>
        <img 
          src="/assets/images/SimboloSemafinidade.webp" 
          alt="Carregando..." 
          style={{ 
            width: '100px', 
            height: '100px', 
            marginBottom: '20px',
            filter: 'drop-shadow(0 0 15px var(--cor-destaque))',
            animation: 'pulse 1.5s infinite alternate'
          }}
        />
        <h2>INICIANDO SISTEMA...</h2>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}