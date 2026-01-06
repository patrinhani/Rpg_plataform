// src/contexts/ConfigContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const ConfigContext = createContext();

export function useConfig() {
  return useContext(ConfigContext);
}

export function ConfigProvider({ children }) {
  // 1. Inicializa lendo do localStorage para lembrar a escolha do usuário
  const [modoDesempenho, setModoDesempenho] = useState(() => {
    const salvo = localStorage.getItem('caos_modo_desempenho');
    return salvo === 'true'; // Retorna true se estiver salvo como string "true"
  });

  // 2. Efeito colateral: Atualiza o CSS global via classe no Body
  useEffect(() => {
    // Salva a preferência
    localStorage.setItem('caos_modo_desempenho', modoDesempenho);
    
    // Adiciona ou remove a classe 'low-spec' no corpo do HTML
    // Isso vai permitir que o CSS desligue blurs e animações automaticamente
    if (modoDesempenho) {
      document.body.classList.add('low-spec');
    } else {
      document.body.classList.remove('low-spec');
    }
  }, [modoDesempenho]);

  const toggleModoDesempenho = () => {
    setModoDesempenho((prev) => !prev);
  };

  return (
    <ConfigContext.Provider value={{ modoDesempenho, toggleModoDesempenho }}>
      {children}
    </ConfigContext.Provider>
  );
}