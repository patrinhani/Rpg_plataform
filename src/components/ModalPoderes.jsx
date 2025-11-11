// /src/components/ModalPoderes.jsx

import React, { useState, useEffect } from 'react';

/**
 * Modal para seleção e gerenciamento de Poderes de Classe.
 * @param {object} props
 * @param {boolean} props.isOpen - Se o modal está visível.
 * @param {function} props.onClose - Função para fechar o modal.
 * @param {string} props.classe - A classe atual ('combatente', 'especialista', 'ocultista').
 * @param {object[]} props.poderesDisponiveis - A lista completa de poderes para a classe.
 * @param {object[]} props.poderesAprendidos - A lista de poderes que o personagem já possui.
 * @param {function} props.onTogglePoder - Função para adicionar/remover um poder.
 */
function ModalPoderes({ 
    isOpen, 
    onClose, 
    classe, 
    poderesDisponiveis, 
    poderesAprendidos,
    onTogglePoder 
}) {

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }
  
  const nomeClasse = classe.charAt(0).toUpperCase() + classe.slice(1);
  const aprendidosKeys = poderesAprendidos.map(p => p.key);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-conteudo modal-grande">
        
        <div className="modal-header">
          <h3>Poderes de {nomeClasse}</h3>
          <button className="btn-fechar-modal" onClick={onClose}>
            X
          </button>
        </div>

        <div className="modal-body">
          {/* Pode adicionar abas de filtro aqui (Combate, Paranormal, etc.) se necessário */}
          
          <ul className="loja-lista-itens" style={{ gridTemplateColumns: '1fr' }}>
            {poderesDisponiveis.length > 0 ? (
              poderesDisponiveis.map((poder) => {
                const isAprendido = aprendidosKeys.includes(poder.key);
                return (
                  <li key={poder.key} className="item-card" style={{opacity: isAprendido ? 1 : 0.6}}>
                    <div className="item-header" style={{backgroundColor: isAprendido ? 'var(--cor-caixa)' : 'var(--cor-caixa-recurso)'}}>
                      <h3 style={{color: isAprendido ? 'var(--cor-destaque)' : 'var(--cor-texto-principal)'}}>{poder.nome}</h3>
                      <div className="item-header-info">
                          {poder.tipo && <div><strong>Tipo:</strong> {poder.tipo}</div>}
                          {poder.prerequisito && <div><strong>PRÉ:</strong> {poder.prerequisito}</div>}
                      </div>
                    </div>

                    <div className="item-body">
                      <div className="item-descricao">{poder.descricao}</div>
                    </div>

                    <div className="item-footer">
                        <button 
                            className="loja-item-add"
                            style={{backgroundColor: isAprendido ? 'var(--cor-trans-sangue)' : 'var(--cor-destaque)'}}
                            onClick={() => onTogglePoder(poder)}
                        >
                          {isAprendido ? 'Remover Poder' : 'Adicionar Poder'}
                        </button>
                    </div>
                  </li>
                );
              })
            ) : (
              <li className="item-placeholder">Nenhum poder disponível para esta classe.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default ModalPoderes;