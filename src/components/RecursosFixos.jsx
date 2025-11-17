// src/components/RecursosFixos.jsx
import React from 'react';
import useTema from '../hooks/useTema';
import PVIcon from '../assets/icons/pv-icon.svg';
import SANIcon from '../assets/icons/san-icon.svg';
import PEIcon from '../assets/icons/pe-icon.svg';

const RecursosFixos = ({ pv, sanidade, pe, setPv, setSanidade, setPe }) => {
  const { tema } = useTema();

  const handleInputChange = (e, setter) => {
    setter(parseInt(e.target.value, 10) || 0);
  };

  const getTemaIcon = () => {
    switch (tema) {
      case 'tema-ordem': return '/assets/images/Character.webp';
      case 'tema-sangue': return '/assets/images/CharacterSangue.webp';
      case 'tema-morte': return '/assets/images/CharacterMorte.webp';
      case 'tema-conhecimento': return '/assets/images/CharacterConhecimento.webp';
      case 'tema-energia': return '/assets/images/CharacterEnergia.webp';
      default: return '/assets/images/Character.webp'; 
    }
  };

  return (
    <div className="recursos-container-fixo">
      <div className="recursos-hud-itens">
        <div className="recurso-hud-item">
          <img src={PVIcon} alt="Pontos de Vida" className="recurso-icon" />
          <input
            type="number"
            value={pv.atual}
            onChange={(e) => setPv({ ...pv, atual: parseInt(e.target.value) || 0 })}
            min="0"
            max={pv.max}
            className="hud-input-atual"
          />
          <span className="hud-separador">/</span>
          <span className="hud-valor-max">{pv.max}</span>
        </div>

        <div className="recurso-hud-item">
          <img src={SANIcon} alt="Sanidade" className="recurso-icon" />
          <input
            type="number"
            value={sanidade.atual}
            onChange={(e) => setSanidade({ ...sanidade, atual: parseInt(e.target.value) || 0 })}
            min="0"
            max={sanidade.max}
            className="hud-input-atual"
          />
          <span className="hud-separador">/</span>
          <span className="hud-valor-max">{sanidade.max}</span>
        </div>

        <div className="recurso-hud-item">
          <img src={PEIcon} alt="Pontos de Esforço" className="recurso-icon" />
          <input
            type="number"
            value={pe.atual}
            onChange={(e) => setPe({ ...pe, atual: parseInt(e.target.value) || 0 })}
            min="0"
            max={pe.max}
            className="hud-input-atual"
          />
          <span className="hud-separador">/</span>
          <span className="hud-valor-max">{pe.max}</span>
        </div>
      </div>
      <div className="personagem-imagem-container">
        <img src={getTemaIcon()} alt="Símbolo do Tema" className="personagem-imagem-fundo" />
        {/* Placeholder para a imagem do personagem - será preenchido via CSS ou outro componente */}
        <div className="personagem-imagem-foto"></div>
      </div>
    </div>
  );
};

export default RecursosFixos;