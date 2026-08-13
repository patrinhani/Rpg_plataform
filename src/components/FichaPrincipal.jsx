import React from 'react';

import Identidade from './ficha/identidade.jsx';
import Atributos from './ficha/atributos.jsx';
import DefesaStatus from './ficha/defesa-status.jsx';
import Pericias from './ficha/pericias.jsx';
import CalculoDetalhado from './ficha/calculo-detalhado.jsx';
import Condicoes from './Condicoes.jsx';

const NOMES_TEMA = {
  'tema-ordem': 'Ordem',
  'tema-sangue': 'Sangue',
  'tema-morte': 'Morte',
  'tema-conhecimento': 'Conhecimento',
  'tema-energia': 'Energia',
};

const DEATH_SPIRAL_PATH = Array.from({ length: 145 }, (_, index) => {
  const angle = (index / 144) * 7 * Math.PI;
  const radius = 5 + (8.6 * angle);
  const x = 250 + (radius * Math.cos(angle));
  const y = 250 + (radius * Math.sin(angle));
  return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
}).join(' ');

function ThemeImprint({ variant }) {
  return (
    <div className={`summary-theme-imprint summary-theme-imprint--${variant}`} aria-hidden="true">
      <span className="summary-theme-imprint__symbol" />
      <span className="summary-theme-imprint__field" />
      <span className="summary-theme-imprint__trace" />
      <svg
        className="summary-theme-imprint__death-spiral"
        viewBox="0 0 500 500"
        focusable="false"
      >
        <path className="death-spiral-path death-spiral-path--halo" d={DEATH_SPIRAL_PATH} pathLength="1" />
        <path className="death-spiral-path death-spiral-path--main" d={DEATH_SPIRAL_PATH} pathLength="1" />
        <path className="death-spiral-path death-spiral-path--echo" d={DEATH_SPIRAL_PATH} pathLength="1" />
      </svg>
    </div>
  );
}

function FichaPrincipal({
  personagem,
  calculados,
  fichaInstance,
  handleFichaChange,
  temaAtual,
  trilhasPorClasse,
  periciasDeOrigem,
  onToggleCondicao,
  onReaplicarCondicao,
  onAddPericiaCustom,
  onRemovePericiaCustom,
}) {
  const classeNome = personagem.info.classe
    ? personagem.info.classe.charAt(0).toUpperCase() + personagem.info.classe.slice(1)
    : 'Agente';
  const nexAtual = personagem.info.classe === 'sobrevivente'
    ? `Estágio ${personagem.info.estagio_sobrevivente || 1}`
    : `NEX ${parseInt(personagem.info.nex, 10) || 0}%`;

  return (
    <main className="ficha-container ficha-summary">
      <div className="summary-element-atmosphere" aria-hidden="true">
        <span className="summary-element-orbit summary-element-orbit--outer" />
        <span className="summary-element-orbit summary-element-orbit--inner" />
        <span className="summary-element-stream summary-element-stream--one" />
        <span className="summary-element-stream summary-element-stream--two" />
        <span className="summary-element-sigil">A ∴ O ∴ C ∴ S</span>
      </div>

      <section className="summary-panel summary-identity-zone">
        <ThemeImprint variant="identity" />
        <div className="summary-panel-heading">
          <div>
            <span className="summary-panel-kicker">REGISTRO DO AGENTE</span>
            <h1>{personagem.info.nome || 'Agente sem identificação'}</h1>
          </div>
          <div className="summary-agent-tags" aria-label="Dados rápidos do agente">
            <span>{classeNome}</span>
            <span>{nexAtual}</span>
            <span>{NOMES_TEMA[temaAtual] || 'Ordem'}</span>
          </div>
        </div>

        <Identidade
          dados={personagem.info}
          onFichaChange={handleFichaChange}
          trilhasPorClasse={trilhasPorClasse}
          patenteInfo={calculados.patente}
        />
      </section>

      <section className="summary-panel summary-core-zone">
        <ThemeImprint variant="core" />
        <div className="summary-panel-heading summary-panel-heading--compact">
          <div>
            <span className="summary-panel-kicker">NÚCLEO DO AGENTE</span>
            <h2>Matriz de atributos</h2>
          </div>
          <span className="summary-core-status">SINCRONIZADO</span>
        </div>
        <div className="summary-core-shell">
          <Atributos dados={personagem.atributos} onFichaChange={handleFichaChange} />
        </div>
        <p className="summary-core-hint">Edite os valores diretamente no diagrama.</p>
      </section>

      <section className="summary-panel summary-tactical-zone">
        <ThemeImprint variant="tactical" />
        <div className="summary-panel-heading summary-panel-heading--compact">
          <div>
            <span className="summary-panel-kicker">LEITURA DE CAMPO</span>
            <h2>Central de defesa</h2>
          </div>
          <span className="summary-panel-index">01</span>
        </div>
        <div className="summary-tactical-grid">
          <DefesaStatus
            dadosDefesa={personagem.defesa}
            dadosResistencias={personagem.resistencias}
            bonusManuais={personagem.bonusManuais}
            dadosCalculados={calculados}
            onFichaChange={handleFichaChange}
          />
        </div>
      </section>

      <section className="summary-panel summary-operations-zone">
        <ThemeImprint variant="operations" />
        <div className="summary-panel-heading summary-panel-heading--compact">
          <div>
            <span className="summary-panel-kicker">ESTADO OPERACIONAL</span>
            <h2>Monitoramento de condições</h2>
          </div>
          <span className="summary-panel-index">02</span>
        </div>
        <div className="ficha-controls-stack">
          <Condicoes
            ativas={personagem.condicoesEfetivas || personagem.condicoesAtivas || []}
            automaticas={personagem.condicoesAutomaticas || []}
            onToggle={onToggleCondicao}
            onReaplicar={onReaplicarCondicao}
          />
        </div>
      </section>

      <section className="summary-panel summary-skills-zone">
        <ThemeImprint variant="skills" />
        <div className="summary-panel-heading summary-panel-heading--compact">
          <div>
            <span className="summary-panel-kicker">COMPETÊNCIAS</span>
            <h2>Perícias do agente</h2>
          </div>
          <span className="summary-panel-index">03</span>
        </div>
        <Pericias
          dadosPericias={personagem.pericias}
          dadosAtributos={personagem.atributos}
          dadosCalculados={calculados}
          onFichaChange={handleFichaChange}
          periciasDeOrigem={periciasDeOrigem}
          periciasCustom={personagem.periciasCustom || []}
          bonusPericiasManuais={personagem.bonusPericiasManuais || {}}
          onAddPericiaCustom={onAddPericiaCustom}
          onRemovePericiaCustom={onRemovePericiaCustom}
        />
      </section>

      <details className="summary-panel summary-calculation-zone">
        <summary>
          <span>
            <span className="summary-panel-kicker">MEMÓRIA DO SISTEMA</span>
            <strong>Cálculos detalhados e ajustes manuais</strong>
          </span>
          <span className="summary-details-action">ABRIR DIAGNÓSTICO</span>
        </summary>
        <CalculoDetalhado
          dados={personagem.bonusManuais}
          calculos={fichaInstance.calculosDetalhados}
          classe={personagem.info.classe}
          onFichaChange={handleFichaChange}
        />
      </details>
    </main>
  );
}

export default FichaPrincipal;
