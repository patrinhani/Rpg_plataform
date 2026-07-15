// /src/components/ModalEditarItem.jsx
// (PASSO 3 - CORREÇÃO DE SINTAXE '??' E '||')

import React, { useState, useEffect } from 'react';
import ModalBase from './ModalBase.jsx';
import {
  calcularStatsItem,
  getModificacao,
  getModificacoesCompativeis,
  modificacoesSaoIncompativeis,
} from '../lib/inventario.js';

function ModalEditarItem({ isOpen, onClose, onSave, item, pericias }) {
  
  const [nome, setNome] = useState('');
  const [catBase, setCatBase] = useState(0); 
  const [espacosBase, setEspacosBase] = useState(1); 
  const [desc, setDesc] = useState('');
  const [defesa, setDefesa] = useState(0);
  const [bonusPericia, setBonusPericia] = useState(0);
  const [periciaSelect, setPericiaSelect] = useState('');
  const [modsSelecionadas, setModsSelecionadas] = useState([]);
  const [quebrado, setQuebrado] = useState(false);

  useEffect(() => {
    if (item) {
      setNome(item.nome || '');
      
      // --- CORRIGIDO: Adicionado parênteses para agrupar a lógica ---
      // Tenta a 'categoriaBase'. Se for null/undefined, tenta 'item.categoria'. Se ambos forem null/undefined, usa 0.
      setCatBase( (item.categoriaBase ?? item.categoria) ?? 0 );
      setEspacosBase( (item.espacosBase ?? item.espacos) ?? 0 );
      // --- FIM DA CORREÇÃO ---
      
      setDesc(item.descricao || '');
      setDefesa(item.defesa || 0);
      setBonusPericia(item.valorBonus || 0);
      setPericiaSelect(item.periciaVinculada || '');
      setModsSelecionadas(item.modificacoes || []);
      setQuebrado(Boolean(item.quebrado));
    }
  }, [item, isOpen]);

  const handleModToggle = (modKey) => {
    setModsSelecionadas(prevMods => {
      if (prevMods.includes(modKey)) {
        return prevMods.filter(m => m !== modKey);
      } else {
        return [...prevMods.filter(chave => !modificacoesSaoIncompativeis(chave, modKey)), modKey];
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault(); 

    const bonusValor = parseInt(bonusPericia) || 0;
    const periciaNome = periciaSelect;

    const itemAtualizado = {
      ...item, 
      nome: nome || "Item Editado",
      categoriaBase: parseInt(catBase) || 0,
      espacosBase: parseFloat(espacosBase) || 0, 
      descricao: desc || "",
      defesa: parseInt(defesa) || 0,
      valorBonus: bonusValor,
      periciaVinculada: bonusValor > 0 && periciaNome ? periciaNome : null,
      tipoBonus: (bonusValor > 0 && periciaNome) ? (item.id.startsWith('custom_') ? 'custom' : 'generico') : null,
      modificacoes: modsSelecionadas,
    };

    onSave(itemAtualizado); 
    onClose(); 
  };

  const calcularStatsFinais = () => {
    const stats = calcularStatsItem({
      ...item,
      categoriaBase: catBase,
      espacosBase,
      modificacoes: modsSelecionadas,
      quebrado,
    });
    return { categoriaFinal: stats.categoria, espacosFinal: stats.espacos };
  };

  if (!isOpen) {
    return null;
  }
  
  const { categoriaFinal, espacosFinal } = calcularStatsFinais();
  const modificacoesDisponiveis = [
    ...getModificacoesCompativeis(item || {}),
    ...modsSelecionadas.map(getModificacao).filter(Boolean),
  ].filter((modificacao, indice, lista) =>
    lista.findIndex(itemLista => itemLista.key === modificacao.key) === indice,
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Item: ${item ? item.nome : ''}`}
      size="wide"
      closeLabel="Fechar edição do item"
      footer={(
        <>
          <button
            type="button"
            className="caos-modal__button caos-modal__button--secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-edit-item"
            className="caos-modal__button caos-modal__button--primary"
          >
            Salvar Alterações
          </button>
        </>
      )}
    >
          <form id="form-edit-item" className="form-custom-item" onSubmit={handleSubmit}>
              
              <div className="campo-horizontal">
                <label htmlFor="edit-item-nome">Nome do Item</label>
                <input type="text" id="edit-item-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              
              <div className="form-custom-grid form-custom-grid-stats">
                <div className="campo-horizontal">
                  <label htmlFor="edit-item-cat-base">Cat. Base</label>
                  <input type="number" id="edit-item-cat-base" value={catBase} onChange={(e) => setCatBase(e.target.value)} min="0" max="4" />
                </div>
                <div className="campo-horizontal">
                  <label htmlFor="edit-item-mods-total">+ Mods (Cat.)</label>
                  <input id="edit-item-mods-total" type="text" value={`+${modsSelecionadas.length}`} readOnly style={{backgroundColor: '#111', cursor: 'default', color: 'var(--cor-destaque)'}} />
                </div>
                <div className="campo-horizontal">
                  <label htmlFor="edit-item-espacos-base">Esp. Base</label>
                  <input 
                    type="text" 
                    id="edit-item-espacos-base" 
                    value={espacosBase} 
                    onChange={(e) => setEspacosBase(e.target.value)} 
                  />
                </div>
                <div className="campo-horizontal">
                  <label htmlFor="edit-item-stats-final">Cat. Final / Esp. Final</label>
                  {/* Usando toFixed(2) para lidar com '0.5' ou '0.25' */}
                  <input id="edit-item-stats-final" type="text" value={`CAT ${categoriaFinal} / ESP ${espacosFinal.toFixed(2)}`} readOnly style={{backgroundColor: '#111', cursor: 'default', color: 'var(--cor-destaque)', fontWeight: 'bold'}} />
                </div>
              </div>
              
              <div className="campo-horizontal">
                <label htmlFor="edit-item-desc">Descrição</label>
                <textarea id="edit-item-desc" rows="3" value={desc} onChange={(e) => setDesc(e.target.value)}></textarea>
              </div>

              <label htmlFor="edit-item-quebrado" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <input id="edit-item-quebrado" type="checkbox" checked={quebrado} onChange={(e) => setQuebrado(e.target.checked)} />
                Item quebrado (não concede bônus até receber manutenção)
              </label>

              <h4>Bônus Automáticos (Opcional)</h4>
              <div className="form-custom-grid">
                <div className="campo-horizontal">
                  <label htmlFor="edit-item-defesa">Bônus de Defesa</label>
                  <input type="number" id="edit-item-defesa" value={defesa} onChange={(e) => setDefesa(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label htmlFor="edit-item-bonus-pericia">Bônus de Perícia</label>
                  <input type="number" id="edit-item-bonus-pericia" value={bonusPericia} onChange={(e) => setBonusPericia(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label htmlFor="edit-item-pericia-select">Vincular Perícia</label>
                  <select id="edit-item-pericia-select" value={periciaSelect} onChange={(e) => setPericiaSelect(e.target.value)}>
                    <option value="">Nenhuma</option>
                    {pericias.map(periciaKey => (
                      <option key={periciaKey} value={periciaKey}>{periciaKey}</option>
                    ))}
                  </select>
                </div>
              </div>

              <h4>Modificações Mundanas (Cada uma aumenta a Categoria em +I)</h4>
              <div className="form-custom-grid mods-lista-custom mods-lista-custom-alta">
                
                {modificacoesDisponiveis.map(mod => (
                  <label key={mod.key} htmlFor={`edit-item-mod-${mod.key}`} title={mod.descricao} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'help'}}>
                    <input 
                      id={`edit-item-mod-${mod.key}`}
                      type="checkbox"
                      checked={modsSelecionadas.includes(mod.key)}
                      onChange={() => handleModToggle(mod.key)}
                    />
                    {mod.nome}
                  </label>
                ))}
              </div>
              
            </form>
    </ModalBase>
  );
}

export default ModalEditarItem;
