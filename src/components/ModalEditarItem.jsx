// /src/components/ModalEditarItem.jsx

import React, { useState, useEffect } from 'react';

/**
 * Props esperadas do App.jsx:
 * - isOpen: (boolean) Se o modal está visível.
 * - onClose: (função) Para fechar o modal.
 * - onSave: (função) O que fazer quando o usuário clica em "Salvar".
 * - item: (objeto) O item do inventário que está sendo editado.
 * - pericias: (array) A lista completa de perícias (para o select).
 */
function ModalEditarItem({ isOpen, onClose, onSave, item, pericias }) {
  
  // Estados internos do formulário
  const [nome, setNome] = useState('');
  const [cat, setCat] = useState(0);
  const [espacos, setEspacos] = useState(1);
  const [desc, setDesc] = useState('');
  const [defesa, setDefesa] = useState(0);
  const [bonusPericia, setBonusPericia] = useState(0);
  const [periciaSelect, setPericiaSelect] = useState('');
  
  // --- A MÁGICA ACONTECE AQUI ---
  // Este 'useEffect' é disparado sempre que o modal é aberto
  // ou o 'item' para editar é alterado.
  useEffect(() => {
    if (item) {
      // Preenche os estados do formulário com os dados do item
      setNome(item.nome || '');
      setCat(item.categoria || 0);
      setEspacos(item.espacos || 0);
      setDesc(item.descricao || '');
      setDefesa(item.defesa || 0);
      setBonusPericia(item.valorBonus || 0);
      setPericiaSelect(item.periciaVinculada || '');
    }
  }, [item, isOpen]); // Depende do 'item' e 'isOpen'

  // --- Handler do Formulário ---
  const handleSubmit = (e) => {
    e.preventDefault(); 

    const bonusValor = parseInt(bonusPericia) || 0;
    const periciaNome = periciaSelect;

    // Cria um objeto 'item' atualizado com os dados do formulário
    const itemAtualizado = {
      ...item, // Mantém o ID original e outras props (como 'elemento', etc)
      nome: nome || "Item Editado",
      categoria: parseInt(cat) || 0,
      espacos: parseInt(espacos) || 0,
      descricao: desc || "",
      defesa: parseInt(defesa) || 0,
      valorBonus: bonusValor,
      periciaVinculada: bonusValor > 0 && periciaNome ? periciaNome : null,
      tipoBonus: (bonusValor > 0 && periciaNome) ? (item.id.startsWith('custom_') ? 'custom' : 'generico') : null,
    };

    onSave(itemAtualizado); // Envia o item atualizado para o App.jsx
    onClose(); // Fecha o modal
  };

  // --- Handler para fechar o modal clicando no fundo ---
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  // --- Renderização do Modal (Baseado no ModalLoja) ---
  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-conteudo">
        
        <div className="modal-header">
          <h3>Editar Item: {item ? item.nome : ''}</h3>
          <button className="btn-fechar-modal" onClick={onClose}>
            X
          </button>
        </div>

        <div className="modal-body">
          {/* O formulário é idêntico ao de "Item Personalizado" */}
          <form className="form-custom-item" onSubmit={handleSubmit}>
              
              <div className="campo-horizontal">
                <label>Nome do Item</label>
                <input type="text" id="edit-item-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="form-custom-grid">
                <div className="campo-horizontal">
                  <label>Categoria (I, II, III, IV)</label>
                  <input type="number" id="edit-item-cat" value={cat} onChange={(e) => setCat(e.target.value)} min="0" max="4" />
                </div>
                <div className="campo-horizontal">
                  <label>Espaços (Peso)</label>
                  <input type="number" id="edit-item-espacos" value={espacos} onChange={(e) => setEspacos(e.target.value)} min="0" />
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
                    {/* Mapeia a lista de perícias recebida por 'props' */}
                    {pericias.map(periciaKey => (
                      <option key={periciaKey} value={periciaKey}>{periciaKey}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" id="btn-salvar-item-editado">
                Salvar Alterações
              </button>
            </form>
        </div>
      </div>
    </div>
  );
}

export default ModalEditarItem;