import React, { memo } from 'react';

const TEMA_CLASSES = {
  sangue: 'res-sangue',
  morte: 'res-morte',
  conhecimento: 'res-conhecimento',
  energia: 'res-energia',
};

const NOMES_RESISTENCIAS = {
  balistico: 'Balístico',
  corte: 'Corte',
  impacto: 'Impacto',
  perfuracao: 'Perfuração',
  eletricidade: 'Eletricidade',
  fogo: 'Fogo',
  frio: 'Frio',
  quimico: 'Químico',
  mental: 'Mental',
  sangue: 'Sangue',
  morte: 'Morte',
  conhecimento: 'Conhecimento',
  energia: 'Energia',
};

const GRUPOS_RESISTENCIAS = [
  {
    id: 'fisicas',
    titulo: 'Físicas',
    descricao: 'Armas e trauma',
    codigo: 'RDF',
    chaves: ['balistico', 'corte', 'impacto', 'perfuracao'],
  },
  {
    id: 'ambientais',
    titulo: 'Ambientais',
    descricao: 'Agentes e exposição',
    codigo: 'RDA',
    chaves: ['eletricidade', 'fogo', 'frio', 'quimico'],
  },
  {
    id: 'paranormais',
    titulo: 'Mental e paranormal',
    descricao: 'Mente e Outro Lado',
    codigo: 'RDP',
    chaves: ['mental', 'sangue', 'morte', 'conhecimento', 'energia'],
  },
];

function ProtocolIcon({ tipo }) {
  if (tipo === 'bloqueio') {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M12 2.8 19 5.6v5.7c0 4.5-2.7 8.2-7 9.9-4.3-1.7-7-5.4-7-9.9V5.6L12 2.8Z" />
        <path d="m8.8 12.1 2.1 2.1 4.5-4.7" />
      </svg>
    );
  }

  if (tipo === 'esquiva') {
    return (
      <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
        <path d="M4 7h11.5M11.5 3 16 7l-4.5 4" />
        <path d="M20 17H8.5M12.5 13 8 17l4.5 4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="m5 19 5.4-5.4M13.6 10.4 19 5M14.8 3.8 20.2 9M3.8 14.8 9.2 20" />
      <path d="m4 4 16 16" />
    </svg>
  );
}

function ProtocoloDefensivo({ codigo, tipo, titulo, valor, detalhe, disponivel }) {
  return (
    <article className={`defense-protocol ${disponivel ? 'is-ready' : 'is-unavailable'}`}>
      <div className="defense-protocol__topline">
        <span className="defense-protocol__code">{codigo}</span>
        <span className="defense-protocol__icon">
          <ProtocolIcon tipo={tipo} />
        </span>
      </div>
      <span className="defense-protocol__label">{titulo}</span>
      <output className="defense-protocol__result" aria-label={`${titulo}: ${valor}`}>
        {valor}
      </output>
      <span className="defense-protocol__requirement">{detalhe}</span>
      <span className="defense-protocol__state">
        <span aria-hidden="true" />
        {disponivel ? 'Disponível' : 'Não habilitado'}
      </span>
    </article>
  );
}

