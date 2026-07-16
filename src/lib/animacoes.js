import { gsap } from "gsap";
import { getTemaConfig } from "./temas.js";

const MEDIA_ANIMACAO_COMPACTA = "(max-width: 760px), (pointer: coarse)";

const QUANTIDADE_PARTICULAS = Object.freeze({
  desktop: Object.freeze({
    radar: 6,
    sangueCortes: 4,
    sangueRespingos: 9,
    morte: 22,
    conhecimento: 48,
    energia: 10,
  }),
  compacta: Object.freeze({
    radar: 3,
    sangueCortes: 3,
    sangueRespingos: 4,
    morte: 9,
    conhecimento: 22,
    energia: 5,
  }),
});

let transicaoAtiva = null;

function obterOverlay() {
  if (typeof document === "undefined") return null;
  return document.getElementById("transition-overlay");
}

function obterPerfilAnimacao() {
  if (typeof window === "undefined") {
    return { compacta: true };
  }

  const navegador = typeof navigator === "undefined" ? {} : navigator;
  const mediaCompacta = typeof window.matchMedia === "function"
    && window.matchMedia(MEDIA_ANIMACAO_COMPACTA).matches;
  const poucaMemoria = Number.isFinite(navegador.deviceMemory)
    && navegador.deviceMemory <= 4;
  const poucosNucleos = Number.isFinite(navegador.hardwareConcurrency)
    && navegador.hardwareConcurrency <= 4;

  return { compacta: mediaCompacta || poucaMemoria || poucosNucleos };
}

