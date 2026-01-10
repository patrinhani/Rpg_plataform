import React, { useState, useEffect } from 'react';

const BotaoEconomia = () => {
  // Lê do localStorage ou inicia como falso
  const [economia, setEconomia] = useState(() => {
    return localStorage.getItem('modoEconomia') === 'true';
  });

  useEffect(() => {
    // Aplica a classe ao body
    if (economia) {
      document.body.classList.add('modo-economia');
    } else {
      document.body.classList.remove('modo-economia');
    }
    // Salva a preferência
    localStorage.setItem('modoEconomia', economia);
  }, [economia]);

  return (
    <button 
      onClick={() => setEconomia(!economia)}
      className="btn-economia"
      title="Desativa animações e efeitos visuais para melhorar desempenho"
      style={{
        position: 'fixed',
        bottom: '10px',
        left: '10px',
        zIndex: 9000,
        backgroundColor: economia ? '#4CAF50' : '#333',
        color: '#fff',
        border: '1px solid #555',
        padding: '8px 12px',
        fontSize: '0.8em',
        fontFamily: 'sans-serif',
        borderRadius: '4px',
        opacity: 0.7
      }}
    >
      {economia ? '⚡ Modo Leve: ON' : '🐢 Modo Leve: OFF'}
    </button>
  );
};

export default BotaoEconomia;