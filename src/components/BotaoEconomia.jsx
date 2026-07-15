import React, { useState, useEffect } from 'react';
import AppIcon from './icons/NavigationIcons.jsx';

const BotaoEconomia = () => {
  // Lê do localStorage ou inicia como falso
  const [economia, setEconomia] = useState(() => {
    try {
      return localStorage.getItem('modoEconomia') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Aplica a classe ao body
    if (economia) {
      document.body.classList.add('modo-economia');
    } else {
      document.body.classList.remove('modo-economia');
    }
    // Salva a preferência
    try {
      localStorage.setItem('modoEconomia', economia);
    } catch {
      // A preferência continua válida durante a sessão atual.
    }
  }, [economia]);

  return (
    <button
      type="button"
      onClick={() => setEconomia((estadoAtual) => !estadoAtual)}
      className={`btn-economia ${economia ? 'btn-economia--ativa' : 'btn-economia--inativa'}`}
      aria-pressed={economia}
      aria-label={`Modo leve ${economia ? 'ativado' : 'desativado'}`}
      title="Desativa animações e efeitos visuais para melhorar desempenho"
    >
      <AppIcon name="powers" size={16} />
      <span>Modo leve</span>
      <span className="btn-economia-status" aria-hidden="true">
        {economia ? 'Ativo' : 'Inativo'}
      </span>
    </button>
  );
};

export default BotaoEconomia;
