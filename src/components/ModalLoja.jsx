// /src/components/ModalLoja.jsx
// (ATUALIZADO PARA O PASSO 5 - MODIFICAÇÕES NO ITEM CUSTOM)

import React, { useState } from 'react';
// 1. Importa database E as modificações (do Passo 1)
import { database } from '../lib/database.js';
import ItemCard from './ItemCard.jsx';
import {
  calcularStatsItem,
  getModificacoesCompativeis,
  getTodasModificacoes,
  modificacoesSaoIncompativeis,
} from '../lib/inventario.js';

const ordenarPorNome = (itens) => [...itens].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

/**
 * Props:
 * - isOpen, onClose, onAddItem, pericias
 */
function ModalLoja({ isOpen, onClose, onAddItem, pericias }) {
  
  const [abaAtiva, setAbaAtiva] = useState('armas');

  // --- Estados do Formulário Customizado ---
  const [customNome, setCustomNome] = useState('');
  const [customCat, setCustomCat] = useState(0);
  const [customEspacos, setCustomEspacos] = useState(1);
  const [customDesc, setCustomDesc] = useState('');
  const [customDefesa, setCustomDefesa] = useState(0);
  const [customBonusPericia, setCustomBonusPericia] = useState(0);
  const [customPericiaSelect, setCustomPericiaSelect] = useState('');
  const [customTipo, setCustomTipo] = useState('livre');
  
  // 3. Novo estado para as modificações do item custom
  const [customMods, setCustomMods] = useState([]);

  // Organiza os itens do Database para as Abas
  const abasConteudo = {
    armas: [
      ...(database.armasSimples || []),
      ...(database.armasTaticas || []),
      ...(database.armasPesadas || []),
      ...(database.municoes || []),
    ],
    protecoes: [...(database.protecoes || [])],
    geral: ordenarPorNome(database.equipGeral || []),
    paranormal: [...(database.itensParanormais || [])],
  };

  // 4. Handler para o checkbox de modificação (custom)
  const handleCustomModToggle = (modKey) => {
    setCustomMods(prevMods => {
      if (prevMods.includes(modKey)) {
        return prevMods.filter(m => m !== modKey);
      } else {
        return [...prevMods.filter(chave => !modificacoesSaoIncompativeis(chave, modKey)), modKey];
      }
    });
  };

  // 5. Handler de Submit (Salvar) ATUALIZADO
  const handleSubmitCustomItem = (e) => {
    e.preventDefault(); 

    const bonusValor = parseInt(customBonusPericia) || 0;
    const periciaNome = customPericiaSelect;

    const itemCustom = {
      id: `custom_${Date.now()}`, 
      nome: customNome || "Item Personalizado",
      
      // Salva a Categoria e Espaços Base (como no Passo 2)
      categoriaBase: parseInt(customCat) || 0,
      espacosBase: parseFloat(customEspacos) || 0,
      
      descricao: customDesc || "",
      defesa: parseInt(customDefesa) || 0,
      valorBonus: bonusValor,
      periciaVinculada: bonusValor > 0 && periciaNome ? periciaNome : null,
      tipoBonus: bonusValor > 0 && periciaNome ? "custom" : null,
      tipoItem: customTipo === 'livre' ? null : customTipo,
      
      // Salva as modificações
      modificacoes: customMods,
    };

    onAddItem(itemCustom); // Envia o item no novo formato

    // Limpa o formulário
    setCustomNome('');
    setCustomCat(0);
    setCustomEspacos(1);
    setCustomDesc('');
    setCustomDefesa(0);
    setCustomBonusPericia(0);
    setCustomPericiaSelect('');
    setCustomTipo('livre');
    setCustomMods([]); // Limpa as mods
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }
  
  // 6. Calcula a categoria final para exibição no JSX
  const itemCustomPreview = {
    id: 'custom_preview',
    tipoItem: customTipo === 'livre' ? null : customTipo,
    categoriaBase: customCat,
    espacosBase: customEspacos,
    modificacoes: customMods,
    tipoBonus: customTipo === 'acessorio' ? 'custom' : null,
  };
  const statsCustom = calcularStatsItem(itemCustomPreview);
  const catFinalCustom = statsCustom.categoria;
  const espFinalCustom = statsCustom.espacos;
  const modificacoesCustomDisponiveis = customTipo === 'livre'
    ? getTodasModificacoes()
    : getModificacoesCompativeis(itemCustomPreview);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      {/* 7. Modal Grande para caber as modificações */}
      <div className="modal-conteudo modal-grande"> 
        
        <div className="modal-header">
          <h3>Adicionar Itens ao Inventário</h3>
          <button id="btn-fechar-loja" className="btn-fechar-modal" onClick={onClose}>
            X
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-abas">
            <button className={`aba-link ${abaAtiva === 'armas' ? 'active' : ''}`} onClick={() => setAbaAtiva('armas')}>Armas</button>
            <button className={`aba-link ${abaAtiva === 'protecoes' ? 'active' : ''}`} onClick={() => setAbaAtiva('protecoes')}>Proteções</button>
            <button className={`aba-link ${abaAtiva === 'geral' ? 'active' : ''}`} onClick={() => setAbaAtiva('geral')}>Geral</button>
            <button className={`aba-link ${abaAtiva === 'paranormal' ? 'active' : ''}`} onClick={() => setAbaAtiva('paranormal')}>Paranormal</button>
            <button className={`aba-link ${abaAtiva === 'personalizado' ? 'active' : ''}`} onClick={() => setAbaAtiva('personalizado')}>Personalizado</button>
          </div>

          {/* ... (Abas da Loja - Armas, Proteções, Geral, Paranormal - sem alteração) ... */}
          <div className={`aba-conteudo ${abaAtiva === 'armas' ? 'active' : ''}`}>
            <ul className="loja-lista-itens">
              {abasConteudo.armas.map(item => (
                <ItemCard key={item.id} item={item} tipo="loja" onAdd={onAddItem} />
              ))}
            </ul>
          </div>
          <div className={`aba-conteudo ${abaAtiva === 'protecoes' ? 'active' : ''}`}>
            <ul className="loja-lista-itens">
              {abasConteudo.protecoes.map(item => (
                <ItemCard key={item.id} item={item} tipo="loja" onAdd={onAddItem} />
              ))}
            </ul>
          </div>
          <div className={`aba-conteudo ${abaAtiva === 'geral' ? 'active' : ''}`}>
            <ul className="loja-lista-itens">
              {abasConteudo.geral.map(item => (
                <ItemCard key={item.id} item={item} tipo="loja" onAdd={onAddItem} />
              ))}
            </ul>
          </div>
          <div className={`aba-conteudo ${abaAtiva === 'paranormal' ? 'active' : ''}`}>
            <ul className="loja-lista-itens">
              {abasConteudo.paranormal.map(item => (
                <ItemCard key={item.id} item={item} tipo="loja" onAdd={onAddItem} />
              ))}
            </ul>
          </div>
          
          {/* --- 8. Aba de Item Personalizado (ATUALIZADA) --- */}
          <div className={`aba-conteudo ${abaAtiva === 'personalizado' ? 'active' : ''}`}>
            <form id="form-custom-item" className="form-custom-item" onSubmit={handleSubmitCustomItem}>
              <h3>Criar Item Personalizado</h3>
              <div className="campo-horizontal">
                <label>Nome do Item</label>
                <input type="text" id="custom-item-nome" required value={customNome} onChange={(e) => setCustomNome(e.target.value)} />
              </div>
              <div className="campo-horizontal">
                <label>Tipo do Item</label>
                <select value={customTipo} onChange={(e) => { setCustomTipo(e.target.value); setCustomMods([]); }}>
                  <option value="livre">Livre / regra da mesa</option>
                  <option value="arma-corpo-a-corpo">Arma corpo a corpo ou de disparo</option>
                  <option value="arma-fogo">Arma de fogo</option>
                  <option value="arma-fogo-balas">Munição de balas</option>
                  <option value="protecao-leve">Proteção leve</option>
                  <option value="protecao-pesada">Proteção pesada</option>
                  <option value="acessorio">Acessório</option>
                </select>
              </div>
              
              {/* Inputs de Categoria e Espaços atualizados (Layout de 4 colunas) */}
              <div className="form-custom-grid form-custom-grid-stats">
                <div className="campo-horizontal">
                  <label>Cat. Base</label>
                  <input type="number" id="custom-item-cat" value={customCat} onChange={(e) => setCustomCat(e.target.value)} min="0" max="4" />
                </div>
                 <div className="campo-horizontal">
                  <label>+ Mods (Cat.)</label>
                  <input type="text" value={`+${customMods.length}`} readOnly style={{backgroundColor: '#111', cursor: 'default', color: 'var(--cor-destaque)'}} />
                </div>
                <div className="campo-horizontal">
                  <label>Esp. Base</label>
                  <input type="text" id="custom-item-espacos" value={customEspacos} onChange={(e) => setCustomEspacos(e.target.value)} placeholder="Ex: 1 ou 0.5" />
                </div>
                 <div className="campo-horizontal">
                  <label>Cat. Final / Esp. Final</label>
                  <input type="text" value={`CAT ${catFinalCustom} / ESP ${espFinalCustom.toFixed(2)}`} readOnly style={{backgroundColor: '#111', cursor: 'default', color: 'var(--cor-destaque)', fontWeight: 'bold'}} />
                </div>
              </div>

              <div className="campo-horizontal">
                <label>Descrição (Opcional)</label>
                <textarea id="custom-item-desc" rows="2" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)}></textarea>
              </div>

              <h4>Bônus Automáticos (Opcional)</h4>
              {/* (Sem alteração aqui) */}
              <div className="form-custom-grid">
                <div className="campo-horizontal">
                  <label>Bônus de Defesa</label>
                  <input type="number" id="custom-item-defesa" value={customDefesa} onChange={(e) => setCustomDefesa(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label>Bônus de Perícia</label>
                  <input type="number" id="custom-item-bonus-pericia" value={customBonusPericia} onChange={(e) => setCustomBonusPericia(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label>Vincular Perícia</label>
                  <select id="custom-item-pericia-select" value={customPericiaSelect} onChange={(e) => setCustomPericiaSelect(e.target.value)}>
                    <option value="">Nenhuma</option>
                    {pericias.map(periciaKey => (
                      <option key={periciaKey} value={periciaKey}>{periciaKey}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 9. NOVA SEÇÃO: MODIFICAÇÕES (CUSTOM) */}
              <h4>Modificações Mundanas (Cada uma aumenta a Categoria em +I)</h4>
              <div className="form-custom-grid mods-lista-custom">
                
                {modificacoesCustomDisponiveis.map(mod => (
                  <label key={mod.key} title={mod.descricao} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'help'}}>
                    <input 
                      type="checkbox"
                      checked={customMods.includes(mod.key)}
                      onChange={() => handleCustomModToggle(mod.key)}
                    />
                    {mod.nome}
                  </label>
                ))}
              </div>

              <button type="submit" id="btn-add-custom-item" style={{marginTop: '20px'}}>
                Adicionar Item Personalizado
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ModalLoja;
