// /src/lib/animacoes.js
// (VERSÃO CORRIGIDA - Centralização do símbolo de 'tema-ordem')

import { gsap } from "gsap";

let activeTimeline = null;
let particleInterval = null;

/**
 * Pega o valor da variável de cor CSS para a transição.
 */
function getCorTransicao(tema) {
  const rootStyles = getComputedStyle(document.documentElement);
  switch (tema) {
    case "tema-ordem": return rootStyles.getPropertyValue("--cor-trans-ordem");
    case "tema-sangue": return rootStyles.getPropertyValue("--cor-trans-sangue");
    case "tema-morte": return rootStyles.getPropertyValue("--cor-trans-morte");
    case "tema-conhecimento": return rootStyles.getPropertyValue("--cor-trans-conhecimento");
    case "tema-energia": return rootStyles.getPropertyValue("--cor-trans-energia");
    default: return "#000";
  }
}

/**
 * Para e limpa qualquer animação de transição anterior.
 */
function limparAnimacoesAtivas() {
  const transitionOverlay = document.getElementById("transition-overlay");

  if (activeTimeline) {
    activeTimeline.kill();
    activeTimeline = null;
  }
  if (particleInterval) {
    clearInterval(particleInterval);
    particleInterval = null;
  }
  
  if (transitionOverlay) {
    gsap.killTweensOf(transitionOverlay);
    gsap.killTweensOf(transitionOverlay.children);
    transitionOverlay.innerHTML = "";
    transitionOverlay.style.backgroundColor = "transparent";
    transitionOverlay.style.background = "transparent";
    transitionOverlay.style.backgroundImage = "none";
    transitionOverlay.style.opacity = "0"; // Garante que esteja invisível
    transitionOverlay.className = "";
  }
}

/**
 * Cria e adiciona o símbolo do elemento ao overlay de transição.
 */
function injecarSimboloTransicao(tema) {
  const transitionOverlay = document.getElementById("transition-overlay");
  if (!transitionOverlay) return null;
  
  const img = document.createElement("img");
  img.className = "transition-symbol";

  switch (tema) {
    case "tema-ordem":
      img.src = "/assets/images/SimboloSemafinidade.png";
      img.id = "simbolo-ordem-trans";
      break;
    case "tema-sangue":
      img.src = "/assets/images/SimboloSangue.png";
      img.id = "simbolo-sangue-trans";
      break;
    case "tema-morte":
      img.src = "/assets/images/SimboloMorte.png";
      img.id = "simbolo-morte-trans";
      break;
    case "tema-conhecimento":
      img.src = "/assets/images/SimboloConhecimento.png";
      img.id = "simbolo-conhecimento-trans";
      break;
    case "tema-energia":
      img.src = "/assets/images/SimboloEnergia.png";
      img.id = "simbolo-energia-trans";
      break;
  }

  transitionOverlay.appendChild(img);
  return img;
}

// --- Animações Específicas ---

/**
 * Animação de Cortes Aleatórios e Splatter para SANGUE
 */
