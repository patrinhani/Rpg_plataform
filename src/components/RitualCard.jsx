// /src/components/RitualCard.jsx
// (OTIMIZADO COM React.memo)

import React, { memo } from 'react'; // 1. Importar 'memo'

/**
 * ATUALIZADO: Agora recebe props para interatividade
 * * Props:
 * - ritual: O objeto do ritual
 * - tipo: 'loja' (mostra botão 'Adicionar') ou 'inventario' (mostra botão 'Remover')
 * - onAdd: (função) Chamada ao clicar em 'Adicionar'
 * - onRemove: (função) Chamada ao clicar em 'Remover'
 */
function RitualCard({ ritual, tipo, onAdd, onRemove }) {

  // --- 1. Lógica do Footer (Botões) ---
  let footerComponent;
  
  if (tipo === 'loja') {
    // Se for 'loja' (a biblioteca), renderiza o botão "Aprender"
    footerComponent = (
      <button 
        className="loja-item-add" 
        onClick={() => onAdd(ritual)} // Chama a função onAdd (que virá do App.jsx)
      >
        Aprender Ritual
      </button>
    );
  } else if (tipo === 'inventario') {
    // Se for 'inventario' (o grimório), renderiza o botão "Esquecer"
    footerComponent = (
      <button 
        className="item-inventario-remover" 
        onClick={() => onRemove(ritual.inventarioId)} // Chama onRemove com o ID único
      >
        Esquecer
      </button>
    );
  }

  // --- 2. Renderização ---
  const alvoArea = ritual.alvo || ritual.area || ritual.efeito || "N/A";

  return (
    <li className={`item-card ritual-card ${ritual.elemento.toLowerCase()}`}>
      
      <div className="item-header">
        <h3>{ritual.nome}</h3>
        <div className="item-header-info">
          <div><strong>{ritual.elemento} {ritual.circulo}</strong></div>
        </div>
      </div>

      <div className="item-body">
        <div className="item-detalhe"><strong>Execução:</strong> {ritual.execucao}</div>
        <div className="item-detalhe"><strong>Alcance:</strong> {ritual.alcance}</div>
        <div className="item-detalhe"><strong>Alvo/Área:</strong> {alvoArea}</div>
        <div className="item-detalhe"><strong>Duração:</strong> {ritual.duracao}</div>
        
        {ritual.resistencia && (
          <div className="item-detalhe"><strong>Resistência:</strong> {ritual.resistencia}</div>
        )}

        <div className="item-descricao">{ritual.descricao}</div>

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

      {/* --- 3. Footer Interativo --- */}
      {/* Só renderiza o footer se houver um tipo (loja ou inventario) */}
      {tipo && (
        <div className="item-footer">
          {footerComponent}
        </div>
      )}
      
    </li>
  );
}

// 3. Exportar a versão "memorizada"
export default memo(RitualCard);