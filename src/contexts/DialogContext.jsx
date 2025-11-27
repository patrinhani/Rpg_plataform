import React, { createContext, useContext, useState, useRef, useCallback } from 'react';

const DialogContext = createContext();

export function useDialog() {
  return useContext(DialogContext);
}

export function DialogProvider({ children }) {
  const [dialog, setDialog] = useState({
    isOpen: false,
    type: 'alert', // 'alert', 'confirm', 'prompt'
    title: '',
    message: '',
    inputValue: '',
    placeholder: '',
    confirmLabel: 'Confirmar',
    cancelLabel: 'Cancelar'
  });

  // Refs para guardar as funções resolve/reject da Promise ativa
  const promiseInfo = useRef({ resolve: null, reject: null });

  // --- Funções Públicas (Retornam Promises) ---

  // 1. ALERT: Retorna Promise<void> (apenas espera fechar)
  const showAlert = useCallback((message, title = 'Atenção', btnLabel = 'OK') => {
    return new Promise((resolve) => {
      promiseInfo.current = { resolve };
      setDialog({
        isOpen: true,
        type: 'alert',
        title,
        message,
        confirmLabel: btnLabel,
        inputValue: ''
      });
    });
  }, []);

  // 2. CONFIRM: Retorna Promise<boolean> (true/false)
  const showConfirm = useCallback((message, title = 'Confirmação', confirmLabel = 'Sim', cancelLabel = 'Não') => {
    return new Promise((resolve) => {
      promiseInfo.current = { resolve };
      setDialog({
        isOpen: true,
        type: 'confirm',
        title,
        message,
        confirmLabel,
        cancelLabel,
        inputValue: ''
      });
    });
  }, []);

  // 3. PROMPT: Retorna Promise<string | null> (texto ou null se cancelar)
  const showPrompt = useCallback((message, title = 'Entrada', placeholder = '', initialValue = '', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar') => {
    return new Promise((resolve) => {
      promiseInfo.current = { resolve };
      setDialog({
        isOpen: true,
        type: 'prompt',
        title,
        message,
        inputValue: initialValue,
        placeholder,
        confirmLabel,
        cancelLabel
      });
    });
  }, []);

  // --- Funções Internas (Ações dos Botões) ---

  const handleConfirm = (value) => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
    if (promiseInfo.current.resolve) {
      if (dialog.type === 'prompt') {
        promiseInfo.current.resolve(value); // Retorna string
      } else {
        promiseInfo.current.resolve(true); // Retorna true
      }
    }
  };

  const handleCancel = () => {
    setDialog((prev) => ({ ...prev, isOpen: false }));
    if (promiseInfo.current.resolve) {
      if (dialog.type === 'prompt') {
        promiseInfo.current.resolve(null); // Retorna null
      } else {
        promiseInfo.current.resolve(false); // Retorna false
      }
    }
  };

  const setInputValue = (val) => {
    setDialog(prev => ({ ...prev, inputValue: val }));
  };

  return (
    <DialogContext.Provider value={{ 
        dialog, 
        showAlert, 
        showConfirm, 
        showPrompt, 
        handleConfirm, 
        handleCancel,
        setInputValue
    }}>
      {children}
    </DialogContext.Provider>
  );
}