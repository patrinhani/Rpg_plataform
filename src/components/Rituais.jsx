// /src/components/Rituais.jsx
// ATUALIZADO (para mostrar o grimório pessoal)

import React from 'react';
// 1. Não precisamos mais do 'database' aqui
// 2. Importa o card que atualizamos
import RitualCard from './RitualCard.jsx';

/**
 * ATUALIZADO: Agora recebe props do App.jsx
 * - rituais: (array) O personagem.rituais (os rituais aprendidos)
 * - onAbrirModal: (função) Para abrir o modal da biblioteca
 * - onRemoveRitual: (função) Para remover um ritual
 */
function Rituais({ rituais, onAbrirModal, onRemoveRitual }) {

  return (
    <main className="ficha-container-inventario">
      <section className="box box-inventario" id="grid-rituais">
        
        <div className="inventario-header">
          <h2>RITUAIS APRENDIDOS</h2>
          {/* 3. Adiciona o botão '+' que chama a prop */}
          <button 
            className="btn-add-item" 
            onClick={onAbrirModal} // Chama a função do App.jsx
          >
            +
          </button>
        </div>
        
        {/* 4. Usa a lista de rituais vinda da prop 'rituais' */}
        <ul id="lista-rituais" className="loja-lista-itens">
          {rituais && rituais.length > 0 ? (
            // 5. Mapeia os rituais da FICHA
            rituais.map((ritual) => (
              <RitualCard 
                key={ritual.inventarioId} // ID único do inventário
                ritual={ritual}
                tipo="inventario" // Define o tipo para "inventario"
                onRemove={onRemoveRitual}
              />
            ))
          ) : (
            // Mensagem de fallback
            <li className="item-placeholder">Nenhum ritual aprendido. Clique no '+' para adicionar.</li>
          )}
        </ul>

      </section>
    </main>
  );
}

export default Rituais;