// /src/components/RitualCard.jsx

import React from 'react';

// Recebemos o objeto 'ritual' completo como prop
function RitualCard({ ritual }) {

  // Recria a lógica de 'Alvo/Área' do main.js
  const alvoArea = ritual.alvo || ritual.area || ritual.efeito || "N/A";

  return (
    // A classe do elemento (ex: 'sangue') é aplicada no <li>
    <li className={`item-card ritual-card ${ritual.elemento.toLowerCase()}`}>
      
      <div className="item-header">
        <h3>{ritual.nome}</h3>
        <div className="item-header-info">
          {/* O CSS (style.css) vai colorir este texto baseado na classe do <li> */}
          <div><strong>{ritual.elemento} {ritual.circulo}</strong></div>
        </div>
      </div>

      <div className="item-body">
        <div className="item-detalhe"><strong>Execução:</strong> {ritual.execucao}</div>
        <div className="item-detalhe"><strong>Alcance:</strong> {ritual.alcance}</div>
        <div className="item-detalhe"><strong>Alvo/Área:</strong> {alvoArea}</div>
        <div className="item-detalhe"><strong>Duração:</strong> {ritual.duracao}</div>
        
        {/* Renderização condicional: Só mostra se 'ritual.resistencia' existir */}
        {ritual.resistencia && (
          <div className="item-detalhe"><strong>Resistência:</strong> {ritual.resistencia}</div>
        )}

        <div className="item-descricao">{ritual.descricao}</div>

        {/* Renderização condicional para Aprimoramentos */}
        {ritual.discente && (
          <div className="item-detalhe bonus discente">
            <strong>Discente:</strong> {ritual.discente}
          </div>
        )}
        {ritual.verdadeiro && (
          <div className="item-detalhe bonus verdadeiro">
            <strong>Verdadeiro:</strong> {ritual.verdadeiro}
          </div>
        )}
      </div>

    </li>
  );
}

export default RitualCard;