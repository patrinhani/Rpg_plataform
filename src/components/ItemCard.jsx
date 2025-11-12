// /src/components/ItemCard.jsx
// (Nome em PascalCase)

import React from 'react';

/**
 * Este componente é o "molde" universal para um item.
 * Ele recebe 'props' para funcionar:
 * - item: O objeto do item (com nome, dano, etc.)
 * - tipo: 'loja' ou 'inventario'
 * - onAdd: Função para adicionar (usada na loja)
 * - onRemove: Função para remover (usada no inventário)
 * - onToggle: Função para o "auto-toggle" (usada no inventário)
 * - onEdit: Função para abrir o modal de edição // <-- NOVA PROP
 */
function ItemCard({ item, tipo, onAdd, onRemove, onToggle, onEdit }) { // <-- onEdit ADICIONADO

  // --- 1. Lógica do Footer (Botões) ---
  // Decidimos qual <div className="item-footer"></div> renderizar
  // com base na 'prop' tipo.
  let footerComponent;
  
  if (tipo === 'loja') {
    // Se for 'loja', renderiza o botão "Adicionar"
    footerComponent = (
      <button 
        className="loja-item-add" 
        onClick={() => onAdd(item)} // Chama a função onAdd (que virá do App.jsx)
      >
        Adicionar ao Inventário
      </button>
    );
  } else if (tipo === 'inventario') {
    // Se for 'inventario', renderiza o toggle e o botão "Remover"
    const isChecked = !item.ignorarCalculos; // 'ignorarCalculos = false' significa 'checked = true'

    footerComponent = (
      <> {/* Usamos um Fragment <>...</> para agrupar os dois */}
        <div className="item-inventario-toggle">
          <input 
            type="checkbox" 
            className="toggle-item-calculo" 
            checked={isChecked}
            // Chama a função onToggle (do App.jsx) com o ID do item
            onChange={() => onToggle(item.inventarioId)} 
          />
          <label>Auto</label>
        </div>

        {/* --- NOVO BOTÃO DE EDITAR --- */}
        <button 
          className="item-inventario-editar"
          onClick={() => onEdit(item.inventarioId)} // <-- CHAMA A NOVA PROP
        >
          Editar
        </button>
        {/* --- FIM DO NOVO BOTÃO --- */}

        <button 
          className="item-inventario-remover" 
          // Chama a função onRemove (do App.jsx) com o ID do item
          onClick={() => onRemove(item.inventarioId)}
        >
          Remover
        </button>
      </>
    );
  }

  // --- 2. Lógica das Classes de Estilo ---
  // Adiciona classes de cor para itens paranormais (ex: Sangue, Morte)
  let cardClasses = "item-card";
  if (item.elemento) {
    cardClasses += ` ritual-card ${item.elemento.toLowerCase()}`;
  }

  // --- 3. Renderização do Componente ---
  return (
    <li className={cardClasses}>
      
      {/* --- CABEÇALHO (Nome, Cat, Espaços) --- */}
      <div className="item-header">
        <h3>{item.nome}</h3>
        <div className="item-header-info">
          <div><strong>CAT:</strong> {item.categoria}</div>
          <div><strong>ESP:</strong> {item.espacos}</div>
        </div>
      </div>

      {/* --- CORPO (Detalhes e Descrição) --- */}
      <div className="item-body">
        
        {/* Renderização Condicional: Só mostra o detalhe se ele existir */}
        {item.dano && <div className="item-detalhe"><strong>Dano:</strong> {item.dano}</div>}
        {item.defesa > 0 && <div className="item-detalhe"><strong>Defesa:</strong> +{item.defesa}</div>}
        {item.critico && <div className="item-detalhe"><strong>Crítico:</strong> {item.critico}</div>}
        {item.alcance && <div className="item-detalhe"><strong>Alcance:</strong> {item.alcance}</div>}
        {item.tipo && <div className="item-detalhe"><strong>Tipo:</strong> {item.tipo}</div>}

        {/* Lógica de Bônus de Perícia */}
        {item.periciaVinculada && (
          <div className="item-detalhe bonus">
            <strong>Bônus:</strong> +{item.valorBonus} em {item.periciaVinculada}
          </div>
        )}
        {/* Mostra "Vincular Perícia" para itens 'genericos' */}
        {item.tipoBonus === 'generico' && (
          <div className="item-detalhe bonus">
            <strong>Bônus:</strong> +{item.valorBonus} (Vincular Perícia)
          </div>
        )}
        {/* Mostra "(Escolher Elemento)" para itens 'Varia' */}
        {item.tipoBonus === 'escolhaElemento' && (
          <div className="item-detalhe bonus">
            (Escolher Elemento)
          </div>
        )}

        {/* Descrição Padrão */}
        <div className="item-descricao">{item.descricao || "Sem descrição."}</div>
      </div>

      {/* --- RODAPÉ (Controlado pela lógica 'footerComponent') --- */}
      <div className="item-footer">
        {footerComponent}
      </div>
    </li>
  );
}

export default ItemCard;