function executarAnimacaoSangue(tema, onMidpoint) {
  const transitionOverlay = document.getElementById("transition-overlay");
  if (!transitionOverlay) return;

  transitionOverlay.style.opacity = "1";
  transitionOverlay.style.backgroundColor = "transparent"; 
  const simbolo = injecarSimboloTransicao(tema);

  const numCortes = 15;
  const numSplatters = 40;
  const corSangue = getCorTransicao(tema);

  activeTimeline = gsap.timeline({
    onComplete: () => {
      if (transitionOverlay) transitionOverlay.innerHTML = "";
      if (transitionOverlay) transitionOverlay.style.opacity = "0";
      if (transitionOverlay) transitionOverlay.style.background = "transparent";
      activeTimeline = null;
    },
  });
  
  const totalDuration = 2.5; 
  const staggerWindowCortes = totalDuration * 0.7; 
  const staggerWindowSplatters = totalDuration * 0.6;
  const fadeOutTime = totalDuration - 0.7; 

  // 2. Animação dos CORTES (Linhas Pretas)
  for (let i = 0; i < numCortes; i++) {
    const corte = document.createElement("div");
    corte.className = "particula-corte";
    const sangue = document.createElement("div");
    sangue.className = "particula-sangue-splatter";
    
    transitionOverlay.appendChild(sangue);
    transitionOverlay.appendChild(corte);

    const angulo = Math.random() * 180 - 90;
    const isHorizontal = Math.abs(angulo) < 45 || Math.abs(angulo) > 135;
    const comprimento = isHorizontal ? "150vw" : "150vh";
    const espessura = Math.random() * 8 + 4; 

    gsap.set([corte, sangue], {
        left: Math.random() * 100 + "vw",
        top: Math.random() * 100 + "vh",
        rotation: angulo,
        width: comprimento,
        height: espessura + "px",
        xPercent: -50,
        yPercent: -50,
    });
    
    const clipStart = "polygon(0% 45%, 0% 55%, 100% 55%, 100% 45%)";
    const clipEnd = `polygon(0% ${Math.random()*20}%, 100% ${Math.random()*20+10}%, 100% ${Math.random()*20+80}%, 0% ${Math.random()*20+70}%)`;
    gsap.set(corte, { clipPath: clipStart });
    
    const sangueClipStart = "polygon(0% 50%, 0% 50%, 100% 50%, 100% 50%)";
    const sangueClipEnd = "polygon(-50% -500%, 150% -500%, 150% 600%, -50% 600%)";
    gsap.set(sangue, { 
      clipPath: sangueClipStart,
      backgroundColor: corSangue,
      opacity: 0.8,
    });
    
    const delay = (i / numCortes) * staggerWindowCortes;
    const duration = 1.0 - (delay * 0.4);
    
    activeTimeline.to(corte, {
        clipPath: clipEnd,
        duration: duration,
        ease: "power3.inOut"
    }, delay);
    
    activeTimeline.to(sangue, {
        clipPath: sangueClipEnd,
        duration: duration * 0.8,
        ease: "power2.out"
    }, delay + 0.05);
  }
  
  // 3. Animação dos SPLATTERS (Sangue Adicional)
  for (let i = 0; i < numSplatters; i++) {
    const splatter = document.createElement("div");
    splatter.className = "particula-sangue-splatter";
    transitionOverlay.appendChild(splatter);
    
    const startDelay = Math.random() * staggerWindowSplatters + 0.2;
    
    gsap.set(splatter, {
      top: Math.random() * 100 + "vh",
      left: Math.random() * 100 + "vw",
      scale: 0,
      opacity: 0,
    });

    activeTimeline.to(splatter, {
      scale: Math.random() * 6 + 4, 
      opacity: Math.random() * 0.5 + 0.5,
      duration: 0.4,
      ease: "power3.out",
    }, startDelay);
    
    activeTimeline.to(splatter, {
      opacity: 0, 
      duration: 0.6,
      ease: "power1.in",
    }, startDelay + 0.4); 
  }
  
  // 4. Símbolo do Sangue (Centralizado)
  if (simbolo) {
    activeTimeline.fromTo(simbolo, 
      { 
        opacity: 0, 
        scale: 0.8, 
        filter: "brightness(1)",
        xPercent: -50, // <-- Centraliza
        yPercent: -50  // <-- Centraliza
      },
      { 
        opacity: 0.8, 
        scale: 1, 
        filter: "brightness(2)",
        xPercent: -50,
        yPercent: -50,
        duration: 0.4, 
        ease: "power2.out" 
      }, 
      0.6 
    );
    activeTimeline.to(simbolo, 
      { 
        opacity: 0, 
        scale: 1.2, 
        duration: 0.5, 
        ease: "power1.in",
        xPercent: -50,
        yPercent: -50
      }, 
      fadeOutTime 
    );
  }

  // 5. O Midpoint e o Fade Out da Transição
  activeTimeline.call(onMidpoint, null, fadeOutTime);
  
  activeTimeline.fromTo(transitionOverlay, 
    { backgroundColor: "transparent" },
    { backgroundColor: corSangue, duration: 0.5 },
    0.8
  );
  
  activeTimeline.to(transitionOverlay, { 
    opacity: 0, 
    duration: 0.7,
    ease: "power1.out" 
  }, fadeOutTime);
}


/**
 * Animação de Glifos para CONHECIMENTO
 */
