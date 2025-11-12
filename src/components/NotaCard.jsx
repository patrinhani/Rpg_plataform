// /src/components/NotaCard.jsx

import React from 'react';

/**
 * Props esperadas do App.jsx (através do Diario.jsx):
 * - nota: O objeto da anotação (ex: { id: '...', titulo: '...', conteudo: '...' })
 * - onEdit: (função) Chamada ao clicar em 'Editar'
 * - onRemove: (função) Chamada ao clicar em 'Remover'
 */
function NotaCard({ nota, onEdit, onRemove }) {

  return (
    <li className="item-card">
      
      {/* --- CABEÇALHO (Título da Nota) --- */}
      <div className="item-header">
        <h3>{nota.titulo || "Nota sem Título"}</h3>
      </div>

      {/* --- CORPO (Conteúdo da Nota) --- */}
      <div className="item-body">
        <div 
            className="item-descricao"
            style={{ 
              fontStyle: 'normal', // Remove o itálico padrão da descrição
              color: 'var(--cor-texto-principal)', // Usa a cor de texto normal
              whiteSpace: 'pre-wrap' // Faz com que quebras de linha (Enter) sejam respeitadas
            }}
        >
            {nota.conteudo || "..."}
        </div>
      </div>

      {/* --- RODAPÉ (Botões de Ação) --- */}
      <div className="item-footer">
        <button 
          className="item-inventario-editar"
          onClick={() => onEdit(nota)} // Passa o objeto 'nota' inteiro para edição
        >
          Editar
        </button>
        <button 
          className="item-inventario-remover" 
          onClick={() => onRemove(nota.id)} // Passa apenas o ID para remoção
        >
          Remover
        </button>
      </div>
    </li>
  );
}

export default NotaCard;