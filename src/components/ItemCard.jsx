// /src/components/ItemCard.jsx
// (ATUALIZADO PARA O PASSO 4 - COM DESCRIÇÃO NO TITLE)
// (OTIMIZADO COM React.memo)

import React, { memo } from 'react'; // 1. Importar o 'memo'
// 1. Importar as listas de modificações (do Passo 1)
import { 
  modificacoesArmas, 
  modificacoesProtecoes, 
  modificacoesAcessorios 
} from '../lib/database.js'; //

// 2. Criar o objeto de mapeamento (igual ao ModalEditarItem)
const todasModificacoes = {
  ...modificacoesArmas.reduce((acc, mod) => ({ ...acc, [mod.key]: mod }), {}),
  ...modificacoesProtecoes.reduce((acc, mod) => ({ ...acc, [mod.key]: mod }), {}),
  ...modificacoesAcessorios.reduce((acc, mod) => ({ ...acc, [mod.key]: mod }), {}),
};

/**
 * Props:
 * - item, tipo, onAdd, onRemove, onToggle, onEdit
 */
function ItemCard({ item, tipo, onAdd, onRemove, onToggle, onEdit }) {

  // --- Lógica do Footer (Botões) ---
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
        <div className="item-inventario-toggle">
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

  // --- Lógica das Classes de Estilo ---
  let cardClasses = "item-card";
  if (item.elemento) {
    cardClasses += ` ritual-card ${item.elemento.toLowerCase()}`;
  }

  // --- 3. LÓGICA DE CÁLCULO DAS MODIFICAÇÕES ---
  const modsAplicadas = item.modificacoes || [];
  
  // Pega a Categoria Base (com fallback para itens antigos)
  // Usando a sintaxe corrigida (parênteses)
  const catBase = (item.categoriaBase ?? item.categoria) ?? 0; //
  
  // Pega os Espaços Base (com fallback para itens antigos)
  const espacosBase = (item.espacosBase ?? item.espacos) ?? 0; //

  // Calcula os valores finais
  let categoriaFinal = (parseInt(catBase) || 0) + modsAplicadas.length; //
  let espacosFinal = parseFloat(espacosBase) || 0;
  
  // 4. Gera a lista de nomes E descrições
  const listaModsDetalhada = modsAplicadas.map(key => {
      const modData = todasModificacoes[key];
      return {
        nome: modData?.nome || key,
        descricao: modData?.descricao || "Modificação personalizada." //
      };
  });
  
  // Calcula os espaços finais
  modsAplicadas.forEach(modKey => {
      const modData = todasModificacoes[modKey];
      if (modData) {
        espacosFinal += (modData.espacos || 0); //
      }
  });
  espacosFinal = Math.max(0, espacosFinal);

  // Cria a string de nomes (ex: "Certeira, Perigosa")
  const nomesModsString = listaModsDetalhada.map(mod => mod.nome).join(', ');
  // Cria a string de descrições (ex: "Certeira: +2 nos ataques. | Perigosa: +2 na ameaça.")
  const descricoesModsString = listaModsDetalhada.map(mod => `${mod.nome}: ${mod.descricao}`).join(' | ');


  return (
    <li className={cardClasses}>
      
      <div className="item-header">
        <h3>{item.nome}</h3>
        <div className="item-header-info">
          <div><strong>CAT:</strong> {categoriaFinal}</div>
          <div><strong>ESP:</strong> {espacosFinal.toFixed(2)}</div>
        </div>
      </div>

      <div className="item-body">
        
        {/* ... (Renderização dos detalhes de dano, defesa, etc. - Sem alteração) ... */}
        {item.dano && <div className="item-detalhe"><strong>Dano:</strong> {item.dano}</div>}
        {item.defesa > 0 && <div className="item-detalhe"><strong>Defesa:</strong> +{item.defesa}</div>}
        {item.critico && <div className="item-detalhe"><strong>Crítico:</strong> {item.critico}</div>}
        {item.alcance && <div className="item-detalhe"><strong>Alcance:</strong> {item.alcance}</div>}
        {item.tipo && <div className="item-detalhe"><strong>Tipo:</strong> {item.tipo}</div>}
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
        {/* --- FIM (Sem alteração) --- */}

        {/* 6. (ATUALIZADO) Exibir Modificações Aplicadas com Tooltip */}
        {listaModsDetalhada.length > 0 && (
          <div 
            className="item-detalhe bonus" 
            style={{ fontStyle: 'italic', fontSize: '0.9em', color: 'var(--cor-texto-label)', cursor: 'help' }}
            // Adiciona o 'title' com as descrições
            title={descricoesModsString} 
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

// 3. Exportar a versão "memorizada"
export default memo(ItemCard);