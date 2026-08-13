import React from "react";
import { getTemaConfig, listaTemas } from "../lib/temas.js";
import { AFFINITY_NEX_THRESHOLD, getNexAffinityState } from "../lib/nex-affinity.js";

const estilos = `
  .element-rail {
    --element-rail-accent: #0091ff;
    align-items: center;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 28%),
      rgba(3, 9, 15, 0.9);
    border: 1px solid color-mix(in srgb, var(--element-rail-accent) 35%, #273644);
    border-radius: 18px;
    box-shadow: inset 0 0 28px rgba(0, 0, 0, 0.48);
    display: flex;
    flex-direction: column;
    gap: 10px;
    isolation: isolate;
    padding: 14px 9px;
    position: relative;
    width: 112px;
  }

  .element-rail::before {
    background: linear-gradient(180deg, transparent, var(--element-rail-accent), transparent);
    content: "";
    height: calc(100% - 52px);
    left: 50%;
    opacity: 0.2;
    position: absolute;
    top: 26px;
    transform: translateX(-50%);
    width: 1px;
    z-index: -1;
  }

  .element-rail--dashboard {
    position: relative;
  }

  .element-rail__item {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    position: relative;
  }

  .element-rail__awakening {
    align-self: stretch;
    background: rgb(0 145 255 / 0.06);
    border: 1px solid rgb(0 145 255 / 0.2);
    border-radius: 11px;
    display: grid;
    gap: 6px;
    padding: 9px 8px;
    text-align: center;
  }

  .element-rail__awakening > span,
  .element-rail__awakening > small {
    color: rgba(205, 225, 239, 0.68);
    font-family: "Roboto Condensed", system-ui, sans-serif;
    font-size: 0.57rem;
    letter-spacing: 0.08em;
    line-height: 1.15;
    text-transform: uppercase;
  }

  .element-rail__awakening > strong {
    color: #8bceff;
    font-family: "Special Elite", monospace;
    font-size: 0.72rem;
  }

  .element-rail__awakening--unlocked {
    background: rgb(111 211 255 / 0.1);
    border-color: rgb(111 211 255 / 0.46);
    box-shadow: 0 0 18px rgb(0 145 255 / 0.16);
  }

  .element-rail__progress {
    background: rgba(0, 0, 0, 0.48);
    border-radius: 999px;
    height: 4px;
    overflow: hidden;
  }

  .element-rail__progress > i {
    background: linear-gradient(90deg, #165d91, #64c5ff);
    box-shadow: 0 0 9px #0091ff;
    display: block;
    height: 100%;
    transition: width 420ms ease;
  }

  .element-rail__control {
    align-items: center;
    appearance: none;
    background: rgba(4, 9, 14, 0.9);
    border: 1px solid rgba(151, 178, 200, 0.28);
    border-radius: 50%;
    box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.36);
    color: #edf7ff;
    display: flex;
    height: 58px;
    justify-content: center;
    overflow: hidden;
    margin: 0;
    padding: 7px;
    position: relative;
    transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
    width: 58px;
  }

  button.element-rail__control {
    cursor: pointer;
  }

  button.element-rail__control:hover:not(:disabled) {
    border-color: var(--tema-cor);
    box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.36), 0 0 18px color-mix(in srgb, var(--tema-cor) 52%, transparent);
    transform: translateY(-2px);
  }

  button.element-rail__control:focus-visible {
    outline: 2px solid #ffffff;
    outline-offset: 4px;
  }

  button.element-rail__control:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .element-rail__item--active .element-rail__control {
    border-color: var(--tema-cor);
    box-shadow:
      0 0 0 4px rgba(0, 0, 0, 0.42),
      0 0 20px color-mix(in srgb, var(--tema-cor) 58%, transparent),
      inset 0 0 14px color-mix(in srgb, var(--tema-cor) 18%, transparent);
    opacity: 1;
  }

  .element-rail__item--ordem .element-rail__control {
    border-radius: 16px;
    height: 78px;
    padding: 3px;
    width: 78px;
  }

  .element-rail__symbol {
    display: block;
    filter: saturate(0.9);
    height: 100%;
    object-fit: contain;
    opacity: 0.82;
    width: 100%;
  }

  .element-rail__item--active .element-rail__symbol {
    filter: saturate(1.08);
    opacity: 1;
  }

  .element-rail__label {
    color: rgba(222, 235, 246, 0.7);
    font-family: "Roboto Condensed", system-ui, sans-serif;
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    line-height: 1.1;
    max-width: 92px;
    overflow-wrap: anywhere;
    text-align: center;
    text-transform: uppercase;
  }

  .element-rail__item--active .element-rail__label {
    color: var(--tema-cor-texto);
  }

  @media (max-width: 768px) {
    .element-rail {
      border-radius: 14px;
      flex-direction: row;
      gap: 7px;
      justify-content: space-between;
      max-width: 100%;
      overflow-x: auto;
      padding: 8px;
      width: 100%;
    }

    .element-rail::before {
      background: linear-gradient(90deg, transparent, var(--element-rail-accent), transparent);
      height: 1px;
      left: 20px;
      right: 20px;
      top: 37px;
      transform: none;
      width: auto;
    }

    .element-rail__control,
    .element-rail__item--ordem .element-rail__control {
      border-radius: 50%;
      height: 48px;
      width: 48px;
    }

    .element-rail__label {
      font-size: 0.58rem;
      max-width: 64px;
    }

    .element-rail__awakening {
      flex: 0 0 132px;
      min-height: 58px;
    }
  }
`;

