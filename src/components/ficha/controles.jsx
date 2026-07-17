import React from 'react';

function Controles({ temaAtual, onThemeChange, canChangeTheme }) {
  if (!canChangeTheme) return null;

  return (
    <section className="box box-controles box-controles--affinity" id="grid-controles">
      <div>
        <span className="ficha-record-kicker">AFINIDADE DESBLOQUEADA</span>
        <strong>Elemento do agente</strong>
        <small>Disponível a partir de NEX 50%.</small>
      </div>
      <label htmlFor="tema-elemento" className="seletor-tema">
        <span className="sr-only">Afinidade</span>
        <select id="tema-elemento" value={temaAtual} onChange={event => onThemeChange(event.target.value)}>
          <option value="tema-ordem">Sem afinidade</option>
          <option value="tema-sangue">Sangue</option>
          <option value="tema-morte">Morte</option>
          <option value="tema-conhecimento">Conhecimento</option>
          <option value="tema-energia">Energia</option>
        </select>
      </label>
    </section>
  );
}

export default Controles;
