import React, { useState } from 'react';
import { database } from '../lib/database.js';
import { getIconePorCondicao } from './icons/Icones.jsx';

function Condicoes({ ativas = [], automaticas = [], onToggle, onReaplicar }) {
  const [expandido, setExpandido] = useState(false);

  const listaOrdenada = database.condicoes
    ? [...database.condicoes].sort((a, b) => {
        const aAtiva = ativas.includes(a.id);
        const bAtiva = ativas.includes(b.id);
        if (aAtiva && !bAtiva) return -1;
        if (!aAtiva && bAtiva) return 1;
        return a.nome.localeCompare(b.nome);
      })
    : [];

  return (
    <section className="box box-condicoes" id="grid-condicoes">
      <div className="inventario-header condicoes-header">
        <h2>CONDIÇÕES E ESTADOS</h2>
        <button
          type="button"
          className="btn-add-item"
          onClick={() => setExpandido((valorAtual) => !valorAtual)}
          aria-expanded={expandido}
          aria-controls="lista-condicoes"
        >
          {expandido ? '▲ Recolher' : '▼ Expandir'}
        </button>
      </div>

      <div id="lista-condicoes" className={`condicoes-grid ${expandido ? 'expandido' : 'recolhido'}`}>
        {listaOrdenada.map((condicao) => {
          const isAtiva = ativas.includes(condicao.id);
          const isAutomatica = automaticas.includes(condicao.id);
          const descricaoId = `condicao-desc-${condicao.id}`;
          const descricaoResumida = condicao.descricao.length > 50 && !isAtiva
            ? `${condicao.descricao.substring(0, 50)}...`
            : condicao.descricao;

          const conteudo = (
            <>
              <span className="condicao-icone" aria-hidden="true">
                {getIconePorCondicao(condicao.id)}
              </span>
              <span className="condicao-info">
                <span className="condicao-nome">{condicao.nome}</span>
                {isAutomatica && (
                  <span className="condicao-desc-curta">Automática pelos recursos atuais</span>
                )}
                <span
                  id={descricaoId}
                  className={`condicao-desc-curta ${!isAtiva && !expandido ? 'condicao-desc-curta--sr-only' : ''}`}
                >
                  {descricaoResumida}
                </span>
              </span>
            </>
          );

          return (
            <article
              key={condicao.id}
              className={`condicao-card ${isAtiva ? 'ativa' : ''} ${isAutomatica ? 'automatica' : ''} ${condicao.tipo}`}
            >
              {isAutomatica ? (
                <div className="condicao-card__toggle condicao-card__toggle--automatic" aria-describedby={descricaoId}>
                  {conteudo}
                </div>
              ) : (
                <button
                  type="button"
                  className="condicao-card__toggle"
                  onClick={() => onToggle(condicao.id)}
                  aria-pressed={isAtiva}
                  aria-describedby={descricaoId}
                >
                  {conteudo}
                </button>
              )}

              {isAtiva && !isAutomatica && condicao.evolucao && (
                <button
                  type="button"
                  className="condicao-reaplicar"
                  onClick={() => onReaplicar?.(condicao.id)}
                >
                  Aplicar novamente → {database.condicoes.find((item) => item.id === condicao.evolucao)?.nome || condicao.evolucao}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default Condicoes;
