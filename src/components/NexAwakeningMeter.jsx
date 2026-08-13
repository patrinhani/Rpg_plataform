import React from 'react';

const STAGE_CONTENT = {
  latente: {
    label: 'Sinal latente',
    description: 'O Outro Lado ainda é apenas um ruído distante.',
  },
  ressonante: {
    label: 'Ressonância crescente',
    description: 'A ficha começa a responder à exposição paranormal.',
  },
  iminente: {
    label: 'Despertar iminente',
    description: 'A afinidade procura uma forma. O limiar está próximo.',
  },
  desperto: {
    label: 'Afinidade despertada',
    description: 'O limiar foi rompido. Escolha o elemento que respondeu.',
  },
};

const MILESTONES = [
  { value: 0, label: 'Latente' },
  { value: 20, label: 'Ressonante' },
  { value: 35, label: 'Iminente' },
  { value: 50, label: 'Afinidade' },
];

export default function NexAwakeningMeter({ state }) {
  const content = STAGE_CONTENT[state.stage] || STAGE_CONTENT.latente;

  return (
    <section className={`nex-awakening-meter nex-awakening-meter--${state.stage}`} aria-label="Evolução paranormal">
      <div className="nex-awakening-meter__copy">
        <span>EXPOSIÇÃO PARANORMAL</span>
        <strong>{content.label}</strong>
        <small>{content.description}</small>
      </div>

      <div className="nex-awakening-meter__readout" aria-label={`NEX ${state.nex}% de 50%`}>
        <b>{state.nex}%</b>
        <span>/ 50%</span>
      </div>

      <div className="nex-awakening-meter__timeline">
        <div
          className="nex-awakening-meter__track"
          role="progressbar"
          aria-label="Exposição até o despertar da afinidade"
          aria-valuemin="0"
          aria-valuemax="50"
          aria-valuenow={Math.min(state.nex, 50)}
        >
          <i style={{ width: `${state.progress * 100}%` }} />
        </div>

        <div className="nex-awakening-meter__milestones" aria-hidden="true">
          {MILESTONES.map((milestone) => (
            <span
              key={milestone.value}
              className={state.nex >= milestone.value ? 'is-reached' : ''}
              style={{ left: `${(milestone.value / 50) * 100}%` }}
            >
              <i />
              <b>{milestone.value}%</b>
              <small>{milestone.label}</small>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
