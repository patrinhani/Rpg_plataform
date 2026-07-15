import React, { useId } from 'react';
import ModalBase from './ModalBase.jsx';

export default function ModalSelecao({ isOpen, onClose, item, onSelect }) {
  const descriptionId = useId();

  if (!isOpen || !item) return null;

  const options = item.opcoes || [];
  const title = item.tituloModal || 'Selecionar';
  const description = item.descricaoModal || 'Escolha uma opção:';

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      closeLabel="Fechar seleção"
      describedBy={descriptionId}
    >
      <p id={descriptionId}>{description}</p>

      <ul className="caos-choice-list">
        {options.map((option) => (
          <li key={option.valor}>
            <button type="button" onClick={() => onSelect(option.valor)}>
              {option.nome}
            </button>
          </li>
        ))}
      </ul>
    </ModalBase>
  );
}
