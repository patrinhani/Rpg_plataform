/**
 * js/database.js
 * (REVISADO E CORRIGIDO)
 * - Adicionadas listas de Modificações (Armas, Proteções, Acessórios).
 * - Lista 'equipGeral' totalmente refeita com base no 'itens.txt' (Acessórios, Explosivos, Itens Operacionais).
 * - Itens duplicados (como "Granada (SaH)") foram removidos para evitar confusão.
 * - Itens "Utensílio" e "Vestimenta" removidos em favor de itens reais e modificações.
 */

import { 
    poderesCombatente, 
    poderesEspecialista, 
    poderesOcultista,
    poderesGerais,
    poderesParanormais
} from './poderes.js';

// --- (NOVO) LISTAS DE MODIFICAÇÕES ---
//
const modificacoesArmas = [
  // Tipo: 'arma' (qualquer), 'arma-fogo', 'arma-fogo-balas', 'arma-fogo-automatica', 'arma-fogo-mira', 'arma-corpo-a-corpo'
  { key: "alongada", nome: "Alongada", tipo: ['arma-fogo'], cat: 1, descricao: "Fornece +2 nos testes de ataque." },
  { key: "calibre_grosso", nome: "Calibre Grosso", tipo: ['arma-fogo'], cat: 1, descricao: "Aumenta o dano em mais um dado do mesmo tipo. Requer munição de calibre grosso." },
  { key: "certeira", nome: "Certeira", tipo: ['arma-corpo-a-corpo'], cat: 1, descricao: "Fornece +2 nos testes de ataque." },
  { key: "compensador", nome: "Compensador", tipo: ['arma-fogo-automatica'], cat: 1, descricao: "Anula a penalidade em testes de ataque por disparar rajadas." },
  { key: "cruel", nome: "Cruel", tipo: ['arma-corpo-a-corpo'], cat: 1, descricao: "Fornece +2 nas rolagens de dano." },
  { key: "discreta_arma", nome: "Discreta", tipo: ['arma'], cat: 1, espacos: -1, descricao: "Reduz o número de espaços ocupados em 1 (mínimo 0), +5 em Crime para ocultar." },
  { key: "dum_dum", nome: "Dum Dum", tipo: ['arma-fogo-balas'], cat: 1, descricao: "Aumenta o multiplicador de crítico em +1." },
  { key: "explosiva", nome: "Explosiva", tipo: ['arma-fogo-balas'], cat: 1, descricao: "Aumenta o dano em +2d6." },
  { key: "ferrolho_automatico", nome: "Ferrolho Automático", tipo: ['arma-fogo'], cat: 1, descricao: "A arma se torna automática." },
  { key: "mira_laser", nome: "Mira Laser", tipo: ['arma-fogo-mira'], cat: 1, descricao: "Aumenta a margem de ameaça em +2." },
  { key: "mira_telescopica", nome: "Mira Telescópica", tipo: ['arma-fogo-mira'], cat: 1, descricao: "Aumenta o alcance em uma categoria. Permite Ataque Furtivo em qualquer alcance." },
  { key: "perigosa", nome: "Perigosa", tipo: ['arma-corpo-a-corpo'], cat: 1, descricao: "Aumenta a margem de ameaça em +2." },
  { key: "silenciador", nome: "Silenciador", tipo: ['arma-fogo'], cat: 1, descricao: "Reduz em –10 a penalidade em Furtividade por se esconder no mesmo turno em que atacou." },
  { key: "tatica", nome: "Tática", tipo: ['arma'], cat: 1, descricao: "Você pode sacar a arma como uma ação livre." },
  { key: "visao_de_calor", nome: "Visão de Calor", tipo: ['arma-fogo-mira'], cat: 1, descricao: "Ao disparar com a arma, você ignora qualquer camuflagem do alvo." },
];

const modificacoesProtecoes = [
  // Tipo: 'protecao' (qualquer), 'protecao-leve', 'protecao-pesada'
  { key: "antibombas", nome: "Antibombas", tipo: ['protecao-pesada'], cat: 1, descricao: "Fornece +5 em testes de resistência contra efeitos de área." },
  { key: "blindada", nome: "Blindada", tipo: ['protecao-pesada'], cat: 1, espacos: 1, descricao: "Aumenta a RD para 5 e o espaço em +1." },
  { key: "discreta_protecao", nome: "Discreta", tipo: ['protecao-leve'], cat: 1, espacos: -1, descricao: "Reduz o espaço em 1 (mínimo 0), +5 em Crime para ocultar." },
  { key: "reforcada", nome: "Reforçada", tipo: ['protecao'], cat: 1, espacos: 1, descricao: "Aumenta a Defesa fornecida em +2 e o espaço em +1." },
];

const modificacoesAcessorios = [
  // Tipo: 'acessorio', 'acessorio-eletrico'
  { key: "aprimorado", nome: "Aprimorado", tipo: ['acessorio'], cat: 1, descricao: "O bônus em perícia do acessório aumenta para +5. Pode ser escolhida uma segunda vez para uma Função Adicional." },
  { key: "discreto_acessorio", nome: "Discreto", tipo: ['acessorio'], cat: 1, espacos: -1, descricao: "Reduz o espaço em 1 (mínimo 0), +5 em Crime para ocultar." },
  { key: "funcao_adicional", nome: "Função Adicional", tipo: ['acessorio'], cat: 1, descricao: "Fornece +2 em uma perícia adicional à sua escolha (aprovada pelo mestre)." },
  { key: "instrumental", nome: "Instrumental", tipo: ['acessorio'], cat: 1, descricao: "Pode ser usado como um kit de perícia específico (escolhido ao aplicar)." },
  { key: "bateria_potente", nome: "Bateria Potente", tipo: ['acessorio-eletrico'], cat: 1, descricao: "Dobra a duração da bateria/alcance de luz, ou dobra usos/dano/DT de taser." },
];

const modificacoesParanormais = [
  { key: "lente_revelacao", nome: "Lente de Revelação", tipo: ['item-paranormal'], cat: 1, descricao: "Modificação de Câmera de Aura. Permite ver invisíveis/incorpóreos. Ação padrão (1 PE): fotografar criatura (curto), ela perde camuflagem/invisibilidade (Von DT Pre evita)." },
];
// --- FIM DAS MODIFICAÇÕES ---


// --- CONSTANTES DE FICHA ---
const NiveisNex = {
    "5%": "5%", "10%": "10%", "15%": "15%",
    "20%": "20%", "25%": "25%", "30%": "30%",
    "35%": "35%", "40%": "40%", "45%": "45%",
    "50%": "50%", "55%": "55%", "60%": "60%",
    "65%": "65%", "70%": "70%", "75%": "75%",
    "80%": "80%", "85%": "85%", "90%": "90%",
    "95%": "95%", "99%": "99%"
};

const OpcoesClasse = {
    combatente: "Combatente", especialista: "Especialista",
    ocultista: "Ocultista", sobrevivente: "Sobrevivente"
};

const OpcoesOrigem = {
    academico: "Acadêmico", agente_saude: "Agente de Saúde", amnesico: "Amnésico",
    artista: "Artista", atleta: "Atleta", chef: "Chef", criminoso: "Criminoso",
    cultista_arrependido: "Cultista Arrependido", desgarrado: "Desgarrado",
    engenheiro: "Engenheiro", executivo: "Executivo", investigador: "Investigador",
    lutador: "Lutador", magnata: "Magnata", militar: "Militar", policial: "Policial",
    religioso: "Religioso", servidor_publico: "Servidor Público",
    teorico_conspiracao: "Teórico da Conspiração", ti: "T.I.", trabalhador_rural: "Trabalhador Rural",
    universitario: "Universitário", vitima: "Vítima", amigo_animais: "Amigo dos Animais",
    astronauta: "Astronauta", chef_outro_lado: "Chef do Outro Lado", colegial: "Colegial",
    cosplayer: "Cosplayer", diplomata: "Diplomata", explorador: "Explorador",
    experimento: "Experimento", fanatico_criaturas: "Fanático por Criaturas",
    fotografo: "Fotógrafo", inventor_paranormal: "Inventor Paranormal", jovem_mistico: "Jovem Místico",
    legista_noturno: "Legista do Turno da Noite", mateiro: "Mateiro", mergulhador: "Mergulhador",
    motorista: "Motorista", nerd_entusiasta: "Nerd Entusiasta", profetizado: "Profetizado",
    psicologo: "Psicólogo", reporter_investigativo: "Repórter Investigativo"
};
// --- FIM DAS CONSTANTES DE FICHA ---

const Patentes = [
  { pp: 0, nome: "Recruta", credito: "Baixo", catI: 2, catII: 0, catIII: 0, catIV: 0 },
  { pp: 20, nome: "Operador", credito: "Médio", catI: 3, catII: 1, catIII: 0, catIV: 0 },
  { pp: 50, nome: "Agente Especial", credito: "Médio", catI: 3, catII: 2, catIII: 1, catIV: 0 },
  { pp: 100, nome: "Oficial de Operações", credito: "Alto", catI: 3, catII: 3, catIII: 2, catIV: 1 },
  { pp: 200, nome: "Agente de Elite", credito: "Ilimitado", catI: 3, catII: 3, catIII: 3, catIV: 2 }
];

/**
 * Retorna os dados da patente com base nos pontos de prestígio.
* @param {number} pp - Pontos de Prestígio.
 * @returns {object} - O objeto da patente correspondente.
 */
const getPatenteInfo = (pp) => {
  let patenteAtual = Patentes[0];
  // Itera de forma decrescente para garantir que a patente mais alta seja pega primeiro
  for (let i = Patentes.length - 1; i >= 0; i--) {
    // Garante que pp é um número antes de comparar
    if (Number(pp) >= Patentes[i].pp) { 
      patenteAtual = Patentes[i];
      break;
    }
  }
  return patenteAtual; // <-- ESTA É A CORREÇÃO
}

