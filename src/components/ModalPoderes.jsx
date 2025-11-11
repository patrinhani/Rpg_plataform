// /src/components/ModalPoderes.jsx

import React, { useState, useEffect } from 'react';

/**
 * Modal para seleção e gerenciamento de Poderes de Classe e Gerais.
 * @param {object} props
 * @param {boolean} props.isOpen - Se o modal está visível.
 * @param {function} props.onClose - Função para fechar o modal.
 * @param {string} props.classe - A classe atual ('combatente', 'especialista', 'ocultista').
 * @param {object[]} props.poderesDisponiveis - A lista completa de poderes para a classe.
 * @param {object[]} props.poderesGerais - A lista de poderes gerais.
 * @param {object[]} props.poderesAprendidos - A lista de poderes que o personagem já possui.
 * @param {function} props.onTogglePoder - Função para adicionar/remover um poder.
 */
function ModalPoderes({ 
    isOpen, 
    onClose, 
    classe, 
    poderesDisponiveis, 
    poderesGerais,
    poderesAprendidos,
    onTogglePoder 
}) {
    
  // Controla a aba interna do modal (Classe ou Geral)
  const [abaAtiva, setAbaAtiva] = useState('classe');

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Reseta a aba para "classe" sempre que o modal abrir ou a classe mudar
  useEffect(() => {
    if (isOpen) {
      setAbaAtiva('classe');
    }
  }, [isOpen, classe]);

  if (!isOpen) {
    return null;
  }
  
  const nomeClasse = classe.charAt(0).toUpperCase() + classe.slice(1);
  const aprendidosKeys = poderesAprendidos.map(p => p.key);

  // Função helper para renderizar uma lista de poderes (cards)
  const renderListaPoderes = (lista) => {
    return (
      <ul className="loja-lista-itens" style={{ gridTemplateColumns: '1fr' }}>
        {lista && lista.length > 0 ? (
          lista.map((poder) => {
            const isAprendido = aprendidosKeys.includes(poder.key);
            return (
              <li key={poder.key} className="item-card" style={{opacity: isAprendido ? 1 : 0.7}}>
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
                    {/* --- BOTÃO CORRIGIDO AQUI --- */}
                    <button 
                        className="loja-item-add"
                        style={{
                           backgroundColor: isAprendido ? 'var(--cor-trans-sangue)' : 'var(--cor-destaque)',
                           /* CORREÇÃO: Usar a cor de fundo mais escura (--cor-caixa-recurso) para o texto */
                           color: isAprendido ? null : 'var(--cor-caixa-recurso)' 
                        }}
                        onClick={() => onTogglePoder(poder)}
                    >
                      {isAprendido ? 'Remover Poder' : 'Adicionar Poder'}
                    </button>
                    {/* --- FIM DA CORREÇÃO --- */}
                </div>
              </li>
            );
          })
        ) : (
          <li className="item-placeholder">Nenhum poder disponível nesta categoria.</li>
        )}
      </ul>
    );
  };


  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-conteudo modal-grande">
        
        <div className="modal-header">
          <h3>Biblioteca de Poderes</h3>
          <button className="btn-fechar-modal" onClick={onClose}>
            X
          </button>
        </div>

        <div className="modal-body">
            {/* Abas Internas do Modal (Classe e Geral) */}
            <div className="modal-abas">
                <button 
                    className={`aba-link ${abaAtiva === 'classe' ? 'active' : ''}`} 
                    onClick={() => setAbaAtiva('classe')}
                >
                    Poderes de {nomeClasse}
                </button>
                <button 
                    className={`aba-link ${abaAtiva === 'geral' ? 'active' : ''}`} 
                    onClick={() => setAbaAtiva('geral')}
                >
                    Poderes Gerais
                </button>
            </div>

            {/* Conteúdo da Aba Classe */}
            <div className={`aba-conteudo ${abaAtiva === 'classe' ? 'active' : ''}`}>
                {renderListaPoderes(poderesDisponiveis)}
            </div>

            {/* Conteúdo da Aba Geral */}
            <div className={`aba-conteudo ${abaAtiva === 'geral' ? 'active' : ''}`}>
                {renderListaPoderes(poderesGerais)}
            </div>
        </div>
      </div>
    </div>
  );
}

export default ModalPoderes;