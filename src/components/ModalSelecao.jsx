// /src/components/ModalSelecao.jsx

import React from 'react';

/**
 * Props esperadas do App.jsx:
 * - isOpen: (boolean) Se o modal está visível.
 * - onClose: (função) Para fechar o modal.
 * - item: O item pendente (ex: { nome: 'Vestimenta', ... })
 * - onSelect: (função) O que fazer quando o usuário clica em uma opção.
 */
function ModalSelecao({ isOpen, onClose, item, onSelect }) {
  
  // Se não estiver aberto, não renderiza nada
  if (!isOpen || !item) {
    return null;
  }

  // Pega a lista de perícias do 'item' (enviada pelo App.jsx)
  const listaOpcoes = item.opcoes || [];
  let titulo = item.tituloModal || 'Selecionar';
  let descricao = item.descricaoModal || 'Escolha uma opção:';

  // Handler para fechar o modal clicando no fundo
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-conteudo modal-pequeno"> {/* Estilo de modal pequeno */}
        
        <div className="modal-header">
          <h3 id="modal-pericia-titulo">{titulo}</h3>
          <button id="btn-fechar-selecao" className="btn-fechar-modal" onClick={onClose}>
            X
          </button>
        </div>

        <div className="modal-body">
          <p id="modal-pericia-descricao">{descricao}</p>
          
          <ul id="lista-selecao-pericia">
            {listaOpcoes.map((opcao) => (
              <li 
                key={opcao.valor} // 'valor' (ex: 'acrobacia' ou 'Sangue')
                // Chama a função onSelect (do App.jsx) com o valor da opção
                onClick={() => onSelect(opcao.valor)} 
              >
                {opcao.nome} {/* 'nome' (ex: 'Acrobacia' ou 'Sangue') */}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}

export default ModalSelecao;