const database = {

  //
  armasSimples: [
    {
      id: "faca",
      nome: "Faca",
      categoria: 0,
      dano: "1d4",
      critico: "19",
      alcance: "Curto",
      tipo: "C",
      espacos: 1,
      descricao: "Uma lâmina longa e afiada. É uma arma ágil e pode ser arremessada.",
    },
    {
      id: "martelo",
      nome: "Martelo",
      categoria: 0,
      dano: "1d6",
      critico: "x2",
      alcance: "-",
      tipo: "I",
      espacos: 1,
      descricao: "Esta ferramenta comum pode ser usada como arma na falta de opções melhores.",
    },
    {
      id: "punhal",
      nome: "Punhal",
      categoria: 0,
      dano: "1d4",
      critico: "x3",
      alcance: "-",
      tipo: "P",
      espacos: 1,
      descricao: "Uma faca de lâmina longa e pontiaguda, usada por cultistas. É uma arma ágil.",
    },
    {
      id: "bastao",
      nome: "Bastão",
      categoria: 0,
      dano: "1d6/1d8",
      critico: "x2",
      alcance: "-",
      tipo: "I",
      espacos: 1,
      descricao: "Um cilindro de madeira maciça. Pode ser empunhado com uma mão (dano 1d6) ou com as duas (dano 1d8).",
    },
    {
      id: "machete",
      nome: "Machete",
      categoria: 0,
      dano: "1d6",
      critico: "19",
      alcance: "-",
      tipo: "C",
      espacos: 1,
      descricao: "Uma lâmina longa, muito usada como ferramenta para abrir trilhas.",
    },
    {
      id: "lanca",
      nome: "Lança",
      categoria: 0,
      dano: "1d6",
      critico: "x2",
      alcance: "Curto",
      tipo: "P",
      espacos: 1,
      descricao: "Uma haste de madeira com uma ponta metálica afiada. Pode ser arremessada.",
    },
    {
      id: "cajado",
      nome: "Cajado",
      categoria: 0,
      dano: "1d6/1d6",
      critico: "x2",
      alcance: "-",
      tipo: "I",
      espacos: 2,
      descricao: "Um cabo de madeira ou barra de ferro longo. É uma arma ágil.",
    },
    {
      id: "arco",
      nome: "Arco",
      categoria: 0,
      dano: "1d6",
      critico: "x3",
      alcance: "Médio",
      tipo: "P",
      espacos: 2,
      descricao: "Um arco e flecha comum, próprio para tiro ao alvo.",
    },
    {
      id: "besta",
      nome: "Besta",
      categoria: 0,
      dano: "1d8",
      critico: "19",
      alcance: "Médio",
      tipo: "P",
      espacos: 2,
      descricao: "Exige uma ação de movimento para ser recarregada a cada disparo.",
    },
    {
      id: "pistola",
      nome: "Pistola",
      categoria: 1,
      dano: "1d12",
      critico: "18",
      alcance: "Curto",
      tipo: "B",
      espacos: 1,
      descricao: "Uma arma de mão comum entre policiais e militares.",
    },
    {
      id: "revolver",
      nome: "Revólver",
      categoria: 1,
      dano: "2d6",
      critico: "19/x3",
      alcance: "Curto",
      tipo: "B",
      espacos: 1,
      descricao: "A arma de fogo mais comum, e uma das mais confiáveis.",
    },
    {
      id: "fuzil_caca",
      nome: "Fuzil de Caça",
      categoria: 1,
      dano: "2d8",
      critico: "19/x3",
      alcance: "Médio",
      tipo: "B",
      espacos: 2,
      descricao: "Popular entre fazendeiros, caçadores e atiradores esportistas.",
    },
    {
      id: "estilingue", // SaH
      nome: "Estilingue",
      categoria: 0,
      dano: "1d4",
      critico: "x2",
      alcance: "Curto",
      tipo: "I",
      espacos: 1,
      descricao: "Aplica Força ao dano. Pode arremessar granadas em alcance longo.",
    },
    {
      id: "pregador_pneumatico", // SaH
      nome: "Pregador Pneumático",
      categoria: 0,
      dano: "1d4",
      critico: "x4",
      alcance: "Curto",
      tipo: "P",
      espacos: 1,
      descricao: "Ferramenta que dispara pregos. Conta como arma de fogo para poderes.",
    },
    {
      id: "revolver_compacto", // SaH
      nome: "Revólver Compacto",
      categoria: 1,
      dano: "2d4",
      critico: "19/x3",
      alcance: "Curto",
      tipo: "B",
      espacos: 1,
      descricao: "Arma de baixo calibre, projetada para ser facilmente escondida.",
    },
  ],
  //
  armasTaticas: [
    {
      id: "machadinha",
      nome: "Machadinha",
      categoria: 0,
      dano: "1d6",
      critico: "x3",
      alcance: "Curto",
      tipo: "C",
      espacos: 1,
      descricao: "Ferramenta útil para cortar madeira. Pode ser arremessada.",
    },
    {
      id: "nunchaku",
      nome: "Nunchaku",
      categoria: 0,
      dano: "1d8",
      critico: "x2",
      alcance: "-",
      tipo: "I",
      espacos: 1,
      descricao: "Dois bastões curtos de madeira ligados por uma corrente. É uma arma ágil.",
    },
    {
      id: "corrente",
      nome: "Corrente",
      categoria: 0,
      dano: "1d8",
      critico: "x2",
      alcance: "-",
      tipo: "I",
      espacos: 1,
      descricao: "Um pedaço de corrente grossa. Fornece +2 em testes para desarmar e derrubar.",
    },
    {
      id: "espada",
      nome: "Espada",
      categoria: 1,
      dano: "1d8/1d10",
      critico: "19",
      alcance: "-",
      tipo: "C",
      espacos: 1,
      descricao: "Uma arma medieval. Pode ser empunhada com uma mão (dano 1d8) ou com as duas (dano 1d10).",
    },
    {
      id: "florete",
      nome: "Florete",
      categoria: 1,
      dano: "1d6",
      critico: "18",
      alcance: "-",
      tipo: "C",
      espacos: 1,
      descricao: "Esta espada de lâmina fina e comprida é usada por esgrimistas. É uma arma ágil.",
    },
    {
      id: "machado",
      nome: "Machado",
      categoria: 1,
      dano: "1d8",
      critico: "x3",
      alcance: "-",
      tipo: "C",
      espacos: 1,
      descricao: "Uma ferramenta importante para lenhadores e bombeiros.",
    },
    {
      id: "maca",
      nome: "Maça",
      categoria: 1,
      dano: "2d4",
      critico: "x2",
      alcance: "-",
      tipo: "I",
      espacos: 1,
      descricao: "Bastão com uma cabeça metálica cheia de protuberâncias.",
    },
    {
      id: "acha",
      nome: "Acha",
      categoria: 1,
      dano: "1d12",
      critico: "x3",
      alcance: "-",
      tipo: "C",
      espacos: 2,
      descricao: "Um machado grande e pesado, usado no corte de árvores largas.",
    },
    {
      id: "gadanho",
      nome: "Gadanho",
      categoria: 1,
      dano: "2d4",
      critico: "x4",
      alcance: "-",
      tipo: "C",
      espacos: 2,
      descricao: "Uma ferramenta agrícola, versão maior da foice, para uso com as duas mãos.",
    },
    {
      id: "katana",
      nome: "Katana",
      categoria: 1,
      dano: "1d10",
      critico: "19",
      alcance: "-",
      tipo: "C",
      espacos: 2,
      descricao: "Espada longa e levemente curvada. É uma arma ágil.",
    },
    {
      id: "marreta",
      nome: "Marreta",
      categoria: 1,
      dano: "3d4",
      critico: "x2",
      alcance: "-",
      tipo: "I",
      espacos: 2,
      descricao: "Normalmente usada para demolir paredes.",
    },
    {
      id: "montante",
      nome: "Montante",
      categoria: 1,
      dano: "2d6",
      critico: "19",
      alcance: "-",
      tipo: "C",
      espacos: 2,
      descricao: "Enorme e pesada, esta espada de 1,5m de comprimento.",
    },
    {
      id: "motosserra",
      nome: "Motosserra",
      categoria: 1,
      dano: "3d6",
      critico: "x2",
      alcance: "-",
      tipo: "C",
      espacos: 2,
      descricao: "Capaz de causar ferimentos profundos. Impõe -5 nos seus testes de ataque.",
    },
    {
      id: "arco_composto",
      nome: "Arco Composto",
      categoria: 1,
      dano: "1d10",
      critico: "x3",
      alcance: "Médio",
      tipo: "P",
      espacos: 2,
      descricao: "Este arco moderno permite que você aplique sua Força às rolagens de dano.",
    },
    {
      id: "balestra",
      nome: "Balestra",
      categoria: 1,
      dano: "1d12",
      critico: "19",
      alcance: "Médio",
      tipo: "P",
      espacos: 2,
      descricao: "Uma besta pesada. Exige uma ação de movimento para ser recarregada a cada disparo.",
    },
    {
      id: "submetralhadora",
      nome: "Submetralhadora",
      categoria: 2,
      dano: "2d6",
      critico: "19/x3",
      alcance: "Curto",
      tipo: "B",
      espacos: 1,
      descricao: "Esta arma de fogo automática pode ser empunhada com apenas uma mão.",
    },
    {
      id: "espingarda",
      nome: "Espingarda",
      categoria: 1,
      dano: "4d6",
      critico: "x3",
      alcance: "Curto",
      tipo: "B",
      espacos: 2,
      descricao: "Arma de fogo longa e com cano liso. Causa metade do dano em alcance médio ou maior.",
    },
    {
      id: "fuzil_assalto",
      nome: "Fuzil de Assalto",
      categoria: 2,
      dano: "2d10",
      critico: "19/x3",
      alcance: "Médio",
      tipo: "B",
      espacos: 2,
      descricao: "A arma de fogo padrão dos exércitos modernos. É uma arma automática.",
    },
    {
      id: "fuzil_precisao",
      nome: "Fuzil de Precisão",
      categoria: 2,
      dano: "2d10",
      critico: "19/x3",
      alcance: "Longo",
      tipo: "B",
      espacos: 2,
      descricao: "Projetada para disparos longos e precisos.",
    },
    {
      id: "baioneta", // SaH
      nome: "Baioneta",
      categoria: 0,
      dano: "1d4",
      critico: "19",
      alcance: "-",
      tipo: "P",
      espacos: 1,
      descricao: "Lâmina para ser fixada em um fuzil (dano 1d6, Ágil) ou usada como uma faca.",
    },
    {
      id: "bastao_policial", // SaH
      nome: "Bastão Policial",
      categoria: 1,
      dano: "1d6",
      critico: "x2",
      alcance: "Curto",
      tipo: "I",
      espacos: 1,
      descricao: "Bastão com guarda lateral. Fornece +1 na Defesa ao usar a ação esquiva. É ágil.",
    },
    {
      id: "espingarda_cano_duplo", // SaH
      nome: "Espingarda de Cano Duplo",
      categoria: 1,
      dano: "4d6",
      critico: "x3",
      alcance: "Curto",
      tipo: "B",
      espacos: 2,
      descricao: "Exige recarga (ação de movimento) após 2 disparos. Pode disparar os dois canos (dano 6d6, -2 no ataque).",
    },
    {
      id: "faca_tatica", // SaH
      nome: "Faca Tática",
      categoria: 1,
      dano: "1d6",
      critico: "19",
      alcance: "Curto",
      tipo: "C",
      espacos: 1,
      descricao: "Balanceada. Fornece +2 no teste de contra-ataque. Pode ser sacrificada para dar +20 RD num bloqueio. É ágil.",
    },
    {
      id: "gancho_carne", // SaH
      nome: "Gancho de Carne",
      categoria: 0,
      dano: "1d4",
      critico: "x4",
      alcance: "-",
      tipo: "P",
      espacos: 1,
      descricao: "Gancho metálico usado em frigoríficos. Pode ser amarrado a uma corda (alcance 4,5m, 2 espaços).",
    },
    {
      id: "picareta", // SaH
      nome: "Picareta",
      categoria: 0,
      dano: "1d6",
      critico: "x4",
      alcance: "-",
      tipo: "P",
      espacos: 1,
      descricao: "Ferramenta de mineração e demolição.",
    },
    {
      id: "shuriken", // SaH
      nome: "Shuriken",
      categoria: 1,
      dano: "1d4",
      critico: "x2",
      alcance: "Curto",
      tipo: "P",
      espacos: 0.5,
      descricao: "Projéteis metálicos em forma de estrela. Um pacote dura duas cenas.",
    },
    {
      id: "pistola_pesada", // SaH
      nome: "Pistola Pesada",
      categoria: 1,
      dano: "2d8",
      critico: "18",
      alcance: "Curto",
      tipo: "B",
      espacos: 1,
      descricao: "Pistola de calibre superior. Impõe -2 em testes de ataque (anulado se empunhar com duas mãos).",
    },
  ],
  //
  armasPesadas: [
    {
      id: "bazuca",
      nome: "Bazuca",
      categoria: 3,
      dano: "10d8",
      critico: "x2",
      alcance: "Médio",
      tipo: "I",
      espacos: 2,
      descricao: "Causa dano em área (3m, Reflexos DT Agi reduz à metade). Recarga de 1 ação de movimento.",
    },
    {
      id: "lanca_chamas",
      nome: "Lança-chamas",
      categoria: 3,
      dano: "6d6",
      critico: "x2",
      alcance: "Curto",
      tipo: "Fogo",
      espacos: 2,
      descricao: "Atinge todos os seres em uma linha de 1,5m de largura com alcance curto. Alvos ficam em chamas.",
    },
    {
      id: "metralhadora",
      nome: "Metralhadora",
      categoria: 2,
      dano: "2d12",
      critico: "19/x3",
      alcance: "Médio",
      tipo: "B",
      espacos: 2,
      descricao: "Exige Força 4 ou gastar uma ação de movimento para apoiá-la. É uma arma automática.",
    },
    {
      id: "gatling", // SaH
      nome: "Metralhadora Gatling",
      categoria: 3,
      dano: "4d6",
      critico: "19/x3",
      alcance: "Médio",
      tipo: "B",
      espacos: 10,
      descricao: "Alta cadência. Requer ação de movimento para 'aquecer' (mirar). Se não aquecer, impõe -2d20 nos ataques. Gasta 10 balas por disparo.",
    },
  ],
  //
  municoes: [
    {
      id: "balas_curtas",
      nome: "Balas Curtas",
      categoria: 0,
      espacos: 1,
      descricao: "Munição para pistolas, revólveres e submetralhadoras. Dura duas cenas.",
    },
    {
      id: "balas_longas",
      nome: "Balas Longas",
      categoria: 1,
      espacos: 1,
      descricao: "Munição para fuzis e metralhadoras. Dura uma cena.",
    },
    {
      id: "cartuchos",
      nome: "Cartuchos",
      categoria: 1,
      espacos: 1,
      descricao: "Usados em espingardas. Dura uma cena.",
    },
    {
      id: "combustivel",
      nome: "Combustível (Lança-chamas)",
      categoria: 1,
      espacos: 1,
      descricao: "Tanque de combustível para lança-chamas. Dura uma cena.",
    },
    {
      id: "flechas",
      nome: "Flechas",
      categoria: 0,
      espacos: 1,
      descricao: "Munição para arcos e bestas. Dura uma missão inteira.",
    },
    {
      id: "foguete",
      nome: "Foguete (Bazuca)",
      categoria: 1,
      espacos: 1,
      descricao: "Munição para bazuca. Cada foguete dura um único disparo.",
    },
    {
      id: "bolinhas_estilingue", // SaH
      nome: "Bolinhas (Estilingue)",
      categoria: 0,
      espacos: 0.5,
      descricao: "Bolinhas de metal ou pedras para estilingue. Dura uma missão inteira.",
    },
    {
      id: "pregos_pregador", // SaH
      nome: "Pregos (Pregador)",
      categoria: 0,
      espacos: 1,
      descricao: "Rolo de pregos para um pregador pneumático. Dura uma missão inteira.",
    },
  ],
  //
  protecoes: [
    {
      id: "protecao_leve",
      nome: "Proteção Leve",
      categoria: 1,
      defesa: 5,
      espacos: 2,
      descricao: "Jaqueta de couro pesada ou um colete de kevlar. Fornece +5 na Defesa.",
    },
    {
      id: "protecao_pesada",
      nome: "Proteção Pesada",
      categoria: 2,
      defesa: 10,
      espacos: 5,
      descricao: "Equipamento tático completo. Fornece +10 na Defesa e RD 2 (Balístico, Corte, Impacto, Perfuração). Impõe -5 em testes com penalidade de carga.",
    },
    {
      id: "escudo",
      nome: "Escudo",
      categoria: 1,
      defesa: 2,
      espacos: 2,
      descricao: "Um escudo balístico ou medieval. Fornece +2 na Defesa. Conta como proteção pesada para proficiência.",
    },
    {
      id: "escudo_balistico_sah", // SaH
      nome: "Escudo Balístico (SaH)",
      categoria: 2,
      defesa: 5,
      espacos: 3,
      descricao: "Escudo pesado. Concede +10 em Defesa (total) se usar ação 'Proteger'. Subtrai 2d20 de testes de Agilidade e Vigor.",
    },
  ],
  //
  equipGeral: [
    // --- Acessórios ---
    {
      id: "kit_pericia",
      nome: "Kit de Perícia",
      categoria: 0,
      espacos: 1,
      descricao: "Um kit de ferramentas para uma perícia (ex: Medicina, Tecnologia). Sem o kit, você sofre -5 no teste.",
      tipoBonus: "kit",
    },
    {
      id: "amuleto_sagrado",
      nome: "Amuleto Sagrado",
      categoria: 1, // Utensílio Especial
      espacos: 1,
      descricao: "Um utensílio que reforça sua fé. Ocupa o espaço de um item vestido e fornece +2 em Religião e Vontade.",
      valorBonus: 2,
      periciaVinculada: "religiao", // Bônus principal
      // Nota: Bônus duplo (Vontade) pode ser adicionado com modificação "Função Adicional"
    },
    {
      id: "celular",
      nome: "Celular",
      categoria: 1, // Utensílio Especial
      espacos: 1,
      descricao: "Acessa a internet, tira fotos, grava áudio/vídeo. Se tiver acesso a internet, fornece +2 em testes para adquirir informações.",
      valorBonus: 2,
      periciaVinculada: "atualidades", // Exemplo de perícia de informação
    },
    {
      id: "chave_fenda_universal",
      nome: "Chave de Fenda Universal",
      categoria: 1, // Utensílio Especial
      espacos: 1,
      descricao: "Fornece +2 em testes de perícia para criar ou reparar objetos (ex: Profissão, Tecnologia).",
      valorBonus: 2,
      periciaVinculada: "profissao", // Bônus principal
    },
    {
      id: "chaves",
      nome: "Chaves",
      categoria: 1, // Utensílio Especial
      espacos: 0.5, // Ajustado (menor que um utensílio padrão)
      descricao: "Molho de chaves. Fornece +2 em testes de Furtividade para distrair (jogando as chaves).",
      valorBonus: 2,
      periciaVinculada: "furtividade",
    },
    {
      id: "documentos_falsos",
      nome: "Documentos Falsos",
      categoria: 1, // Utensílio Especial
      espacos: 1,
      descricao: "Identidade falsa, cartões. Fornece +2 em testes de Diplomacia, Enganação e Intimidação para se passar pela identidade.",
      valorBonus: 2,
      periciaVinculada: "enganacao", // Bônus principal
    },
    {
      id: "manual_operacional",
      nome: "Manual Operacional",
      categoria: 1, // Acessório
      espacos: 1,
      descricao: "Gastar uma ação de interlúdio lendo permite que você use a perícia como se fosse treinado nela até o próximo interlúdio.",
    },
    {
      id: "notebook",
      nome: "Notebook",
      categoria: 1, // Utensílio Especial
      espacos: 2, // Ajustado (maior que celular)
      descricao: "Se tiver acesso a internet, fornece +2 em testes para adquirir informações. Recupera +1 SAN ao relaxar em interlúdio.",
      valorBonus: 2,
      periciaVinculada: "tecnologia", // Exemplo de perícia
    },
    // --- Explosivos ---
    {
      id: "granada_atordoamento",
      nome: "Granada de Atordoamento",
      categoria: 0,
      espacos: 1,
      descricao: "Ação padrão. Área (6m). Alvos ficam atordoados por 1 rodada (Fortitude DT Agi reduz para ofuscado e surdo).",
    },
    {
      id: "granada_fumaca",
      nome: "Granada de Fumaça",
      categoria: 0,
      espacos: 1,
      descricao: "Ação padrão. Área (6m). Seres na área ficam cegos e sob camuflagem total. Dura 2 rodadas.",
    },
    {
      id: "granada_fragmentacao",
      nome: "Granada de Fragmentação",
      categoria: 2,
      espacos: 1,
      descricao: "Ação padrão. Área (6m). Sofrem 8d6 de dano de perfuração (Reflexos DT Agi reduz à metade).",
    },
    {
      id: "granada_incendiaria",
      nome: "Granada Incendiária",
      categoria: 2,
      espacos: 1,
      descricao: "Ação padrão. Área (6m). Sofrem 6d6 de dano de fogo e ficam em chamas (Reflexos DT Agi reduz à metade e evita chamas).",
    },
    {
      id: "granada_gas_sonifero",
      nome: "Granada de Gás Sonífero",
      categoria: 1, // SaH
      espacos: 1,
      descricao: "Ação padrão. Área (6m). Seres na área ficam inconscientes (Fortitude DT Agi reduz para fatigado). Dura 2 rodadas.",
    },
    {
      id: "granada_pem",
      nome: "Granada de PEM",
      categoria: 2, // SaH
      espacos: 1,
      descricao: "Ação padrão. Desativa eletrônicos em 18m. Criaturas de Energia sofrem 6d6 dano de impacto e ficam paralisadas (Fortitude DT Agi reduz à metade e evita).",
    },
    {
      id: "mina_antipessoal",
      nome: "Mina Antipessoal",
      categoria: 1,
      espacos: 1,
      descricao: "Ação completa para instalar (Tática DT 15). Detonação por ação padrão (alcance longo). Causa 12d6 dano de perfuração (cone 6m, Reflexos DT Int reduz à metade).",
    },
    {
      id: "dinamite",
      nome: "Dinamite",
      categoria: 1, // SaH
      espacos: 1,
      descricao: "Ação padrão. Área (6m). Sofrem 4d6 impacto e 4d6 fogo, e ficam em chamas (Reflexos DT Agi reduz à metade e evita chamas).",
    },
    {
      id: "explosivo_plastico",
      nome: "Explosivo Plástico",
      categoria: 2, // SaH
      espacos: 1,
      descricao: "Duas rodadas para preparar. Detonação (ação livre). Área (3m). Causa 16d6 dano de impacto (Reflexos DT Int reduz à metade). Dobro de dano a objetos/estruturas.",
    },
    {
      id: "galao_vermelho",
      nome: "Galão Vermelho",
      categoria: 1, // SaH
      espacos: 1,
      descricao: "Explode ao sofrer dano de fogo/balístico. Área (6m). Causa 12d6 dano de fogo e deixa em chamas (Reflexos DT 25 reduz à metade e evita).",
    },
    // --- Itens Operacionais ---
    {
      id: "algemas",
      nome: "Algemas",
      categoria: 0,
      espacos: 1,
      descricao: "Prender um alvo exige agarrar e vencer um novo teste de agarrar.",
    },
    {
      id: "arpeu",
      nome: "Arpéu",
      categoria: 0,
      espacos: 1,
      descricao: "Gancho de aço com corda. Prender exige teste de Pontaria (DT 15). Fornece +5 em Atletismo para escalar.",
    },
    {
      id: "bandoleira",
      nome: "Bandoleira",
      categoria: 1,
      espacos: 1,
      descricao: "Cinto com bolsos e alças. Uma vez por rodada, pode sacar ou guardar um item como ação livre.",
    },
    {
      id: "binoculos",
      nome: "Binóculos",
      categoria: 0,
      espacos: 1,
      descricao: "Fornece +5 em testes de Percepção para observar coisas distantes.",
      tipoBonus: "especifico", periciaVinculada: "percepcao", valorBonus: 5,
    },
    {
      id: "bloqueador_sinal",
      nome: "Bloqueador de Sinal",
      categoria: 1,
      espacos: 1,
      descricao: "Impede conexão de celulares em alcance médio.",
    },
    {
      id: "cicatrizante",
      nome: "Cicatrizante",
      categoria: 1,
      espacos: 1,
      descricao: "Ação padrão para curar 2d8+2 PV em você ou em um ser adjacente.",
    },
    {
      id: "corda",
      nome: "Corda",
      categoria: 0,
      espacos: 1,
      descricao: "Rolo com 10 metros de corda resistente.",
    },
    {
      id: "equip_sobrevivencia",
      nome: "Equip. de Sobrevivência",
      categoria: 0,
      espacos: 2,
      descricao: "Mochila com saco de dormir, GPS, etc. Fornece +5 em Sobrevivência (acampar/orientar-se) e permite uso destreinado.",
      tipoBonus: "especifico", periciaVinculada: "sobrevivencia", valorBonus: 5,
    },
    {
      id: "lanterna_tatica",
      nome: "Lanterna Tática",
      categoria: 1,
      espacos: 1,
      descricao: "Ilumina. Ação de movimento para mirar nos olhos de um ser (alcance curto), deixando-o ofuscado por 1 rodada.",
    },
    {
      id: "mascara_gas",
      nome: "Máscara de Gás",
      categoria: 1,
      espacos: 1,
      descricao: "Fornece +10 em testes de Fortitude contra efeitos de respiração.",
      tipoBonus: "especifico", periciaVinculada: "fortitude", valorBonus: 10,
    },
    {
      id: "mochila_militar",
      nome: "Mochila Militar",
      categoria: 1,
      espacos: 0,
      descricao: "Não usa espaço e aumenta sua capacidade de carga em 2 espaços.",
    },
    {
      id: "oculos_visao_termica",
      nome: "Óculos de Visão Térmica",
      categoria: 1,
      espacos: 1,
      descricao: "Elimina penalidade em testes por camuflagem.",
    },
    {
      id: "pe_de_cabra",
      nome: "Pé de Cabra",
      categoria: 0,
      espacos: 1,
      descricao: "Fornece +5 em testes de Força para arrombar portas. Pode ser usado como um bastão.",
    },
    {
      id: "pistola_dardos",
      nome: "Pistola de Dardos",
      categoria: 1,
      espacos: 1,
      descricao: "Ataque à distância. Se acertar, alvo fica inconsciente (Fortitude DT Agi reduz para desprevenido e lento). Vem com 2 dardos.",
    },
    {
      id: "pistola_sinalizadora",
      nome: "Pistola Sinalizadora",
      categoria: 0,
      espacos: 1,
      descricao: "Dispara sinalizador. Pode ser usada como arma de disparo (curto, 2d6 de fogo). Vem com 2 cargas.",
    },
    {
      id: "soqueira",
      nome: "Soqueira",
      categoria: 0,
      espacos: 1,
      descricao: "Fornece +1 em rolagens de dano desarmado. Pode receber modificações/maldições de armas corpo a corpo.",
    },
    {
      id: "spray_pimenta",
      nome: "Spray de Pimenta",
      categoria: 1,
      espacos: 1,
      descricao: "Ação padrão. Ser adjacente fica cego por 1d4 rodadas (Fortitude DT Agi evita). 2 usos.",
    },
    {
      id: "taser",
      nome: "Taser",
      categoria: 1,
      espacos: 1,
      descricao: "Ação padrão. Ser adjacente sofre 1d6 dano de eletricidade e fica atordoado por 1 rodada (Fortitude DT Agi evita). 2 usos.",
    },
    {
      id: "traje_hazmat",
      nome: "Traje Hazmat",
      categoria: 1,
      espacos: 2,
      descricao: "Fornece +5 em testes de resistência contra efeitos ambientais e RD 10 a químico.",
    },
    // --- Itens Operacionais (SaH) ---
    {
      id: "alarme_movimento", // SaH
      nome: "Alarme de Movimento",
      categoria: 1,
      espacos: 0.5, // Ajustado
      descricao: "Ação completa para ativar. Sinaliza movimento em cone de 30m. Pode ser discreto ou barulhento.",
    },
    {
      id: "alimento_energetico", // SaH
      nome: "Alimento Energético",
      categoria: 0, // Ajustado
      espacos: 0.5,
      descricao: "Ação padrão para consumir. Recupera 1d4 PE.",
    },
    {
      id: "aplicador_medicamentos", // SaH
      nome: "Aplicador de Medicamentos",
      categoria: 1,
      espacos: 1,
      descricao: "Aplica medicamentos (cicatrizante, etc.) como ação de movimento. Comporta 3 doses.",
    },
    {
      id: "bracadeira_reforcada", // SaH
      nome: "Braçadeira Reforçada",
      categoria: 1,
      espacos: 1,
      descricao: "Aumenta em +2 a RD recebida por usar um bloqueio.",
    },
    {
      id: "cao_adestrado", // SaH
      nome: "Cão Adestrado",
      categoria: 2, // Requer Treino em Adestramento
      espacos: 0, // Aliado
      descricao: "Aliado. Fornece +2 em Investigação e Percepção. (1 PE): +2 na Defesa por 1 rodada.",
    },
    {
      id: "coldre_saque_rapido", // SaH
      nome: "Coldre Saque Rápido",
      categoria: 1,
      espacos: 1,
      descricao: "Uma vez por rodada, pode sacar ou guardar uma arma de fogo leve como ação livre.",
    },
    {
      id: "equip_escuta", // SaH
      nome: "Equipamento de Escuta",
      categoria: 1,
      espacos: 1,
      descricao: "Receptor (alcance 90m) e 3 transmissores (raio 9m). Instalar exige teste de Crime (DT 20).",
    },
    {
      id: "estrepes", // SaH
      nome: "Estrepes",
      categoria: 0, // Ajustado
      espacos: 1,
      descricao: "Ação padrão. Cobre 1,5m. Causa 1d4 dano de perfuração e deixa lento (Reflexos DT Agi evita).",
    },
    {
      id: "faixa_pregos", // SaH
      nome: "Faixa de Pregos",
      categoria: 1,
      espacos: 2,
      descricao: "Funciona como estrepes, mas ocupa uma linha de 9m. Fura pneus de veículos.",
    },
    {
      id: "isqueiro", // SaH
      nome: "Isqueiro",
      categoria: 0,
      espacos: 0, // Ajustado
      descricao: "Ação de movimento para produzir chama. Ilumina 3m.",
    },
    {
      id: "medicamentos", // SaH
      nome: "Medicamentos (Dose)",
      categoria: 0,
      espacos: 0.5,
      descricao: "Ação padrão. (Antibiótico, Antídoto, Antiemético, Antihistamínico, Anti-inflamatório, Antitérmico, Broncodilatador, Coagulante).",
    },
    {
      id: "oculos_escuros", // SaH
      nome: "Óculos Escuros",
      categoria: 0,
      espacos: 0,
      descricao: "Não pode ser ofuscado.",
    },
    {
      id: "oculos_visao_noturna", // SaH
      nome: "Óculos de Visão Noturna",
      categoria: 1,
      espacos: 1,
      descricao: "Permite enxergar no escuro. Impõe –O em testes de resistência contra ofuscado e efeitos de luz.",
    },
    {
      id: "pa", // SaH
      nome: "Pá",
      categoria: 0,
      espacos: 1,
      descricao: "Fornece +5 em testes de Força para cavar. Pode ser usada como um bastão.",
    },
    {
      id: "paraquedas", // SaH
      nome: "Paraquedas",
      categoria: 1,
      espacos: 2,
      descricao: "Anula o dano de queda. Requer treino ou teste de Reflexos (DT 20).",
    },
    {
      id: "traje_mergulho", // SaH
      nome: "Traje de Mergulho",
      categoria: 1,
      espacos: 2,
      descricao: "Tanque (1 hora de oxigênio). Fornece +5 em resistência contra efeitos ambientais e RD 5 a químico.",
    },
    {
      id: "traje_espacial", // SaH
      nome: "Traje Espacial",
      categoria: 3, // Ajustado
      espacos: 5, // Ajustado
      descricao: "Suprimento (8 horas de oxigênio). Fornece +10 em resistência contra efeitos ambientais e RD 20 a químico.",
    },
  ],

  //
  itensParanormais: [
    // --- Itens Operacionais Paranormais ---
    {
      id: "amarras_elemento",
      nome: "Amarras de (Elemento)",
      tipoBonus: "escolhaElemento", 
      categoria: 2,
      espacos: 1,
      descricao: "Ação padrão, 1 PE, 1 criatura (curto). Fica paralisada por 1 rodada (Vontade DT Agi anula).",
    },
    {
      id: "camera_aura",
      nome: "Câmera de Aura Paranormal",
      elemento: "Conhecimento", 
      categoria: 2,
      espacos: 1,
      descricao: "Ação padrão, 1 PE. Tira foto instantânea que revela auras paranormais.",
    },
    {
      id: "componentes_ritualisticos",
      nome: "Componentes Ritualísticos",
      tipoBonus: "escolhaElemento", 
      categoria: 0,
      espacos: 1,
      descricao: "Necessários para conjurar rituais de um elemento (Sangue, Morte, Conhecimento ou Energia).",
    },
    {
      id: "emissor_pulsos",
      nome: "Emissor de Pulsos Paranormais",
      tipoBonus: "escolhaElemento", 
      categoria: 2,
      espacos: 1,
      descricao: "Ação completa, 1 PE. Atrai criaturas do elemento escolhido e afasta do oposto (Vontade DT Pre evita).",
    },
    {
      id: "escuta_ruidos",
      nome: "Escuta de Ruídos Paranormais",
      elemento: "Conhecimento", 
      categoria: 2,
      espacos: 1,
      descricao: "Ação completa, 2 PE. Grava ruídos por 24h. Fornece +5 em Ocultismo para identificar criatura.",
      tipoBonus: "especifico", periciaVinculada: "ocultismo", valorBonus: 5,
    },
    {
      id: "medidor_membrana",
      nome: "Medidor de Estabilidade da Membrana",
      elemento: "Conhecimento", 
      categoria: 1,
      espacos: 1,
      descricao: "Permite avaliar o estado da Membrana em uma área (requer Ocultismo).",
    },
    {
      id: "scanner_manifestacao",
      nome: "Scanner de Manifestação de (Elemento)",
      tipoBonus: "escolhaElemento", 
      categoria: 2,
      espacos: 1,
      descricao: "Ação padrão, 1 PE/rodada. Sabe a direção de todas as manifestações do elemento (alcance longo).",
    },
    // --- Catalisadores (SaH / itens.txt) ---
    {
      id: "catalisador_ampliador",
      nome: "Catalisador (Ampliador)",
      categoria: 1,
      espacos: 0.5,
      descricao: "Consumível. Aumenta o alcance do ritual em um passo ou dobra a área de efeito.",
    },
    {
      id: "catalisador_perturbador",
      nome: "Catalisador (Perturbador)",
      categoria: 1,
      espacos: 0.5,
      descricao: "Consumível. A DT para resistir ao ritual aumenta em +2.",
    },
    {
      id: "catalisador_potencializador",
      nome: "Catalisador (Potencializador)",
      categoria: 1,
      espacos: 0.5,
      descricao: "Consumível. O dano do ritual aumenta em um dado do mesmo tipo.",
    },
    {
      id: "catalisador_prolongador",
      nome: "Catalisador (Prolongador)",
      categoria: 1,
      espacos: 0.5,
      descricao: "Consumível. A duração do ritual dobra (não funciona em instantâneos ou sustentados).",
    },
    // --- Itens Especiais (SaH / itens.txt) ---
    {
      id: "ligacao_infernal",
      nome: "Ligação Direta Infernal",
      elemento: "Sangue", 
      categoria: 2,
      espacos: 1,
      descricao: "Fios (Sangue/Energia). Ação completa para ligar veículo. Veículo ganha RD 20, imune a Sangue, +5 em Pilotagem.",
    },
    {
      id: "medidor_vertebral",
      nome: "Medidor de Condição Vertebral",
      elemento: "Morte", 
      categoria: 2,
      espacos: 1,
      descricao: "Vestimenta (Morte/Energia). Ação completa para conectar (causa atordoamento). Fornece +2 em Fortitude, indica PV e efeitos.",
    },
    {
      id: "pe_de_morto",
      nome: "Pé de Morto",
      elemento: "Morte", 
      categoria: 2,
      espacos: 1,
      descricao: "Botas (Morte). Concede +5 em Furtividade. Em cenas de furtividade, ações de movimento aumentam visibilidade em +1 (em vez de +2).",
    },
    {
      id: "pendrive_selado",
      nome: "Pendrive Selado",
      elemento: "Conhecimento", 
      categoria: 2,
      espacos: 0.5,
      descricao: "Pen drive (Conhecimento). Não pode ser invadido ou afetado por rituais, seres ou efeitos de Energia.",
    },
    {
      id: "valete_salvacao",
      nome: "Valete da Salvação",
      elemento: "Conhecimento", 
      categoria: 1,
      espacos: 0.5,
      descricao: "Carta (Conhecimento). Ação padrão. Voa e aponta para a melhor rota de fuga (alcance médio).",
    },

    // --- ITENS AMALDIÇOADOS ESPECIAIS (OPRPG / itens.txt) ---
    // SANGUE
    {
      id: "coracao_pulsante",
      nome: "Coração Pulsante",
      elemento: "Sangue", 
      categoria: 2,
      espacos: 1,
      descricao: "(Sangue) Reação: reduzir um dano sofrido pela metade. Requer teste de Fortitude (DT 15 +5 por uso/dia) ou é destruído.",
    },
    {
      id: "coroa_espinhos_amald",
      nome: "Coroa de Espinhos (Amaldiçoada)",
      elemento: "Sangue", 
      categoria: 2,
      espacos: 1,
      descricao: "(Sangue) Vestimenta. Reação (1 vez/rodada): transformar dano mental sofrido em dano de Sangue. Impede recuperar sanidade por descanso.",
    },
    {
      id: "frasco_vitalidade",
      nome: "Frasco de Vitalidade",
      elemento: "Sangue", 
      categoria: 2,
      espacos: 1,
      descricao: "(Sangue) Ação (1 min): sofrer até 20 de dano para encher. Ação padrão: beber para curar o PV armazenado (Fortitude DT 20 evita 'enjoado').",
    },
    {
      id: "perola_sangue",
      nome: "Pérola de Sangue",
      elemento: "Sangue", 
      categoria: 2,
      espacos: 1,
      descricao: "(Sangue) Ação de movimento: absorver. Recebe +5 em testes de AGI, FOR e VIG. No fim da cena, Fortitude (DT 20) ou fica 'fatigado'.",
    },
    {
      id: "punhos_enraivecidos",
      nome: "Punhos Enraivecidos",
      elemento: "Sangue", 
      categoria: 2,
      espacos: 1,
      descricao: "(Sangue) Soqueira. Ataques desarmados causam 1d8 dano de Sangue. Ação (Agredir): pode gastar 2 PE para ataque extra, +2 PE para cada subsequente.",
    },
    {
      id: "seringa_transfiguracao",
      nome: "Seringa de Transfiguração",
      elemento: "Sangue", 
      categoria: 2,
      espacos: 1,
      descricao: "(Sangue) Ação padrão: sugar sangue. Ação padrão: injetar em outro alvo. Alvo assume a aparência (como Distorcer Aparência) por 1 dia.",
    },

    // MORTE
    {
      id: "amarras_mortais",
      nome: "Amarras Mortais",
      elemento: "Morte", 
      categoria: 2,
      espacos: 1,
      descricao: "(Morte) Bracelete. Ação padrão (1 vez/rodada, 2 PE): manobra 'Agarrar' (alcance curto, +10 no teste).",
    },
    {
      id: "casaco_lodo",
      nome: "Casaco de Lodo",
      elemento: "Morte", 
      categoria: 2,
      espacos: 1,
      descricao: "(Morte) Vestimenta. Concede RD 5 (Corte, Impacto, Morte, Perfuração). Concede Vulnerabilidade a Dano Balístico e de Energia.",
    },
    {
      id: "coletora",
      nome: "Coletora",
      elemento: "Morte", 
      categoria: 2,
      espacos: 1,
      descricao: "(Morte) Punhal. Ação completa: apunhalar alvo morrendo para matá-lo. Armazena 1d8 PE (máx 20 PE). Causa pesadelos.",
    },
    {
      id: "cranio_espiral",
      nome: "Crânio Espiral",
      elemento: "Morte", 
      categoria: 2,
      espacos: 1,
      descricao: "(Morte) Ação livre (1 vez/rodada): +1 Ação Padrão. Requer teste de Vontade (DT 15 +5 por uso/dia) ou envelhece 1d4 anos.",
    },
    {
      id: "frasco_lodo",
      nome: "Frasco de Lodo",
      elemento: "Morte", 
      categoria: 2,
      espacos: 1,
      descricao: "(Morte) Ação padrão: aplicar em ferimento. Se ferido na última rodada, cura 6d8+20 PV. Se não, 50% chance de curar 3d8+10 ou causar 3d8+10 dano. 1 uso.",
    },
    {
      id: "vislumbre_fim",
      nome: "Vislumbre do Fim",
      elemento: "Morte", 
      categoria: 2,
      espacos: 1,
      descricao: "(Morte) Óculos. Ação de movimento: descobre pior resistência (Fort, Ref, Von) e vulnerabilidades do alvo.",
    },

    // CONHECIMENTO
    {
      id: "aneis_elo_mental",
      nome: "Anéis do Elo Mental",
      elemento: "Conhecimento", 
      categoria: 2,
      espacos: 1,
      descricao: "(Conhecimento) Par de anéis. Cria Ligação Telepática (Invadir Mente) permanente entre 2 usuários. Usam o melhor bônus de Vontade. Dano mental sofrido por um afeta o outro.",
    },
    {
      id: "lanterna_reveladora",
      nome: "Lanterna Reveladora",
      elemento: "Conhecimento", 
      categoria: 2,
      espacos: 1,
      descricao: "(Conhecimento) Ação padrão (1 PE/rodada): ativa luz com efeito de Terceiro Olho. Criaturas de Sangue atacam o portador preferencialmente.",
    },
    {
      id: "mascara_sombras",
      nome: "Máscara das Pessoas nas Sombras",
      elemento: "Conhecimento", 
      categoria: 2,
      espacos: 1,
      descricao: "(Conhecimento) Concede RD 10 (Conhecimento). Ação de movimento (2 PE): teletransportar-se para outra sombra em alcance médio.",
    },
    {
      id: "municao_jurada",
      nome: "Munição Jurada",
      elemento: "Conhecimento", 
      categoria: 2,
      espacos: 1,
      descricao: "(Conhecimento) Bala. Ritual (1 hora) para vincular a 1 ser. Contra esse ser: +10 ataque, dobra margem de ameaça, +6d12 dano de Conhecimento.",
    },
    {
      id: "pergaminho_pertinacia",
      nome: "Pergaminho da Pertinácia",
      elemento: "Conhecimento", 
      categoria: 2,
      espacos: 1,
      descricao: "(Conhecimento) Ação padrão: recebe 5 PE temporários. Requer teste de Ocultismo (DT 15 +5 por uso/dia) ou o item se desfaz.",
    },

    // ENERGIA
    {
      id: "arcabuz_moretti",
      nome: "Arcabuz dos Moretti",
      elemento: "Energia", 
      categoria: 2,
      espacos: 1,
      descricao: "(Energia) Arma de Fogo (simples, 1 mão). +2 ataque. Dano 1d6 (rolar 1d6 no ataque): 1(2d4), 2(2d6), 3(2d8), 4(2d10), 5(2d12), 6(2d20). Não usa munição.",
    },
    {
      id: "bateria_reversa",
      nome: "Bateria Reversa",
      elemento: "Energia", 
      categoria: 2,
      espacos: 1,
      descricao: "(Energia) Ação padrão (2 PE): descarrega 1 eletrônico (curto). Ação padrão: recarrega 1 eletrônico. Requer teste Ocultismo (DT 15 +5/dia) ou explode (12d6 dano).",
    },
    {
      id: "peitoral_segunda_chance",
      nome: "Peitoral da Segunda Chance",
      elemento: "Energia", 
      categoria: 2,
      espacos: 1,
      descricao: "(Energia) Vestimenta. Se reduzido a 0 PV, gasta 5 PE e cura 4d10 PV. 10% chance de falha (morte instantânea).",
    },
    {
      id: "relogio_arnaldo",
      nome: "Relógio de Arnaldo",
      elemento: "Energia", 
      categoria: 2,
      espacos: 1,
      descricao: "(Energia) Ação (1 vez/rodada, 1 PE): rolar novamente qualquer dado com resultado 1. Custo aumenta em +1 PE a cada uso no dia.",
    },
    {
      id: "talisma_sorte",
      nome: "Talismã da Sorte",
      elemento: "Energia", 
      categoria: 2,
      espacos: 1,
      descricao: "(Energia) Vestimenta. Reação (3 PE) ao sofrer dano: rolar 1d4. 1 (Dobra o dano, quebra), 2-3 (Evita o dano), 4 (Evita o dano, quebra).",
    },
    {
      id: "teclado_neural",
      nome: "Teclado de Conexão Neural",
      elemento: "Energia", 
      categoria: 2,
      espacos: 1,
      descricao: "(Energia) Conectar (ação movimento). +10 em Hackear, -50% tempo para Localizar Arquivo. Causa 1d6 dano mental/rodada de uso.",
    },
    {
      id: "tela_pesadelo",
      nome: "Tela do Pesadelo",
      elemento: "Energia", 
      categoria: 2,
      espacos: 1,
      descricao: "(Energia) Ação padrão (2 PE): ativar. Próximo a tocar vê ilusão. Teste Vontade (DT usuário +5) ou fica Atordoado, sofre 4d6 dano mental.",
    },
    {
      id: "veiculo_energizado",
      nome: "Veículo Energizado",
      elemento: "Energia", 
      categoria: 2,
      espacos: 1,
      descricao: "(Energia) Motor não usa combustível. Reação (teste Pilotagem DT 25): atravessa 1 objeto sólido (fica incorpóreo).",
    },

    // MEDO/VARIA
    {
      id: "jaqueta_verissimo",
      nome: "Jaqueta de Veríssimo",
      elemento: "Medo", 
      categoria: 4,
      espacos: 1,
      descricao: "(Medo) Vestimenta. Concede RD 15 (Paranormal). Reação (2 PE): tomar o dano de 1 aliado adjacente no seu lugar. Item Único.",
    },
    {
      id: "dedo_decepado",
      nome: "Dedo Decepado",
      tipoBonus: "escolhaElemento", 
      categoria: 2,
      espacos: 1,
      descricao: "(Varia) Vestimenta. Concede 1 Poder Paranormal. 25% chance de não recuperar PV/PE/SAN ao descansar.",
    },
    {
      id: "selo_paranormal",
      nome: "Selo Paranormal",
      tipoBonus: "escolhaElemento", 
      categoria: "Varia",
      espacos: 1,
      descricao: "(Varia) Contém 1 ritual. Ação padrão para conjurar. Requer teste de Ocultismo (DT 20 + Custo PE) se não conhecer. Consumido. Categoria = Círculo do Ritual.",
    },
  ],

  // (MANTIDO) 'periciasPorOrigem' é USADO PELO CONTADOR
   periciasPorOrigem: {
    academico: { fixas: ["ciencias", "investigacao"], escolhas: [] },
    agente_saude: { fixas: ["intuicao", "medicina"], escolhas: [] },
    amnesico: {
      fixas: [],
      escolhas: [
        {
          titulo: "Perícias de Origem (Amnésico)",
          descricao:
            "Você não se lembra de nada, mas seu corpo sim. Escolha 2 perícias.",
          grupo: "listaCompletaPericias",
          quantidade: 2,
        },
      ],
    },
    artista: { fixas: ["artes", "enganacao"], escolhas: [] },
    atleta: { fixas: ["acrobacia", "atletismo"], escolhas: [] },
    chef: { fixas: ["fortitude", "profissao"], escolhas: [] },
    criminoso: { fixas: ["crime", "furtividade"], escolhas: [] },
    cultista_arrependido: { fixas: ["ocultismo", "religiao"], escolhas: [] },
    desgarrado: {
      fixas: [],
      escolhas: [
        {
          titulo: "Perícias de Origem (Desgarrado)",
          descricao: "Você aprendeu a se virar. Escolha 2 perícias.",
          grupo: "listaCompletaPericias",
          quantidade: 2,
        },
      ],
    },
    engenheiro: { fixas: ["profissao", "tecnologia"], escolhas: [] },
    executivo: { fixas: ["diplomacia", "intimidacao"], escolhas: [] },
    investigador: { fixas: ["investigacao", "percepcao"], escolhas: [] },
    lutador: { fixas: ["luta", "reflexos"], escolhas: [] },
    magnata: { fixas: ["diplomacia", "pilotagem"], escolhas: [] },
    militar: { fixas: ["pontaria", "tatica"], escolhas: [] },
    policial: { fixas: ["percepcao", "pontaria"], escolhas: [] },
    religioso: { fixas: ["religiao", "vontade"], escolhas: [] },
    servidor_publico: { fixas: ["intuicao", "vontade"], escolhas: [] },
    teorico_conspiracao: { fixas: ["investigacao", "ocultismo"], escolhas: [] },
    ti: { fixas: ["investigacao", "tecnologia"], escolhas: [] },
    trabalhador_rural: {
      fixas: ["adestramento", "sobrevivencia"],
      escolhas: [],
    },
    universitario: { fixas: ["atualidades", "investigacao"], escolhas: [] },
    vitima: { fixas: ["reflexos", "vontade"], escolhas: [] },
    amigo_animais: { fixas: ["adestramento", "percepcao"], escolhas: [] },
    astronauta: { fixas: ["ciencias", "fortitude"], escolhas: [] },
    chef_outro_lado: { fixas: ["ocultismo", "profissao"], escolhas: [] },
    colegial: { fixas: ["atualidades", "tecnologia"], escolhas: [] },
    cosplayer: { fixas: ["artes", "vontade"], escolhas: [] },
    diplomata: { fixas: ["atualidades", "diplomacia"], escolhas: [] },
    explorador: { fixas: ["fortitude", "sobrevivencia"], escolhas: [] },
    experimento: { fixas: ["atletismo", "fortitude"], escolhas: [] },
    fanatico_criaturas: { fixas: ["investigacao", "ocultismo"], escolhas: [] },
    fotografo: { fixas: ["artes", "percepcao"], escolhas: [] },
    inventor_paranormal: { fixas: ["profissao", "vontade"], escolhas: [] },
    jovem_mistico: { fixas: ["ocultismo", "religiao"], escolhas: [] },
    legista_noturno: { fixas: ["ciencias", "medicina"], escolhas: [] },
    mateiro: { fixas: ["percepcao", "sobrevivencia"], escolhas: [] },
    mergulhador: { fixas: ["atletismo", "fortitude"], escolhas: [] },
    motorista: { fixas: ["pilotagem", "reflexos"], escolhas: [] },
    nerd_entusiasta: { fixas: ["ciencias", "tecnologia"], escolhas: [] },
    profetizado: {
      fixas: ["vontade"],
      escolhas: [
        {
          titulo: "Perícia de Origem (Profetizado)",
          descricao: "Escolha 1 perícia relacionada à sua premonição.",
          grupo: "listaCompletaPericias",
          quantidade: 1,
        },
      ],
    },
    psicologo: { fixas: ["intuicao", "profissao"], escolhas: [] },
    reporter_investigativo: {
      fixas: ["atualidades", "investigacao"],
      escolhas: [],
    },
  },
  
  // A lista de rituais permanece a mesma
  


// A EXPORTAÇÃO FINAL DEVE INCLUIR TUDO:


  rituais: [
    // ---------- CÍRCULO 1: SANGUE ----------
    {
      id: "arma_atroz",
      nome: "Arma Atroz",
      elemento: "Sangue",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 arma corpo a corpo",
      duracao: "Sustentada",
      resistencia: "",
      descricao:
        "A arma é recoberta por veias carmesim e passa a exalar uma aura de violência. Ela fornece +2 em testes de ataque e +1 na margem de ameaça.",
      discente:
        "+2 PE: muda o bônus para +5 em testes de ataque. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda o bônus para +5 em testes de ataque e +2 na margem de ameaça e no multiplicador de crítico. Requer 3º círculo e afinidade.",
    },
    {
      id: "armadura_de_sangue",
      nome: "Armadura de Sangue",
      elemento: "Sangue",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Seu sangue escorre para fora do corpo, cobrindo-o sob a forma de uma carapaça que fornece +5 em Defesa. Esse bônus é cumulativo com outros rituais, mas não com bônus fornecido por equipamento.",
      discente:
        "+5 PE: muda o efeito para “fornece +10 na Defesa e resistência a balístico, corte, impacto e perfuração 5”. Requer 3º círculo.",
      verdadeiro:
        "+9 PE: muda o efeito para “fornece +15 na Defesa e resistência a balístico, corte, impacto e perfuração 10”. Requer 4º círculo e afinidade.",
    },
    {
      id: "corpo_adaptado",
      nome: "Corpo Adaptado",
      elemento: "Sangue",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 pessoa ou animal",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Este ritual modifica a biologia do alvo para permitir a sobrevivência em ambientes hostis. O alvo fica imune a calor e frio extremos, pode respirar na água se respirar ar (ou vice-versa) e não sufoca em fumaça densa.",
      discente: "+2 PE: muda a duração para 1 dia.",
      verdadeiro:
        "+5 PE: muda o alcance para “curto” e o alvo para “pessoas ou animais escolhidos”.",
    },
    {
      id: "distorcer_aparencia",
      nome: "Distorcer Aparência",
      elemento: "Sangue",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena",
      resistencia: "Vontade desacredita",
      descricao:
        "Você modifica sua aparência de modo a parecer outra pessoa. Isso inclui altura, peso, tom de pele, cor de cabelo, timbre de voz, impressão digital, córnea etc. Você recebe +10 em testes de Enganação para disfarce, mas não recebe habilidades da nova forma nem modifica suas demais estatísticas.",
      discente:
        "+2 PE: muda o alcance para “curto” e o alvo para “1 ser”. Um alvo involuntário pode anular o efeito com um teste de Vontade.",
      verdadeiro:
        "+5 PE: como em Discente, mas muda o alvo para “seres escolhidos”. Requer 3º círculo.",
    },
    {
      id: "fortalecimento_sensorial",
      nome: "Fortalecimento Sensorial",
      elemento: "Sangue",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Você potencializa seus sentidos, recebendo +1d20 em Investigação, Luta, Percepção e Pontaria.", // O "O" no livro-texto foi interpretado como 1d20
      discente:
        "+2 PE: além do normal, seus inimigos sofrem –1d20 em testes de ataque contra você. Requer 2º círculo.", // O "O" no livro-texto foi interpretado como 1d20
      verdadeiro:
        "+5 PE: além do normal, você apura seus sentidos para perceber qualquer perigo. Você fica imune às condições surpreendido e desprevenido e recebe +10 em Defesa e Reflexo. Requer 4º círculo e afinidade.",
    },
    {
      id: "odio_incontrolavel",
      nome: "Ódio Incontrolável",
      elemento: "Sangue",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 pessoa",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "O alvo entra em um frenesi, aumentando sua agressividade e capacidade de luta. Ele recebe +2 em testes de ataque e rolagens de dano corpo a corpo e resistência a balístico, corte, impacto e perfuração 5. Enquanto o efeito durar, o alvo não pode fazer nenhuma ação que exige calma e concentração (como usar a perícia Furtividade ou conjurar rituais), e deve sempre atacar um alvo em sua rodada, mesmo que seja um aliado se ele for o único a seu alcance.",
      discente:
        "+2 PE: além do normal, sempre que o alvo usar a ação agredir, pode fazer um ataque corpo a corpo adicional contra o mesmo alvo.",
      verdadeiro:
        "+5 PE: muda o bônus de ataque e dano para +5 e o alvo passa a sofrer apenas metade do dano dos tipos balístico, corte, impacto e perfuração. Requer 3º círculo e afinidade.",
    },
    {
      id: "esfolar",
      nome: "Esfolar",
      elemento: "Sangue",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "Reflexos parcial",
      descricao:
        "Você usa seu corpo como passagem para o Sangue, projetando agulhas e lâminas rubras praticamente imperceptíveis que se projetam contra o alvo. O ser sofre 3d4+3 pontos de dano de corte e fica sangrando. Se passar no teste de resistência, sofre apenas metade do dano e evita a condição.",
      discente:
        "+2 PE: muda o alcance para médio, o dano para 5d4+5 e o alvo para explosão com 6m de raio. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda o alcance para longo, o dano para 10d4+10 e o alvo para explosão com 6m de raio. Passar no teste de resistência não evita a condição. Requer 3º círculo.",
    },

    // ---------- CÍRCULO 1: MORTE ----------
    {
      id: "cicatrizacao_morte",
      nome: "Cicatrização",
      elemento: "Morte",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Você acelera o tempo ao redor das feridas do alvo, que cicatrizam instantaneamente. O alvo recupera 3d8+3 PV, mas envelhece 1 ano automaticamente.",
      discente:
        "+2 PE: aumenta a cura para 5d8+5 PV. Requer 2º círculo.",
      verdadeiro:
        "+9 PE: muda o alcance para “curto”, o alvo para “seres escolhidos” e aumenta a cura para 7d8+7 PV. Requer 4º círculo e afinidade com Morte.",
    },
    {
      id: "consumir_manancial",
      nome: "Consumir Manancial",
      elemento: "Morte",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Você suga uma pequena porção do tempo de vida de plantas, insetos e até mesmo do solo ao redor, gerando lodo e recebendo 3d6 pontos de vida temporários. Os PV temporários desaparecem ao final da cena.",
      discente:
        "+2 PE: muda os PV temporários recebidos para 6d6. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda o alvo para “área: esfera com 6m de raio centrada em você” e a resistência para “Fortitude reduz à metade”. Em vez do normal, você suga energia de todos os seres vivos na área, causando 3d6 pontos de dano de Morte em cada um e recebendo PV temporários iguais ao dano total causado até o final da cena. Requer 3º círculo e afinidade.",
    },
    {
      id: "decadencia",
      nome: "Decadência",
      elemento: "Morte",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "Fortitude reduz à metade",
      descricao:
        "Espirais de trevas envolvem sua mão e definham o alvo, que sofre 2d8+2 pontos de dano de Morte.",
      discente:
        "+2 PE: muda a resistência para “nenhuma” e o dano para 3d8+3. Como parte da execução do ritual, você transfere as espirais para uma arma e faz um ataque corpo a corpo contra o alvo com esta arma. Se acertar, causa o dano da arma e do ritual, somados.",
      verdadeiro:
        "+5 PE: muda o alcance para “pessoal” o alvo para “área: explosão com 6m de raio” e o dano para 8d8+8. As espirais afetam todos os seres na área. Requer 3º círculo.",
    },
    {
      id: "definhar",
      nome: "Definhar",
      elemento: "Morte",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Cena",
      resistencia: "Fortitude parcial",
      descricao:
        "Você dispara uma lufada de cinzas que drena as forças do alvo. O alvo fica fatigado. Se passar no teste de resistência, em vez disso fica vulnerável.",
      discente:
        "+2 PE: em vez do normal, o alvo fica exausto. Se passar na resistência, fica fatigado. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: como discente, mas muda o alvo para “até 5 seres”. Requer 3º círculo e afinidade com Morte.",
    },
    {
      id: "espirais_da_perdicao",
      nome: "Espirais da Perdição",
      elemento: "Morte",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Cena",
      resistencia: "", // O texto não menciona resistência
      descricao:
        "Espirais surgem no corpo do alvo, tornando seus movimentos lentos. O alvo sofre –1d20 em testes de ataque.", // O "O" no livro-texto foi interpretado como 1d20
      discente:
        "+2 PE: muda a penalidade para –2d20. Requer 2º círculo.", // O "O" no livro-texto foi interpretado como 2d20
      verdadeiro:
        "+8 PE: muda a penalidade para –2d20 e o alvo para “seres escolhidos”. Requer 3º círculo.", // O "O" no livro-texto foi interpretado como 2d20
    },
    {
      id: "nuvem_de_cinzas",
      nome: "Nuvem de Cinzas",
      elemento: "Morte",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      efeito: "Nuvem com 6m de raio e 6m de altura",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Uma nuvem de fuligem espessa eleva-se de um ponto a sua escolha, obscurecendo toda a visão — seres a até 1,5m têm camuflagem e seres a partir de 3m têm camuflagem total. Um vento forte dispersa a nuvem em 4 rodadas e um vendaval a dispersa em 1 rodada. A nuvem não funciona sob a água.",
      discente:
        "+2 PE: você pode escolher seres no alcance ao conjurar o ritual; eles enxergam através do efeito. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: além do normal, a nuvem fica espessa, quase sólida. Qualquer ser dentro dela tem seu deslocamento reduzido para 3m (independentemente de seu deslocamento normal) e sofre –2 em testes de ataque. Requer 3º círculo.",
    },
    {
      id: "apagar_as_luzes",
      nome: "Apagar as Luzes",
      elemento: "Morte",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Ao conjurar esse ritual, qualquer fonte de luz em alcance curto de você, natural ou paranormal, se apaga (criando um ambiente de penumbra ou escuridão). O efeito é instantâneo, mas permanece mantendo a escuridão, pelo menos, até o fim da cena. Você, por outro lado, recebe visão no escuro, até o fim da cena.",
      discente:
        "+2 PE: muda o alcance para determinar fontes de luz afetadas para longo. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: como Discente, e além de você, até cinco outros seres dentro desse alcance recebem visão no escuro. Requer 3º círculo.",
    },

    // ---------- CÍRCULO 1: ENERGIA ----------
    {
      id: "amaldicoar_tecnologia",
      nome: "Amaldiçoar Tecnologia",
      elemento: "Energia",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 acessório ou arma de fogo",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Você imbui o alvo com Energia, fazendo-o funcionar acima de sua capacidade. O item recebe uma modificação a sua escolha.",
      discente:
        "+2 PE: muda para duas modificações. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda para três modificações. Requer 3º círculo e afinidade.",
    },
    {
      id: "coincidencia_forcada",
      nome: "Coincidência Forçada",
      elemento: "Energia",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Você manipula os caminhos do caos para que o alvo tenha mais sorte. O alvo recebe +2 em testes de perícias.",
      discente:
        "+2 PE: muda o alvo para aliados à sua escolha. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda o alvo para aliados à sua escolha e o bônus para +5. Requer 3º círculo e afinidade.",
    },
    {
      id: "eletrocucao",
      nome: "Eletrocussão",
      elemento: "Energia",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser ou objeto",
      duracao: "Instantânea",
      resistencia: "Fortitude parcial",
      descricao:
        "Você manifesta e dispara uma corrente elétrica contra o alvo, que sofre 3d6 pontos de dano de eletricidade e fica vulnerável por uma rodada. Se passar no teste de resistência, sofre apenas metade do dano e evita a condição. Se usado contra objetos eletrônicos, este ritual causa o dobro de dano e ignora resistência.",
      discente:
        "+2 PE: muda o alvo para “área: linha de 30m”. Você dispara um poderoso raio que causa 6d6 pontos de dano de Energia em todos os seres e objetos livres na área. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda a área para “alvos escolhidos”. Em vez do normal, você dispara vários relâmpagos, um para cada alvo escolhido, causando 8d6 pontos de dano de Energia em cada. Requer 3º círculo.",
    },
    {
      id: "embaralhar",
      nome: "Embaralhar",
      elemento: "Energia",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Você cria três cópias ilusórias suas, como hologramas extremamente realistas. As cópias ficam ao seu redor e imitam suas ações. Você recebe +6 na Defesa. Cada vez que um ataque contra você erra, uma das imagens desaparece e o bônus na Defesa diminui em 2. Um oponente deve ver as cópias para ser confundido.",
      discente:
        "+2 PE: muda o número de cópias para 5 (e o bônus na Defesa para +10). Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda o número de cópias para 8 (e o bônus na Defesa para +16). Além do normal, toda vez que uma cópia é destruída, emite um clarão de luz. O ser que destruiu a cópia fica ofuscada por uma rodada. Requer 3º círculo.",
    },
    {
      id: "luz",
      nome: "Luz",
      elemento: "Energia",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 objeto",
      duracao: "Cena",
      resistencia: "Vontade anula (veja texto)",
      descricao:
        "O alvo emite luz de cores alternadas e brilhantes (mas não produz calor) em uma área com 9m de raio. O objeto pode ser guardado para interromper a luz. Se o alvo for um objeto em posse de uma pessoa involuntária, ela tem direito a um teste de Vontade para anular o efeito.",
      discente:
        "+2 PE: muda o alcance para longo e o efeito para 4 esferas brilhantes. Cria esferas flutuantes de pura luz (10cm), que você pode posicionar onde quiser. Você pode mover as esferas com uma ação livre (1/rodada). Cada esfera ilumina 6m de raio. Se uma esfera ocupar o espaço de um ser, ele fica ofuscado e sua silhueta pode ser vista claramente (não recebe camuflagem por escuridão ou invisibilidade). Requer 2º círculo.",
      verdadeiro:
        "+5 PE: a luz é cálida como a do sol. Dentro da área seus aliados recebem +1d20 em testes de Vontade, e seus inimigos ficam ofuscados. Requer 3º círculo.", // O "O" no livro-texto foi interpretado como 1d20
    },
    {
      id: "polarizacao_caotica",
      nome: "Polarização Caótica",
      elemento: "Energia",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "Você",
      duracao: "Sustentada",
      resistencia: "Vontade anula",
      descricao:
        "Você gera uma aura magnética sobrenatural. Escolha um dos efeitos a seguir. \nAtrair: você pode usar uma ação de movimento para puxar um objeto metálico de espaço 2 ou menor dentro do alcance. Se o objeto estiver livre, voa para suas mãos ou pés. \nRepelir: você repele objetos de espaço 2 ou menor, recebendo resistência a balístico, corte, impacto e perfuração 5.",
      discente:
        "+2 PE: A energia é expelida de uma única vez e arremessa até 10 objetos (ou 10 espaços). Objetos arremessados podem atin gir seres (dano 1 a 1d6 por espaço). Seres atingidos têm direito a um teste de Reflexos para reduzir o dano à metade. Seres podem ser arremessados (Vontade evita). Um ser arremessado contra uma superfície sólida sofre 1d6 de dano de impacto para cada 3m.",
      verdadeiro:
        "+5 PE: muda o alcance para médio. Você pode usar uma ação de movimento para levitar e mover um ser ou objeto (espaço 10 ou menor) por até 9m. Um ser pode anular o efeito sobre ele (Vontade).",
    },
    {
      id: "overclock",
      nome: "Overclock",
      elemento: "Energia",
      circulo: 1,
      execucao: "Reação",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Ao fazer um teste de Tecnologia para lidar com um objeto eletrônico, você pode, após saber o resultado, conjurar este ritual para receber as informações que buscava de outra forma (ex: jogo de 'estátua' com o mestre). Se não falhar no 'jogo' até o fim, é bem-sucedido. Contudo, após o uso, o objeto é tomado por um 'vírus paranormal' e seu uso se torna impossível.",
      discente:
        "+2 PE: você só falha no teste se errar duas vezes no jogo. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: você só falha no teste se errar três vezes no jogo. Requer 3º círculo.",
    },

    // ---------- CÍRCULO 1: CONHECIMENTO ----------
    {
      id: "compreensao_paranormal",
      nome: "Compreensão Paranormal",
      elemento: "Conhecimento",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser ou objeto",
      duracao: "Cena",
      resistencia: "Vontade anula (veja texto)",
      descricao:
        "O ritual confere compreensão sobrenatural da linguagem. Se tocar um objeto contendo informação, você entende as palavras (idiomas humanos). Se tocar uma pessoa, pode se comunicar com ela. Se tocar um ser não inteligente, pode perceber seus sentimentos básicos. Um alvo involuntário tem direito a um teste de Vontade.",
      discente:
        "+2 PE: muda o alcance para “curto” e o alvo para “alvos escolhidos”. Você pode entender todos os alvos afetados. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda o alcance para “pessoal” e o alvo para “você”. Em vez do normal, você pode falar, entender e escrever qualquer idioma humano. Requer 3º círculo.",
    },
    {
      id: "enfeiticar",
      nome: "Enfeitiçar",
      elemento: "Conhecimento",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 pessoa",
      duracao: "Cena",
      resistencia: "Vontade anula",
      descricao:
        "Este ritual torna o alvo prestativo. Ele não fica sob seu controle, mas percebe suas palavras da maneira mais favorável possível. Você recebe +10 em testes de Diplomacia com ele. Um alvo hostil ou em combate recebe +5 no teste de resistência. Se você ou aliados tomarem ação hostil, o efeito é dissipado.",
      discente:
        "+2 PE: em vez do normal, você sugere uma ação (que pareça aceitável) para o alvo e ele obedece. Quando o alvo executa a ação, o efeito termina. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: afeta todos os alvos dentro do alcance. Requer 3º círculo.",
    },
    {
      id: "ouvir_os_sussurros",
      nome: "Ouvir os Sussurros",
      elemento: "Conhecimento",
      circulo: 1,
      execucao: "Completa",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Você consulta os sussurros para receber conhecimento sobre uma ação na mesma cena. Faça uma pergunta de “sim” ou “não”. O mestre rola 1d6 (secreto): 2-6, você recebe a resposta (“sim”, “não” ou “sim e não”); 1, o ritual falha e dá a resposta “não”. Lançar múltiplas vezes sobre o mesmo assunto gera sempre o primeiro resultado.",
      discente:
        "+2 PE: execução 1 minuto. Pergunta sobre um evento até um dia no futuro. 2-6 (d6), recebe uma pista (frase, profecia); 1 (d6), não recebe resposta. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: execução 10 minutos, duração 5 rodadas. Pode fazer uma pergunta (sim/não/ninguém sabe) por rodada. Chance de falha (resposta “ninguém sabe”) para cada pergunta. Requer 3º círculo.",
    },
    {
      id: "perturbacao",
      nome: "Perturbação",
      elemento: "Conhecimento",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 pessoa",
      duracao: "1 rodada",
      resistencia: "Vontade anula",
      descricao:
        "Você dá uma ordem (que o alvo deve ouvir). Se falhar, obedece. Escolha um: \nFuja: Gasta o turno se afastando de você. \nLargue: Solta itens (ação livre) e não pode pegá-los. \nPare: Fica pasmo. \nSente-se: Senta no chão (ação livre) e não pode se levantar. \nVenha: Gasta o turno se aproximando de você.",
      discente:
        "+2 PE: muda o alvo para “1 ser” e adiciona: “Sofra. O alvo sofre 3d8 pontos de dano de Conhecimento e fica abalado por uma rodada”.",
      verdadeiro:
        "+5 PE: muda o alvo para “até 5 seres” OU adiciona: “Ataque. O alvo deve fazer a ação agredir contra outro alvo à sua escolha em alcance médio”. Requer 3º círculo e afinidade.",
    },
    {
      id: "tecer_ilusao",
      nome: "Tecer Ilusão",
      elemento: "Conhecimento",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Médio",
      efeito: "Ilusão que se estende a até 4 cubos de 1,5m",
      duracao: "Cena",
      resistencia: "Vontade desacredita",
      descricao:
        "Cria uma ilusão visual (pessoa, parede) ou sonora (grito, uivo). Cria apenas imagens ou sons simples (volume de 1 pessoa por cubo). Não cria cheiros, texturas, temperaturas ou sons complexos. Seres e objetos atravessam a ilusão. A ilusão é dissipada se você sair do alcance.",
      discente:
        "+2 PE: muda o efeito para 8 cubos (1,5m) e duração para sustentada. Pode criar sons complexos, odores e sensações térmicas/táteis. Seres não atravessam sem passar num teste de Vontade. Pode mover/alterar a ilusão (ação livre). A ilusão persiste por 1 rodada após parar de sustentar. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: cria a ilusão de um perigo mortal. No início de cada turno seu, um alvo interagindo com a ilusão (Vontade) ou acredita ser real e sofre 6d6 dano de Conhecimento. Se passar em 2 testes seguidos, o efeito é anulado para ele. Requer 3º círculo.",
    },
    {
      id: "terceiro_olho",
      nome: "Terceiro Olho",
      elemento: "Conhecimento",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Seus olhos se enchem de sigilos e você passa a enxergar auras paranormais em alcance longo. Você sabe o elemento da aura e seu poder (Fraca: C1/VD até 80; Moderada: C2-3/VD 81-280; Poderosa: C4/VD 281+). Além disso, pode gastar uma ação de movimento para descobrir se um ser (alcance médio) tem poderes paranormais ou rituais (e quais elementos).",
      discente: "+2 PE: muda a duração para 1 dia.",
      verdadeiro:
        "+5 PE: também pode enxergar objetos e seres invisíveis (formas translúcidas).",
    },
    {
      id: "desfazer_sinapses",
      nome: "Desfazer Sinapses",
      elemento: "Conhecimento",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "Vontade parcial",
      descricao:
        "A entidade do Conhecimento inexiste neurônios no cérebro do alvo. O alvo sofre 2d6+2 pontos de dano de Conhecimento e fica frustrado por uma rodada. Se passar no teste de resistência, sofre apenas metade do dano e evita a condição. O alvo precisa ter um cérebro.",
      discente:
        "+2 PE: muda o alcance para longo, o dano para 3d6+3 e o alvo para até 5 seres a sua escolha. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda o alcance para extremo, o dano para 8d6+8 e a condição para esmorecido. Se passar no teste de resistência, em vez de esmorecido, fica frustrado. Requer 3º círculo.",
    },

    // ---------- CÍRCULO 1: MEDO ----------
    {
      id: "cineraria",
      nome: "Cinerária",
      elemento: "Medo",
      circulo: 1,
      execucao: "Padrão",
      alcance: "Curto",
      area: "Nuvem de 6m de raio",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Você manifesta uma névoa carregada de essência paranormal. Rituais conjurados dentro da névoa têm sua DT aumentada em +5.",
      discente:
        "+2 PE: além do normal, rituais conjurados dentro da névoa custam -2 PE.",
      verdadeiro:
        "+5 PE: além do normal, rituais conjurados dentro da névoa causam dano maximizado.",
    },

    // ---------- CÍRCULO 1: VARIA (Amaldiçoar Arma) ----------
    {
      id: "amaldicoar_arma",
      nome: "Amaldiçoar Arma",
      elemento: "Varia", // O jogador escolhe o elemento ao aprender
      circulo: 1,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 arma corpo a corpo ou pacote de munição",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Quando aprender este ritual, escolha um elemento entre Conhecimento, Energia, Morte e Sangue. Este ritual passa a ser do elemento escolhido. Você imbui a arma ou munições com o elemento, fazendo com que causem +1d6 de dano do tipo do elemento.",
      discente:
        "+2 PE: muda o bônus de dano para +2d6. Requer 2º círculo.",
      verdadeiro:
        "+5 PE: muda o bônus de dano para +4d6. Requer 3º círculo e afinidade.",
    },
    // ---------- CÍRCULO 2: SANGUE ----------
    {
      id: "aprimorar_fisico",
      nome: "Aprimorar Físico",
      elemento: "Sangue",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "O alvo tem seus músculos tonificados e seus ligamentos reforçados, recebendo +1 em Agilidade ou Força, à escolha dele.",
      discente: "+3 PE: muda o bônus para +2. Requer 3º círculo.",
      verdadeiro:
        "+7 PE: muda o bônus para +3. Requer 4º círculo e afinidade.",
    },
    {
      id: "descarnar",
      nome: "Descarnar",
      elemento: "Sangue",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "Fortitude parcial",
      descricao:
        "Este ritual cruel faz com que lacerações se manifestem na pele e órgãos do alvo, que sofre 6d8 pontos de dano (metade corte, metade Sangue) e fica com uma hemorragia severa. No início de cada turno dele, o alvo deve fazer um teste de Fortitude. Se falhar, sofre 2d8 pontos de dano de Sangue. Se passar nesse teste dois turnos seguidos, a hemorragia é estancada. Alvos que passem no teste de resistência inicial sofrem metade do dano e não ficam com hemorragia.",
      discente:
        "+3 PE: muda o dano direto para 10d8 e o dano da hemorragia para 4d8. Requer 3º círculo.",
      verdadeiro:
        "+7 PE: muda o alvo para você e a duração para sustentada. Enquanto o ritual durar, seus ataques corpo a corpo causam 4d8 pontos de dano de Sangue adicional e deixam o alvo com hemorragia automaticamente (o alvo ainda tem direito a um teste de Fortitude). Requer 3º círculo e afinidade.",
    },
    {
      id: "flagelo_de_sangue",
      nome: "Flagelo de Sangue",
      elemento: "Sangue",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 pessoa",
      duracao: "Cena",
      resistencia: "Fortitude parcial",
      descricao:
        "Você toca uma pessoa, gravando uma marca escavada no corpo dela enquanto profere uma ordem (como “não ataque a mim ou meus aliados”, “siga-me” ou “não saia desta sala”). A cada rodada que o alvo desobedecer a ordem, a marca inflige dor excruciante, que causa 10d6 pontos de dano de Sangue e deixa o alvo enjoado pela rodada (Fortitude reduz o dano à metade e evita a condição). Se o alvo passar nesse teste dois turnos seguidos a marca desaparece.",
      discente:
        "+3 PE: muda o alvo para “1 ser (exceto criaturas de Sangue)”. Requer 3º círculo.",
      verdadeiro:
        "+7 PE: como Discente, e muda a duração para “1 dia”. Requer 4º círculo e afinidade.",
    },
    {
      id: "hemofagia",
      nome: "Hemofagia",
      elemento: "Sangue",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "Fortitude reduz à metade",
      descricao:
        "Você arranca o sangue do corpo do alvo através da pele dele, causando 6d6 pontos de dano de Sangue. Você então absorve esse sangue, recuperando pontos de vida iguais à metade do dano causado.",
      discente:
        "+3 PE: muda a resistência para “nenhuma”. Como parte da execução do ritual, você faz um ataque corpo a corpo contra o alvo. Se acertar, causa o dano do ataque e do ritual, recuperando PV em quantidade igual à metade do dano total causado.",
      verdadeiro:
        "+7 PE: muda o alcance para “pessoal”, o alvo para “você” e a duração para “cena”. Em vez do normal, a cada rodada você pode gastar uma ação padrão para tocar 1 ser e causar 4d6 pontos de dano de Sangue. Você recupera PV iguais à metade do dano causado. Requer 4º círculo.",
    },
    {
      id: "sede_de_adrenalina",
      nome: "Sede de Adrenalina",
      elemento: "Sangue",
      circulo: 2,
      execucao: "Reação",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Quando você falha em um teste de Acrobacia ou Atletismo, pode conjurar esse ritual para repetir esse teste, usando Presença no lugar do atributo base daquela perícia. Alternativamente, quando sofre dano de impacto, você pode usar esse ritual para reduzir esse dano em 20. Em qualquer caso, você só pode usar este ritual uma vez por rodada. Se usá-lo para reduzir dano, logo após o impacto o Sangue retorce seus ossos e tendões, fazendo com que você passe 1 rodada atordoado.",
      discente: "+3 PE: muda a redução de dano de impacto para 40.",
      verdadeiro:
        "+7 PE: muda a redução de dano de impacto para 70. Requer 4º círculo e afinidade.",
    },
    {
      id: "transfusao_vital",
      nome: "Transfusão Vital",
      elemento: "Sangue",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Você toca no alvo e transfere sua própria energia vital para ele, podendo sofrer até 30 pontos de dano de Sangue para que o alvo recupere a mesma quantidade em PV. Você não pode ficar com menos de 1 PV por causa desse ritual.",
      discente:
        "+3 PE: Você pode transferir até 50 pontos de vida. Requer 3º círculo.",
      verdadeiro:
        "+7 PE: Você pode transferir até 100 pontos de vida. Requer 4º círculo.",
    },

    // ---------- CÍRCULO 2: MORTE ----------
    {
      id: "desacelerar_impacto",
      nome: "Desacelerar Impacto",
      elemento: "Morte",
      circulo: 2,
      execucao: "Reação",
      alcance: "Curto",
      alvo: "1 ser ou objetos somando até 10 espaços",
      duracao: "Até chegar ao solo ou cena",
      resistencia: "",
      descricao:
        "O alvo cai lentamente. A velocidade da queda é reduzida para 18m por rodada — o suficiente para não causar dano. Pode ser conjurado para salvar a si ou um aliado de quedas inesperadas. Se o alvo for um projétil, o ritual faz com que ele cause metade do dano normal. Este ritual só funciona em alvos em queda livre.",
      discente:
        "+3 PE: aumenta o total de alvos para seres ou objetos somando até 100 espaços.",
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeira
    },
    {
      id: "eco_espiral",
      nome: "Eco Espiral",
      elemento: "Morte",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "2 rodadas",
      resistencia: "Fortitude reduz à metade",
      descricao:
        "Você manifesta uma pequena cópia do alvo feita de cinzas. No início do próximo turno, você precisa gastar uma ação padrão para se concentrar nele. No início do segundo turno, você precisa gastar uma ação padrão para descarregá-lo. Se fizer isso, a cópia explode e o alvo sofre dano de Morte igual a quantidade de dano que sofreu na rodada em que você se concentrou (Fortitude reduz à metade). Se não fizer, o ritual se dissipa.",
      discente: "+3 PE: muda o alvo para “até 5 seres”.",
      verdadeiro:
        "+7 PE: muda a duração para “até 3 rodadas”, permitindo que você se concentre nas duas primeiras e descarregue na terceira. Requer 4º círculo e afinidade.",
    },
    {
      id: "lingua_morta",
      nome: "Língua Morta",
      elemento: "Morte",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 cadáver",
      duracao: "Sustentada",
      resistencia: "",
      descricao:
        "Ao preparar um cadáver humano e conjurar esse ritual, o Lodo da Morte se espalha por dentro do cadáver, reanimando-o forçadamente. O cadáver é capaz de responder uma pergunta por rodada em que você mantém o ritual sustentado, até o limite de três rodadas. Ao final da terceira resposta, o cadáver é consumido pela Morte e se transforma em um esqueleto de Lodo. A clareza das respostas depende do estado do cadáver.",
      discente:
        "+3 PE: aumenta o limite para quatro rodadas. Ao final da quarta rodada, o cadáver se transforma em um enraizado.",
      verdadeiro:
        "+7 PE: aumenta o limite para cinco rodadas. Requer 4º círculo e afinidade. Ao final da quinta rodada, o cadáver se transforma em uma marionete.",
    },
    {
      id: "miasma_entropico",
      nome: "Miasma Entrópico",
      elemento: "Morte",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Médio",
      area: "Nuvem com 6m de raio",
      duracao: "Instantânea",
      resistencia: "Fortitude parcial (veja texto)",
      descricao:
        "Cria uma explosão de emanações tóxicas. Seres na área sofrem 4d8 pontos de dano químico e ficam enjoados por 1 rodada. Se passarem na resistência, sofrem metade do dano e não ficam enjoados.",
      discente: "+3 PE: muda o dano para 6d8 de Morte.",
      verdadeiro:
        "+7 PE: muda a duração para 3 rodadas. Um ser que inicie seu turno dentro da área sofre o dano novamente. Requer 3º círculo.",
    },
    {
      id: "paradoxo",
      nome: "Paradoxo",
      elemento: "Morte",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Médio",
      area: "Esfera com 6m de raio",
      duracao: "Instantânea",
      resistencia: "Fortitude reduz à metade",
      descricao:
        "O ritual cria uma poderosa implosão de distorção temporal contraditória, causando 6d6 pontos de dano de Morte em todos os seres na área.",
      discente:
        "+3 PE: muda a área para “efeito: esfera com tamanho Médio” e a duração para cena. Em vez do normal, cria uma esfera de emanações espirais (1,5m de diâmetro) que causa 4d6 pontos de dano de Morte a qualquer ser no mesmo espaço. Você pode gastar uma ação de movimento para fazer a esfera voar 9m. Um ser só pode sofrer dano da esfera uma vez por rodada.",
      verdadeiro:
        "+7 PE: muda o dano para 13d6. Seres reduzidos a 0 PV pelo dano do Paradoxo devem fazer um teste de Fortitude. Se falharem, são reduzidas a cinzas (morrem imediatamente). Requer 4º círculo.",
    },
    {
      id: "velocidade_mortal",
      nome: "Velocidade Mortal",
      elemento: "Morte",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Sustentada",
      resistencia: "",
      descricao:
        "Você distorce a passagem do tempo ao redor do alvo, tornando-o extremamente veloz. O alvo pode realizar uma ação de movimento adicional por turno. Esta ação não pode ser usada para conjurar rituais.",
      discente:
        "+3 PE: em vez de uma ação de movimento, o alvo recebe uma ação padrão adicional por turno.",
      verdadeiro:
        "+7 PE: muda o alvo para “alvos escolhidos”. Requer 4º círculo e afinidade.",
    },

    // ---------- CÍRCULO 2: ENERGIA ----------
    {
      id: "chamas_do_caos",
      nome: "Chamas do Caos",
      elemento: "Energia",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "Veja texto",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Você manipula o calor e o fogo. Ao conjurar o ritual, escolha um dos seguintes efeitos: \nChamejar: o alvo é uma arma corpo a corpo. Ela causa +1d6 pontos de dano de fogo. \nEsquentar: o alvo é um objeto, que começa a esquentar. Ele sofre 1d6 pontos de dano de fogo por rodada e causa o mesmo dano a qualquer ser que o esteja empunhando ou vestindo. \nExtinguir: o alvo é uma chama (Tamanho Grande ou menor), que é apagada. Isso cria uma nuvem de fumaça (esfera 3m de raio) onde seres têm camuflagem. \nModelar: o alvo é uma chama (Tamanho Grande ou menor). A cada rodada, você pode gastar uma ação livre para movimentá-la 9m. Se atravessar o espaço de um ser, ela causa 3d6 de dano de fogo (limite 1 vez/rodada).",
      discente:
        "+3 PE: muda a duração para sustentada e adiciona “Resistência: Reflexos reduz à metade”. Em vez do normal, uma vez por rodada você pode gastar uma ação de movimento para projetar uma labareda, num alvo em alcance curto. O alvo sofre 4d6 pontos de dano de Energia (Reflexos reduz à metade).",
      verdadeiro:
        "+7 PE: como discente, mas muda o dano para 8d6. Requer 3º círculo.",
    },
    {
      id: "contencao_fantasmagorica",
      nome: "Contenção Fantasmagórica",
      elemento: "Energia",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Médio",
      alvo: "1 ser",
      duracao: "Cena",
      resistencia: "Reflexos anula",
      descricao:
        "Três laços de Energia surgem do chão e se enroscam no alvo, deixando-o agarrado. O alvo pode tentar se livrar (ação padrão, teste de Atletismo DT do ritual). Se passar, destrói um laço (+1 laço a cada 5 pontos acima da DT). Os laços podem ser atacados (Defesa 10, 10 PV, RD 5, imune a Energia). Se todos os laços forem destruídos, o ritual é dissipado. Os laços afetam criaturas incorpóreas.",
      discente:
        "+3 PE: aumenta o número de laços para 6, e você pode escolher o alvo de cada laço (mínimo 2 laços/alvo). Requer 3º círculo.",
      verdadeiro:
        "+5 PE: como discente, e cada laço destruído libera uma onda de choque que causa 2d6+2 pontos de dano de Energia no alvo agarrado. Requer 3º círculo e afinidade.",
    },
    {
      id: "dissonancia_acustica",
      nome: "Dissonância Acústica",
      elemento: "Energia",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Médio",
      area: "Esfera com 6m de raio",
      duracao: "Sustentada",
      resistencia: "",
      descricao:
        "Você manipula a vibração do ar, criando uma área de dissonância sonora. Enquanto estiverem na área, todos os seres ficam surdos. Essa dissonância impede que seres dentro da área conjurem rituais.",
      discente:
        "+1 PE: muda a área para “alvo: 1 objeto”. Em vez do normal, o alvo emana uma área de silêncio com 3m de raio. Se conjurar num objeto de um ser involuntário, ele tem direito a um teste de Vontade para anulá-lo.",
      verdadeiro:
        "+3 PE: muda a duração para cena. Em vez do normal, nenhum som pode deixar a área, mas seres dentro da área podem falar, ouvir e conjurar rituais normalmente. Requer 3º círculo.",
    },
    {
      id: "sopro_do_caos",
      nome: "Sopro do Caos",
      elemento: "Energia",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Médio",
      area: "Varia",
      duracao: "Sustentada",
      resistencia: "Veja texto",
      descricao:
        "Você altera os movimentos de massas de ar. Escolha um dos efeitos: \nAscender: cria uma corrente de ar ascendente (ergue 1 ser ou objeto Médio). Você pode gastar uma ação de movimento para subir ou descer o alvo até 6m (máx 30m altura). Um ser levitando fica vulnerável. Alvos involuntários (Fortitude no início do turno) para encerrar o efeito. \nSopro: cria uma lufada de vento (cone 4,5m). Faça uma manobra empurrar (use Ocultismo) contra alvos Médios ou menores. Também apaga chamas, dispersa vapores, etc. Manter exige ação padrão. \nVento: cria uma área de vento forte. Manter exige ação de movimento.",
      discente: "+3 PE: passa a afetar alvos Grandes.",
      verdadeiro: "+9 PE: passa a afetar alvos Enormes.",
    },
    {
      id: "tela_de_ruido",
      nome: "Tela de Ruído",
      elemento: "Energia",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Cria uma película de energia que recobre seu corpo. Você recebe 30 PV temporários, mas apenas contra dano balístico, de corte, de impacto ou de perfuração. Alternativamente, você pode conjurar como reação ao sofrer dano, recebendo resistência 15 apenas contra esse dano.",
      discente:
        "+3 PE: aumenta os PV temporário para 60 e a resistência para 30.",
      verdadeiro:
        "+7 PE: muda o alcance para curto e o alvo para 1 ser ou objeto Enorme ou menor. Em vez do normal, cria uma esfera imóvel (tamanho do alvo) centrada nele. Nenhum ser, objeto ou efeito de dano pode passar pela esfera. O alvo (Reflexos) para evitar ser aprisionado. Requer 4º círculo.",
    },
    {
      id: "tremeluzir",
      nome: "Tremeluzir",
      elemento: "Energia",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Sustentada",
      resistencia: "",
      descricao:
        "Seu corpo pisca como um monitor oscilando. Você e seu equipamento são capazes de atravessar objetos sólidos. Para se mover através de cada objeto sólido, você deve gastar uma ação de movimento. Sempre que fizer isso, há 25% (1 em 1d4) de você não atravessar. Em cena de perseguição, permite usar 'cortar caminho' sem penalidade em Atletismo. Para cada rodada neste estado, você sofre 1d4 pontos de dano de Energia (ignora RD). Se terminar sua rodada dentro de um objeto sólido, sofre 1d4 dano de Energia adicional.",
      discente:
        "+3 PE: muda o alcance para toque e o alvo para 1 ser voluntário.",
      verdadeiro:
        "+7 PE: muda o alcance para curto e o alvo para até 5 seres voluntários. Requer 4º círculo.",
    },

    // ---------- CÍRCULO 2: CONHECIMENTO ----------
    {
      id: "aprimorar_mente",
      nome: "Aprimorar Mente",
      elemento: "Conhecimento",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "O alvo tem sua mente energizada. Ele recebe +1 em Intelecto ou Presença, à escolha dele (não fornece PE ou perícias treinadas).",
      discente: "+3 PE: muda o bônus para +2. Requer 3º círculo.",
      verdadeiro:
        "+7 PE: muda o bônus para +3. Requer 4º círculo e afinidade.",
    },
    {
      id: "deteccao_de_ameacas",
      nome: "Detecção de Ameaças",
      elemento: "Conhecimento",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Pessoal",
      area: "Esfera de 18m de raio",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Você recebe uma percepção aguçada sobre perigos. Quando um ser hostil ou armadilha entra na área, você tem uma sensação de perigo e pode gastar uma ação de movimento para fazer um teste de Percepção (DT 20). Se passar, sabe a direção e distância do perigo.",
      discente:
        "+3 PE: além do normal, você não fica desprevenido contra perigos detectados e recebe +5 em testes de resistência contra armadilhas. Requer 3º círculo.",
      verdadeiro:
        "+5 PE: muda a duração para “1 dia” e concede os mesmos benefícios de discente. Requer 4º círculo.",
    },
    {
      id: "esconder_dos_olhos",
      nome: "Esconder dos Olhos",
      elemento: "Conhecimento",
      circulo: 2,
      execucao: "Livre",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "1 rodada",
      resistencia: "",
      descricao:
        "Você fica invisível, incluindo seu equipamento, recebendo camuflagem total e +15 em testes de Furtividade. Seres que não possam vê-lo ficam desprevenidos contra seus ataques. O efeito termina se você faz um ataque ou usa uma habilidade hostil.",
      discente:
        "+3 PE: muda a duração para “sustentada”. Em vez do normal, você gera uma esfera de invisibilidade (3m de raio). Você e todos os aliados a até 3m de você se tornam invisíveis (ainda ficam visíveis se fizerem ação hostil). Requer 3º círculo.",
      verdadeiro:
        "+7 PE: muda a execução para “ação padrão”, o alcance para “toque”, o alvo para “1 ser” e a duração para “sustentada”. O efeito não é dissipado caso o alvo faça um ataque ou ação hostil. Requer 4º círculo e afinidade.",
    },
    {
      id: "invadir_mente",
      nome: "Invadir Mente",
      elemento: "Conhecimento",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Médio ou Toque",
      alvo: "1 ser ou 2 pessoas voluntárias",
      duracao: "Instantânea ou 1 dia",
      resistencia: "Vontade parcial ou Nenhuma",
      descricao:
        "Escolha um efeito: \nRajada Mental (Médio, 1 ser, Inst, Von parcial): Você infecta a mente do alvo. O alvo sofre 6d6 pontos de dano de Conhecimento e fica atordoado por uma rodada. Se passar no teste de Vontade, sofre metade do dano e não fica atordoado. Um mesmo alvo só pode ficar atordoado por este ritual uma vez por cena. \nLigação Telepática (Toque, 2 voluntárias, 1 dia, Nenhuma): Você cria um elo mental entre duas pessoas (você pode ser uma delas), que podem se comunicar independente da distância.",
      discente:
        "+3 PE: Se rajada mental, aumenta o dano para 10d6. Se ligação telepática, em vez do normal, você cria um elo mental que permite que você veja e ouça pelos sentidos do alvo (ação de movimento para concentrar). Um alvo involuntário (Vontade) para suprimir o ritual por uma hora. Requer 3º círculo.",
      verdadeiro:
        "+7 PE: Se rajada mental, aumenta o dano para 10d6 e muda o alvo para “seres escolhidos”. Se ligação telepática, você pode criar um vínculo mental entre até 5 pessoas.",
    },
    {
      id: "localizacao",
      nome: "Localização",
      elemento: "Conhecimento",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Pessoal",
      area: "Círculo com 90m de raio",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Encontra uma pessoa ou objeto (geral ou específico). O ritual indica a direção e distância da pessoa ou objeto mais próximo desse tipo, caso esteja ao alcance. Procurar algo muito específico exige uma imagem precisa do objeto. Pode ser bloqueado por chumbo.",
      discente:
        "+3 PE: muda o alcance para “toque”, o alvo para “1 pessoa” e a duração para “1 hora”. Em vez do normal, a pessoa tocada descobre o caminho mais direto para entrar ou sair de um lugar (não localiza pessoas/objetos).",
      verdadeiro:
        "+7 PE: aumenta a área para círculo de 1km de raio. Requer 4º círculo.",
    },
    {
      id: "aurora_da_verdade",
      nome: "Aurora da Verdade",
      elemento: "Conhecimento",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Curto",
      area: "Esfera com 3m de raio",
      duracao: "Sustentada",
      resistencia: "Vontade parcial",
      descricao:
        "Uma luz espectral surge na área. Qualquer ser dentro dessa área é obrigado a falar apenas a verdade, inclusive o conjurador. Se passar no teste de resistência, o ser pode mentir. Além disso, qualquer ser que tente se esconder, obter camuflagem ou ficar invisível dentro da luz é imediatamente revelado.",
      discente:
        "+3 PE: muda o alcance para médio e a área para esfera com 9m de raio e o conjurador não é mais afetado pelo efeito.",
      verdadeiro:
        "+7 PE: como discente, mas muda o alcance para longo e a duração para cena. Além disso, independentemente da distância, você pode ouvir tudo que é falado na área. Requer 4º círculo e afinidade.",
    },

    // ---------- CÍRCULO 2: MEDO ----------
    {
      id: "protecao_contra_rituais",
      nome: "Proteção contra Rituais",
      elemento: "Medo",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Você canaliza uma aura de Medo puro, que protege o alvo contra efeitos paranormais. O alvo recebe resistência a dano paranormal 5 e +5 em testes de resistência contra rituais e habilidades de criaturas paranormais.",
      discente:
        "+3 PE: muda o alvo para “até 5 seres tocados”. Requer 3º círculo.",
      verdadeiro:
        "+6 PE: muda o alvo para “até 5 seres tocados”, a resistência a dano para 10 e o bônus em testes de resistência para +10. Requer 4º círculo.",
    },
    {
      id: "rejeitar_nevoa",
      nome: "Rejeitar Névoa",
      elemento: "Medo",
      circulo: 2,
      execucao: "Padrão",
      alcance: "Curto",
      area: "Nuvem de 6m de raio",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Você manifesta um leve redemoinho de névoa. Rituais conjurados dentro da área têm seu custo aumentado em +2 PE por círculo e sua execução aumentada em um passo (livre -> movimento -> padrão -> completa -> 2 rodadas). Rejeitar a Névoa anula os efeitos de Cinerária (a menos que o conjurador de Cinerária use ação completa/rodada para manter).",
      discente:
        "+2 PE: além do normal, a DT de testes de resistência contra rituais realizados na área diminui em -5.",
      verdadeiro:
        "+5 PE: como discente, e o dano causado dentro da névoa por rituais é sempre mínimo.",
    },
    // ---------- CÍRCULO 3: SANGUE ----------
    {
      id: "ferver_sangue",
      nome: "Ferver Sangue",
      elemento: "Sangue",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Sustentada",
      resistencia: "Fortitude parcial",
      descricao:
        "O sangue do alvo aquece até entrar em ebulição. Quando o ritual é conjurado, e no início de cada turno do alvo, ele deve fazer um teste de Fortitude. Se falhar, sofre 4d8 pontos de dano de Sangue e fica fraco; se passar, sofre metade do dano e não fica fraco nesta rodada. Se o alvo passar nesse teste dois turnos seguidos o efeito termina.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro:
        "+4 PE: muda o alvo para “seres escolhidos”. Requer 4º círculo e afinidade.",
    },
    {
      id: "forma_monstruosa",
      nome: "Forma Monstruosa",
      elemento: "Sangue",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Seu corpo se transforma, assumindo uma forma que combina suas características com as de uma criatura de Sangue; suas roupas e proteção se mesclam à sua carne e quaisquer objetos em suas mãos se fundem aos seus braços, transformando-se em garras. Seu equipamento fica inacessível, mas seus bônus se mantém. Seu tamanho muda para Grande e você recebe +5 em testes de ataque e rolagens de dano corpo a corpo e 30 PV temporários. Enquanto estiver transformado, você não pode falar nem conjurar rituais e a cada rodada deve atacar o ser mais próximo possível. Se o ser mais próximo for um aliado, você pode fazer um teste de Vontade (DT do ritual). Se passar, neste turno você pode escolher qual ser atacar.",
      discente:
        "+3 PE: além do normal, você recebe imunidade a atordoamento, fadiga, sangramento, sono e veneno. Requer 3º círculo.", // Note que o discente aqui também é C3
      verdadeiro:
        "+9 PE: muda os bônus em testes de ataque e rolagens de dano para +10 e os PV temporários para 50. Requer 4º círculo e afinidade.",
    },
    {
      id: "purgatorio",
      nome: "Purgatório",
      elemento: "Sangue",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "Área de 6m de raio",
      duracao: "Sustentada",
      resistencia: "Fortitude parcial",
      descricao:
        "Você faz brotar uma poça de sangue pegajoso na área afetada. Inimigos na área se tornam vulneráveis a dano balístico, de corte, de impacto e de perfuração. Um alvo que tente sair da área sofre 6d6 pontos de dano de Sangue e deve fazer um teste de Fortitude. Se passar, consegue sair. Se falhar, a dor faz com que não consiga se mover e perca a ação de movimento.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "vomitar_pestes",
      nome: "Vomitar Pestes",
      elemento: "Sangue",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Médio",
      efeito: "1 enxame Grande (quadrado de 3m)",
      duracao: "Sustentada",
      resistencia: "Reflexos reduz à metade",
      descricao:
        "Você vomita um enxame de pequenas criaturas de Sangue. O enxame pode passar pelo espaço de outros seres. No final de cada um de seus turnos, o enxame causa 5d12 pontos de dano de sangue a qualquer ser no espaço dele (Reflexos reduz à metade). Você pode gastar uma ação de movimento para mover o enxame com deslocamento de 12m.",
      discente:
        "+2 PE: além do normal, um alvo que falhe no teste de Reflexos fica agarrado. O alvo pode gastar uma ação padrão e fazer um teste de Acrobacia ou Atletismo para escapar. Se você mover o enxame, o alvo fica livre.",
      verdadeiro:
        "+5 PE: o enxame vira Enorme (cubo de 6m de lado) e ganha deslocamento de voo 18m.",
    },
    {
      id: "odor_da_cacada",
      nome: "Odor da Caçada",
      elemento: "Sangue",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Seu nariz enruga e suas pupilas dilatam. Você recebe faro. Além disso, em uma cena de perseguição você recebe +5 nos testes de Atletismo e não perde PV pela ação de esforço extra (desde que o alvo emita odores). Na próxima cena, você está sob efeito de fome e sede (como se tivesse falhado no teste de Fortitude do primeiro dia).",
      discente:
        "+4 PE: muda o alcance para toque e o alvo para 1 ser.",
      verdadeiro:
        "+9 PE: muda o alcance para curto e o alvo para até 5 seres. Requer afinidade.",
    },

    // ---------- CÍRCULO 3: MORTE ----------
    {
      id: "ancora_temporal",
      nome: "Âncora Temporal",
      elemento: "Morte",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Cena",
      resistencia: "Vontade parcial",
      descricao:
        "Uma aura espiralada surge sobre o alvo. No início de cada turno dele, ele deve fazer um teste de Vontade. Se falhar, não poderá se deslocar naquele turno (ele ainda pode agir). Se o alvo passar nesse teste dois turnos seguidos o efeito termina.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro:
        "+4 PE: muda o alvo para “seres à sua escolha”. Requer 4º círculo.",
    },
    {
      id: "poeira_da_podridao",
      nome: "Poeira da Podridão",
      elemento: "Morte",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Médio",
      area: "Nuvem com 6m de raio",
      duracao: "Sustentada",
      resistencia: "Fortitude (veja texto)",
      descricao:
        "Você manifesta uma nuvem de poeira que apodrece os seres na área. Ao conjurar o ritual, e no início de cada um de seus turnos, seres e objetos na área sofrem 4d8 pontos de dano de Morte (Fortitude reduz à metade). Alvos que falharem no teste também não podem recuperar PV de nenhuma forma por uma rodada.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "+4 PE: muda o dano para 4d8+16.",
    },
    {
      id: "tentaculos_de_lodo",
      nome: "Tentáculos de Lodo",
      elemento: "Morte",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Médio",
      area: "Círculo com 6m de raio",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Uma fenda sombria se abre no chão, de onde surgem tentáculos de lodo. Ao conjurar o ritual e no início de cada um de seus turnos, você faz um teste da manobra agarrar (usando Ocultismo) contra cada alvo na área. Se você vencer, o ser é agarrado; se já estava agarrado, é esmagado, sofrendo 4d6 pontos de dano (metade impacto, metade Morte). A área conta como terreno difícil. Os tentáculos são imunes a dano.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro:
        "+5 PE: aumenta o raio da área para 9m e aumenta o dano dos tentáculos para 6d6.",
    },
    {
      id: "zerar_entropia",
      nome: "Zerar Entropia",
      elemento: "Morte",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 pessoa",
      duracao: "Cena",
      resistencia: "Vontade parcial",
      descricao:
        "Você zera completamente a entropia do alvo, deixando-o paralisado. Se passar na resistência, em vez disso fica lento. No início de cada um de seus turnos, o alvo pode gastar uma ação completa para fazer um novo teste de Vontade. Se passar, encerra o efeito.",
      discente: "+4 PE: muda o alvo para “1 ser”. Requer 4º círculo.",
      verdadeiro:
        "+11 PE: muda o alvo para “seres escolhidos”. Requer 4º círculo e afinidade.",
    },
    {
      id: "fedor_putrido",
      nome: "Fedor Pútrido",
      elemento: "Morte",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Sustentada",
      resistencia: "",
      descricao:
        "Você cobre seu corpo com o fedor da Morte, parando suas funções biológicas. Qualquer animal se afasta de você e você sofre –3d20 em Diplomacia. Você recebe +5 em Furtividade e +10 em testes de Enganação (fingir de morto). Em cena de furtividade, enquanto ficar parado, sua visibilidade é 1 ponto menor. Para cada rodada em que mantêm esse ritual, você sofre 1d4 pontos de dano de Morte (ignora RD).", // O "O" no livro-texto foi interpretado como d20
      discente:
        "+4 PE: muda o alcance para toque e o alvo para 1 ser voluntário.",
      verdadeiro:
        "+9 PE: muda o alcance para curto e o alvo para até 5 seres voluntários. Requer afinidade.",
    },

    // ---------- CÍRCULO 3: ENERGIA ----------
    {
      id: "convocacao_instantanea",
      nome: "Convocação Instantânea",
      elemento: "Energia",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Ilimitado",
      alvo: "1 objeto de até 2 espaços",
      duracao: "Instantânea",
      resistencia: "Vontade anula",
      descricao:
        "Você invoca um objeto de qualquer lugar para sua mão. O item deve ter sido previamente preparado com o símbolo do ritual. Se o objeto estiver sendo empunhado por outra pessoa, ela pode fazer um teste de Vontade para negar o efeito, mas você saberá onde o objeto está e quem o está carregando. Por até 1h depois da convocação, você pode gastar uma ação de movimento para enviar o objeto de volta.",
      discente:
        "+4 PE: muda o alvo para um objeto de até 10 espaços.",
      verdadeiro:
        "+9 PE: muda o alvo para “1 recipiente Médio (mala, caixote), com itens somando até 10 espaços” e a duração para “permanente”. Você encanta o recipiente para mantê-lo escondido no Outro Lado. Você pode convocá-lo (adjacente) ou enviá-lo de volta (ação padrão), usando uma miniatura do objeto. Quando conjura esta versão, você perde 1 PE permanentemente.",
    },
    {
      id: "salto_fantasma",
      nome: "Salto Fantasma",
      elemento: "Energia",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Médio",
      alvo: "Você",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Seu corpo se transforma momentaneamente em Energia pura e viaja até outro ponto. Você não precisa perceber nem ter linha de efeito ao seu destino, podendo imaginá-lo (desde que já tenha observado o local). Você não pode agir pelo resto do turno. Não permite aparecer dentro de um corpo sólido (ressurge na área vazia mais próxima).",
      discente:
        "+2 PE: muda a execução para reação. Em vez do normal, você salta para um espaço adjacente (1,5m), recebendo +10 na Defesa e em testes de Reflexos contra um ataque ou efeito.",
      verdadeiro:
        "+4 PE: muda o alcance para longo e o alvo para você e até dois outros seres voluntários que você esteja tocando.",
    },
    {
      id: "transfigurar_agua",
      nome: "Transfigurar Água",
      elemento: "Energia",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Longo",
      area: "Esfera com 30m de raio",
      duracao: "Cena",
      resistencia: "Veja texto",
      descricao:
        "Você canaliza Energia sobre um corpo de água. Escolha um dos efeitos: \nCongelar: água mundana na área é congelada. Seres nadando ficam imóveis (Atletismo DT do ritual para escapar). \nDerreter: gelo mundano vira água e o ritual termina. \nEnchente: eleva o nível da água em até 4,5m. Alternativamente, (alvo: 1 embarcação) recebe +6m em seu deslocamento. \nEvaporar: água e gelo mundano evaporam (instantâneo). Seres vivos na área sofrem 5d8 dano de Energia (Fortitude reduz à metade). Criaturas de Morte sofrem o dobro. \nPartir: diminui o nível da água em até 4,5m. Pode abrir um caminho seco ou criar um redemoinho (Pilotagem DT do ritual evita prender barco).",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro:
        "+5 PE: aumenta o deslocamento de enchente para +12m e o dano de evaporar para 10d8.",
    },
    {
      id: "transfigurar_terra",
      nome: "Transfigurar Terra",
      elemento: "Energia",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Longo",
      area: "9 cubos com 1,5m de lado",
      duracao: "Instantânea",
      resistencia: "Veja texto",
      descricao:
        "Você imbui terra, pedra, lama, argila ou areia com Energia. Escolha um dos efeitos: \nAmolecer: se afetar teto/suporte, provoca desabamento (10d6 dano de impacto, Reflexos reduz à metade). Se afetar piso, cria terreno difícil. \nModelar: pode usar pedra ou argila para criar objetos simples (Enorme ou menor, sem partes móveis), como uma parede (RD 8, 50 PV / 3m). \nSolidificar: transforma lama ou areia em terra ou pedra. Seres com os pés na superfície ficam agarrados (ação padrão, Atletismo DT do ritual para soltar).",
      discente: "+3 PE: muda a área para 15 cubos com 1,5m de lado.",
      verdadeiro:
        "+7 PE: também afeta todos os tipos de minerais e metais. Requer 4º círculo.",
    },
    {
      id: "mutar",
      nome: "Mutar",
      elemento: "Energia",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena", // O texto diz 'cena' no cabeçalho mas 'sustentada' na descrição. Usei 'cena'
      descricao:
        "Você inibe a emissão de qualquer som a partir de você (passos, disparos, voz). Você também não pode ser alcançado por sons. Concede +10 em testes de Furtividade e reduz qualquer ganho de visibilidade em cenas de furtividade em 1. O jogador só pode falar na mesa com permissão do mestre (ou se comunicar por mímica/mensagens). Se falar sem permissão, o ritual se esvai.",
      discente:
        "+4 PE: muda o alcance para toque e o alvo para 1 ser.",
      verdadeiro:
        "+9 PE: muda o alcance para curto e o alvo para até 5 seres. Requer afinidade com Energia.",
    },
    {
      id: "milagre_ionizante",
      nome: "Milagre Ionizante",
      elemento: "Energia",
      circulo: 3,
      execucao: "Completa",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Você pode curar o ser de uma condição entre abalado, apavorado, alquebrado, atordoado, cego, confuso, debilitado, enjoado, envenenado, esmorecido, exausto, fascinado, fatigado, fraco, frustrado, lento, ofuscado, paralisado, pasmo ou surdo, ou uma doença ou um veneno. Afeta efeitos paranormais (exceto de Energia e permanentes). Após curar, o alvo deve fazer um teste de Fortitude (DT 30). Se falhar, é incubado pelo vírus do infectcídio.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },

    // ---------- CÍRCULO 3: CONHECIMENTO ----------
    {
      id: "alterar_memoria",
      nome: "Alterar Memória",
      elemento: "Conhecimento",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 pessoa",
      duracao: "Instantânea",
      resistencia: "Vontade anula",
      descricao:
        "Você invade a mente do alvo e altera ou apaga suas memórias de até uma hora atrás. Se escolher alterar as memórias, você pode mudar detalhes de eventos recentes (como identidade ou endereço), mas não reescrever completamente esses eventos. O alvo recupera suas memórias após 1d4 dias.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro:
        "+4 PE: você pode alterar ou apagar memórias de até 24 horas atrás. Requer 4º círculo.",
    },
    {
      id: "contato_paranormal",
      nome: "Contato Paranormal",
      elemento: "Conhecimento",
      circulo: 3,
      execucao: "Completa",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "1 dia",
      resistencia: "",
      descricao:
        "Você recebe seis d6. Sempre que fizer um teste de perícia, pode gastar um desses d6, rolá-lo e adicionar o resultado. Sempre que rolar um 6 no dado, a entidade toma 2 pontos de Sanidade de você. Se ficar sem dados ou chegar a Sanidade 0, o ritual acaba.",
      discente:
        "+4 PE: muda os dados de auxílio para d8. Sempre que rolar um 8, a entidade toma 3 pontos de sua Sanidade. Requer 4º círculo.",
      verdadeiro:
        "+9 PE: muda os dados de auxílio para d12. Sempre que rolar um 12, a entidade toma 5 pontos de sua Sanidade. Requer 4º círculo e afinidade.",
    },
    {
      id: "mergulho_mental",
      nome: "Mergulho Mental",
      elemento: "Conhecimento",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 pessoa",
      duracao: "Sustentada",
      resistencia: "Vontade parcial (veja texto)",
      descricao:
        "Você mergulha nos pensamentos do alvo (você fica desprevenido). No início de cada turno seu (sustentando e tocando), o alvo deve fazer um teste de Vontade. Se falhar, deve responder uma pergunta sua (sim/não) com sinceridade.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro:
        "+4 PE: muda a execução para 1 dia, o alcance para ilimitado e adiciona componentes (cuba de ouro com água, máscara CAT II). Você pode realizar o mergulho à distância, submergindo o rosto mascarado na água mentalizando o alvo (requer informação, nome completo, objeto pessoal ou foto). Requer 4º círculo.",
    },
    {
      id: "videncia",
      nome: "Vidência",
      elemento: "Conhecimento",
      circulo: 3,
      execucao: "Completa",
      alcance: "Ilimitado",
      alvo: "1 ser",
      duracao: "5 rodadas",
      resistencia: "Vontade anula",
      descricao:
        "Através de uma superfície reflexiva, você pode ver e ouvir um ser escolhido e seus arredores (6m). O alvo (Vontade no início do turno dele) para impedir a Vidência naquele turno. Se passar em 2 testes seguidos, o ritual é encerrado (imune por 1 semana). Requer informação sobre o alvo (nome, foto). Bônus/Penalidades no teste do alvo: Sabe o mínimo (+10), Algumas informações (+5), Conhece bem (0), Pertence pessoal (–5), Parte do corpo (–10).",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "relembrar_fragmento",
      nome: "Relembrar Fragmento",
      elemento: "Conhecimento",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 objeto",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Você toca um objeto (livro, papel, etc.) ilegível ou danificado pelo tempo. O objeto é completamente restaurado para o momento em que recebeu sua última anotação e permanece assim enquanto você o tocar. Se soltá-lo, retorna ao estado danificado. Não restaura objetos destruídos por meios paranormais.",
      discente:
        "+4 PE: o objeto permanece restaurado até o fim da missão.",
      verdadeiro:
        "+9 PE: em vez do normal, o ritual pode ser usado para alterar o objeto de forma imperceptível (ex: transformar um papel numa permissão legítima). O objeto permanece alterado até o fim da missão. Requer afinidade.",
    },

    // ---------- CÍRCULO 3: MEDO ----------
    {
      id: "dissipar_ritual",
      nome: "Dissipar Ritual",
      elemento: "Medo",
      circulo: 3,
      execucao: "Padrão",
      alcance: "Médio",
      alvo: "1 ser ou objeto, ou esfera com 3m de raio",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Você dissipa rituais ativos (efeitos instantâneos não podem ser dissipados). Faça um teste de Ocultismo; você anula quaisquer rituais ativos no alvo ou na área com DT igual ou menor que o resultado. Você pode conjurar em um item amaldiçoado para que se torne mundano por um dia (usuário pode fazer teste de Vontade para negar).",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },

    // ---------- CÍRCULO 4: SANGUE ----------
    {
      id: "capturar_o_coracao",
      nome: "Capturar o Coração",
      elemento: "Sangue",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 pessoa",
      duracao: "Cena",
      resistencia: "Vontade parcial",
      descricao:
        "Você desperta uma paixão doentia no alvo, que passa a querer agradá-lo. No início de cada turno do alvo ele deve fazer um teste de Vontade. Se falhar, age de forma a ajudá-lo na melhor de suas capacidades. Se o alvo passar nesse teste dois turnos seguidos o efeito termina.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "involucro_de_carne",
      nome: "Invólucro de Carne",
      elemento: "Sangue",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Curto",
      efeito: "1 clone seu",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Emerge uma cópia sua de uma poça de sangue. Ela é idêntica em aparência e capacidades (mesmas estatísticas) e surge com cópia de equipamento mundano. A cópia não tem consciência (INT e PRE nulos) e não age sem ordem. Você pode gastar uma ação de movimento para dar uma ordem. No final do turno, a cópia segue a ordem. Alternativamente, no início do seu turno, você pode controlar ativamente a cópia (você entra em transe). Um teste de Percepção (DT do ritual) revela que é uma cópia. A cópia se desfaz a 0 PV ou se sair do alcance.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "vinculo_de_sangue",
      nome: "Vínculo de Sangue",
      elemento: "Sangue",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Cena",
      resistencia: "Fortitude anula",
      descricao:
        "Você manifesta um símbolo de Sangue no seu corpo e no do alvo. Sempre que você sofrer dano, o alvo deve fazer um teste de Fortitude. Se ele falhar, você sofre apenas metade do dano e ele sofre a metade restante. Você pode conjurar com efeito inverso (você recebe metade do dano do alvo). Alvos voluntários não precisam fazer testes.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "martirio_de_sangue",
      nome: "Martírio de Sangue",
      elemento: "Sangue",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Veja texto",
      resistencia: "",
      descricao:
        "Você se entrega ao Sangue. Você recebe faro, visão no escuro, cura acelerada 10, +10 em testes de ataque e rolagens de dano corpo a corpo e na Defesa, 30 PV temporários e seus ataques desarmados causam 1 dado de dano adicional (letal). Após invocar, você não pode fazer ações que demandem foco (como conjurar rituais) e sofre –3d20 em testes de interação social. O ritual não possui fim. Quando a cena acaba, você se torna permanentemente uma criatura de Sangue (personagem perdido).", // O "O" no livro-texto foi interpretado como d20
      discente:
        "+5 PE: muda os bônus para +20 e os PV temporários para 50. Requer afinidade.",
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },

    // ---------- CÍRCULO 4: MORTE ----------
    {
      id: "convocar_o_algoz",
      nome: "Convocar o Algoz",
      elemento: "Morte",
      circulo: 4,
      execucao: "Padrão",
      alcance: "1,5m",
      alvo: "1 pessoa",
      duracao: "Sustentada",
      resistencia: "Vontade parcial, Fortitude parcial",
      descricao:
        "Você manipula a espiral da Morte para criar uma imagem do que o alvo mais teme (apenas a vítima vê nitidez, outros veem um vulto). O algoz surge adjacente a você. No fim de cada turno seu, ele flutua 12m em direção à vítima. Se terminar em alcance curto, vítima (Vontade) ou fica abalada. Se terminar adjacente, vítima (Fortitude) ou fica com 0 PV; se passar, sofre 6d6 dano de Morte (não reduz a menos de 1 PV). O algoz é incorpóreo e imune a dano.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "distorcao_temporal",
      nome: "Distorção Temporal",
      elemento: "Morte",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Veja texto",
      duracao: "Veja texto", // 3 rodadas
      resistencia: "",
      descricao:
        "Este ritual distorce o fluxo de tempo em relação a você, criando um bolsão temporal que dura 3 rodadas. Durante este tempo, você pode agir, mas não pode se deslocar nem interagir com seres e objetos. Efeitos contínuos não o afetam, e quaisquer efeitos que você iniciar não afetarão a área ao seu redor.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "fim_inevitavel",
      nome: "Fim Inevitável",
      elemento: "Morte",
      circulo: 4,
      execucao: "Completa",
      alcance: "Extremo",
      efeito: "Buraco negro com 1,5m de diâmetro",
      duracao: "4 rodadas",
      resistencia: "Fortitude parcial",
      descricao:
        "Você cria um vácuo. No início de cada um de seus quatro turnos seguintes, todos os seres a até 90m do vácuo (incluindo você) devem fazer um teste de Fortitude. Em caso de falha, ficam caídas e são puxadas 30m na direção do vácuo. Seres podem gastar ação de movimento para se segurar (recebendo +5 no teste). Seres e objetos que iniciem seu turno tocando o vácuo sofrem 100 pontos de dano de Morte por rodada.",
      discente:
        "+5 PE: muda a duração para “5 rodadas” e o efeito para que você não seja afetado. Requer afinidade.",
      verdadeiro:
        "+10 PE: muda a duração para “6 rodadas” e o efeito para que seres escolhidos dentro do alcance não sejam afetados. Requer afinidade.",
    },
    {
      id: "singularidade_temporal",
      nome: "Singularidade Temporal",
      elemento: "Morte",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 objeto não paranormal Médio",
      duracao: "Instantânea",
      resistencia: "Veja texto",
      descricao:
        "Você avança o estado temporal de um objeto até sua decomposição mais avançada (ex: maçã apodrece, pneu resseca e rasga). Dependendo da natureza, o objeto pode ficar danificado (–5 em testes) ou ser destruído. Um objeto em uso por alguém permite um teste de Fortitude para proteger o objeto.",
      discente:
        "+5 PE: muda o tamanho do objeto afetado para Grande.",
      verdadeiro:
        "+10 PE: muda o tamanho do objeto afetado para Enorme.",
    },

    // ---------- CÍRCULO 4: ENERGIA ----------
    {
      id: "alterar_destino",
      nome: "Alterar Destino",
      elemento: "Energia",
      circulo: 4,
      execucao: "Reação",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Você vislumbra seu futuro próximo, analisando milhões de possibilidades e escolhendo a melhor. Você recebe +15 em um teste de resistência ou na Defesa contra um ataque.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro:
        "+5 PE: muda o alcance para “curto” e o alvo para “um aliado à sua escolha”.",
    },
    {
      id: "deflagracao_de_energia",
      nome: "Deflagração de Energia",
      elemento: "Energia",
      circulo: 4,
      execucao: "Completa",
      alcance: "Pessoal",
      area: "Explosão de 15m de raio",
      duracao: "Instantânea", // O cabeçalho não lista, mas o efeito é
      resistencia: "Fortitude parcial",
      descricao:
        "Você libera uma explosão intensa. Todos na área sofrem 3d10 x 10 pontos de dano de Energia e todos os itens tecnológicos (armas de fogo, acessórios, utensílios) param de funcionar (quebrados). Você não é afetado. Alvos que passem no teste de Fortitude sofrem metade do dano e seus itens voltam a funcionar após 1d4 rodadas.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "+5 PE: afeta apenas alvos a sua escolha.",
    },
    {
      id: "teletransporte",
      nome: "Teletransporte",
      elemento: "Energia",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "Até 5 seres voluntários",
      duracao: "Instantânea",
      resistencia: "",
      descricao:
        "Transporta os alvos para um lugar a sua escolha a até 1.000km. Requer teste de Ocultismo (DT 25 Lugar frequente; DT 30 Lugar visitado; DT 35 Lugar descrito). Se passar, chega ao destino. Se falhar, chega em lugar errado (até 1d10 x 10 km). Se falhar por 5+, o ritual falha, gasta PE e você fica atordoado por 1d4 rodadas.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro:
        "+5 PE: pode se teletransportar para qualquer local na Terra.",
    },

    // ---------- CÍRCULO 4: CONHECIMENTO ----------
    {
      id: "controle_mental",
      nome: "Controle Mental",
      elemento: "Conhecimento",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Médio",
      alvo: "1 pessoa ou animal",
      duracao: "Sustentada",
      resistencia: "Vontade parcial",
      descricao:
        "Você domina a mente do alvo, que obedece todos os seus comandos, exceto ordens suicidas. Um alvo tem direito a um teste de Vontade no final de cada um de seus turnos para se livrar do efeito. Alvos que passarem no teste ficam pasmos por 1 rodada.",
      discente:
        "+5 PE: muda o alvo para até cinco pessoas ou animais.",
      verdadeiro:
        "+10 PE: muda o alvo para até dez pessoas ou animais. Requer afinidade com Conhecimento.",
    },
    {
      id: "inexistir",
      nome: "Inexistir",
      elemento: "Conhecimento",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "Vontade parcial",
      descricao:
        "Você toca o alvo com a intenção de apagá-lo. O alvo levita e textos narrando sua vida brilham em sua pele, até que sua existência é destruída, causando 10d12+10 pontos de dano de Conhecimento. Se o alvo passar no teste de resistência, sofre 2d12 pontos de dano e fica debilitado por uma rodada. Se os PV do alvo forem reduzidos a 0 ou menos, ele será completamente apagado, sem deixar traços.",
      discente:
        "+5 PE: muda o dano para 15d12+15 e o dano resistido para 3d12.",
      verdadeiro:
        "+10 PE: muda o dano para 20d12+20 e o dano resistido para 4d12. Requer afinidade.",
    },
    {
      id: "possessao",
      nome: "Possessão",
      elemento: "Conhecimento",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Longo",
      alvo: "1 pessoa viva ou morta",
      duracao: "1 dia",
      resistencia: "Vontade anula",
      descricao:
        "Você projeta sua consciência no corpo de uma pessoa. Você assume o controle total do corpo (se viva, a consciência dela troca de lugar com a sua, ficando inerte no seu corpo desacordado). Você continua usando sua ficha, mas com os atributos físicos (AGI, FOR, VIG) e deslocamento do alvo. Se o alvo passar na resistência, sabe que você tentou possuí-lo (imune por 1 dia). Se qualquer um dos corpos morrer, a mente sobrevivente ficará permanentemente presa no corpo novo. Retornar ao seu corpo é uma ação livre.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "pronunciar_sigilo",
      nome: "Pronunciar Sigilo",
      elemento: "Conhecimento",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Curto",
      alvo: "1 ser",
      duracao: "Instantânea/Veja texto",
      resistencia: "Vontade parcial",
      descricao:
        "Você profana a Realidade, pronunciando um Sigilo. Causa um dos efeitos à sua escolha: \nEsquecer: o alvo esquece quem é e fica atordoado por 1d4+1 rodadas (1 vez/cena). Se passar ou já foi atordoado, fica desprevenido por 1d4 rodadas. \nCegar: o alvo fica cego. Se passar, fica ofuscado por 1d4 rodadas. \nInexistir: o alvo 'desaparece' da Realidade por 1d4+1 rodadas (ou 1 rodada, se passar). Ao final, retorna ao espaço onde estava (ou adjacente). Se for criatura, retorna a um ponto à escolha dela em 18m. (1 vez/cena).",
      discente: "+5 PE: muda o alcance para extremo.",
      verdadeiro:
        "+10 PE: muda o alvo para até cinco seres. Requer afinidade.",
    },

    // ---------- CÍRCULO 4: MEDO ----------
    {
      id: "canalizar_o_medo",
      nome: "Canalizar o Medo",
      elemento: "Medo",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 pessoa",
      duracao: "Permanente até ser descarregada",
      resistencia: "",
      descricao:
        "Você transfere parte de seu poder. Escolha um ritual de até 3º círculo que você conheça; o alvo pode conjurar este ritual (forma básica) uma vez, sem pagar seu custo em PE (mas pode usar formas avançadas gastando seus próprios PE). Até o ritual ser conjurado, seus PE máximos diminuem no valor do custo dele.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "conhecendo_o_medo",
      nome: "Conhecendo o Medo",
      elemento: "Medo",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 pessoa",
      duracao: "Cena",
      resistencia: "Vontade parcial",
      descricao:
        "Você manifesta medo absoluto na mente do alvo. Se ele falhar no teste, a Sanidade dele é reduzida a 0 e ele fica enlouquecendo. Se passar, sofre 10d6 pontos de dano mental e fica apavorado por 1 rodada. Uma pessoa que fique insana por este ritual se transforma em uma criatura paranormal (critério do mestre).",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "lamina_do_medo",
      nome: "Lâmina do Medo",
      elemento: "Medo",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Toque",
      alvo: "1 ser",
      duracao: "Instantânea",
      resistencia: "Fortitude parcial",
      descricao:
        "Você manifesta uma “fenda na Realidade” e golpeia um alvo adjacente. Se o alvo falhar no teste de Fortitude, seus PV são reduzidos a 0 (morrendo); se passar, sofre 10d8 pontos de dano de Medo (ignora RD) e fica apavorado por 1 rodada. Se sobreviver após ficar morrendo, o ferimento jamais cicatriza (dor constante). Requer poder de trilha específico.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "medo_tangivel",
      nome: "Medo Tangível",
      elemento: "Medo",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Pessoal",
      alvo: "Você",
      duracao: "Cena",
      resistencia: "",
      descricao:
        "Seu corpo se torna uma manifestação do Medo. Você fica imune às condições atordoado, cego, debilitado, enjoado, envenenado, exausto, fatigado, fraco, lento, ofuscado e paralisado, além de doenças e venenos. Você não sofre dano adicional por acertos críticos e ataques furtivos. Dano (balístico, corte, impacto, perfuração) não pode reduzir seu PV abaixo de 1.",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
    {
      id: "presenca_do_medo",
      nome: "Presença do Medo",
      elemento: "Medo",
      circulo: 4,
      execucao: "Padrão",
      alcance: "Pessoal",
      area: "Emanação de 9m de raio",
      duracao: "Sustentada",
      resistencia: "",
      descricao:
        "Você emana ondas de pavor. Alvos dentro da área (no momento da conjuração ou no início do turno deles) sofrem 5d8 de dano mental e 5d8 de dano de Medo (Vontade reduz ambos à metade). Alvos que falharem no teste ficam atordoados por 1 rodada (1 vez/cena).",
      discente: "Não possui.", // O texto não lista versão Discente
      verdadeiro: "Não possui.", // O texto não lista versão Verdadeiro
    },
  ],
};
// --- LISTAS DE PODERES DE CLASSE (COLE NO FINAL DO ARQUIVO) ---

export { 
    database, 
    NiveisNex, 
    OpcoesClasse, 
    OpcoesOrigem,
    poderesCombatente,        
    poderesEspecialista,      
    poderesOcultista,
    poderesGerais,
    poderesParanormais, 
    Patentes,
    getPatenteInfo,
    // --- EXPORTA AS MODIFICAÇÕES ---
    modificacoesArmas,
    modificacoesProtecoes,
    modificacoesAcessorios,
    modificacoesParanormais
};