// /src/components/ItemCard.jsx
// (ATUALIZADO: Com Calculadora de Dano Dinâmica e Tooltips de Mods)
// (OTIMIZADO COM React.memo)

import React, { memo, useId } from 'react';
import { calcularDanoArma } from '../lib/calculosCombate.js';
import {
  calcularAlcanceItem,
  calcularBonusAtaqueItem,
  calcularCriticoItem,
  calcularDefesaItem,
  calcularStatsItem,
  getModificacao,
} from '../lib/inventario.js';

/**
 * Props:
 * - item: Objeto do item (com nome, categoria, modificacoes[], etc.)
 * - tipo: 'loja' (botão adicionar) ou 'inventario' (botões editar/remover)
 * - onAdd, onRemove, onToggle, onEdit: Funções de callback
 */
function ItemCard({ item, tipo, onAdd, onRemove, onToggle, onEdit }) {
  const autoToggleId = useId();

  // --- 1. Lógica de Exibição do Footer ---
  let footerComponent;
  
  if (tipo === 'loja') {
    footerComponent = (
      <button 
        type="button"
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
        <div className="item-inventario-toggle">
          <input 
            id={autoToggleId}
            type="checkbox" 
            className="toggle-item-calculo" 
            checked={isChecked}
            onChange={() => onToggle(item.inventarioId)} 
            aria-describedby={`${autoToggleId}-help`}
          />
          <label htmlFor={autoToggleId}>
            <span>Auto</span>
            <small id={`${autoToggleId}-help`}>Inclui peso e penalidades</small>
          </label>
        </div>
        <button 
          type="button"
          className="item-inventario-editar"
          onClick={() => onEdit(item.inventarioId)} 
          aria-label={`Editar ${item.nome}`}
        >
          Editar
        </button>
        <button 
          type="button"
          className="item-inventario-remover" 
          onClick={() => onRemove(item.inventarioId)}
          aria-label={`Remover ${item.nome}`}
        >
          Remover
        </button>
      </>
    );
  }

  // --- 2. Classes de Estilo (ex: cor da borda para itens paranormais) ---
  let cardClasses = `item-card item-card--${tipo || 'catalogo'}`;
  if (item.elemento) {
    cardClasses += ` ritual-card ${item.elemento.toLowerCase()}`;
  }
  if (item.quebrado) cardClasses += ' item-quebrado';
  if (item.ignorarCalculos) cardClasses += ' is-calculation-disabled';

  // --- 3. Cálculos de Stats (Categoria e Espaços) ---
  const { categoria: categoriaFinal, espacos: espacosFinal, modificacoes: modsAplicadas } = calcularStatsItem(item);
  
  // Gera lista detalhada para o tooltip
  const listaModsDetalhada = modsAplicadas.map(key => {
      const modData = getModificacao(key);

      return {
        nome: modData?.nome || key,
        descricao: modData?.descricao || "Modificação personalizada."
      };
  });
  
  // Strings para exibição
  const nomesModsString = listaModsDetalhada.map(mod => mod.nome).join(', ');

  // --- 4. Cálculo de Dano Dinâmico ---
  // Se o item tem dano, calcula o valor real considerando as mods
  const danoExibido = item.dano ? calcularDanoArma(item) : null;
  const defesaExibida = calcularDefesaItem(item);
  const bonusAtaque = calcularBonusAtaqueItem(item);
  const criticoExibido = calcularCriticoItem(item);
  const alcanceExibido = calcularAlcanceItem(item);

  return (
    <li className={cardClasses}>
      
      <div className="item-header">
        <div className="item-title-stack">
          <h3>{item.nome}</h3>
          <div className="item-status-list">
            {item.quebrado && <span className="item-status item-status--danger">Quebrado</span>}
            {item.ignorarCalculos && <span className="item-status">Fora dos cálculos</span>}
          </div>
        </div>
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
                    <span className="item-damage-comparison">
                        <span className="item-damage-original">
                            {item.dano}
                        </span>
                        <span className="item-damage-final">
                            {danoExibido}
                        </span>
                    </span>
                ) : (
                    item.dano
                )}
            </div>
        )}

        {defesaExibida > 0 && <div className="item-detalhe"><strong>Defesa:</strong> +{defesaExibida}</div>}
        {bonusAtaque !== 0 && <div className="item-detalhe"><strong>Ataque:</strong> +{bonusAtaque}</div>}
        {criticoExibido && <div className="item-detalhe"><strong>Crítico:</strong> {criticoExibido}</div>}
        {alcanceExibido && <div className="item-detalhe"><strong>Alcance:</strong> {alcanceExibido}</div>}
        {item.tipo && <div className="item-detalhe"><strong>Tipo:</strong> {item.tipo}</div>}
        
        {/* Bônus de Perícia */}
        {item.periciaVinculada && (
          <div className="item-detalhe bonus">
            <strong>Bônus:</strong> +{item.valorBonus} em {item.periciaVinculada}
          </div>
        )}
        {item.tipoBonus === 'generico' && !item.periciaVinculada && (
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
          <details className="item-mod-details">
            <summary><strong>Mods:</strong> {nomesModsString}</summary>
            <ul>
              {listaModsDetalhada.map((modificacao) => (
                <li key={modificacao.nome}>
                  <strong>{modificacao.nome}:</strong> {modificacao.descricao}
                </li>
              ))}
            </ul>
          </details>
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