function deveReduzirMovimento() {
  if (typeof document === "undefined") return true;

  // A escolha explícita no aplicativo prevalece sobre a preferência do SO.
  // O SO ainda define o valor inicial do Modo leve em BotaoEconomia.
  return document.body?.classList.contains("modo-economia");
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

function aleatorio(minimo, maximo) {
  return minimo + Math.random() * (maximo - minimo);
}

function tempo(contexto, desktop, compacta = desktop * 0.8) {
  return contexto.perfil.compacta ? compacta : desktop;
}

function quantidade(contexto, tipo) {
  const perfil = contexto.perfil.compacta ? "compacta" : "desktop";
  return QUANTIDADE_PARTICULAS[perfil][tipo];
}

function restaurarOverlay(overlay) {
  if (!overlay) return;

  overlay.replaceChildren();
  overlay.className = "";
  overlay.removeAttribute("style");
}

function removerGuardas(contexto) {
  if (!contexto?.guardasAtivos) return;

  contexto.guardasAtivos = false;
  contexto.bodyObserver?.disconnect();
  contexto.bodyObserver = null;

  document.removeEventListener("visibilitychange", contexto.interromperSeOculto);
  window.removeEventListener("pagehide", contexto.interromperPorPreferencia);
}

function cancelarTransicaoAtiva() {
  const contexto = transicaoAtiva;
  if (!contexto) return;

  transicaoAtiva = null;
  contexto.cancelada = true;
  removerGuardas(contexto);
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
    // O tema continua funcional quando o navegador bloqueia armazenamento local.
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
  removerGuardas(contexto);
  gsap.killTweensOf([contexto.overlay, ...contexto.elementos]);
  restaurarOverlay(contexto.overlay);
}

function interromperEAplicar(contexto) {
  if (transicaoAtiva !== contexto) return;

  contexto.timeline?.kill();
  gsap.killTweensOf([contexto.overlay, ...contexto.elementos]);
  aplicarTemaNoMidpoint(contexto);
  transicaoAtiva = null;
  removerGuardas(contexto);
  restaurarOverlay(contexto.overlay);
}

function instalarGuardas(contexto) {
  contexto.guardasAtivos = true;
  contexto.interromperPorPreferencia = () => {
    if (deveReduzirMovimento() || document.visibilityState === "hidden") {
      interromperEAplicar(contexto);
    }
  };
  contexto.interromperSeOculto = () => {
    if (document.visibilityState === "hidden") interromperEAplicar(contexto);
  };

  if (typeof MutationObserver === "function" && document.body) {
    contexto.bodyObserver = new MutationObserver(contexto.interromperPorPreferencia);
    contexto.bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  document.addEventListener("visibilitychange", contexto.interromperSeOculto);
  window.addEventListener("pagehide", contexto.interromperPorPreferencia, { once: true });
}

function criarContexto(overlay, temaConfig, onMidpoint) {
  const contexto = {
    overlay,
    temaConfig,
    onMidpoint,
    perfil: obterPerfilAnimacao(),
    elementos: [],
    cancelada: false,
    temaAplicado: false,
    timeline: null,
    guardasAtivos: false,
  };

  contexto.timeline = gsap.timeline({
    paused: true,
    defaults: { overwrite: "auto" },
    onComplete: () => finalizarTransicao(contexto),
  });

  transicaoAtiva = contexto;
  instalarGuardas(contexto);
  return contexto;
}

function registrarElemento(contexto, elemento, parent = contexto.overlay) {
  contexto.elementos.push(elemento);
  parent.appendChild(elemento);
  return elemento;
}

function criarElemento(contexto, tagName, className, parent) {
  const elemento = document.createElement(tagName);
  elemento.className = className;
  elemento.setAttribute("aria-hidden", "true");
  return registrarElemento(contexto, elemento, parent);
}

function injetarSimboloTransicao(contexto, className = "") {
  const img = document.createElement("img");
  const nomeTema = contexto.temaConfig.id.replace("tema-", "");

  img.className = `transition-symbol ${className}`.trim();
  img.id = `simbolo-${nomeTema}-trans`;
  img.src = contexto.perfil.compacta
    ? (contexto.temaConfig.simboloMini || contexto.temaConfig.simbolo)
    : contexto.temaConfig.simbolo;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.decoding = "async";
  img.draggable = false;

  return registrarElemento(contexto, img);
}

function prepararOverlay(contexto, className) {
  const { overlay, temaConfig } = contexto;

  restaurarOverlay(overlay);
  overlay.className = `theme-transition ${className}`;
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.setProperty("--transition-accent", temaConfig.cor);
  overlay.style.setProperty("--transition-background", getCorTransicao(temaConfig));
  overlay.style.opacity = "0";
  overlay.style.visibility = "visible";
}

function animarSimbolo(contexto, simbolo, {
  inicio = 0.08,
  entrada = 0.3,
  saida = 0.62,
  duracaoSaida = 0.3,
  escalaInicial = 0.78,
  escalaFinal = 1.08,
  opacidade = 0.9,
  rotacao = 0,
  blur = 0,
} = {}) {
  const { timeline } = contexto;

  timeline.fromTo(simbolo, {
    opacity: 0,
    scale: escalaInicial,
    rotation: rotacao,
    xPercent: -50,
    yPercent: -50,
    "--transition-symbol-blur": `${blur}px`,
    force3D: true,
  }, {
    opacity: opacidade,
    scale: 1,
    rotation: 0,
    xPercent: -50,
    yPercent: -50,
    "--transition-symbol-blur": "0px",
    duration: entrada,
    ease: "power3.out",
    force3D: true,
  }, inicio);

  timeline.to(simbolo, {
    opacity: 0,
    scale: escalaFinal,
    xPercent: -50,
    yPercent: -50,
    duration: duracaoSaida,
    ease: "power2.in",
    force3D: true,
  }, saida);
}

function executarAnimacaoOrdem(contexto) {
  prepararOverlay(contexto, "anim-ordem");

  const { timeline, overlay } = contexto;
  const wash = criarElemento(contexto, "div", "transition-wash transition-wash--ordem");
  const radar = criarElemento(contexto, "div", "transition-radar");
  const sweep = criarElemento(contexto, "span", "transition-radar__sweep", radar);
  const simbolo = injetarSimboloTransicao(contexto);
  const entrada = tempo(contexto, 0.32, 0.24);
  const pontoMedio = tempo(contexto, 0.64, 0.48);
  const saida = tempo(contexto, 0.98, 0.74);

  timeline.fromTo(overlay, { opacity: 0 }, {
    opacity: 1,
    duration: entrada,
    ease: "power2.inOut",
  }, 0);
  timeline.fromTo(wash, { opacity: 0 }, {
    opacity: 1,
    duration: entrada,
    ease: "power1.out",
  }, 0);
  timeline.fromTo(radar, {
    opacity: 0,
    scale: 0.58,
    rotation: -8,
    xPercent: -50,
    yPercent: -50,
  }, {
    opacity: 0.92,
    scale: 1,
    rotation: 0,
    xPercent: -50,
    yPercent: -50,
    duration: tempo(contexto, 0.62, 0.46),
    ease: "expo.out",
    force3D: true,
  }, 0.03);
  timeline.fromTo(sweep, { rotation: -70, opacity: 0 }, {
    rotation: 300,
    opacity: 0.84,
    duration: tempo(contexto, 0.9, 0.68),
    ease: "none",
    force3D: true,
  }, 0.06);

  for (let i = 0; i < quantidade(contexto, "radar"); i += 1) {
    const blip = criarElemento(contexto, "i", "transition-radar__blip", radar);
    const angulo = aleatorio(0, Math.PI * 2);
    const raio = aleatorio(14, 44);
    blip.style.left = `${50 + Math.cos(angulo) * raio}%`;
    blip.style.top = `${50 + Math.sin(angulo) * raio}%`;

    timeline.fromTo(blip, { opacity: 0, scale: 0.2 }, {
      opacity: 1,
      scale: 1,
      duration: tempo(contexto, 0.12, 0.09),
      ease: "back.out(2.4)",
    }, tempo(contexto, 0.16 + i * 0.055, 0.12 + i * 0.038));
    timeline.to(blip, {
      opacity: 0,
      scale: 2.2,
      duration: tempo(contexto, 0.22, 0.16),
      ease: "power2.out",
    }, tempo(contexto, 0.42 + i * 0.025, 0.32 + i * 0.018));
  }

  animarSimbolo(contexto, simbolo, {
    inicio: tempo(contexto, 0.16, 0.12),
    entrada: tempo(contexto, 0.46, 0.34),
    saida,
    duracaoSaida: tempo(contexto, 0.46, 0.34),
    escalaInicial: 0.64,
    escalaFinal: 1.12,
    opacidade: 0.9,
    rotacao: -5,
    blur: contexto.perfil.compacta ? 2 : 4,
  });

  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, pontoMedio);
  timeline.to(radar, {
    opacity: 0,
    scale: 1.22,
    duration: tempo(contexto, 0.46, 0.34),
    ease: "power2.in",
  }, saida - 0.05);
  timeline.to(overlay, {
    opacity: 0,
    duration: tempo(contexto, 0.5, 0.36),
    ease: "power2.out",
  }, saida);
}

function executarAnimacaoSangue(contexto) {
  prepararOverlay(contexto, "anim-sangue");

  const { timeline, overlay } = contexto;
  const wash = criarElemento(contexto, "div", "transition-wash transition-wash--sangue");
  const mare = criarElemento(contexto, "div", "transition-blood-tide");
  const ondas = [1, 2, 3].map((indice) => criarElemento(
    contexto,
    "div",
    `transition-blood-wave transition-blood-wave--${indice}`,
    mare,
  ));
  const veias = criarElemento(contexto, "div", "transition-blood-veins");
  const vasos = Array.from({ length: contexto.perfil.compacta ? 6 : 12 }, (_, indice) => criarElemento(
    contexto,
    "i",
    `transition-blood-vessel transition-blood-vessel--${(indice % 3) + 1}`,
    veias,
  ));
  const pulso = criarElemento(contexto, "div", "transition-blood-pulse");
  const simbolo = injetarSimboloTransicao(contexto);
  const pontoMedio = tempo(contexto, 0.72, 0.54);
  const saida = tempo(contexto, 1.08, 0.82);

  timeline.set(overlay, { opacity: 1 }, 0);
  timeline.fromTo(wash, { opacity: 0 }, {
    opacity: 1,
    duration: tempo(contexto, 0.46, 0.34),
    ease: "power2.in",
  }, 0);
  timeline.fromTo(mare, {
    opacity: 0,
    yPercent: 48,
    scale: 1.12,
  }, {
    opacity: 0.92,
    yPercent: 0,
    scale: 1,
    duration: tempo(contexto, 0.9, 0.68),
    ease: "power3.out",
    force3D: true,
  }, 0.03);
  ondas.forEach((onda, indice) => {
    timeline.fromTo(onda, {
      xPercent: indice % 2 === 0 ? -18 : 18,
      yPercent: 16 + indice * 6,
      rotation: indice % 2 === 0 ? -7 : 7,
      scale: 1.08,
    }, {
      xPercent: indice % 2 === 0 ? 8 : -8,
      yPercent: -4 - indice * 3,
      rotation: indice % 2 === 0 ? 4 : -4,
      scale: 1,
      duration: tempo(contexto, 0.98 + indice * 0.08, 0.72 + indice * 0.06),
      ease: "power2.inOut",
      force3D: true,
    }, tempo(contexto, 0.02 + indice * 0.04, 0.02 + indice * 0.03));
  });
  timeline.fromTo(veias, {
    opacity: 0,
    scale: 0.42,
    rotation: -18,
    xPercent: -50,
    yPercent: -50,
  }, {
    opacity: 0.72,
    scale: 1.08,
    rotation: 16,
    xPercent: -50,
    yPercent: -50,
    duration: tempo(contexto, 0.8, 0.6),
    ease: "power3.out",
    force3D: true,
  }, 0.05);
  vasos.forEach((vaso, indice) => {
    const angulo = (indice / vasos.length) * 360 + aleatorio(-16, 16);
    const delay = tempo(contexto, 0.12 + (indice % 6) * 0.045, 0.09 + (indice % 4) * 0.035);

    gsap.set(vaso, {
      left: "50%",
      top: "50%",
      width: `${aleatorio(28, 48)}%`,
      height: `${aleatorio(3, contexto.perfil.compacta ? 6 : 9)}px`,
      rotation: angulo,
      transformOrigin: "left center",
      force3D: true,
    });
    timeline.fromTo(vaso, {
      opacity: 0,
      scaleX: 0.04,
      scaleY: 0.4,
    }, {
      opacity: aleatorio(0.4, 0.76),
      scaleX: 1,
      scaleY: aleatorio(0.72, 1.24),
      duration: tempo(contexto, 0.34, 0.25),
      ease: "power3.out",
      force3D: true,
    }, delay);
  });
  timeline.fromTo(pulso, {
    opacity: 0,
    scale: 0.35,
    xPercent: -50,
    yPercent: -50,
  }, {
    opacity: 0.62,
    scale: 1.08,
    xPercent: -50,
    yPercent: -50,
    duration: tempo(contexto, 0.68, 0.5),
    ease: "power4.out",
    force3D: true,
  }, 0.04);

  for (let i = 0; i < quantidade(contexto, "sangueCortes"); i += 1) {
    const corte = criarElemento(contexto, "div", "particula-corte");
    const brilho = criarElemento(contexto, "i", "particula-corte__brilho", corte);
    const delay = tempo(contexto, 0.05 + i * 0.055, 0.04 + i * 0.045);
    const horizontal = i % 3 !== 0;

    gsap.set(corte, {
      left: `${aleatorio(14, 86)}vw`,
      top: `${aleatorio(8, 92)}vh`,
      width: horizontal ? `${aleatorio(78, 118)}vw` : `${aleatorio(68, 102)}vh`,
      height: `${aleatorio(2, contexto.perfil.compacta ? 4 : 6)}px`,
      rotation: horizontal ? aleatorio(-38, 38) : aleatorio(58, 122),
      xPercent: -50,
      yPercent: -50,
      transformOrigin: i % 2 === 0 ? "left center" : "right center",
      force3D: true,
    });

    timeline.fromTo(corte, { scaleX: 0, opacity: 0 }, {
      scaleX: 1,
      opacity: 0.98,
      duration: tempo(contexto, 0.17, 0.13),
      ease: "power4.out",
      force3D: true,
    }, delay);
    timeline.fromTo(brilho, { xPercent: -110, opacity: 0 }, {
      xPercent: 120,
      opacity: 0.88,
      duration: tempo(contexto, 0.2, 0.15),
      ease: "power2.inOut",
    }, delay + 0.03);
    timeline.to(corte, {
      opacity: 0,
      scaleY: 0.2,
      duration: tempo(contexto, 0.28, 0.2),
      ease: "power2.in",
    }, delay + tempo(contexto, 0.22, 0.17));
  }

  for (let i = 0; i < quantidade(contexto, "sangueRespingos"); i += 1) {
    const respingo = criarElemento(contexto, "div", "particula-sangue-splatter");
    const tamanho = aleatorio(10, contexto.perfil.compacta ? 28 : 42);
    const delay = tempo(contexto, aleatorio(0.18, 0.5), aleatorio(0.14, 0.38));

    gsap.set(respingo, {
      left: `${aleatorio(4, 96)}vw`,
      top: `${aleatorio(4, 96)}vh`,
      width: tamanho,
      height: tamanho * aleatorio(0.55, 1.25),
      rotation: aleatorio(-80, 80),
      borderRadius: `${aleatorio(35, 68)}% ${aleatorio(30, 72)}% ${aleatorio(32, 70)}% ${aleatorio(28, 66)}%`,
    });

    timeline.fromTo(respingo, { opacity: 0, scale: 0.08 }, {
      opacity: 0.78,
      scale: aleatorio(0.9, 1.7),
      duration: tempo(contexto, 0.18, 0.14),
      ease: "back.out(2)",
    }, delay);
    timeline.to(respingo, {
      opacity: 0,
      scale: aleatorio(1.7, 2.5),
      duration: tempo(contexto, 0.34, 0.24),
      ease: "power1.out",
    }, delay + tempo(contexto, 0.17, 0.13));
  }

  animarSimbolo(contexto, simbolo, {
    inicio: tempo(contexto, 0.32, 0.24),
    entrada: tempo(contexto, 0.42, 0.31),
    saida,
    duracaoSaida: tempo(contexto, 0.48, 0.35),
    escalaInicial: 0.58,
    escalaFinal: 1.18,
    opacidade: 0.94,
    rotacao: 3,
    blur: contexto.perfil.compacta ? 2 : 5,
  });

  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, pontoMedio);
  timeline.to(pulso, {
    opacity: 0,
    scale: 1.55,
    duration: tempo(contexto, 0.5, 0.36),
    ease: "power2.in",
  }, saida - 0.12);
  timeline.to([mare, veias], {
    opacity: 0,
    scale: 1.12,
    duration: tempo(contexto, 0.46, 0.34),
    ease: "power2.in",
  }, saida - tempo(contexto, 0.1, 0.08));
  timeline.to(overlay, {
    opacity: 0,
    duration: tempo(contexto, 0.52, 0.38),
    ease: "power2.out",
  }, saida);
}