function executarAnimacaoConhecimento(tema, onMidpoint) {
  const transitionOverlay = document.getElementById("transition-overlay");
  if (!transitionOverlay) return;

  transitionOverlay.style.opacity = "1";
  transitionOverlay.style.backgroundColor = getCorTransicao(tema);
  const simbolo = injecarSimboloTransicao(tema);
  const numSimbolos = 150;
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

  for (let i = 0; i < numSimbolos; i++) {
    const span = document.createElement("span");
    span.className = "glitch-text";
    span.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
    gsap.set(span, { position: "absolute", top: Math.random() * 100 + "vh", left: Math.random() * 100 + "vw", fontSize: Math.random() * 2 + 1 + "em", opacity: 0, rotation: Math.random() * 360 });
    transitionOverlay.appendChild(span);
    gsap.timeline({ repeat: -1, repeatDelay: Math.random() * 2 })
      .to(span, { opacity: Math.random() * 0.8 + 0.2, y: "-=" + (Math.random() * 50 + 20), duration: Math.random() * 1.5 + 0.5, ease: "power2.out", delay: Math.random() * 0.8 })
      .to(span, { opacity: 0, y: "+=" + (Math.random() * 30 + 10), duration: Math.random() * 1 + 0.5, ease: "power1.in" });
  }
  
  activeTimeline = gsap.timeline({
    onComplete: () => {
      if (transitionOverlay) transitionOverlay.innerHTML = "";
      if (transitionOverlay) transitionOverlay.style.backgroundColor = "transparent";
      activeTimeline = null;
    },
  });
  
  activeTimeline.to(transitionOverlay, { duration: 0.2, opacity: 1 })
  if (simbolo) {
    // Símbolo do Conhecimento (Centralizado)
    activeTimeline.to(simbolo, { 
      opacity: 1, 
      scale: 1, 
      duration: 0.3, 
      ease: "power2.out",
      xPercent: -50, // <-- Centraliza
      yPercent: -50  // <-- Centraliza
    }, 0.5)
    activeTimeline.to(simbolo, { 
      opacity: 0, 
      scale: 1.2, 
      duration: 0.3, 
      ease: "power2.in",
      xPercent: -50,
      yPercent: -50
    }, 0.8)
  }
  activeTimeline.call(onMidpoint, null, 0.6) 
  activeTimeline.to(transitionOverlay, { duration: 0.8, opacity: 0, delay: 0.8 });
}

/**
 * Helper para criar partículas de MORTE
 */
function criarParticula() {
  const transitionOverlay = document.getElementById("transition-overlay");
  if (!particleInterval || !transitionOverlay) return;
  const p = document.createElement("div");
  p.className = "particula-morte";
  transitionOverlay.appendChild(p);
  const size = Math.random() * 40 + 10 + "px";
  gsap.set(p, { top: () => Math.random() * 100 + "vh", left: "-50px", width: size, height: size, opacity: Math.random() * 0.4 + 0.1, rotation: () => Math.random() * 360 });
  gsap.to(p, { duration: Math.random() * 2 + 1.5, x: "110vw", rotation: () => Math.random() * 720 - 360, ease: "none", onComplete: () => p.remove() });
}

/**
 * Animação de Lodo/Cinzas para MORTE
 */
function executarAnimacaoMorte(tema, onMidpoint) {
  const transitionOverlay = document.getElementById("transition-overlay");
  if (!transitionOverlay) return;
  
  transitionOverlay.style.opacity = "1";
  transitionOverlay.className = "anim-morte";
  const novaCorDeFundo = getCorTransicao(tema);
  const simbolo = injecarSimboloTransicao(tema);
  particleInterval = setInterval(criarParticula, 30);
  
  activeTimeline = gsap.timeline({
    onComplete: () => {
      if (transitionOverlay) transitionOverlay.innerHTML = "";
      if (transitionOverlay) transitionOverlay.style.opacity = "0";
      if (particleInterval) clearInterval(particleInterval);
      if (transitionOverlay) transitionOverlay.style.backgroundColor = "transparent";
      particleInterval = null;
      activeTimeline = null;
    },
  });
  
  activeTimeline.to(transitionOverlay, { backgroundColor: novaCorDeFundo, duration: 2.0, ease: "power1.in" })
  if(simbolo) {
    // Símbolo da Morte (Centralizado)
    activeTimeline.to(simbolo, { 
      opacity: 0.3, 
      scale: 1, 
      duration: 1.0, 
      ease: "power1.inOut",
      xPercent: -50, // <-- Centraliza
      yPercent: -50  // <-- Centraliza
    }, 1.0)
    activeTimeline.to(simbolo, { 
      opacity: 0, 
      duration: 0.5, 
      ease: "power1.out",
      xPercent: -50,
      yPercent: -50
    }, 2.0)
  }
  activeTimeline.call(onMidpoint, null, 1.0) 
  activeTimeline.to(transitionOverlay, { opacity: 0, duration: 1.5, ease: "power1.out" });
}

