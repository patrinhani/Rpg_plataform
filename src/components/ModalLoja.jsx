// /src/components/ModalLoja.jsx

import React, { useState } from 'react';
import { database } from '../lib/database.js'; // Importa o database
import ItemCard from './ItemCard.jsx';         // Importa o card de item

/**
 * Props que este componente espera receber do App.jsx:
 * - isOpen: (boolean) Se o modal deve estar visível.
 * - onClose: (função) O que fazer quando o modal for fechado (pelo 'X' ou fundo).
 * - onAddItem: (função) O que fazer quando o usuário clica em "Adicionar" em um item.
 * - pericias: (array) A lista de perícias (para o form de item custom).
 */
function ModalLoja({ isOpen, onClose, onAddItem, pericias }) {
  
  // Estado interno para controlar qual aba DO MODAL está ativa
  const [abaAtiva, setAbaAtiva] = useState('armas');

  // --- Estados para o Formulário de Item Personalizado ---
  // (Replicamos o formulário do index.html)
  const [customNome, setCustomNome] = useState('');
  const [customCat, setCustomCat] = useState(0);
  const [customEspacos, setCustomEspacos] = useState(1);
  const [customDesc, setCustomDesc] = useState('');
  const [customDefesa, setCustomDefesa] = useState(0);
  const [customBonusPericia, setCustomBonusPericia] = useState(0);
  const [customPericiaSelect, setCustomPericiaSelect] = useState('');

  // --- Organiza os itens do Database para as Abas ---
  // (Idêntico à lógica do main.js)
  const abasConteudo = {
    armas: [
      ...(database.armasSimples || []),
      ...(database.armasTaticas || []),
      ...(database.armasPesadas || []),
      ...(database.municoes || []),
    ],
    protecoes: [...(database.protecoes || [])],
    geral: [...(database.equipGeral || [])],
    paranormal: [...(database.itensParanormais || [])],
  };

  // --- Handler do Formulário Customizado ---
  const handleSubmitCustomItem = (e) => {
    e.preventDefault(); // Impede o refresh da página

    const bonusValor = parseInt(customBonusPericia) || 0;
    const periciaNome = customPericiaSelect;

    const itemCustom = {
      id: `custom_${Date.now()}`, // ID único
      nome: customNome || "Item Personalizado",
      categoria: parseInt(customCat) || 0,
      espacos: parseInt(customEspacos) || 0,
      descricao: customDesc || "",
      defesa: parseInt(customDefesa) || 0,
      valorBonus: bonusValor,
      periciaVinculada: bonusValor > 0 && periciaNome ? periciaNome : null,
      tipoBonus: bonusValor > 0 && periciaNome ? "custom" : null,
    };

    onAddItem(itemCustom); // Envia o item criado para o App.jsx

    // Limpa o formulário e fecha o modal
    setCustomNome('');
    setCustomCat(0);
    setCustomEspacos(1);
    setCustomDesc('');
    setCustomDefesa(0);
    setCustomBonusPericia(0);
    setCustomPericiaSelect('');
    onClose();
  };

  // --- Handler para fechar o modal clicando no fundo ---
  const handleOverlayClick = (e) => {
    // Se o clique foi no 'modal-overlay' (o fundo) e não no 'modal-conteudo'
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Se a 'prop' isOpen for false, não renderiza nada (retorna null)
  if (!isOpen) {
    return null;
  }

  // --- Renderização do Modal ---
  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-conteudo">
        
        {/* --- Cabeçalho do Modal --- */}
        <div className="modal-header">
          <h3>Adicionar Itens ao Inventário</h3>
          <button id="btn-fechar-loja" className="btn-fechar-modal" onClick={onClose}>
            X
          </button>
        </div>

        {/* --- Corpo do Modal (Abas) --- */}
        <div className="modal-body">
          <div className="modal-abas">
            {/* Botões que trocam o estado 'abaAtiva' */}
            <button className={`aba-link ${abaAtiva === 'armas' ? 'active' : ''}`} onClick={() => setAbaAtiva('armas')}>Armas</button>
            <button className={`aba-link ${abaAtiva === 'protecoes' ? 'active' : ''}`} onClick={() => setAbaAtiva('protecoes')}>Proteções</button>
            <button className={`aba-link ${abaAtiva === 'geral' ? 'active' : ''}`} onClick={() => setAbaAtiva('geral')}>Geral</button>
            <button className={`aba-link ${abaAtiva === 'paranormal' ? 'active' : ''}`} onClick={() => setAbaAtiva('paranormal')}>Paranormal</button>
            <button className={`aba-link ${abaAtiva === 'personalizado' ? 'active' : ''}`} onClick={() => setAbaAtiva('personalizado')}>Personalizado</button>
          </div>

          {/* --- Conteúdo das Abas (Renderização Condicional) --- */}
          
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

          {/* --- Aba de Item Personalizado --- */}
          <div className={`aba-conteudo ${abaAtiva === 'personalizado' ? 'active' : ''}`}>
            <form id="form-custom-item" className="form-custom-item" onSubmit={handleSubmitCustomItem}>
              <h3>Criar Item Personalizado</h3>
              <div className="campo-horizontal">
                <label>Nome do Item</label>
                <input type="text" id="custom-item-nome" required value={customNome} onChange={(e) => setCustomNome(e.target.value)} />
              </div>
              <div className="form-custom-grid">
                <div className="campo-horizontal">
                  <label>Categoria (I, II, III, IV)</label>
                  <input type="number" id="custom-item-cat" value={customCat} onChange={(e) => setCustomCat(e.target.value)} min="0" max="4" />
                </div>
                <div className="campo-horizontal">
                  <label>Espaços (Peso)</label>
                  <input type="number" id="custom-item-espacos" value={customEspacos} onChange={(e) => setCustomEspacos(e.target.value)} min="0" />
                </div>
              </div>
              <div className="campo-horizontal">
                <label>Descrição (Opcional)</label>
                <textarea id="custom-item-desc" rows="2" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)}></textarea>
              </div>

              <h4>Bônus Automáticos (Opcional)</h4>
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
                    {/* Mapeia a lista de perícias recebida por 'props' */}
                    {pericias.map(periciaKey => (
                      <option key={periciaKey} value={periciaKey}>{periciaKey}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" id="btn-add-custom-item">
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