function executarAnimacaoMorte(contexto) {
  prepararOverlay(contexto, "anim-morte");

  const { timeline, overlay } = contexto;
  const wash = criarElemento(contexto, "div", "transition-wash transition-wash--morte");
  const mantosLodo = [1, 2].map((indice) => criarElemento(
    contexto,
    "div",
    `transition-death-sludge-sheet transition-death-sludge-sheet--${indice}`,
  ));
  const lodoTemporal = criarElemento(contexto, "div", "transition-death-sludge");
  const espiral = criarElemento(contexto, "div", "transition-death-spiral", lodoTemporal);
  const anelTemporal = criarElemento(contexto, "div", "transition-death-clock-ring", lodoTemporal);
  const halo = criarElemento(contexto, "div", "transition-death-halo", lodoTemporal);
  const flash = criarElemento(contexto, "div", "transition-death-flash");
  const gotasLodo = Array.from({ length: contexto.perfil.compacta ? 4 : 7 }, (_, indice) => criarElemento(
    contexto,
    "i",
    `transition-death-sludge-drop transition-death-sludge-drop--${(indice % 3) + 1}`,
  ));
  const ecos = ["passado", "presente", "futuro"].map((estado) => {
    const eco = injetarSimboloTransicao(contexto, `transition-symbol--death-echo transition-symbol--death-${estado}`);
    eco.removeAttribute("id");
    return eco;
  });
  const simbolo = injetarSimboloTransicao(contexto);
  const raioBase = Math.max(180, Math.min(window.innerWidth, window.innerHeight) * 0.54);
  const pontoMedio = tempo(contexto, 0.8, 0.6);
  const saida = tempo(contexto, 1.22, 0.92);

  timeline.set(overlay, { opacity: 1 }, 0);
  timeline.fromTo(wash, { opacity: 0 }, {
    opacity: 1,
    duration: tempo(contexto, 0.56, 0.42),
    ease: "power2.in",
  }, 0);
  mantosLodo.forEach((manto, indice) => {
    const direcao = indice === 0 ? 1 : -1;
    timeline.fromTo(manto, {
      opacity: 0,
      xPercent: -direcao * 18,
      yPercent: direcao * 68,
      rotation: -direcao * 9,
      scale: 1.08,
    }, {
      opacity: indice === 0 ? 0.84 : 0.68,
      xPercent: direcao * 6,
      yPercent: -direcao * 4,
      rotation: direcao * 5,
      scale: 1,
      duration: tempo(contexto, 0.96 + indice * 0.1, 0.72 + indice * 0.08),
      ease: "power3.inOut",
      force3D: true,
    }, tempo(contexto, 0.02 + indice * 0.06, 0.02 + indice * 0.045));
  });
  timeline.fromTo(lodoTemporal, {
    opacity: 0,
    scale: 1.34,
    rotation: -28,
    xPercent: -50,
    yPercent: -50,
  }, {
    opacity: 0.94,
    scale: 0.88,
    rotation: 142,
    xPercent: -50,
    yPercent: -50,
    duration: tempo(contexto, 1.16, 0.86),
    ease: "power3.inOut",
    force3D: true,
  }, 0.02);
  timeline.fromTo(espiral, { opacity: 0, scale: 1.26, rotation: -120 }, {
    opacity: 0.9,
    scale: 0.68,
    rotation: 300,
    duration: tempo(contexto, 1.18, 0.88),
    ease: "power2.inOut",
    force3D: true,
  }, 0.03);
  timeline.fromTo(anelTemporal, { opacity: 0, scale: 1.08, rotation: 90 }, {
    opacity: 0.58,
    scale: 0.76,
    rotation: -240,
    duration: tempo(contexto, 1.02, 0.76),
    ease: "steps(9)",
    force3D: true,
  }, 0.06);
  timeline.fromTo(halo, { opacity: 0, scale: 1.34 }, {
    opacity: 0.78,
    scale: 0.58,
    duration: tempo(contexto, 0.9, 0.68),
    ease: "expo.in",
  }, 0.04);

  gotasLodo.forEach((gota, indice) => {
    const esquerda = aleatorio(6, 94);
    const topo = aleatorio(6, 94);
    const tamanho = aleatorio(contexto.perfil.compacta ? 22 : 30, contexto.perfil.compacta ? 54 : 78);
    const delay = tempo(contexto, 0.08 + (indice % 4) * 0.065, 0.06 + (indice % 3) * 0.05);
    const duracao = tempo(contexto, aleatorio(0.58, 0.86), aleatorio(0.44, 0.64));

    gsap.set(gota, {
      left: `${esquerda}%`,
      top: `${topo}%`,
      width: tamanho,
      height: tamanho * aleatorio(0.62, 1.26),
      xPercent: -50,
      yPercent: -50,
      force3D: true,
    });
    timeline.fromTo(gota, {
      opacity: 0,
      scale: aleatorio(0.3, 0.68),
      rotation: aleatorio(-80, 80),
      x: 0,
      y: 0,
    }, {
      opacity: aleatorio(0.58, 0.86),
      scale: aleatorio(0.9, 1.3),
      rotation: aleatorio(120, 320),
      x: ((50 - esquerda) / 100) * window.innerWidth * 0.68,
      y: ((50 - topo) / 100) * window.innerHeight * 0.68,
      duration: duracao,
      ease: indice % 2 === 0 ? "steps(5)" : "power2.in",
      force3D: true,
    }, delay);
    timeline.to(gota, {
      opacity: 0,
      scale: 0.08,
      duration: tempo(contexto, 0.24, 0.18),
      ease: "power3.in",
    }, delay + duracao * 0.82);
  });

  const totalBracos = contexto.perfil.compacta ? 5 : 8;
  for (let i = 0; i < totalBracos; i += 1) {
    const braco = criarElemento(contexto, "i", `transition-death-sludge-arm transition-death-sludge-arm--${(i % 3) + 1}`);
    const angulo = (i / totalBracos) * 360 + aleatorio(-12, 12);
    const duracao = tempo(contexto, aleatorio(0.72, 0.98), aleatorio(0.54, 0.72));
    const delay = tempo(contexto, 0.05 + (i % 4) * 0.06, 0.04 + (i % 3) * 0.045);

    gsap.set(braco, {
      left: "50%",
      top: "50%",
      width: `${aleatorio(contexto.perfil.compacta ? 48 : 58, contexto.perfil.compacta ? 72 : 88)}vmin`,
      height: `${aleatorio(5, contexto.perfil.compacta ? 10 : 14)}vmin`,
      transformOrigin: "left center",
      rotation: angulo,
      force3D: true,
    });
    timeline.fromTo(braco, {
      opacity: 0,
      scaleX: 1.18,
      scaleY: aleatorio(0.64, 1.1),
      rotation: angulo - 22,
    }, {
      opacity: aleatorio(0.58, 0.86),
      scaleX: 0.18,
      scaleY: aleatorio(0.36, 0.72),
      rotation: angulo + aleatorio(92, 138),
      duration: duracao,
      ease: "power2.in",
      force3D: true,
    }, delay);
    timeline.to(braco, {
      opacity: 0,
      scaleX: 0.04,
      duration: tempo(contexto, 0.24, 0.18),
      ease: "power3.in",
    }, delay + duracao * 0.78);
  }

  for (let i = 0; i < quantidade(contexto, "morte"); i += 1) {
    const cinza = criarElemento(contexto, "i", "particula-morte");
    const angulo = (i / quantidade(contexto, "morte")) * Math.PI * 2 + aleatorio(-0.22, 0.22);
    const raio = raioBase * aleatorio(0.74, 1.28);
    const tamanho = aleatorio(4, contexto.perfil.compacta ? 12 : 18);
    const delay = tempo(contexto, aleatorio(0.02, 0.28), aleatorio(0.02, 0.2));
    const anguloIntermediario = angulo + aleatorio(0.62, 0.92);
    const anguloInterno = angulo + aleatorio(1.5, 1.95);
    const duracaoExterior = tempo(contexto, aleatorio(0.34, 0.48), aleatorio(0.26, 0.36));
    const duracaoInterior = tempo(contexto, aleatorio(0.28, 0.46), aleatorio(0.22, 0.34));
    const duracaoCentro = tempo(contexto, 0.24, 0.18);

    gsap.set(cinza, {
      left: "50%",
      top: "50%",
      width: tamanho,
      height: tamanho * aleatorio(0.45, 1.3),
      borderRadius: `${aleatorio(24, 70)}%`,
    });
    timeline.fromTo(cinza, {
      x: Math.cos(angulo) * raio,
      y: Math.sin(angulo) * raio,
      opacity: 0,
      scale: aleatorio(0.5, 1.4),
      rotation: aleatorio(-160, 160),
    }, {
      x: Math.cos(anguloIntermediario) * raio * 0.52,
      y: Math.sin(anguloIntermediario) * raio * 0.52,
      opacity: aleatorio(0.42, 0.86),
      scale: aleatorio(0.4, 0.88),
      rotation: aleatorio(160, 360),
      duration: duracaoExterior,
      ease: i % 3 === 0 ? "steps(5)" : "power1.in",
      force3D: true,
    }, delay);
    timeline.to(cinza, {
      x: Math.cos(anguloInterno) * raio * 0.16,
      y: Math.sin(anguloInterno) * raio * 0.16,
      opacity: aleatorio(0.58, 0.92),
      scale: aleatorio(0.16, 0.48),
      rotation: aleatorio(380, 720),
      duration: duracaoInterior,
      ease: i % 4 === 0 ? "steps(3)" : "power1.in",
      force3D: true,
    }, delay + duracaoExterior);
    timeline.to(cinza, {
      x: 0,
      y: 0,
      opacity: 0,
      scale: 0.05,
      duration: duracaoCentro,
      ease: "power3.in",
    }, delay + duracaoExterior + duracaoInterior);
  }

  ecos.forEach((eco, indice) => {
    const deslocamento = (indice - 1) * (contexto.perfil.compacta ? 16 : 28);
    const instante = tempo(contexto, 0.2 + indice * 0.075, 0.15 + indice * 0.055);
    timeline.fromTo(eco, {
      opacity: 0,
      scale: 0.72 + indice * 0.12,
      rotation: -8 + indice * 8,
      xPercent: -50,
      yPercent: -50,
      x: deslocamento,
    }, {
      opacity: 0.34,
      scale: 0.94 + indice * 0.05,
      rotation: 3 - indice * 3,
      xPercent: -50,
      yPercent: -50,
      x: -deslocamento * 0.45,
      duration: tempo(contexto, 0.22 + indice * 0.07, 0.16 + indice * 0.05),
      ease: indice === 1 ? "steps(3)" : "power2.out",
      force3D: true,
    }, instante);
    timeline.to(eco, {
      opacity: 0,
      scale: 1.08 + indice * 0.05,
      duration: tempo(contexto, 0.22, 0.16),
      ease: "steps(3)",
    }, pontoMedio + tempo(contexto, indice * 0.035, indice * 0.026));
  });

  animarSimbolo(contexto, simbolo, {
    inicio: tempo(contexto, 0.38, 0.28),
    entrada: tempo(contexto, 0.48, 0.36),
    saida,
    duracaoSaida: tempo(contexto, 0.5, 0.38),
    escalaInicial: 1.22,
    escalaFinal: 0.88,
    opacidade: 0.9,
    rotacao: -8,
    blur: contexto.perfil.compacta ? 2 : 4,
  });

  timeline.fromTo(flash, {
    opacity: 0,
    scale: 0.52,
    xPercent: -50,
    yPercent: -50,
  }, {
    opacity: 0.2,
    scale: 1,
    xPercent: -50,
    yPercent: -50,
    duration: tempo(contexto, 0.14, 0.1),
    ease: "steps(2)",
  }, pontoMedio - tempo(contexto, 0.06, 0.045));
  timeline.to(flash, {
    opacity: 0,
    scale: 1.24,
    duration: tempo(contexto, 0.28, 0.21),
    ease: "power2.out",
  }, pontoMedio + tempo(contexto, 0.06, 0.045));
  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, pontoMedio);
  timeline.to(lodoTemporal, {
    opacity: 0,
    scale: 0.42,
    rotation: 320,
    duration: tempo(contexto, 0.54, 0.4),
    ease: "power3.in",
  }, saida - tempo(contexto, 0.14, 0.1));
  timeline.to(mantosLodo, {
    opacity: 0,
    scale: 1.08,
    duration: tempo(contexto, 0.48, 0.35),
    ease: "power2.in",
  }, saida - tempo(contexto, 0.12, 0.09));
  timeline.to(overlay, {
    opacity: 0,
    duration: tempo(contexto, 0.58, 0.42),
    ease: "power2.out",
  }, saida);
}