// --- Funções Principais (Exportadas) ---

/**
 * Função principal que decide qual animação tocar.
 */
export function aplicarTemaComAnimacao(tema, temaAtual, onMidpointCallback) {
  const transitionOverlay = document.getElementById("transition-overlay");
  if (!transitionOverlay) {
    aplicarTemaSemAnimacao(tema);
    onMidpointCallback();
    return;
  }
  
  limparAnimacoesAtivas();

  if (tema === temaAtual) {
    return;
  }

  let animationTime = 1200;
  const novaCorDeFundo = getCorTransicao(tema);

  // 1. Escolhe a animação
  switch (tema) {
    // O 'tema-sangue' é tratado no App.jsx, mas deixamos um fallback
    case "tema-sangue":
      executarAnimacaoSangue(tema, onMidpointCallback);
      return;
    case "tema-morte":
      executarAnimacaoMorte(tema, onMidpointCallback);
      return;
    case "tema-conhecimento":
      executarAnimacaoConhecimento(tema, onMidpointCallback);
      return;
      
    case "tema-ordem":
      transitionOverlay.style.backgroundColor = novaCorDeFundo;
      animationTime = 1200;
      break;
    case "tema-energia":
      transitionOverlay.style.backgroundColor = novaCorDeFundo;
      transitionOverlay.style.backgroundImage = "url('/assets/images/glitch.png')"; 
      transitionOverlay.style.backgroundSize = "cover";
      transitionOverlay.style.backgroundPosition = "center";
      transitionOverlay.style.backgroundRepeat = "no-repeat";
      transitionOverlay.className = "anim-energia"; 
      animationTime = 1000;
      break;
    default:
      transitionOverlay.style.backgroundColor = novaCorDeFundo;
      animationTime = 1200;
      break;
  }

  // --- 2. Animação Padrão (Usada por Ordem e Energia) ---
  const simbolo = injecarSimboloTransicao(tema);
  const animationTimeInSeconds = animationTime / 1000;
  const halfTime = animationTimeInSeconds / 2;

  transitionOverlay.style.opacity = ""; 

  activeTimeline = gsap.timeline({
    onComplete: () => {
      transitionOverlay.className = "";
      transitionOverlay.style.opacity = "0"; 
      transitionOverlay.style.backgroundColor = "transparent";
      transitionOverlay.style.backgroundImage = "none";
      if (transitionOverlay.innerHTML) transitionOverlay.innerHTML = "";
      activeTimeline = null;
    },
  });

  // Fade-in
  activeTimeline.to(transitionOverlay, { 
    opacity: 1, 
    duration: halfTime, 
    ease: "power1.in" 
  }, 0); 
  
  // Chama o callback no meio
  activeTimeline.call(onMidpointCallback, null, halfTime); 
  
  // Fade-out
  activeTimeline.to(transitionOverlay, { 
    opacity: 0, 
    duration: halfTime, 
    ease: "power1.out" 
  }, halfTime); 

  // Animação do símbolo
  if (simbolo) {
    // --- INÍCIO DA CORREÇÃO ---
    // Adiciona xPercent e yPercent para forçar a centralização
    activeTimeline.to(simbolo, { 
      opacity: 1, 
      scale: 1, 
      duration: animationTimeInSeconds * 0.3, 
      ease: "power2.out",
      xPercent: -50, // <-- CORREÇÃO
      yPercent: -50  // <-- CORREÇÃO
    }, animationTimeInSeconds * 0.25);
    
    activeTimeline.to(simbolo, { 
      opacity: 0, 
      scale: 0.9, 
      duration: animationTimeInSeconds * 0.3, 
      ease: "power2.in",
      xPercent: -50, // <-- CORREÇÃO
      yPercent: -50  // <-- CORREÇÃO
    }, halfTime); 
    // --- FIM DA CORREÇÃO ---
  }
}

/**
 * Aplica o tema instantaneamente (usado no carregamento da página).
 */
export function aplicarTemaSemAnimacao(tema) {
  const rootElement = document.documentElement;
  rootElement.dataset.tema = tema;
  localStorage.setItem("temaFichaOrdem", tema);
}