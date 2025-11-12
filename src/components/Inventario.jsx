// /src/components/Inventario.jsx
// ATUALIZADO (para exibir o inventário real)
// (ATUALIZADO: Adiciona a prop 'onEditItem' e a repassa para o ItemCard)

import React from 'react';
import ItemCard from './ItemCard.jsx'; // Importa o card

/**
 * Props esperadas do App.jsx:
 * - inventario: (array) O personagem.inventario
 * - onAbrirLoja: (função) Para abrir o modal da loja
 * - onRemoveItem: (função) Para remover um item
 * - onToggleItem: (função) Para o "auto-toggle"
 * - onEditItem: (função) Para abrir o modal de edição // <-- NOVO
 */
function Inventario({ inventario, onAbrirLoja, onRemoveItem, onToggleItem, onEditItem }) { // <-- NOVO
  
  return (
    <main className="ficha-container-inventario">
      <section className="box box-inventario" id="grid-inventario">
        
        <div className="inventario-header">
          <h2>INVENTÁRIO</h2>
          {/* O botão "+" agora chama a função do App.jsx */}
          <button 
            className="btn-add-item" 
            id="btn-abrir-loja-inv"
            onClick={onAbrirLoja}
          >
            +
          </button>
        </div>
        
        <ul id="lista-inventario-pessoal" className="loja-lista-itens">
          {inventario.length > 0 ? (
            // Mapeia os itens do inventário
            inventario.map((item) => (
              <ItemCard 
                key={item.inventarioId} // ID único do inventário
                item={item}
                tipo="inventario" // Define o tipo para "inventario"
                onRemove={onRemoveItem}
                onToggle={onToggleItem}
                onEdit={onEditItem} // <-- NOVO: Passando a prop para o card
              />
            ))
          ) : (
            // Mensagem de fallback
            <li className="item-placeholder">Nenhum item adicionado.</li>
          )}
        </ul>

      </section>
    </main>
  );
}

export default Inventario;