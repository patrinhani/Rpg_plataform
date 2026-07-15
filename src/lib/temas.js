const TEMA_PADRAO = "tema-ordem";

const registroTemas = Object.freeze({
  "tema-ordem": Object.freeze({
    id: "tema-ordem",
    nome: "Sem Afinidade",
    nomeCurto: "Ordem",
    simbolo: "/assets/images/SimboloSemafinidade.webp",
    hexagono: "/assets/images/hexagono.webp",
    character: "/assets/images/Character.webp",
    transicao: "radar",
    cor: "#0091ff",
  }),
  "tema-sangue": Object.freeze({
    id: "tema-sangue",
    nome: "Afinidade com Sangue",
    nomeCurto: "Sangue",
    simbolo: "/assets/images/SimboloSangue.webp",
    hexagono: "/assets/images/hexagonoSangue.webp",
    character: "/assets/images/CharacterSangue.webp",
    transicao: "cortes",
    cor: "#d40000",
  }),
  "tema-morte": Object.freeze({
    id: "tema-morte",
    nome: "Afinidade com Morte",
    nomeCurto: "Morte",
    simbolo: "/assets/images/SimboloMorte.webp",
    hexagono: "/assets/images/hexagonoMorte.webp",
    character: "/assets/images/CharacterMorte.webp",
    transicao: "cinzas",
    cor: "#e0e0e0",
  }),
  "tema-conhecimento": Object.freeze({
    id: "tema-conhecimento",
    nome: "Afinidade com Conhecimento",
    nomeCurto: "Conhecimento",
    simbolo: "/assets/images/SimboloConhecimento.webp",
    hexagono: "/assets/images/hexagonoConhecimento.webp",
    character: "/assets/images/CharacterConhecimento.webp",
    transicao: "sigilos",
    cor: "#ffeb3b",
  }),
  "tema-energia": Object.freeze({
    id: "tema-energia",
    nome: "Afinidade com Energia",
    nomeCurto: "Energia",
    simbolo: "/assets/images/SimboloEnergia.webp",
    hexagono: "/assets/images/hexagonoEnergia.webp",
    character: "/assets/images/CharacterEnergia.webp",
    transicao: "glitch",
    cor: "#be29ec",
  }),
});

export const listaTemas = Object.freeze(Object.values(registroTemas));

export function getTemaConfig(temaId) {
  return registroTemas[temaId] || registroTemas[TEMA_PADRAO];
}

export default registroTemas;
