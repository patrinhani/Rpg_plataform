import { gsap } from "gsap";
import { getTemaConfig } from "./temas.js";

const MEDIA_MOVIMENTO_REDUZIDO = "(prefers-reduced-motion: reduce)";

const QUANTIDADE_PARTICULAS = Object.freeze({
  sangueCortes: 8,
  sangueRespingos: 10,
  morte: 18,
  conhecimento: 28,
});

let transicaoAtiva = null;

function obterOverlay() {
  if (typeof document === "undefined") return null;
  return document.getElementById("transition-overlay");
}

function deveReduzirMovimento() {
  if (typeof window === "undefined" || typeof document === "undefined") return true;

  const prefereReducao = typeof window.matchMedia === "function"
    && window.matchMedia(MEDIA_MOVIMENTO_REDUZIDO).matches;
  const modoEconomia = document.body?.classList.contains("modo-economia");

  return prefereReducao || modoEconomia;
}

function getCorTransicao(temaConfig) {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") {
    return temaConfig.cor || "#000000";
  }

  const nomeTema = temaConfig.id.replace("tema-", "");
  const valorCss = getComputedStyle(document.documentElement)
    .getPropertyValue(`--cor-trans-${nomeTema}`)
    .trim();

  return valorCss || temaConfig.cor || "#000000";
}

function restaurarOverlay(overlay) {
  if (!overlay) return;

  overlay.replaceChildren();
  overlay.className = "";
  overlay.removeAttribute("style");
}

function cancelarTransicaoAtiva() {
  const contexto = transicaoAtiva;
  if (!contexto) return;

  transicaoAtiva = null;
  contexto.cancelada = true;
  contexto.timeline?.kill();

  gsap.killTweensOf([contexto.overlay, ...contexto.elementos]);
  restaurarOverlay(contexto.overlay);
}

function definirTemaNoDocumento(temaConfig) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.tema = temaConfig.id;

  try {
    window.localStorage.setItem("temaFichaOrdem", temaConfig.id);
  } catch {
    // O tema ainda funciona quando o navegador bloqueia armazenamento local.
  }
}

function chamarCallback(contexto) {
  if (typeof contexto.onMidpoint !== "function") return;

  try {
    contexto.onMidpoint();
  } catch (error) {
    console.error("Erro ao concluir a troca de tema:", error);
  }
}

function aplicarTemaNoMidpoint(contexto) {
  if (transicaoAtiva !== contexto || contexto.cancelada || contexto.temaAplicado) return;

  contexto.temaAplicado = true;
  definirTemaNoDocumento(contexto.temaConfig);
  chamarCallback(contexto);
}

function finalizarTransicao(contexto) {
  if (transicaoAtiva !== contexto) return;

  aplicarTemaNoMidpoint(contexto);
  transicaoAtiva = null;
  gsap.killTweensOf([contexto.overlay, ...contexto.elementos]);
  restaurarOverlay(contexto.overlay);
}

function criarContexto(overlay, temaConfig, onMidpoint) {
  const contexto = {
    overlay,
    temaConfig,
    onMidpoint,
    elementos: [],
    cancelada: false,
    temaAplicado: false,
    timeline: null,
  };

  contexto.timeline = gsap.timeline({
    paused: true,
    defaults: { overwrite: "auto" },
    onComplete: () => finalizarTransicao(contexto),
  });

  transicaoAtiva = contexto;
  return contexto;
}

function registrarElemento(contexto, elemento) {
  contexto.elementos.push(elemento);
  contexto.overlay.appendChild(elemento);
  return elemento;
}

function injetarSimboloTransicao(contexto) {
  const img = document.createElement("img");
  img.className = "transition-symbol";
  img.id = `simbolo-${contexto.temaConfig.id.replace("tema-", "")}-trans`;
  img.src = contexto.temaConfig.simbolo;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.decoding = "async";
  img.draggable = false;

  return registrarElemento(contexto, img);
}

