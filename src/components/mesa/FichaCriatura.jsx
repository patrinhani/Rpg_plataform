import React, { memo } from 'react';
import ModalBase from '../ModalBase.jsx';
import '../../styles/mesa.css';

const TEMAS_CRIATURA = {
  Sangue: {
    accent: '#ff6469',
    rgb: '255 100 105',
    symbol: '/assets/images/optimized/SimboloSangue-320.webp',
  },
  Morte: {
    accent: '#d9e2e8',
    rgb: '217 226 232',
    symbol: '/assets/images/optimized/SimboloMorte-320.webp',
  },
  Conhecimento: {
    accent: '#ffe45e',
    rgb: '255 228 94',
    symbol: '/assets/images/optimized/SimboloConhecimento-320.webp',
  },
  Energia: {
    accent: '#d56cff',
    rgb: '213 108 255',
    symbol: '/assets/images/optimized/SimboloEnergia-320.webp',
  },
  Medo: {
    accent: '#f3f7fa',
    rgb: '243 247 250',
    symbol: '/assets/images/optimized/SimboloSemafinidade-320.webp',
  },
};

function FichaCriatura({ dados, onClose }) {
  if (!dados) return null;

  const chaveTema = Object.keys(TEMAS_CRIATURA).find(elemento => String(dados.elemento || '').includes(elemento));
  const theme = TEMAS_CRIATURA[chaveTema] || TEMAS_CRIATURA.Medo;
  const attributes = Object.entries(dados.atributos || {});
  const abilities = dados.habilidades || [];
  const actions = dados.acoes || [];

  return (
    <ModalBase
      isOpen={Boolean(dados)}
      onClose={onClose}
      title={dados.nome || 'Criatura'}
      size="large"
      className="creature-sheet"
      bodyClassName="creature-sheet__body"
      closeLabel="Fechar ficha da criatura"
      panelStyle={{
        '--creature-accent': theme.accent,
        '--creature-accent-rgb': theme.rgb,
        '--modal-accent': theme.accent,
        '--modal-accent-rgb': theme.rgb,
      }}
    >
      <div className="creature-sheet__overview">
        <div className="creature-sheet__classification">
          <span>{dados.elemento || 'Medo'}</span>
          <span>{dados.tipo || 'Criatura paranormal'}</span>
          {dados.personalizada && <span>Ficha da mesa</span>}
        </div>
        <div className="creature-sheet__vd">
          <small>Valor de desafio</small>
          <strong>{dados.vd ?? '—'}</strong>
        </div>
      </div>

      <div className={`creature-sheet__visual ${dados.foto ? '' : 'creature-sheet__visual--symbol'}`}>
        <span className="creature-sheet__watermark" style={{ backgroundImage: `url(${theme.symbol})` }} aria-hidden="true" />
        <img
          src={dados.foto || theme.symbol}
          alt={dados.foto ? dados.nome : ''}
          aria-hidden={dados.foto ? undefined : 'true'}
          loading="lazy"
          decoding="async"
        />
      </div>

      <section className="creature-sheet__presence" aria-labelledby="creature-presence-title">
        <h3 id="creature-presence-title">Presença perturbadora</h3>
        <p>{dados.presenca || 'Sem informação registrada.'}</p>
      </section>

      <div className="creature-sheet__columns">
        <section className="creature-sheet__section">
          <h3>Sentidos</h3>
          <p>{dados.sentidos || '—'}</p>
          <p><strong>Iniciativa:</strong> {dados.iniciativa ?? '—'}</p>
        </section>

        <section className="creature-sheet__section">
          <h3>Defesa <strong>{dados.defesa ?? '—'}</strong></h3>
          <dl className="creature-sheet__compact-list">
            <div><dt>Fortitude</dt><dd>{dados.fortitude ?? '—'}</dd></div>
            <div><dt>Reflexos</dt><dd>{dados.reflexos ?? '—'}</dd></div>
            <div><dt>Vontade</dt><dd>{dados.vontade ?? '—'}</dd></div>
          </dl>
        </section>
      </div>

      <section className="creature-sheet__vitals" aria-label="Vida e resistências">
        <div className="creature-sheet__life">
          <span>Pontos de vida</span>
          <strong>{dados.pv_max ?? '—'}</strong>
          <small>Machucado: {dados.machucado ?? '—'}</small>
        </div>
        <dl>
          <div><dt>Resistências</dt><dd>{dados.resistencias || '—'}</dd></div>
          <div><dt>Vulnerabilidades</dt><dd>{dados.vulnerabilidades || '—'}</dd></div>
        </dl>
      </section>

      {attributes.length > 0 && (
        <section className="creature-sheet__attributes" aria-label="Atributos da criatura">
          {attributes.map(([attribute, value]) => (
            <div key={attribute}>
              <span>{attribute.toUpperCase()}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>
      )}

      <p className="creature-sheet__movement"><strong>Deslocamento:</strong> {dados.deslocamento || '—'}</p>

      {abilities.length > 0 && (
        <section className="creature-sheet__actions" aria-labelledby="creature-abilities-title">
          <h3 id="creature-abilities-title">Habilidades</h3>
          <ul>
            {abilities.map((ability, index) => {
              const [name, ...description] = String(ability).split(':');
              return (
                <li key={`${name || 'habilidade'}-${index}`}>
                  <strong>{description.length > 0 ? name : 'Habilidade'}</strong>
                  <p>{description.length > 0 ? description.join(':').trim() : ability}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="creature-sheet__actions" aria-labelledby="creature-actions-title">
        <h3 id="creature-actions-title">Ações</h3>
        {actions.length > 0 ? (
          <ul>
            {actions.map((action, index) => (
              <li key={`${action.nome || 'acao'}-${index}`}>
                <strong>{action.nome || 'Ação'}</strong>
                <p>{action.descricao || 'Sem descrição.'}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma ação registrada.</p>
        )}
      </section>
    </ModalBase>
  );
}

export default memo(FichaCriatura);
