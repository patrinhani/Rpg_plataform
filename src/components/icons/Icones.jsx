import React from 'react';

// --- ÍCONES ESPECÍFICOS ---

// Abalado / Apavorado (Medo)
export const IconeMedo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// Agarrado / Enredado / Imóvel (Correntes/Paralisia)
export const IconeParalisia = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

// Fraco / Debilitado (Músculo/Força baixa)
export const IconeFraqueza = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 12v6a2 2 0 0 0 4 0v-6" />
    <path d="M8 8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4h-8Z" />
    <path d="M4 10h16" />
  </svg>
);

// Lento (Caracol/Tartaruga - ou Seta para baixo)
export const IconeLento = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" />
    <path d="M19 12l-7 7-7-7" />
  </svg>
);

// Sangrando / Machucado (Gota de Sangue)
export const IconeSangue = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.69l5.74 5.74c2.34 2.34 2.34 6.14 0 8.49a6 6 0 0 1-8.49 0c-2.34-2.34-2.34-6.14 0-8.49L12 2.69z" />
  </svg>
);

// Morrendo / Inconsciente (Caveira)
export const IconeMorte = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2v4" />
    <path d="M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    <circle cx="12" cy="12" r="8" />
  </svg>
);

// Cego / Ofuscado (Olho Cortado)
export const IconeCego = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// Surdo (Orelha Cortada/Som Proibido)
export const IconeSurdo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </svg>
);

// Doente / Envenenado (Frasco/Veneno)
export const IconeVeneno = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 10a7.5 7.5 0 0 0 7 0" />
    <path d="M12 16v-6" />
    <path d="M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
    <path d="M7 10v2a5 5 0 0 0 10 0v-2" />
  </svg>
);

// Confuso / Atordoado (Espiral/Tontura)
export const IconeConfusao = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" />
    <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="M4.93 4.93l2.83 2.83" />
    <path d="M16.24 16.24l2.83 2.83" />
  </svg>
);

// Em Chamas (Fogo)
export const IconeFogo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3.3-1.1 1-1.6 2.5-2.2z" />
  </svg>
);

// Fatigado / Exausto (Bateria Fraca)
export const IconeFadiga = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
    <line x1="22" y1="11" x2="22" y2="13" />
    <line x1="6" y1="7" x2="6" y2="17" />
  </svg>
);


// --- ÍCONES GENÉRICOS (Fallback) ---

export const IconeMental = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a5 5 0 0 1 5 5c0 .7-.2 1.36-.56 1.92C15.16 10.98 12 13 12 13s-3.16-2.02-4.44-4.08A4.97 4.97 0 0 1 7 7a5 5 0 0 1 5-5Z" />
    <path d="M12 13v8" />
    <path d="M8 21h8" />
  </svg>
);

export const IconeFisico = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
    <line x1="9" y1="9" x2="9.01" y2="9" />
    <line x1="15" y1="9" x2="15.01" y2="9" />
  </svg>
);


// Helper para mapear condições para ícones
export const getIconePorCondicao = (idCondicao) => {
    const map = {
        // Medo / Mental
        abalado: <IconeMedo />,
        apavorado: <IconeMedo />,
        alquebrado: <IconeMedo />,
        frustrado: <IconeMental />,
        esmorecido: <IconeMental />,
        pasmo: <IconeConfusao />,
        surpreendido: <IconeMedo />,
        perturbado: <IconeConfusao />,
        atordoado: <IconeConfusao />,
        confuso: <IconeConfusao />,
        fascinado: <IconeConfusao />,

        // Sangue / Dano
        sangrando: <IconeSangue />,
        machucado: <IconeSangue />,
        morrendo: <IconeMorte />,
        inconsciente: <IconeMorte />,
        petrificado: <IconeParalisia />,

        // Físico / Movimento
        agarrado: <IconeParalisia />,
        enredado: <IconeParalisia />,
        imovel: <IconeParalisia />,
        paralisado: <IconeParalisia />,
        indefeso: <IconeParalisia />,
        lento: <IconeLento />,
        caido: <IconeLento />,
        vulneravel: <IconeFisico />,

        // Debilidade / Cansaço
        fraco: <IconeFraqueza />,
        debilitado: <IconeFraqueza />,
        fatigado: <IconeFadiga />,
        exausto: <IconeFadiga />,
        asfixiado: <IconeLento />,

        // Sentidos / Outros
        cego: <IconeCego />,
        ofuscado: <IconeCego />,
        surdo: <IconeSurdo />,
        doente: <IconeVeneno />,
        envenenado: <IconeVeneno />,
        enjoado: <IconeVeneno />,
        em_chamas: <IconeFogo />,
    };

    return map[idCondicao] || <IconeFisico />; // Fallback
};