import React, { useEffect, useRef } from 'react';
import { useDialog } from '../contexts/DialogContext';

export default function SystemDialog() {
  const { dialog, handleConfirm, handleCancel, setInputValue } = useDialog();
  const inputRef = useRef(null);

  // Foca no input automaticamente se for um prompt
  useEffect(() => {
    if (dialog.isOpen && dialog.type === 'prompt' && inputRef.current) {
      // Pequeno delay para garantir que o elemento renderizou
      setTimeout(() => inputRef.current.focus(), 100);
    }
  }, [dialog.isOpen, dialog.type]);

  // Fecha ao pressionar ESC ou confirma com ENTER
  useEffect(() => {
    const handleKeyDown = (e) => {
        if (!dialog.isOpen) return;
        
        if (e.key === 'Escape' && dialog.type !== 'alert') {
            handleCancel();
        }
        
        if (e.key === 'Enter') {
            if (dialog.type !== 'alert') {
                handleConfirm(dialog.inputValue);
            } else {
                handleConfirm();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialog, handleCancel, handleConfirm]);

  if (!dialog.isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-conteudo" style={{ maxWidth: '450px', textAlign: 'center', border: '1px solid var(--cor-destaque)', background: 'rgba(10,10,10,0.95)' }}>
        
        {/* Header */}
        <div className="modal-header" style={{ justifyContent: 'center', borderBottom: '1px solid var(--cor-borda)' }}>
          <h3 style={{ color: 'var(--cor-destaque)', fontSize: '1.4em', margin: 0 }}>{dialog.title}</h3>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '25px 20px' }}>
          <p style={{ fontSize: '1.1em', color: 'var(--cor-texto-principal)', marginBottom: '20px', whiteSpace: 'pre-wrap' }}>
            {dialog.message}
          </p>

          {/* Input para Prompt */}
          {dialog.type === 'prompt' && (
            <div className="input-group" style={{ marginBottom: '10px' }}>
              <input
                ref={inputRef}
                type="text"
                value={dialog.inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={dialog.placeholder}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--cor-borda)',
                  color: '#fff',
                  textAlign: 'center',
                  fontSize: '1.1em'
                }}
              />
            </div>
          )}
        </div>

        {/* Footer (Botões) */}
        <div className="modal-footer" style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '15px', 
            padding: '0 20px 20px 20px' 
        }}>
          {/* Botão Cancelar (Não aparece no Alert) */}
          {dialog.type !== 'alert' && (
            <button 
              onClick={handleCancel}
              className="item-inventario-remover" // Reutilizando classe de botão vermelho/escuro
              style={{ minWidth: '100px', padding: '10px' }}
            >
              {dialog.cancelLabel}
            </button>
          )}

          {/* Botão Confirmar */}
          <button 
            onClick={() => handleConfirm(dialog.inputValue)}
            className="btn-login primary" // Reutilizando classe de botão azul/destaque
            style={{ margin: 0, minWidth: '100px', padding: '10px' }}
          >
            {dialog.confirmLabel}
          </button>
        </div>

      </div>
    </div>
  );
}