function ElementItem({ tema, ativo, interativo, habilitado, onSelect, disabledTitle }) {
  const itemClassName = [
    "element-rail__item",
    tema.id === "tema-ordem" ? "element-rail__item--ordem" : "",
    ativo ? "element-rail__item--active" : "",
  ].filter(Boolean).join(" ");

  const conteudo = (
    <>
      <img
        className="element-rail__symbol"
        src={tema.simboloMini || tema.simbolo}
        alt=""
        aria-hidden="true"
        decoding="async"
        loading="lazy"
      />
    </>
  );

  return (
    <div className={itemClassName} style={{ "--tema-cor": tema.cor, "--tema-cor-texto": tema.corTexto || tema.cor }}>
      {interativo ? (
        <button
          type="button"
          className="element-rail__control"
          aria-label={`Selecionar ${tema.nome}`}
          aria-pressed={ativo}
          disabled={!habilitado}
          onClick={() => onSelect(tema.id)}
          title={habilitado ? tema.nome : disabledTitle}
        >
          {conteudo}
        </button>
      ) : (
        <div className="element-rail__control" aria-hidden="true">
          {conteudo}
        </div>
      )}
      <span className="element-rail__label" aria-hidden={!interativo}>
        {tema.nomeCurto}
      </span>
    </div>
  );
}

export default function ElementRail({
  variante = "dashboard",
  temaAtual = "tema-ordem",
  onThemeChange,
  canChangeTheme = true,
  nexAtual = AFFINITY_NEX_THRESHOLD,
}) {
  const temaAtivo = getTemaConfig(temaAtual);
  const interativo = variante === "ficha";
  const habilitado = interativo && canChangeTheme && typeof onThemeChange === "function";
  const affinityState = getNexAffinityState(nexAtual);
  const disabledTitle = `Afinidade disponível no NEX ${AFFINITY_NEX_THRESHOLD}%`;

  const selecionarTema = (temaId) => {
    if (!habilitado || temaId === temaAtivo.id) return;
    onThemeChange(temaId);
  };

  const rail = (
    <div
      className={`element-rail element-rail--${interativo ? "ficha" : "dashboard"}`}
      style={{ "--element-rail-accent": temaAtivo.cor }}
    >
      {interativo && (
        <div className={`element-rail__awakening ${affinityState.unlocked ? 'element-rail__awakening--unlocked' : ''}`}>
          <span>{affinityState.unlocked ? 'Limiar rompido' : 'Despertar paranormal'}</span>
          <strong>{affinityState.unlocked ? 'Afinidade liberada' : `NEX ${affinityState.nex}%`}</strong>
          <div
            className="element-rail__progress"
            role="progressbar"
            aria-label="Progresso para desbloquear afinidade"
            aria-valuemin="0"
            aria-valuemax={AFFINITY_NEX_THRESHOLD}
            aria-valuenow={Math.min(affinityState.nex, AFFINITY_NEX_THRESHOLD)}
          >
            <i style={{ width: `${affinityState.progress * 100}%` }} />
          </div>
          <small>{affinityState.unlocked ? 'Selecione seu elemento' : `Faltam ${affinityState.remaining}%`}</small>
        </div>
      )}
      {listaTemas.map((tema) => (
        <ElementItem
          key={tema.id}
          tema={tema}
          ativo={tema.id === temaAtivo.id}
          interativo={interativo}
          habilitado={habilitado}
          onSelect={selecionarTema}
          disabledTitle={disabledTitle}
        />
      ))}
    </div>
  );

  return (
    <>
      <style>{estilos}</style>
      {interativo ? (
        <nav aria-label="Afinidade elemental">
          {rail}
        </nav>
      ) : (
        <aside aria-hidden="true">
          {rail}
        </aside>
      )}
    </>
  );
}
