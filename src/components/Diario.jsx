// /src/components/Diario.jsx
// (ATUALIZADO para o layout de cards)

import React from 'react';
import NotaCard from './NotaCard.jsx'; // Importa o card de anotação

/**
 * Props esperadas do App.jsx:
 * - diarioData: (array) O array personagem.diario
 * - onAbrirModal: (função) Para abrir o modal de criação/edição
 * - onRemoveNota: (função) Para remover uma nota
 */
function Diario({ diarioData, onAbrirModal, onRemoveNota }) {

  return (
    <main className="ficha-container-inventario">
      <section className="box box-inventario" id="grid-diario">
        
        <div className="inventario-header">
          <h2>DIÁRIO DE INVESTIGAÇÃO</h2>
          <button 
            className="btn-add-item" 
            id="btn-add-nota"
            onClick={() => onAbrirModal(null)} // 'null' significa criar nota nova
          >
            +
          </button>
        </div>
        
        {/* Reutiliza o layout de lista do inventário */ }
        <ul id="lista-diario" className="loja-lista-itens">
          {diarioData && diarioData.length > 0 ? (
            
            diarioData.map((nota) => (
              <NotaCard 
                key={nota.id}
                nota={nota}
                onEdit={() => onAbrirModal(nota)} // Passa a nota para edição
                onRemove={onRemoveNota}
              />
            ))
            
          ) : (
            <li className="item-placeholder">
              Nenhuma anotação adicionada. Clique no '+' para criar seu diário.
            </li>
          )}
        </ul>

      </section>
    </main>
  );
}

export default Diario;