// /src/components/ModalNota.jsx

import React, { useEffect, useId, useRef, useState } from 'react';
import ModalBase from './ModalBase.jsx';

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
  const formId = useId();
  const tituloId = useId();
  const conteudoId = useId();
  const tituloRef = useRef(null);

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

  if (!isOpen) {
    return null;
  }

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={notaAtual ? 'Editar Anotação' : 'Nova Anotação'}
      size="medium"
      closeLabel="Fechar anotação"
      initialFocusRef={tituloRef}
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
            form={formId}
            id="btn-salvar-nota"
            className="caos-modal__button caos-modal__button--primary"
          >
            Salvar Anotação
          </button>
        </>
      )}
    >
      <form id={formId} className="form-custom-item" onSubmit={handleSubmit}>
        <div className="caos-modal__field">
          <label htmlFor={tituloId}>Título</label>
          <input
            ref={tituloRef}
            id={tituloId}
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título da Pista, NPC ou Local"
          />
        </div>

        <div className="caos-modal__field">
          <label htmlFor={conteudoId}>Conteúdo (Pode colar links de imagens aqui)</label>
          <textarea
            id={conteudoId}
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            placeholder="Descreva a pista"
            style={{
              minHeight: '250px',
              resize: 'vertical',
              fontFamily: '"Roboto Condensed", sans-serif',
              fontSize: '1em'
            }}
          />
        </div>
      </form>
    </ModalBase>
  );
}

export default ModalNota;
