import React, { useId, useRef } from 'react';
import { useDialog } from '../contexts/DialogContext.jsx';
import ModalBase from './ModalBase.jsx';

export default function SystemDialog() {
  const { dialog, handleConfirm, handleCancel, setInputValue } = useDialog();
  const inputRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const formId = useId();
  const inputLabelId = useId();

  const handleSubmit = (event) => {
    event.preventDefault();
    handleConfirm(dialog.type === 'prompt' ? dialog.inputValue : undefined);
  };

  return (
    <ModalBase
      isOpen={dialog.isOpen}
      onClose={dialog.type === 'alert' ? undefined : handleCancel}
      closeOnOverlay={dialog.type !== 'alert'}
      title={dialog.title}
      size="small"
      closeLabel="Cancelar e fechar diálogo"
      initialFocusRef={dialog.type === 'prompt' ? inputRef : confirmButtonRef}
      footer={(
        <>
          {dialog.type !== 'alert' && (
            <button type="button" className="caos-modal__button caos-modal__button--secondary" onClick={handleCancel}>
              {dialog.cancelLabel}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            type="submit"
            form={formId}
            className="caos-modal__button caos-modal__button--primary"
          >
            {dialog.confirmLabel}
          </button>
        </>
      )}
    >
      <form id={formId} onSubmit={handleSubmit}>
        <p className="caos-modal__message">{dialog.message}</p>

        {dialog.type === 'prompt' && (
          <div className="caos-modal__field">
            <label id={inputLabelId} htmlFor={`${formId}-input`}>
              {dialog.placeholder || 'Resposta'}
            </label>
            <input
              ref={inputRef}
              id={`${formId}-input`}
              type="text"
              value={dialog.inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder={dialog.placeholder}
              aria-labelledby={inputLabelId}
            />
          </div>
        )}
      </form>
    </ModalBase>
  );
}
