import React from 'react';
import NotaCard from './NotaCard.jsx';
import FichaSectionFrame from './ficha/FichaSectionFrame.jsx';
import HandoutEvidencePanel from './handouts/HandoutEvidencePanel.jsx';
import { AppIcon } from './icons/NavigationIcons.jsx';

function Diario({ diarioData, handoutSession, onAbrirModal, onRemoveNota }) {
  const notas = diarioData || [];
  const evidencias = Array.isArray(handoutSession?.deliveredHandouts)
    ? handoutSession.deliveredHandouts
    : [];
  const palavras = notas.reduce((total, nota) => {
    const conteudo = String(nota.conteudo || nota.texto || '').trim();
    return total + (conteudo ? conteudo.split(/\s+/).length : 0);
  }, 0);

  return (
    <FichaSectionFrame
      variant="journal"
      icon="journal"
      eyebrow="REGISTRO DE INVESTIGAÇÃO"
      title="Diário"
      description="Hipóteses, pistas e registros de campo organizados sem interferir nas regras da ficha."
      metrics={[
        { label: 'Entradas', value: notas.length },
        handoutSession && { label: 'Evidências', value: evidencias.length },
        { label: 'Palavras', value: palavras },
        { label: 'Última revisão', value: notas.length > 0 ? 'Registrada' : '—' },
      ]}
      className={handoutSession ? 'ficha-section-view--with-evidence' : ''}
      action={(
        <button type="button" className="ficha-section-action" onClick={() => onAbrirModal(null)}>
          <AppIcon name="plus" size={18} />
          Nova anotação
        </button>
      )}
    >
      {handoutSession && (
        <div className="journal-evidence-panel">
          <HandoutEvidencePanel
            mode="viewer"
            status={handoutSession.status}
            role={handoutSession.role}
            error={handoutSession.error}
            deliveredHandouts={evidencias}
            onReconnect={handoutSession.reconnect}
          />
        </div>
      )}

      <section className="ficha-record-panel journal-record-panel" id="grid-diario" aria-labelledby="journal-record-title">
        <header className="ficha-record-heading">
          <div>
            <span className="ficha-record-kicker">ARQUIVO DE CAMPO</span>
            <h2 id="journal-record-title">Anotações da investigação</h2>
          </div>
          <span className="ficha-record-count">{notas.length.toString().padStart(2, '0')}</span>
        </header>

        <ul id="lista-diario" className="loja-lista-itens journal-grid">
          {notas.length > 0 ? (
            notas.map(nota => (
              <NotaCard
                key={nota.id}
                nota={nota}
                onEdit={() => onAbrirModal(nota)}
                onRemove={onRemoveNota}
              />
            ))
          ) : (
            <li className="item-placeholder ficha-section-empty-state">
              <AppIcon name="journal" size={28} />
              <strong>O diário ainda está em branco</strong>
              <span>Registre pistas, suspeitas ou decisões importantes da mesa.</span>
            </li>
          )}
        </ul>
      </section>
    </FichaSectionFrame>
  );
}

export default Diario;
