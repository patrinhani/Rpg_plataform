// src/contexts/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, googleProvider, db } from '../lib/firebase';
import { 
  signOut, 
  onAuthStateChanged,
  signInWithPopup, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

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
  
  // 2. Criar Conta Email
  async function criarContaEmail(email, senha, nome) {
      setAuthError(null);
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
        
        if (nome) {
            // Atualiza o Perfil
            await updateProfile(userCredential.user, { displayName: nome });
            // Marca no Banco
            await setDoc(doc(db, "users", userCredential.user.uid), { 
                nomeDefinido: true 
            }, { merge: true });
        }

        // Tenta enviar o e-mail
        try {
            await sendEmailVerification(userCredential.user);
        } catch (emailError) {
            console.error("Erro ao enviar e-mail inicial:", emailError);
            // Não lançamos o erro aqui para não impedir o cadastro, 
            // o usuário pode reenviar depois na tela de verificação.
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
      return await signInWithEmailAndPassword(auth, email, senha);
  }

  // 4. Reenviar E-mail (NOVO)
  async function resendEmail() {
      if (auth.currentUser) {
          return await sendEmailVerification(auth.currentUser);
      }
  }

  // 5. Checar Verificação Manualmente (NOVO)
  async function checkVerification() {
      if (auth.currentUser) {
          // Força o Firebase a atualizar os dados do usuário
          await auth.currentUser.reload();
          
          // Atualiza o estado local para refletir a mudança na UI imediatamente
          const userAtualizado = auth.currentUser;
          setUsuario({ ...userAtualizado });
          
          return userAtualizado.emailVerified;
      }
      return false;
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user || null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // EXPORTAR AS NOVAS FUNÇÕES AQUI
  const value = {
    usuario,
    authError,
    loginGoogle,
    criarContaEmail,
    loginEmail,
    resendEmail,       // Adicionado
    checkVerification, // Adicionado
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}