function prepararOverlay(contexto, className = "") {
  const { overlay } = contexto;
  restaurarOverlay(overlay);
  overlay.className = className;
  overlay.style.backgroundColor = "transparent";
  overlay.style.backgroundImage = "none";
  overlay.style.opacity = "0";
}

function animarSimbolo(contexto, simbolo, {
  inicio = 0.08,
  entrada = 0.28,
  saida = 0.58,
  duracaoSaida = 0.28,
  escalaInicial = 0.78,
  escalaFinal = 1.08,
  opacidade = 0.88,
  rotacao = 0,
} = {}) {
  const { timeline } = contexto;

  timeline.fromTo(simbolo, {
    opacity: 0,
    scale: escalaInicial,
    rotation: rotacao,
    xPercent: -50,
    yPercent: -50,
  }, {
    opacity: opacidade,
    scale: 1,
    rotation: 0,
    xPercent: -50,
    yPercent: -50,
    duration: entrada,
    ease: "power2.out",
  }, inicio);

  timeline.to(simbolo, {
    opacity: 0,
    scale: escalaFinal,
    xPercent: -50,
    yPercent: -50,
    duration: duracaoSaida,
    ease: "power1.in",
  }, saida);
}

function executarAnimacaoOrdem(contexto) {
  prepararOverlay(contexto, "anim-ordem");

  const { timeline, overlay, temaConfig } = contexto;
  const simbolo = injetarSimboloTransicao(contexto);
  const cor = getCorTransicao(temaConfig);

  overlay.style.background = `radial-gradient(circle, ${temaConfig.cor}33 0%, ${cor} 58%, #020406 100%)`;

  timeline.fromTo(overlay, { opacity: 0 }, {
    opacity: 1,
    duration: 0.28,
    ease: "power1.in",
  }, 0);

  animarSimbolo(contexto, simbolo, {
    inicio: 0.04,
    entrada: 0.3,
    saida: 0.42,
    duracaoSaida: 0.3,
    escalaInicial: 0.72,
    escalaFinal: 1.1,
    rotacao: -5,
  });

  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, 0.3);
  timeline.to(overlay, { opacity: 0, duration: 0.34, ease: "power1.out" }, 0.4);
}

function executarAnimacaoSangue(contexto) {
  prepararOverlay(contexto, "anim-sangue");

  const { timeline, overlay, temaConfig } = contexto;
  const simbolo = injetarSimboloTransicao(contexto);
  const cor = getCorTransicao(temaConfig);

  timeline.set(overlay, { opacity: 1 }, 0);

  for (let i = 0; i < QUANTIDADE_PARTICULAS.sangueCortes; i += 1) {
    const corte = document.createElement("div");
    corte.className = "particula-corte";
    registrarElemento(contexto, corte);

    const delay = 0.03 + i * 0.045;
    const horizontal = i % 3 !== 0;

    gsap.set(corte, {
      left: `${12 + Math.random() * 76}vw`,
      top: `${8 + Math.random() * 84}vh`,
      width: horizontal ? "125vw" : "125vh",
      height: `${3 + Math.random() * 5}px`,
      rotation: horizontal ? -35 + Math.random() * 70 : 55 + Math.random() * 70,
      xPercent: -50,
      yPercent: -50,
      transformOrigin: "center",
    });

    timeline.fromTo(corte, { scaleX: 0, opacity: 0 }, {
      scaleX: 1,
      opacity: 0.92,
      duration: 0.2,
      ease: "power3.out",
    }, delay);
    timeline.to(corte, { opacity: 0, duration: 0.22, ease: "power1.out" }, delay + 0.2);
  }

  for (let i = 0; i < QUANTIDADE_PARTICULAS.sangueRespingos; i += 1) {
    const respingo = document.createElement("div");
    respingo.className = "particula-sangue-splatter";
    registrarElemento(contexto, respingo);

    const tamanho = 12 + Math.random() * 34;
    const delay = 0.12 + Math.random() * 0.32;

    gsap.set(respingo, {
      left: `${Math.random() * 100}vw`,
      top: `${Math.random() * 100}vh`,
      width: tamanho,
      height: tamanho,
      backgroundColor: temaConfig.cor,
    });

    timeline.fromTo(respingo, { opacity: 0, scale: 0.15 }, {
      opacity: 0.72,
      scale: 1.4 + Math.random(),
      duration: 0.2,
      ease: "power2.out",
    }, delay);
    timeline.to(respingo, { opacity: 0, duration: 0.3 }, delay + 0.2);
  }

  timeline.to(overlay, { backgroundColor: cor, duration: 0.28, ease: "power1.in" }, 0.2);
  animarSimbolo(contexto, simbolo, {
    inicio: 0.2,
    entrada: 0.24,
    saida: 0.62,
    duracaoSaida: 0.26,
    escalaInicial: 0.7,
    escalaFinal: 1.14,
    opacidade: 0.9,
  });
  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, 0.46);
  timeline.to(overlay, { opacity: 0, duration: 0.4, ease: "power1.out" }, 0.68);
}

