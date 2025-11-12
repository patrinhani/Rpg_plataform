// /src/components/ModalNota.jsx

import React, { useState, useEffect } from 'react';

/**
 * Props esperadas do App.jsx (através do Diario.jsx):
 * - isOpen: (boolean) Se o modal está visível.
 * - onClose: (função) Para fechar o modal.
 * - onSave: (função) Chamada ao salvar. Recebe o objeto da nota.
 * - notaAtual: (objeto | null) A nota a ser editada, ou null para criar uma nova.
 */
function ModalNota({ isOpen, onClose, onSave, notaAtual }) {
  
  // Estados internos do formulário
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');

  // Efeito para preencher o formulário se estivermos editando
  useEffect(() => {
    if (isOpen && notaAtual) {
      // Modo Edição: Preenche os campos
      setTitulo(notaAtual.titulo || '');
      setConteudo(notaAtual.conteudo || '');
    } else {
      // Modo Criação: Limpa os campos
      setTitulo('');
      setConteudo('');
    }
  }, [isOpen, notaAtual]); // Dispara quando o modal abre ou a nota muda

  // --- Handler do Formulário ---
  const handleSubmit = (e) => {
    e.preventDefault(); 

    const dadosNota = {
      titulo: titulo || "Nota sem Título",
      conteudo: conteudo
    };

    // A função 'onSave' (vinda do App.jsx) saberá se é uma criação ou edição
    // com base no 'notaAtual'
    onSave(dadosNota); 
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

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-conteudo"> {/* Usa o tamanho padrão de modal */}
        
        <div className="modal-header">
          <h3>{notaAtual ? "Editar Anotação" : "Nova Anotação"}</h3>
          <button className="btn-fechar-modal" onClick={onClose}>
            X
          </button>
        </div>

        <div className="modal-body">
          {/* Reutiliza o CSS do formulário de item customizado */ }
          <form className="form-custom-item" onSubmit={handleSubmit}>
              
              <div className="campo-horizontal">
                <label>Título</label>
                <input 
                  type="text" 
                  value={titulo} 
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Título da Pista, NPC ou Local"
                />
              </div>

              <div className="campo-horizontal">
                <label>Conteúdo (Pode colar links de imagens aqui)</label>
                <textarea
                  value={conteudo}
                  onChange={(e) => setConteudo(e.target.value)}
                  placeholder="Descreva a pista"
                  style={{
                    minHeight: '250px', // Altura do campo de texto no modal
                    resize: 'vertical',
                    fontFamily: '"Roboto Condensed", sans-serif',
                    fontSize: '1em'
                  }}
                />
              </div>

              <button type="submit" id="btn-salvar-nota">
                Salvar Anotação
              </button>
            </form>
        </div>
      </div>
    </div>
  );
}

export default ModalNota;