const TEMA_PADRAO = "tema-ordem";

const registroTemas = Object.freeze({
  "tema-ordem": Object.freeze({
    id: "tema-ordem",
    nome: "Sem Afinidade",
    nomeCurto: "Ordem",
    simbolo: "/assets/images/optimized/SimboloSemafinidade-1024.webp",
    simboloMini: "/assets/images/optimized/SimboloSemafinidade-320.webp",
    hexagono: "/assets/images/hexagono.webp",
    character: "/assets/images/optimized/Character-640.webp",
    transicao: "radar",
    cor: "#0091ff",
    corTexto: "#0091ff",
  }),
  "tema-sangue": Object.freeze({
    id: "tema-sangue",
    nome: "Afinidade com Sangue",
    nomeCurto: "Sangue",
    simbolo: "/assets/images/optimized/SimboloSangue-1024.webp",
    simboloMini: "/assets/images/optimized/SimboloSangue-320.webp",
    hexagono: "/assets/images/hexagonoSangue.webp",
    character: "/assets/images/optimized/CharacterSangue-640.webp",
    transicao: "cortes",
    cor: "#d40000",
    corTexto: "#ff6b70",
  }),
  "tema-morte": Object.freeze({
    id: "tema-morte",
    nome: "Afinidade com Morte",
    nomeCurto: "Morte",
    simbolo: "/assets/images/optimized/SimboloMorte-1024.webp",
    simboloMini: "/assets/images/optimized/SimboloMorte-320.webp",
    hexagono: "/assets/images/hexagonoMorte.webp",
    character: "/assets/images/optimized/CharacterMorte-640.webp",
    transicao: "cinzas",
    cor: "#e0e0e0",
    corTexto: "#e0e0e0",
  }),
  "tema-conhecimento": Object.freeze({
    id: "tema-conhecimento",
    nome: "Afinidade com Conhecimento",
    nomeCurto: "Conhecimento",
    simbolo: "/assets/images/optimized/SimboloConhecimento-1024.webp",
    simboloMini: "/assets/images/optimized/SimboloConhecimento-320.webp",
    hexagono: "/assets/images/hexagonoConhecimento.webp",
    character: "/assets/images/optimized/CharacterConhecimento-640.webp",
    transicao: "sigilos",
    cor: "#ffeb3b",
    corTexto: "#ffeb3b",
  }),
  "tema-energia": Object.freeze({
    id: "tema-energia",
    nome: "Afinidade com Energia",
    nomeCurto: "Energia",
    simbolo: "/assets/images/optimized/SimboloEnergia-1024.webp",
    simboloMini: "/assets/images/optimized/SimboloEnergia-320.webp",
    hexagono: "/assets/images/hexagonoEnergia.webp",
    character: "/assets/images/optimized/CharacterEnergia-640.webp",
    transicao: "glitch",
    cor: "#be29ec",
    corTexto: "#d96bf8",
  }),
});

export const listaTemas = Object.freeze(Object.values(registroTemas));

export function getTemaConfig(temaId) {
  return registroTemas[temaId] || registroTemas[TEMA_PADRAO];
}

export default registroTemas;