function executarAnimacaoMorte(contexto) {
  prepararOverlay(contexto, "anim-morte");

  const { timeline, overlay, temaConfig } = contexto;
  const simbolo = injetarSimboloTransicao(contexto);
  const cor = getCorTransicao(temaConfig);

  timeline.set(overlay, { opacity: 1 }, 0);
  timeline.to(overlay, { backgroundColor: cor, duration: 0.42, ease: "power1.in" }, 0);

  for (let i = 0; i < QUANTIDADE_PARTICULAS.morte; i += 1) {
    const particula = document.createElement("div");
    particula.className = "particula-morte";
    registrarElemento(contexto, particula);

    const tamanho = 10 + Math.random() * 30;
    const delay = Math.random() * 0.34;

    gsap.set(particula, {
      left: "-12vw",
      top: `${Math.random() * 100}vh`,
      width: tamanho,
      height: tamanho,
      backgroundColor: i % 3 === 0 ? "#6f6f6f" : "#050505",
    });

    timeline.fromTo(particula, {
      x: 0,
      y: 16,
      opacity: 0,
      rotation: 0,
    }, {
      x: "124vw",
      y: -24 - Math.random() * 45,
      opacity: 0.48,
      rotation: 180 + Math.random() * 300,
      duration: 0.62 + Math.random() * 0.32,
      ease: "none",
    }, delay);
    timeline.to(particula, { opacity: 0, duration: 0.2 }, delay + 0.58);
  }

  animarSimbolo(contexto, simbolo, {
    inicio: 0.16,
    entrada: 0.34,
    saida: 0.62,
    duracaoSaida: 0.34,
    escalaInicial: 0.86,
    escalaFinal: 1.04,
    opacidade: 0.55,
    rotacao: -3,
  });
  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, 0.48);
  timeline.to(overlay, { opacity: 0, duration: 0.46, ease: "power1.out" }, 0.68);
}

function executarAnimacaoConhecimento(contexto) {
  prepararOverlay(contexto, "anim-conhecimento");

  const { timeline, overlay, temaConfig } = contexto;
  const simbolo = injetarSimboloTransicao(contexto);
  const cor = getCorTransicao(temaConfig);
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  timeline.set(overlay, { opacity: 1, backgroundColor: cor }, 0);

  for (let i = 0; i < QUANTIDADE_PARTICULAS.conhecimento; i += 1) {
    const glifo = document.createElement("span");
    glifo.className = "glitch-text";
    glifo.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    registrarElemento(contexto, glifo);

    const delay = Math.random() * 0.3;
    const deslocamento = 18 + Math.random() * 42;

    gsap.set(glifo, {
      left: `${4 + Math.random() * 92}vw`,
      top: `${5 + Math.random() * 90}vh`,
      fontSize: `${0.8 + Math.random() * 1.4}rem`,
      rotation: -35 + Math.random() * 70,
    });

    timeline.fromTo(glifo, { opacity: 0, y: deslocamento }, {
      opacity: 0.35 + Math.random() * 0.45,
      y: 0,
      duration: 0.26,
      ease: "power2.out",
    }, delay);
    timeline.to(glifo, {
      opacity: 0,
      y: -deslocamento,
      duration: 0.3,
      ease: "power1.in",
    }, delay + 0.3);
  }

  animarSimbolo(contexto, simbolo, {
    inicio: 0.16,
    entrada: 0.28,
    saida: 0.54,
    duracaoSaida: 0.26,
    escalaInicial: 0.76,
    escalaFinal: 1.12,
    opacidade: 0.94,
  });
  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, 0.42);
  timeline.to(overlay, { opacity: 0, duration: 0.38, ease: "power1.out" }, 0.58);
}