function executarAnimacaoConhecimento(contexto) {
  prepararOverlay(contexto, "anim-conhecimento");

  const { timeline, overlay } = contexto;
  const wash = criarElemento(contexto, "div", "transition-wash transition-wash--conhecimento");
  const wheel = criarElemento(contexto, "div", "transition-sigil-wheel");
  const revelacao = criarElemento(contexto, "div", "transition-knowledge-reveal");
  const simbolo = injetarSimboloTransicao(contexto);
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const reescrita = criarElemento(contexto, "div", "transition-knowledge-rewrite");
  const coro = criarElemento(contexto, "div", "transition-knowledge-choir");
  const colunas = Array.from({ length: contexto.perfil.compacta ? 3 : 5 }, (_, indice) => {
    const coluna = criarElemento(contexto, "span", "transition-knowledge-column", coro);
    coluna.textContent = Array.from(
      { length: contexto.perfil.compacta ? 12 : 18 },
      (__, posicao) => glyphs[(indice * 11 + posicao * 7) % glyphs.length],
    ).join(" ");
    coluna.style.left = `${10 + (indice / Math.max(1, (contexto.perfil.compacta ? 3 : 5) - 1)) * 80}%`;
    return coluna;
  });
  const pontoMedio = tempo(contexto, 0.74, 0.56);
  const saida = tempo(contexto, 1.1, 0.84);
  const totalGlifos = quantidade(contexto, "conhecimento");
  const menorDimensao = Math.min(window.innerWidth, window.innerHeight);
  const raios = contexto.perfil.compacta
    ? [menorDimensao * 0.2, menorDimensao * 0.33]
    : [menorDimensao * 0.17, menorDimensao * 0.29, menorDimensao * 0.41];

  timeline.set(overlay, { opacity: 1 }, 0);
  timeline.fromTo(wash, { opacity: 0 }, {
    opacity: 1,
    duration: tempo(contexto, 0.44, 0.32),
    ease: "power2.in",
  }, 0);
  timeline.fromTo(wheel, {
    opacity: 0,
    scale: 1.35,
    rotation: -35,
    xPercent: -50,
    yPercent: -50,
  }, {
    opacity: 0.9,
    scale: 0.96,
    rotation: 38,
    xPercent: -50,
    yPercent: -50,
    duration: tempo(contexto, 0.92, 0.68),
    ease: "power3.out",
    force3D: true,
  }, 0.04);
  timeline.fromTo(revelacao, { opacity: 0, xPercent: -130 }, {
    opacity: 0.62,
    xPercent: 130,
    duration: tempo(contexto, 0.98, 0.74),
    ease: "power2.inOut",
    force3D: true,
  }, 0.04);
  timeline.fromTo(reescrita, {
    opacity: 0,
    xPercent: -18,
    scaleX: 0.76,
  }, {
    opacity: 0.62,
    xPercent: 0,
    scaleX: 1,
    duration: tempo(contexto, 0.72, 0.54),
    ease: "power3.out",
    force3D: true,
  }, tempo(contexto, 0.12, 0.09));
  colunas.forEach((coluna, indice) => {
    timeline.fromTo(coluna, {
      opacity: 0,
      yPercent: indice % 2 === 0 ? 28 : -28,
    }, {
      opacity: aleatorio(0.22, 0.48),
      yPercent: indice % 2 === 0 ? -10 : 10,
      duration: tempo(contexto, 0.78 + indice * 0.06, 0.58 + indice * 0.045),
      ease: "power2.inOut",
      force3D: true,
    }, tempo(contexto, 0.06 + indice * 0.045, 0.04 + indice * 0.034));
    timeline.to(coluna, {
      opacity: 0,
      duration: tempo(contexto, 0.3, 0.22),
      ease: "power2.in",
    }, saida - tempo(contexto, 0.1, 0.08));
  });

  for (let i = 0; i < totalGlifos; i += 1) {
    const indiceAnel = i % raios.length;
    const posicaoNoAnel = Math.floor(i / raios.length);
    const totalNoAnel = Math.ceil((totalGlifos - indiceAnel) / raios.length);
    const angulo = (posicaoNoAnel / totalNoAnel) * Math.PI * 2 + indiceAnel * 0.34;
    const raio = raios[indiceAnel];
    const anguloInicial = angulo + aleatorio(-0.7, 0.7);
    const raioInicial = menorDimensao * aleatorio(0.58, 0.78);
    const alvoX = Math.cos(angulo) * raio;
    const alvoY = Math.sin(angulo) * raio;
    const delay = tempo(contexto, 0.08 + (posicaoNoAnel % 8) * 0.034, 0.06 + (posicaoNoAnel % 6) * 0.026);
    const glifo = criarElemento(contexto, "span", `glitch-text glitch-text--ring-${indiceAnel + 1}`);
    glifo.textContent = glyphs[(i * 7 + indiceAnel * 3) % glyphs.length];

    gsap.set(glifo, {
      left: "50%",
      top: "50%",
      fontSize: `${aleatorio(0.68, contexto.perfil.compacta ? 1.05 : 1.42)}rem`,
      transformOrigin: "center",
    });

    timeline.fromTo(glifo, {
      x: Math.cos(anguloInicial) * raioInicial,
      y: Math.sin(anguloInicial) * raioInicial,
      opacity: 0,
      scale: 0.28,
      rotation: aleatorio(-100, 100),
    }, {
      x: alvoX,
      y: alvoY,
      opacity: aleatorio(0.62, 0.96),
      scale: 1,
      rotation: (angulo * 180) / Math.PI + 90,
      duration: tempo(contexto, 0.48, 0.36),
      ease: "power3.inOut",
      force3D: true,
    }, delay);
    timeline.to(glifo, {
      x: alvoX * 0.88,
      y: alvoY * 0.88,
      opacity: aleatorio(0.72, 1),
      scale: 1.08,
      duration: tempo(contexto, 0.3, 0.22),
      ease: "power2.inOut",
    }, pontoMedio - tempo(contexto, 0.14, 0.1));
    timeline.to(glifo, {
      opacity: 0,
      scale: 1.34,
      duration: tempo(contexto, 0.38, 0.28),
      ease: "power2.in",
    }, saida - tempo(contexto, 0.12, 0.09));
  }

  animarSimbolo(contexto, simbolo, {
    inicio: tempo(contexto, 0.28, 0.21),
    entrada: tempo(contexto, 0.44, 0.33),
    saida,
    duracaoSaida: tempo(contexto, 0.46, 0.34),
    escalaInicial: 0.72,
    escalaFinal: 1.14,
    opacidade: 0.94,
    rotacao: -2,
    blur: contexto.perfil.compacta ? 2 : 4,
  });

  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, pontoMedio);
  timeline.to(wheel, {
    opacity: 0,
    scale: 1.15,
    rotation: 62,
    duration: tempo(contexto, 0.5, 0.36),
    ease: "power2.in",
  }, saida - tempo(contexto, 0.1, 0.08));
  timeline.to(reescrita, {
    opacity: 0,
    xPercent: 18,
    duration: tempo(contexto, 0.42, 0.31),
    ease: "power2.in",
  }, saida - tempo(contexto, 0.12, 0.09));
  timeline.to(overlay, {
    opacity: 0,
    duration: tempo(contexto, 0.52, 0.38),
    ease: "power2.out",
  }, saida);
}

