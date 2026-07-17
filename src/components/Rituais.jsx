import React from 'react';
import RitualCard from './RitualCard.jsx';
import FichaSectionFrame from './ficha/FichaSectionFrame.jsx';
import { AppIcon } from './icons/NavigationIcons.jsx';

function Rituais({ rituais, onAbrirModal, onRemoveRitual }) {
  const conhecidos = rituais || [];
  const elementos = new Set(conhecidos.map(ritual => ritual.elemento).filter(Boolean));
  const maiorCirculo = conhecidos.reduce((maior, ritual) => Math.max(maior, Number(ritual.circulo) || 0), 0);

  return (
    <FichaSectionFrame
      variant="rituals"
      icon="rituals"
      eyebrow="ARQUIVO OCULTISTA"
      title="Rituais"
      description="Um grimório operacional para consultar formas, custos e efeitos sem perder o contexto da ficha."
      metrics={[
        { label: 'Conhecidos', value: conhecidos.length },
        { label: 'Elementos', value: elementos.size },
        { label: 'Maior círculo', value: maiorCirculo || '—' },
      ]}
      action={(
        <button type="button" className="ficha-section-action" onClick={onAbrirModal}>
          <AppIcon name="plus" size={18} />
          Aprender ritual
        </button>
      )}
    >
      <section className="ficha-record-panel rituals-record-panel" id="grid-rituais" aria-labelledby="rituals-record-title">
        <header className="ficha-record-heading">
          <div>
            <span className="ficha-record-kicker">GRIMÓRIO PESSOAL</span>
            <h2 id="rituals-record-title">Rituais aprendidos</h2>
          </div>
          <span className="ficha-record-count">{conhecidos.length.toString().padStart(2, '0')}</span>
        </header>

        <ul id="lista-rituais" className="loja-lista-itens rituals-grid">
          {conhecidos.length > 0 ? (
            conhecidos.map(ritual => (
              <RitualCard
                key={ritual.inventarioId || ritual.id}
                ritual={ritual}
                tipo="inventario"
                onRemove={onRemoveRitual}
              />
            ))
          ) : (
            <li className="item-placeholder ficha-section-empty-state">
              <AppIcon name="rituals" size={28} />
              <strong>Nenhum ritual registrado</strong>
              <span>Consulte o arquivo ocultista para adicionar o primeiro ritual.</span>
            </li>
          )}
        </ul>
      </section>
    </FichaSectionFrame>
  );
}

export default Rituais;