function executarAnimacaoEnergia(contexto) {
  prepararOverlay(contexto, "anim-energia");

  const { timeline, overlay, temaConfig } = contexto;
  const simbolo = injetarSimboloTransicao(contexto);
  const cor = getCorTransicao(temaConfig);

  overlay.style.backgroundColor = cor;
  overlay.style.backgroundImage = "url('/assets/images/glitch.webp')";
  overlay.style.backgroundPosition = "center";
  overlay.style.backgroundRepeat = "no-repeat";
  overlay.style.backgroundSize = "cover";

  timeline.fromTo(overlay, { opacity: 0 }, {
    opacity: 1,
    duration: 0.2,
    ease: "steps(3)",
  }, 0);

  animarSimbolo(contexto, simbolo, {
    inicio: 0.08,
    entrada: 0.2,
    saida: 0.42,
    duracaoSaida: 0.22,
    escalaInicial: 0.66,
    escalaFinal: 1.16,
    opacidade: 0.92,
    rotacao: 4,
  });
  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, 0.32);
  timeline.to(overlay, { opacity: 0, duration: 0.34, ease: "steps(4)" }, 0.46);
}

const animacoesPorTipo = Object.freeze({
  radar: executarAnimacaoOrdem,
  cortes: executarAnimacaoSangue,
  cinzas: executarAnimacaoMorte,
  sigilos: executarAnimacaoConhecimento,
  glitch: executarAnimacaoEnergia,
});

function aplicarImediatamente(temaConfig, onMidpointCallback) {
  definirTemaNoDocumento(temaConfig);

  if (typeof onMidpointCallback === "function") {
    try {
      onMidpointCallback();
    } catch (error) {
      console.error("Erro ao concluir a troca de tema:", error);
    }
  }
}

export function aplicarTemaComAnimacao(tema, temaAtual, onMidpointCallback) {
  const temaConfig = getTemaConfig(tema);
  const temaAtualConfig = getTemaConfig(temaAtual);
  const temaNoDocumento = typeof document !== "undefined"
    ? document.documentElement.dataset.tema
    : "";
  const temaOrigem = temaNoDocumento || temaAtualConfig.id;

  cancelarTransicaoAtiva();

  if (temaConfig.id === temaOrigem) {
    definirTemaNoDocumento(temaConfig);
    return;
  }

  const overlay = obterOverlay();
  if (!overlay || deveReduzirMovimento()) {
    aplicarImediatamente(temaConfig, onMidpointCallback);
    return;
  }

  const contexto = criarContexto(overlay, temaConfig, onMidpointCallback);
  const executarAnimacao = animacoesPorTipo[temaConfig.transicao] || executarAnimacaoOrdem;

  try {
    executarAnimacao(contexto);
    contexto.timeline.play(0);
  } catch (error) {
    console.error("Não foi possível executar a animação de tema:", error);
    cancelarTransicaoAtiva();
    aplicarImediatamente(temaConfig, onMidpointCallback);
  }
}

export function aplicarTemaSemAnimacao(tema) {
  cancelarTransicaoAtiva();
  definirTemaNoDocumento(getTemaConfig(tema));
}
