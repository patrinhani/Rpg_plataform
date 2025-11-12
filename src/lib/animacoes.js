// /src/lib/animacoes.js
// (CORRIGIDO: GSAP agora controla o fade-in/out de Ordem e Energia)

import { gsap } from "gsap";

let activeTimeline = null;
let particleInterval = null;

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
    transitionOverlay.style.opacity = "0"; // Isto é importante para limpar
    transitionOverlay.className = "";
  }
}

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

// --- Animações Específicas (Não mudaram) ---

function executarAnimacaoSangue(tema, onMidpoint) {
  const transitionOverlay = document.getElementById("transition-overlay");
  if (!transitionOverlay) return;

  transitionOverlay.style.opacity = "1"; 
  transitionOverlay.style.backgroundColor = "transparent";
  const novaCorDeFundo = getCorTransicao(tema);
  const simbolo = injecarSimboloTransicao(tema);

  const numGotas = 100;
  const gotas = [];
  for (let i = 0; i < numGotas; i++) {
    const gota = document.createElement("div");
    gota.className = "particula-sangue";
    transitionOverlay.appendChild(gota);
    const size = Math.random() * 10 + 5 + "px";
    gsap.set(gota, { top: -150, left: () => Math.random() * 100 + "vw", width: size, height: size, scaleY: 1, opacity: 0 });
    gotas.push(gota);
  }
  activeTimeline = gsap.timeline({
    onComplete: () => {
      if (transitionOverlay) transitionOverlay.innerHTML = "";
      if (transitionOverlay) transitionOverlay.style.opacity = "0";
      if (transitionOverlay) transitionOverlay.style.background = "transparent";
      activeTimeline = null;
    },
  });
  const pulso = { progress: 0 };
  activeTimeline.to(pulso, { duration: 1.2, progress: 1, ease: "power1.in", onUpdate: () => {
    const size = Math.min(100, pulso.progress * 400);
    if (transitionOverlay) transitionOverlay.style.background = `radial-gradient(circle at center, ${novaCorDeFundo} ${size / 2}%, rgba(0,0,0,0) ${size}%)`;
  }}, 0);
  activeTimeline.to(gotas, { duration: 1.5, y: "110vh", opacity: 1, scaleY: () => Math.random() * 15 + 10, stagger: { each: 0.02, from: "random" }, ease: "power2.in" }, 0.1);
  if (simbolo) {
    activeTimeline.to(simbolo, { opacity: 0.5, scale: 1, duration: 0.5, ease: "power2.out" }, 0.7);
    activeTimeline.to(simbolo, { opacity: 0, scale: 1.1, duration: 0.4, ease: "power2.in" }, 1.2);
  }
  activeTimeline.call(onMidpoint, null, 1.0); 
  activeTimeline.to(transitionOverlay, { opacity: 0, duration: 0.5, ease: "power1.out" }, 1.3);
}

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
    activeTimeline.to(simbolo, { opacity: 1, scale: 1, duration: 0.3, ease: "power2.out" }, 0.5)
    activeTimeline.to(simbolo, { opacity: 0, scale: 1.2, duration: 0.3, ease: "power2.in" }, 0.8)
  }
  activeTimeline.call(onMidpoint, null, 0.6) 
  activeTimeline.to(transitionOverlay, { duration: 0.8, opacity: 0, delay: 0.8 });
}

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
    activeTimeline.to(simbolo, { opacity: 0.3, scale: 1, duration: 1.0, ease: "power1.inOut" }, 1.0)
    activeTimeline.to(simbolo, { opacity: 0, duration: 0.5, ease: "power1.out" }, 2.0)
  }
  activeTimeline.call(onMidpoint, null, 1.0) 
  activeTimeline.to(transitionOverlay, { opacity: 0, duration: 1.5, ease: "power1.out" });
}

// --- Funções Principais (Exportadas) ---

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

  // let animationClass = "anim-ordem"; // <-- REMOVIDO
  let animationTime = 1200;
  const novaCorDeFundo = getCorTransicao(tema);

  switch (tema) {
    case "tema-sangue":
      executarAnimacaoSangue(tema, onMidpointCallback);
      return;
    case "tema-morte":
      executarAnimacaoMorte(tema, onMidpointCallback);
      return;
    case "tema-conhecimento":
      executarAnimacaoConhecimento(tema, onMidpointCallback);
      return;
      
    // Casos padrão (Ordem e Energia)
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
      // Adiciona a classe APENAS para o glitch
      transitionOverlay.className = "anim-energia"; 
      animationTime = 1000;
      break;
    default:
      transitionOverlay.style.backgroundColor = novaCorDeFundo;
      animationTime = 1200;
      break;
  }

  // --- (ATUALIZADO) Animação Padrão (Ordem e Energia) com GSAP ---
  const simbolo = injecarSimboloTransicao(tema);
  const animationTimeInSeconds = animationTime / 1000;
  const halfTime = animationTimeInSeconds / 2;

  // Limpa a opacidade inline deixada pelo 'limparAnimacoesAtivas'
  transitionOverlay.style.opacity = ""; 

  activeTimeline = gsap.timeline({
    onComplete: () => {
      // Limpa tudo ao final
      transitionOverlay.className = "";
      transitionOverlay.style.opacity = "0"; 
      transitionOverlay.style.backgroundColor = "transparent";
      transitionOverlay.style.backgroundImage = "none";
      if (transitionOverlay.innerHTML) transitionOverlay.innerHTML = "";
      activeTimeline = null;
    },
  });

  // 1. Fade-in
  activeTimeline.to(transitionOverlay, { 
    opacity: 1, 
    duration: halfTime, 
    ease: "power1.in" 
  }, 0); 
  
  // 2. Chama o callback no meio
  activeTimeline.call(onMidpointCallback, null, halfTime); 
  
  // 3. Fade-out
  activeTimeline.to(transitionOverlay, { 
    opacity: 0, 
    duration: halfTime, 
    ease: "power1.out" 
  }, halfTime); 

  // Animação do símbolo (acontece durante o fade-in e fade-out)
  if (simbolo) {
    activeTimeline.to(simbolo, { 
      opacity: 1, 
      scale: 1, 
      duration: animationTimeInSeconds * 0.3, 
      ease: "power2.out" 
    }, animationTimeInSeconds * 0.25);
    
    activeTimeline.to(simbolo, { 
      opacity: 0, 
      scale: 0.9, 
      duration: animationTimeInSeconds * 0.3, 
      ease: "power2.in" 
    }, halfTime); // Começa o fade-out do símbolo no meio da animação
  }
}


export function aplicarTemaSemAnimacao(tema) {
  const rootElement = document.documentElement;
  rootElement.dataset.tema = tema;
  localStorage.setItem("temaFichaOrdem", tema);
}