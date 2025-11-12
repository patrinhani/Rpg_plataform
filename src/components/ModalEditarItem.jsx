// /src/components/ModalEditarItem.jsx
// (PASSO 3 - CORREÇÃO DE SINTAXE '??' E '||')

import React, { useState, useEffect } from 'react';
import { 
  modificacoesArmas, 
  modificacoesProtecoes, 
  modificacoesAcessorios 
} from '../lib/database.js';

const todasModificacoes = {
  ...modificacoesArmas.reduce((acc, mod) => ({ ...acc, [mod.key]: mod }), {}),
  ...modificacoesProtecoes.reduce((acc, mod) => ({ ...acc, [mod.key]: mod }), {}),
  ...modificacoesAcessorios.reduce((acc, mod) => ({ ...acc, [mod.key]: mod }), {}),
};

function ModalEditarItem({ isOpen, onClose, onSave, item, pericias }) {
  
  const [nome, setNome] = useState('');
  const [catBase, setCatBase] = useState(0); 
  const [espacosBase, setEspacosBase] = useState(1); 
  const [desc, setDesc] = useState('');
  const [defesa, setDefesa] = useState(0);
  const [bonusPericia, setBonusPericia] = useState(0);
  const [periciaSelect, setPericiaSelect] = useState('');
  const [modsSelecionadas, setModsSelecionadas] = useState([]);

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
    }
  }, [item, isOpen]);

  const handleModToggle = (modKey) => {
    setModsSelecionadas(prevMods => {
      if (prevMods.includes(modKey)) {
        return prevMods.filter(m => m !== modKey);
      } else {
        return [...prevMods, modKey];
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
    let categoriaFinal = parseInt(catBase) || 0;
    let espacosFinal = parseFloat(espacosBase) || 0; 

    modsSelecionadas.forEach(modKey => {
      const modData = todasModificacoes[modKey];
      if (modData) {
        categoriaFinal += (modData.cat || 1); 
        espacosFinal += (modData.espacos || 0);
      }
    });
    
    espacosFinal = Math.max(0, espacosFinal);
    return { categoriaFinal, espacosFinal };
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }
  
  const { categoriaFinal, espacosFinal } = calcularStatsFinais();

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-conteudo modal-grande"> 
        
        <div className="modal-header">
          <h3>Editar Item: {item ? item.nome : ''}</h3>
          <button className="btn-fechar-modal" onClick={onClose}>
            X
          </button>
        </div>

        <div className="modal-body">
          <form className="form-custom-item" onSubmit={handleSubmit}>
              
              <div className="campo-horizontal">
                <label>Nome do Item</label>
                <input type="text" id="edit-item-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              
              <div className="form-custom-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                <div className="campo-horizontal">
                  <label>Cat. Base</label>
                  <input type="number" id="edit-item-cat-base" value={catBase} onChange={(e) => setCatBase(e.target.value)} min="0" max="4" />
                </div>
                <div className="campo-horizontal">
                  <label>+ Mods (Cat.)</label>
                  <input type="text" value={`+${modsSelecionadas.length}`} readOnly style={{backgroundColor: '#111', cursor: 'default', color: 'var(--cor-destaque)'}} />
                </div>
                <div className="campo-horizontal">
                  <label>Esp. Base</label>
                  <input 
                    type="text" 
                    id="edit-item-espacos-base" 
                    value={espacosBase} 
                    onChange={(e) => setEspacosBase(e.target.value)} 
                  />
                </div>
                <div className="campo-horizontal">
                  <label>Cat. Final / Esp. Final</label>
                  {/* Usando toFixed(2) para lidar com '0.5' ou '0.25' */}
                  <input type="text" value={`CAT ${categoriaFinal} / ESP ${espacosFinal.toFixed(2)}`} readOnly style={{backgroundColor: '#111', cursor: 'default', color: 'var(--cor-destaque)', fontWeight: 'bold'}} />
                </div>
              </div>
              
              <div className="campo-horizontal">
                <label>Descrição</label>
                <textarea id="edit-item-desc" rows="3" value={desc} onChange={(e) => setDesc(e.target.value)}></textarea>
              </div>

              <h4>Bônus Automáticos (Opcional)</h4>
              <div className="form-custom-grid">
                <div className="campo-horizontal">
                  <label>Bônus de Defesa</label>
                  <input type="number" id="edit-item-defesa" value={defesa} onChange={(e) => setDefesa(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label>Bônus de Perícia</label>
                  <input type="number" id="edit-item-bonus-pericia" value={bonusPericia} onChange={(e) => setBonusPericia(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label>Vincular Perícia</label>
                  <select id="edit-item-pericia-select" value={periciaSelect} onChange={(e) => setPericiaSelect(e.target.value)}>
                    <option value="">Nenhuma</option>
                    {pericias.map(periciaKey => (
                      <option key={periciaKey} value={periciaKey}>{periciaKey}</option>
                    ))}
                  </select>
                </div>
              </div>

              <h4>Modificações Mundanas (Cada uma aumenta a Categoria em +I)</h4>
              <div className="form-custom-grid" style={{ 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  backgroundColor: 'var(--cor-fundo)', 
                  padding: '10px', 
                  borderRadius: '4px',
                  border: '1px solid var(--cor-caixa-recurso)'
              }}>
                
                {modificacoesArmas.map(mod => (
                  <label key={mod.key} title={mod.descricao} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'help'}}>
                    <input 
                      type="checkbox"
                      checked={modsSelecionadas.includes(mod.key)}
                      onChange={() => handleModToggle(mod.key)}
                    />
                    {mod.nome}
                  </label>
                ))}
                {modificacoesProtecoes.map(mod => (
                  <label key={mod.key} title={mod.descricao} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'help'}}>
                    <input 
                      type="checkbox"
                      checked={modsSelecionadas.includes(mod.key)}
                      onChange={() => handleModToggle(mod.key)}
                    />
                    {mod.nome}
                  </label>
                ))}
                {modificacoesAcessorios.map(mod => (
                  <label key={mod.key} title={mod.descricao} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'help'}}>
                    <input 
                      type="checkbox"
                      checked={modsSelecionadas.includes(mod.key)}
                      onChange={() => handleModToggle(mod.key)}
                    />
                    {mod.nome}
                  </label>
                ))}
              </div>
              
              <button type="submit" id="btn-salvar-item-editado" style={{marginTop: '20px'}}>
                Salvar Alterações
              </button>
            </form>
        </div>
      </div>
    </div>
  );
}

export default ModalEditarItem;