function DefesaStatus({ dadosDefesa, dadosResistencias, dadosCalculados, bonusManuais, onFichaChange }) {
  const handleDefesaChange = (event) => {
    onFichaChange('defesa', event.target.id, event.target.value);
  };

  const handleResistenciaChange = (event) => {
    const campo = event.target.id.replace('res_', '');
    onFichaChange('resistencias', campo, event.target.value);
  };

  const handleBonusManualChange = (event) => {
    onFichaChange('bonusManuais', event.target.id.replace('bonus_', ''), event.target.value);
  };

  const {
    defesaTotal,
    bloqueio_rd,
    esquiva_bonus,
    defesa_esquiva,
    equipamentoDefesa,
    modificadorCaido,
    tem_contra_ataque,
  } = dadosCalculados;

  const agiBonus = parseInt(dadosCalculados.atributosDetalhados?.agi?.valorFinal, 10) || 0;
  const bloqueioDisponivel = bloqueio_rd !== '—';
  const esquivaDisponivel = esquiva_bonus !== '—';
  const protocolosDisponiveis = [bloqueioDisponivel, esquivaDisponivel, tem_contra_ataque].filter(Boolean).length;

  const chavesConhecidas = new Set(GRUPOS_RESISTENCIAS.flatMap((grupo) => grupo.chaves));
  const chavesExtras = Object.keys(dadosResistencias || {}).filter((chave) => !chavesConhecidas.has(chave));
  const gruposExibidos = chavesExtras.length > 0
    ? [
        ...GRUPOS_RESISTENCIAS,
        {
          id: 'outras',
          titulo: 'Outras',
          descricao: 'Registros importados',
          codigo: 'RDX',
          chaves: chavesExtras,
        },
      ]
    : GRUPOS_RESISTENCIAS;
  const todasAsChaves = gruposExibidos.flatMap((grupo) => grupo.chaves);
  const resistenciasAtivas = todasAsChaves.filter((chave) => {
    const total = dadosCalculados.resistenciasCalculadas?.[chave] ?? dadosResistencias?.[chave] ?? 0;
    return Number(total) !== 0;
  }).length;

  return (
    <>
      <section
        className="box box-defesa tactical-module tactical-module--defense"
        id="grid-defesa"
        aria-labelledby="defense-module-title"
      >
        <header className="tactical-module__header">
          <div>
            <span className="tactical-module__eyebrow">PROTOCOLO DEFENSIVO</span>
            <h3 id="defense-module-title">Defesa</h3>
          </div>
          <span className="tactical-module__status">CÁLCULO ATIVO</span>
        </header>

        <div className="defense-readout">
          <div className="defense-total-dial">
            <span>Defesa total</span>
            <output aria-live="polite">{defesaTotal ?? 10}</output>
            <small>Alvo para ataques</small>
          </div>

          <dl className="defense-breakdown">
            <div>
              <dt>Agilidade</dt>
              <dd>{agiBonus}</dd>
            </div>
            <div>
              <dt>Equipamento</dt>
              <dd>{equipamentoDefesa ?? 0}</dd>
            </div>
            <div className="is-editable">
              <dt><label htmlFor="outros">Outros</label></dt>
              <dd>
                <input
                  id="outros"
                  type="number"
                  value={dadosDefesa?.outros ?? 0}
                  onChange={handleDefesaChange}
                />
              </dd>
            </div>
            <div className="is-editable">
              <dt><label htmlFor="bonus_defesa">Ajuste manual</label></dt>
              <dd>
                <input
                  id="bonus_defesa"
                  type="number"
                  value={bonusManuais?.defesa ?? 0}
                  onChange={handleBonusManualChange}
                />
              </dd>
            </div>
          </dl>
        </div>

        <p className="tactical-module__note">
          O total já considera equipamentos, origem, carga e condições aplicáveis.
        </p>
      </section>

      <section
        className="box box-acoes-defesa tactical-module tactical-module--actions"
        id="grid-acoes-defesa"
        aria-labelledby="defense-actions-title"
      >
        <header className="tactical-module__header">
          <div>
            <span className="tactical-module__eyebrow">RESPOSTAS REATIVAS</span>
            <h3 id="defense-actions-title">Ações de defesa</h3>
          </div>
          <span className="tactical-module__counter">{protocolosDisponiveis}/3 PRONTAS</span>
        </header>

        <div className="defense-protocol-grid">
          <ProtocoloDefensivo
            codigo="01"
            tipo="bloqueio"
            titulo="Bloqueio"
            valor={bloqueioDisponivel ? `RD ${bloqueio_rd}` : '—'}
            detalhe="Requer Fortitude treinada"
            disponivel={bloqueioDisponivel}
          />
          <ProtocoloDefensivo
            codigo="02"
            tipo="esquiva"
            titulo="Esquiva"
            valor={esquivaDisponivel ? `+${esquiva_bonus} · DEF ${defesa_esquiva}` : '—'}
            detalhe="Requer Reflexos treinados"
            disponivel={esquivaDisponivel}
          />
          <ProtocoloDefensivo
            codigo="03"
            tipo="contra-ataque"
            titulo="Contra-ataque"
            valor={tem_contra_ataque ? 'SIM' : 'NÃO'}
            detalhe="Requer Luta treinada"
            disponivel={Boolean(tem_contra_ataque)}
          />
        </div>

        {modificadorCaido && (
          <aside className="defense-context-alert" aria-label="Modificador contextual da condição Caído">
            <span className="defense-context-alert__signal" aria-hidden="true">!</span>
            <div>
              <strong>Condição: Caído</strong>
              <span>Corpo a corpo {modificadorCaido.corpoACorpo} · Distância +{modificadorCaido.distancia}</span>
            </div>
          </aside>
        )}

        <fieldset className="defense-adjustments">
          <legend>Ajustes manuais</legend>
          <label htmlFor="bonus_bloqueio">
            <span>Bloqueio</span>
            <input
              id="bonus_bloqueio"
              type="number"
              value={bonusManuais?.bloqueio ?? 0}
              onChange={handleBonusManualChange}
            />
          </label>
          <label htmlFor="bonus_esquiva">
            <span>Esquiva</span>
            <input
              id="bonus_esquiva"
              type="number"
              value={bonusManuais?.esquiva ?? 0}
              onChange={handleBonusManualChange}
            />
          </label>
        </fieldset>
      </section>

      <section
        className="box box-resistencias tactical-module tactical-module--resistances"
        id="grid-resistencias"
        aria-labelledby="resistances-module-title"
      >
        <header className="tactical-module__header">
          <div>
            <span className="tactical-module__eyebrow">CAMADAS DE PROTEÇÃO</span>
            <h3 id="resistances-module-title">Resistências a dano</h3>
          </div>
          <span className="tactical-module__counter">
            {resistenciasAtivas}/{todasAsChaves.length} COM PROTEÇÃO
          </span>
        </header>

        <div className="resistance-groups">
          {gruposExibidos.map((grupo) => (
            <section
              className={`resistance-group resistance-group--${grupo.id}`}
              key={grupo.id}
              aria-labelledby={`resistance-group-${grupo.id}`}
            >
              <header className="resistance-group__header">
                <span className="resistance-group__code">{grupo.codigo}</span>
                <div>
                  <h4 id={`resistance-group-${grupo.id}`}>{grupo.titulo}</h4>
                  <span>{grupo.descricao}</span>
                </div>
              </header>

              <div className="resistance-grid">
                {grupo.chaves.map((chave) => {
                  const temaClasse = TEMA_CLASSES[chave] || '';
                  const nome = NOMES_RESISTENCIAS[chave] || chave;
                  const totalCalculado = dadosCalculados.resistenciasCalculadas?.[chave]
                    ?? dadosResistencias?.[chave]
                    ?? 0;

                  return (
                    <article className={`resistance-card ${temaClasse}`} key={chave}>
                      <div className="resistance-card__heading">
                        <span className="resistance-card__name">{nome}</span>
                        <span className="resistance-card__total-label">TOTAL</span>
                      </div>
                      <output
                        className="resistance-card__total"
                        aria-label={`Resistência total a ${nome}: ${totalCalculado}`}
                      >
                        {totalCalculado}
                      </output>
                      <label className="resistance-card__adjustment" htmlFor={`res_${chave}`}>
                        <span>Ajuste manual</span>
                        <span className="resistance-card__input-wrap">
                          <span aria-hidden="true">±</span>
                          <input
                            id={`res_${chave}`}
                            type="number"
                            value={dadosResistencias?.[chave] ?? 0}
                            onChange={handleResistenciaChange}
                            min="0"
                            title="Proteções são somadas automaticamente ao total"
                          />
                        </span>
                      </label>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </>
  );
}

export default memo(DefesaStatus);
