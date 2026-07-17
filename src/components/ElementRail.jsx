import React from "react";
import { getTemaConfig, listaTemas } from "../lib/temas.js";

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
  }
`;

function ElementItem({ tema, ativo, interativo, habilitado, onSelect }) {
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
          title={habilitado ? tema.nome : "Troca de afinidade indisponível"}
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
}) {
  const temaAtivo = getTemaConfig(temaAtual);
  const interativo = variante === "ficha";
  const habilitado = interativo && canChangeTheme && typeof onThemeChange === "function";

  const selecionarTema = (temaId) => {
    if (!habilitado || temaId === temaAtivo.id) return;
    onThemeChange(temaId);
  };

  const rail = (
    <div
      className={`element-rail element-rail--${interativo ? "ficha" : "dashboard"}`}
      style={{ "--element-rail-accent": temaAtivo.cor }}
    >
      {listaTemas.map((tema) => (
        <ElementItem
          key={tema.id}
          tema={tema}
          ativo={tema.id === temaAtivo.id}
          interativo={interativo}
          habilitado={habilitado}
          onSelect={selecionarTema}
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
