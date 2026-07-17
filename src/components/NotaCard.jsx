import React, { memo } from 'react';

function formatarData(data) {
  if (!data) return null;
  const valor = new Date(data);
  if (Number.isNaN(valor.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(valor);
}

function NotaCard({ nota, onEdit, onRemove }) {
  const conteudo = nota.conteudo || nota.texto || '...';
  const dataFormatada = formatarData(nota.atualizadoEm || nota.data || nota.criadoEm);

  return (
    <li className="item-card item-card--journal note-card">
      <div className="item-header">
        <div className="item-title-stack">
          <span className="note-card__index" aria-hidden="true">REG</span>
          <h3>{nota.titulo || 'Nota sem título'}</h3>
        </div>
        {dataFormatada && <time dateTime={nota.atualizadoEm || nota.data || nota.criadoEm}>{dataFormatada}</time>}
      </div>

      <div className="item-body">
        <div className="item-descricao note-card__content">{conteudo}</div>
      </div>

      <div className="item-footer">
        <button type="button" className="item-inventario-editar" onClick={onEdit} aria-label={`Editar ${nota.titulo || 'nota'}`}>
          Editar
        </button>
        <button
          type="button"
          className="item-inventario-remover"
          onClick={() => onRemove(nota.id)}
          aria-label={`Remover ${nota.titulo || 'nota'}`}
        >
          Remover
        </button>
      </div>
    </li>
  );
}

export default memo(NotaCard);
