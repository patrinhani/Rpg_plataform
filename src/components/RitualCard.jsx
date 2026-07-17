import React, { memo } from 'react';

function RitualCard({ ritual, tipo, onAdd, onRemove }) {
  let footerComponent;

  if (tipo === 'loja') {
    footerComponent = (
      <button type="button" className="loja-item-add" onClick={() => onAdd(ritual)}>
        Aprender ritual
      </button>
    );
  } else if (tipo === 'inventario') {
    footerComponent = (
      <button
        type="button"
        className="item-inventario-remover"
        onClick={() => onRemove(ritual.inventarioId)}
        aria-label={`Esquecer ${ritual.nome}`}
      >
        Esquecer
      </button>
    );
  }

  const alvoArea = ritual.alvo || ritual.area || ritual.efeito || 'N/A';
  const elemento = String(ritual.elemento || 'ordem').toLowerCase();

  return (
    <li className={`item-card item-card--ritual ritual-card ${elemento}`}>
      <div className="item-header">
        <div className="item-title-stack">
          <h3>{ritual.nome}</h3>
          <span className="ritual-element-badge">{ritual.elemento || 'Sem elemento'}</span>
        </div>
        <div className="item-header-info">
          <div><strong>{ritual.circulo}º círculo</strong></div>
        </div>
      </div>

      <div className="item-body">
        <div className="ritual-quick-data">
          <span><strong>Execução</strong>{ritual.execucao}</span>
          <span><strong>Alcance</strong>{ritual.alcance}</span>
          <span><strong>Duração</strong>{ritual.duracao}</span>
        </div>
        <div className="item-detalhe"><strong>Alvo/Área:</strong> {alvoArea}</div>
        {ritual.resistencia && (
          <div className="item-detalhe"><strong>Resistência:</strong> {ritual.resistencia}</div>
        )}

        <div className="item-descricao">{ritual.descricao}</div>

        {ritual.discente && (
          <details className="ritual-variation ritual-variation--discente">
            <summary>Forma discente</summary>
            <p>{ritual.discente}</p>
          </details>
        )}
        {ritual.verdadeiro && (
          <details className="ritual-variation ritual-variation--verdadeiro">
            <summary>Forma verdadeira</summary>
            <p>{ritual.verdadeiro}</p>
          </details>
        )}
      </div>

      {tipo && <div className="item-footer">{footerComponent}</div>}
    </li>
  );
}

export default memo(RitualCard);
