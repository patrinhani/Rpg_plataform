// /src/components/ItemCard.jsx
// (ATUALIZADO: Com Calculadora de Dano Dinâmica e Tooltips de Mods)
// (OTIMIZADO COM React.memo)

import React, { memo } from 'react';
import { 
  modificacoesArmas, 
  modificacoesProtecoes, 
  modificacoesAcessorios 
} from '../lib/database.js';

// Importa a função de cálculo de dano (Certifique-se de ter criado este arquivo)
import { calcularDanoArma } from '../lib/calculosCombate.js';

// Cria o objeto de mapeamento para acesso rápido às descrições das mods
const todasModificacoes = {
  ...modificacoesArmas.reduce((acc, mod) => ({ ...acc, [mod.key]: mod }), {}),
  ...modificacoesProtecoes.reduce((acc, mod) => ({ ...acc, [mod.key]: mod }), {}),
  ...modificacoesAcessorios.reduce((acc, mod) => ({ ...acc, [mod.key]: mod }), {}),
};

/**
 * Props:
 * - item: Objeto do item (com nome, categoria, modificacoes[], etc.)
 * - tipo: 'loja' (botão adicionar) ou 'inventario' (botões editar/remover)
 * - onAdd, onRemove, onToggle, onEdit: Funções de callback
 */
function ItemCard({ item, tipo, onAdd, onRemove, onToggle, onEdit }) {

  // --- 1. Lógica de Exibição do Footer ---
  let footerComponent;
  
  if (tipo === 'loja') {
    footerComponent = (
      <button 
        className="loja-item-add" 
        onClick={() => onAdd(item)} 
      >
        Adicionar ao Inventário
      </button>
    );
  } else if (tipo === 'inventario') {
    const isChecked = !item.ignorarCalculos; 

    footerComponent = (
      <> 
        <div className="item-inventario-toggle" title="Se marcado, o peso e penalidades contam na ficha">
          <input 
            type="checkbox" 
            className="toggle-item-calculo" 
            checked={isChecked}
            onChange={() => onToggle(item.inventarioId)} 
          />
          <label>Auto</label>
        </div>
        <button 
          className="item-inventario-editar"
          onClick={() => onEdit(item.inventarioId)} 
        >
          Editar
        </button>
        <button 
          className="item-inventario-remover" 
          onClick={() => onRemove(item.inventarioId)}
        >
          Remover
        </button>
      </>
    );
  }

  // --- 2. Classes de Estilo (ex: cor da borda para itens paranormais) ---
  let cardClasses = "item-card";
  if (item.elemento) {
    cardClasses += ` ritual-card ${item.elemento.toLowerCase()}`;
  }

  // --- 3. Cálculos de Stats (Categoria e Espaços) ---
  const modsAplicadas = item.modificacoes || [];
  
  // Fallback seguro para categoria e espaços (usa a base se existir, senão o valor direto)
  const catBase = (item.categoriaBase ?? item.categoria) ?? 0;
  const espacosBase = (item.espacosBase ?? item.espacos) ?? 0;

  // Calcula valores finais somando as modificações
  let categoriaFinal = (parseInt(catBase) || 0);
  let espacosFinal = parseFloat(espacosBase) || 0;
  
  // Gera lista detalhada para o tooltip
  const listaModsDetalhada = modsAplicadas.map(key => {
      const modData = todasModificacoes[key];
      
      // Soma aos totais
      if (modData) {
          categoriaFinal += (modData.cat || 1); // Maioria sobe +1 Categoria
          espacosFinal += (modData.espacos || 0);
      } else {
          // Se for mod customizada sem dados no banco, assume +1 Cat
          categoriaFinal += 1;
      }

      return {
        nome: modData?.nome || key,
        descricao: modData?.descricao || "Modificação personalizada."
      };
  });
  
  // Garante que espaço não seja negativo
  espacosFinal = Math.max(0, espacosFinal);

  // Strings para exibição
  const nomesModsString = listaModsDetalhada.map(mod => mod.nome).join(', ');
  const descricoesModsString = listaModsDetalhada.map(mod => `${mod.nome}: ${mod.descricao}`).join('\n');

  // --- 4. Cálculo de Dano Dinâmico ---
  // Se o item tem dano, calcula o valor real considerando as mods
  const danoExibido = item.dano ? calcularDanoArma(item) : null;

  return (
    <li className={cardClasses}>
      
      <div className="item-header">
        <h3>{item.nome}</h3>
        <div className="item-header-info">
          <div><strong>CAT:</strong> {categoriaFinal}</div>
          <div><strong>ESP:</strong> {Number.isInteger(espacosFinal) ? espacosFinal : espacosFinal.toFixed(1)}</div>
        </div>
      </div>

      <div className="item-body">
        
        {/* Exibição Dinâmica de Dano */}
        {item.dano && (
            <div className="item-detalhe">
                <strong>Dano:</strong> 
                {danoExibido !== item.dano ? (
                    <span>
                        <span style={{textDecoration: 'line-through', opacity: 0.6, marginRight: '6px', fontSize: '0.9em'}}>
                            {item.dano}
                        </span>
                        <span style={{color: 'var(--cor-destaque)', fontWeight: 'bold'}}>
                            {danoExibido}
                        </span>
                    </span>
                ) : (
                    item.dano
                )}
            </div>
        )}

        {item.defesa > 0 && <div className="item-detalhe"><strong>Defesa:</strong> +{item.defesa}</div>}
        {item.critico && <div className="item-detalhe"><strong>Crítico:</strong> {item.critico}</div>}
        {item.alcance && <div className="item-detalhe"><strong>Alcance:</strong> {item.alcance}</div>}
        {item.tipo && <div className="item-detalhe"><strong>Tipo:</strong> {item.tipo}</div>}
        
        {/* Bônus de Perícia */}
        {item.periciaVinculada && (
          <div className="item-detalhe bonus">
            <strong>Bônus:</strong> +{item.valorBonus} em {item.periciaVinculada}
          </div>
        )}
        {item.tipoBonus === 'generico' && (
          <div className="item-detalhe bonus">
            <strong>Bônus:</strong> +{item.valorBonus} (Vincular Perícia)
          </div>
        )}
        {item.tipoBonus === 'escolhaElemento' && (
          <div className="item-detalhe bonus">
            (Escolher Elemento)
          </div>
        )}

        {/* Lista de Modificações (se houver) */}
        {listaModsDetalhada.length > 0 && (
          <div 
            className="item-detalhe bonus" 
            style={{ 
                marginTop: '5px',
                fontStyle: 'italic', 
                fontSize: '0.85em', 
                color: 'var(--cor-texto-label)', 
                cursor: 'help',
                borderTop: '1px dashed #444',
                paddingTop: '4px'
            }}
            title={descricoesModsString} // Tooltip nativo com as descrições
          >
            <strong>Mods:</strong> {nomesModsString}
          </div>
        )}

        <div className="item-descricao">{item.descricao || "Sem descrição."}</div>
      </div>

      <div className="item-footer">
        {footerComponent}
      </div>
    </li>
  );
}

export default memo(ItemCard);