import React, { useState } from 'react';
import { database } from '../lib/database.js';
import { getIconePorCondicao } from './icons/Icones.jsx';

const TIPOS_CONDICAO = [
  { id: 'fisica', nome: 'Físicas', descricao: 'Corpo e mobilidade', codigo: 'FIS' },
  { id: 'mental', nome: 'Mentais', descricao: 'Mente e comportamento', codigo: 'MEN' },
  { id: 'sensorial', nome: 'Sensoriais', descricao: 'Percepção e sentidos', codigo: 'SEN' },
];

const ROTULOS_TIPO = {
  fisica: 'Física',
  mental: 'Mental',
  sensorial: 'Sensorial',
};

function ConditionCard({ condicao, ativa, automatica, onToggle, onReaplicar }) {
  const descricaoId = `condicao-desc-${condicao.id}`;
  const evolucaoNome = condicao.evolucao
    ? database.condicoes.find((item) => item.id === condicao.evolucao)?.nome || condicao.evolucao
    : null;

  const conteudo = (
    <>
      <span className="condicao-icone" aria-hidden="true">
        {getIconePorCondicao(condicao.id)}
      </span>
      <span className="condicao-info">
        <span className="condicao-card__topline">
          <span className="condicao-nome">{condicao.nome}</span>
          <span className="condicao-card__badge">
            {automatica ? 'Automática' : ativa ? 'Ativa' : ROTULOS_TIPO[condicao.tipo] || 'Estado'}
          </span>
        </span>
        <span id={descricaoId} className="condicao-desc-curta">
          {condicao.descricao}
        </span>
        <span className="condicao-card__instruction">
          {automatica
            ? 'Gerenciada pelos recursos atuais'
            : ativa
              ? 'Selecionar para remover'
              : 'Selecionar para aplicar'}
        </span>
      </span>
    </>
  );

  return (
    <article
      className={`condicao-card ${ativa ? 'ativa' : ''} ${automatica ? 'automatica' : ''} ${condicao.tipo}`}
    >
      {automatica ? (
        <div
          className="condicao-card__toggle condicao-card__toggle--automatic"
          aria-describedby={descricaoId}
        >
          {conteudo}
        </div>
      ) : (
        <button
          type="button"
          className="condicao-card__toggle"
          onClick={() => onToggle?.(condicao.id)}
          aria-pressed={ativa}
          aria-describedby={descricaoId}
        >
          {conteudo}
        </button>
      )}

      {ativa && !automatica && evolucaoNome && (
        <button
          type="button"
          className="condicao-reaplicar"
          onClick={() => onReaplicar?.(condicao.id)}
          aria-label={`Aplicar ${condicao.nome} novamente — evolui para ${evolucaoNome}`}
        >
          <span>Aplicar novamente</span>
          <strong>→ {evolucaoNome}</strong>
        </button>
      )}
    </article>
  );
}

function Condicoes({ ativas = [], automaticas = [], onToggle, onReaplicar }) {
  const [expandido, setExpandido] = useState(false);
  const ativasSet = new Set(ativas);
  const automaticasSet = new Set(automaticas);
  const listaOrdenada = database.condicoes
    ? [...database.condicoes].sort((a, b) => a.nome.localeCompare(b.nome))
    : [];
  const listaAtiva = listaOrdenada.filter((condicao) => ativasSet.has(condicao.id));
  const listaCatalogo = listaOrdenada.filter((condicao) => !ativasSet.has(condicao.id));
  const automaticasAtivas = listaAtiva.filter((condicao) => automaticasSet.has(condicao.id)).length;
  const manuaisAtivas = listaAtiva.length - automaticasAtivas;

  return (
    <section
      className="box box-condicoes tactical-module tactical-module--conditions"
      id="grid-condicoes"
      aria-labelledby="conditions-module-title"
    >
      <header className="tactical-module__header condicoes-header">
        <div>
          <span className="tactical-module__eyebrow">MONITORAMENTO DO AGENTE</span>
          <h3 id="conditions-module-title">Condições e estados</h3>
        </div>
        <div className="conditions-counters" aria-label="Resumo das condições">
          <span>
            <strong>{manuaisAtivas}</strong> {manuaisAtivas === 1 ? 'manual' : 'manuais'}
          </span>
          <span>
            <strong>{automaticasAtivas}</strong> {automaticasAtivas === 1 ? 'automática' : 'automáticas'}
          </span>
        </div>
      </header>

      <section className="conditions-active-zone" aria-labelledby="active-conditions-title">
        <header className="conditions-zone-header">
          <div>
            <span className="conditions-zone-code">STATUS</span>
            <h4 id="active-conditions-title">Estado atual</h4>
          </div>
          <span>{listaAtiva.length} {listaAtiva.length === 1 ? 'condição ativa' : 'condições ativas'}</span>
        </header>

        {listaAtiva.length > 0 ? (
          <div className="conditions-active-grid">
            {listaAtiva.map((condicao) => (
              <ConditionCard
                key={condicao.id}
                condicao={condicao}
                ativa
                automatica={automaticasSet.has(condicao.id)}
                onToggle={onToggle}
                onReaplicar={onReaplicar}
              />
            ))}
          </div>
        ) : (
          <div className="conditions-empty-state">
            <span className="conditions-empty-state__pulse" aria-hidden="true" />
            <div>
              <strong>Nenhuma condição ativa</strong>
              <span>O agente está operando sem penalidades registradas.</span>
            </div>
          </div>
        )}
      </section>

      <button
        type="button"
        className="conditions-catalog-toggle"
        onClick={() => setExpandido((valorAtual) => !valorAtual)}
        aria-expanded={expandido}
        aria-controls="catalogo-condicoes"
      >
        <span className="conditions-catalog-toggle__signal" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>
          <strong>{expandido ? 'Ocultar catálogo' : 'Abrir catálogo de condições'}</strong>
          <small>{listaCatalogo.length} estados disponíveis para aplicação manual</small>
        </span>
        <span className="conditions-catalog-toggle__chevron" aria-hidden="true">
          {expandido ? '−' : '+'}
        </span>
      </button>

      <div id="catalogo-condicoes" className="conditions-catalog" hidden={!expandido}>
        {TIPOS_CONDICAO.map((tipo) => {
          const condicoesDoTipo = listaCatalogo.filter((condicao) => condicao.tipo === tipo.id);
          if (condicoesDoTipo.length === 0) return null;

          return (
            <section
              className={`conditions-catalog-group conditions-catalog-group--${tipo.id}`}
              key={tipo.id}
              aria-labelledby={`conditions-group-${tipo.id}`}
            >
              <header className="conditions-zone-header">
                <div>
                  <span className="conditions-zone-code">{tipo.codigo}</span>
                  <h4 id={`conditions-group-${tipo.id}`}>{tipo.nome}</h4>
                </div>
                <span>{tipo.descricao} · {condicoesDoTipo.length}</span>
              </header>
              <div className="conditions-catalog-grid">
                {condicoesDoTipo.map((condicao) => (
                  <ConditionCard
                    key={condicao.id}
                    condicao={condicao}
                    ativa={false}
                    automatica={false}
                    onToggle={onToggle}
                    onReaplicar={onReaplicar}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default Condicoes;