function criarEcoEnergia(contexto, modificador) {
  const eco = injetarSimboloTransicao(contexto, `transition-symbol--energy-echo ${modificador}`);
  eco.removeAttribute("id");
  return eco;
}

function executarAnimacaoEnergia(contexto) {
  prepararOverlay(contexto, "anim-energia");

  const { timeline, overlay } = contexto;
  const campo = criarElemento(contexto, "div", "transition-wash transition-wash--energia");
  const plasmas = Array.from({ length: contexto.perfil.compacta ? 3 : 6 }, (_, indice) => criarElemento(
    contexto,
    "i",
    `transition-energy-plasma transition-energy-plasma--${(indice % 4) + 1}`,
  ));
  const scanlines = criarElemento(contexto, "div", "transition-energy-scanlines");
  const orbitaExterna = criarElemento(contexto, "div", "transition-energy-orbit transition-energy-orbit--outer");
  const orbitaInterna = criarElemento(contexto, "div", "transition-energy-orbit transition-energy-orbit--inner");
  const nucleo = criarElemento(contexto, "div", "transition-energy-core");
  const ecoCiano = criarEcoEnergia(contexto, "transition-symbol--energy-cyan");
  const ecoMagenta = criarEcoEnergia(contexto, "transition-symbol--energy-magenta");
  const simbolo = injetarSimboloTransicao(contexto);
  const pontoMedio = tempo(contexto, 0.66, 0.5);
  const saida = tempo(contexto, 1.08, 0.82);

  timeline.fromTo(overlay, { opacity: 0 }, {
    opacity: 1,
    duration: tempo(contexto, 0.24, 0.18),
    ease: "power2.inOut",
  }, 0);
  timeline.fromTo(campo, { opacity: 0, scale: 1.16, rotation: -4 }, {
    opacity: 1,
    scale: 1.02,
    rotation: 3,
    duration: tempo(contexto, 0.82, 0.62),
    ease: "power2.inOut",
    force3D: true,
  }, 0);
  plasmas.forEach((plasma, indice) => {
    const direcao = indice % 2 === 0 ? 1 : -1;
    const tamanho = aleatorio(contexto.perfil.compacta ? 28 : 34, contexto.perfil.compacta ? 54 : 68);
    const delay = tempo(contexto, 0.03 + indice * 0.045, 0.02 + indice * 0.035);

    gsap.set(plasma, {
      left: `${aleatorio(14, 86)}%`,
      top: `${aleatorio(12, 88)}%`,
      width: `${tamanho}vmin`,
      height: `${tamanho * aleatorio(0.62, 1.18)}vmin`,
      xPercent: -50,
      yPercent: -50,
      force3D: true,
    });
    timeline.fromTo(plasma, {
      opacity: 0,
      scale: aleatorio(0.2, 0.58),
      rotation: direcao * aleatorio(30, 110),
      x: direcao * aleatorio(24, 80),
      y: -direcao * aleatorio(18, 62),
    }, {
      opacity: aleatorio(0.42, 0.76),
      scale: aleatorio(0.88, 1.3),
      rotation: -direcao * aleatorio(120, 260),
      x: -direcao * aleatorio(18, 54),
      y: direcao * aleatorio(16, 48),
      duration: tempo(contexto, aleatorio(0.82, 1.08), aleatorio(0.62, 0.8)),
      ease: indice % 3 === 0 ? "steps(7)" : "power2.inOut",
      force3D: true,
    }, delay);
    timeline.to(plasma, {
      opacity: 0,
      scale: aleatorio(1.18, 1.5),
      duration: tempo(contexto, 0.34, 0.25),
      ease: "power2.out",
    }, saida - tempo(contexto, 0.12 + (indice % 3) * 0.025, 0.09 + (indice % 3) * 0.018));
  });
  timeline.fromTo(scanlines, { opacity: 0, yPercent: -8 }, {
    opacity: 0.48,
    yPercent: 10,
    duration: tempo(contexto, 0.88, 0.66),
    ease: "steps(8)",
    force3D: true,
  }, 0.02);

  [
    [orbitaExterna, 1.36, 0.92, -80, 190],
    [orbitaInterna, 0.56, 0.86, 120, -230],
  ].forEach(([orbita, escalaInicial, escalaFinal, rotacaoInicial, rotacaoFinal], indice) => {
    timeline.fromTo(orbita, {
      opacity: 0,
      scale: escalaInicial,
      rotation: rotacaoInicial,
      xPercent: -50,
      yPercent: -50,
    }, {
      opacity: indice === 0 ? 0.9 : 0.72,
      scale: escalaFinal,
      rotation: rotacaoFinal,
      xPercent: -50,
      yPercent: -50,
      duration: tempo(contexto, 0.98, 0.74),
      ease: "power3.inOut",
      force3D: true,
    }, tempo(contexto, 0.04 + indice * 0.04, 0.03 + indice * 0.03));
  });

  timeline.fromTo(nucleo, {
    opacity: 0,
    scale: 0.18,
    xPercent: -50,
    yPercent: -50,
  }, {
    opacity: 0.9,
    scale: 1,
    xPercent: -50,
    yPercent: -50,
    duration: tempo(contexto, 0.62, 0.46),
    ease: "expo.out",
    force3D: true,
  }, tempo(contexto, 0.12, 0.09));

  for (let i = 0; i < quantidade(contexto, "energia"); i += 1) {
    const raio = criarElemento(
      contexto,
      "i",
      `transition-energy-bolt ${i % 2 === 0 ? "transition-energy-bolt--cyan" : "transition-energy-bolt--magenta"}`,
    );
    const angulo = (i / quantidade(contexto, "energia")) * 360 + aleatorio(-14, 14);
    const comprimento = aleatorio(contexto.perfil.compacta ? 28 : 34, contexto.perfil.compacta ? 48 : 62);
    const delay = tempo(contexto, 0.16 + (i % 5) * 0.075, 0.12 + (i % 4) * 0.055);

    gsap.set(raio, {
      left: "50%",
      top: "50%",
      width: `${comprimento}vmin`,
      height: `${aleatorio(5, contexto.perfil.compacta ? 9 : 12)}px`,
      rotation: angulo,
      transformOrigin: "left center",
      force3D: true,
    });

    timeline.fromTo(raio, {
      opacity: 0,
      scaleX: 0.02,
      scaleY: 0.45,
    }, {
      opacity: aleatorio(0.62, 0.94),
      scaleX: 1,
      scaleY: 1,
      duration: tempo(contexto, 0.2, 0.15),
      ease: "steps(4)",
      force3D: true,
    }, delay);
    timeline.to(raio, {
      opacity: 0,
      scaleX: 1.08,
      scaleY: 0.2,
      duration: tempo(contexto, 0.26, 0.19),
      ease: "power2.out",
    }, delay + tempo(contexto, 0.22, 0.16));
  }

  const totalFragmentos = Math.max(3, Math.ceil(quantidade(contexto, "energia") * 0.6));
  for (let i = 0; i < totalFragmentos; i += 1) {
    const fragmento = criarElemento(contexto, "i", "transition-glitch-slice");
    const altura = aleatorio(2, contexto.perfil.compacta ? 6 : 8);
    const top = aleatorio(4, 94 - altura);
    const delay = tempo(contexto, aleatorio(0.2, 0.76), aleatorio(0.15, 0.56));

    fragmento.style.top = `${top}%`;
    fragmento.style.height = `${altura}%`;

    timeline.fromTo(fragmento, {
      opacity: 0,
      xPercent: i % 2 === 0 ? -18 : 18,
      scaleX: 0.84,
    }, {
      opacity: aleatorio(0.38, 0.72),
      xPercent: i % 2 === 0 ? 4 : -4,
      scaleX: 1,
      duration: tempo(contexto, 0.12, 0.09),
      ease: "steps(2)",
      force3D: true,
    }, delay);
    timeline.to(fragmento, {
      opacity: 0,
      xPercent: i % 2 === 0 ? -2 : 2,
      duration: tempo(contexto, 0.18, 0.13),
      ease: "power1.out",
    }, delay + tempo(contexto, 0.14, 0.1));
  }

  [
    [ecoCiano, -18, 5],
    [ecoMagenta, 18, -5],
  ].forEach(([eco, x, rotation]) => {
    timeline.fromTo(eco, {
      opacity: 0,
      scale: 0.72,
      xPercent: -50,
      yPercent: -50,
      x,
      rotation,
    }, {
      opacity: 0.58,
      scale: 1.04,
      xPercent: -50,
      yPercent: -50,
      x: -x * 0.35,
      rotation: -rotation,
      duration: tempo(contexto, 0.46, 0.34),
      ease: "power2.out",
      force3D: true,
    }, tempo(contexto, 0.12, 0.09));
    timeline.to(eco, {
      opacity: 0,
      x: x * 0.4,
      duration: tempo(contexto, 0.34, 0.25),
      ease: "steps(4)",
    }, saida - tempo(contexto, 0.18, 0.13));
  });

  animarSimbolo(contexto, simbolo, {
    inicio: tempo(contexto, 0.2, 0.15),
    entrada: tempo(contexto, 0.42, 0.31),
    saida,
    duracaoSaida: tempo(contexto, 0.42, 0.31),
    escalaInicial: 0.62,
    escalaFinal: 1.2,
    opacidade: 0.94,
    rotacao: 5,
    blur: contexto.perfil.compacta ? 1 : 3,
  });

  timeline.call(() => aplicarTemaNoMidpoint(contexto), null, pontoMedio);
  timeline.to(campo, {
    opacity: 0,
    scale: 1.08,
    duration: tempo(contexto, 0.46, 0.34),
    ease: "power2.out",
  }, saida - tempo(contexto, 0.08, 0.06));
  timeline.to([orbitaExterna, orbitaInterna, nucleo], {
    opacity: 0,
    scale: 1.18,
    duration: tempo(contexto, 0.38, 0.28),
    ease: "power2.in",
  }, saida - tempo(contexto, 0.12, 0.09));
  timeline.to(overlay, {
    opacity: 0,
    duration: tempo(contexto, 0.48, 0.35),
    ease: "power2.out",
  }, saida);
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
