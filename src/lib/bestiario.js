// src/lib/bestiario.js

export const bestiario = [
  // --- SANGUE ---
  {
    id: "aberracao_carne",
    nome: "Aberração de Carne",
    elemento: "Sangue",
    vd: 40,
    tipo: "Criatura - Grande",
    presenca: "Perturbadora (DT 15 • 3d6 mental • NEX 30%+ é imune)",
    foto: "/assets/bestiario/aberracao.webp", 
    sentidos: "Percepção 1d20+5, Percepção às cegas",
    iniciativa: "1d20", 
    defesa: 19,
    fortitude: "3d20+10",
    reflexos: "1d20",
    vontade: "1d20",
    pv_max: 70,
    pv_atual: 70,
    machucado: 35,
    resistencias: "Balístico, impacto, perfuração 5, Sangue 10",
    vulnerabilidades: "Morte",
    atributos: { agi: 1, for: 3, int: 0, pre: 1, vig: 3 },
    deslocamento: "9m | 6q",
    acoes: [
      { 
        nome: "Agredir (Padrão)", 
        descricao: "PANCADA (Corpo a corpo x2). Teste 3d20+10 | Dano 2d6+6 impacto." 
      },
      { 
        nome: "Agarrão (Reação)", 
        descricao: "Se acertar um ataque de pancada, pode tentar agarrar (teste 3d20+12). Mantém até 2 personagens." 
      },
      { 
        nome: "Abocanhar (Movimento)", 
        descricao: "Leva até 2 agarrados para a boca. Agarrados sofrem 3d6 perfuração no início do turno da criatura (Fort DT 15 metade). Atletismo DT 20 para escapar." 
      }
    ]
  },

  // --- ENERGIA ---
  {
    id: "anarquico",
    nome: "Anárquico",
    elemento: "Energia",
    vd: 20,
    tipo: "Criatura - Médio",
    presenca: "Perturbadora (DT 14 • 2d6 mental • NEX 25%+ é imune)",
    foto: "/assets/bestiario/anarquico.webp", // Certifique-se de ter essa imagem
    sentidos: "Percepção -2d20 (Desvantagem), Visão no escuro",
    iniciativa: "3d20+5",
    defesa: 21,
    fortitude: "1d20",
    reflexos: "3d20+10",
    vontade: "-2d20 (Desvantagem)",
    pv_max: 30,
    pv_atual: 30,
    machucado: 15,
    resistencias: "Energia 5",
    vulnerabilidades: "Conhecimento",
    atributos: { agi: 3, for: 2, int: 0, pre: 0, vig: 1 },
    deslocamento: "9m | 6q",
    acoes: [
      {
        nome: "Comportamento Errático (Passiva)",
        descricao: "Role 1d6 no início do turno. 1-2: Investida no mais próximo. 3-4: Luz Prismática (Alcance médio, 2d8 Energia, Atordoado 1 rodada, Fort DT 14 evita). 5: Explosão (Alcance curto, 2d6 Energia, Refl DT 14 metade; Adjacentes +1d6). 6: Risada Descontrolada (Agredir, alvo desprevenido, sem esquiva)."
      },
      {
        nome: "Agredir (Padrão)",
        descricao: "PANCADA ERRÁTICA (Corpo a corpo). Teste 2d20+5 | Dano 2d12 impacto."
      }
    ]
  },

  // --- MORTE ---
  {
    id: "esqueleto_lodo",
    nome: "Esqueleto de Lodo",
    elemento: "Morte",
    vd: 20,
    tipo: "Criatura - Médio",
    presenca: "Perturbadora (DT 14 • 2d4 mental • NEX 25%+ é imune)",
    foto: "/assets/bestiario/esqueleto_lodo.webp", // Certifique-se de ter essa imagem
    sentidos: "Percepção 1d20, Percepção às cegas",
    iniciativa: "2d20",
    defesa: 14,
    fortitude: "2d20",
    reflexos: "2d20+5",
    vontade: "2d20",
    pv_max: 40,
    pv_atual: 40,
    machucado: 20,
    resistencias: "Corte, impacto e perfuração 5, Morte 10",
    vulnerabilidades: "Energia",
    atributos: { agi: 2, for: 2, int: 0, pre: 1, vig: 1 },
    deslocamento: "6m | 4q",
    acoes: [
      {
        nome: "Imortalidade (Passiva)",
        descricao: "Ao morrer, vira poça. Retorna em 1d3 rodadas com 20 PV, a menos que sofra dano de Fogo ou Energia enquanto poça."
      },
      {
        nome: "Agredir (Padrão)",
        descricao: "GARRAS (Corpo a corpo x2). Teste 2d20+5 | Dano 2d6+2 corte."
      },
      {
        nome: "Espiral de Lodo (Completa)",
        descricao: "Lança-se como espiral (Linha reta 9m). Seres no caminho sofrem 2d10 Morte (Reflexos DT 14 reduz à metade). Reforma-se no fim do trajeto."
      }
    ]
  },

  // --- CONHECIMENTO ---
  {
    id: "existido",
    nome: "Existido",
    elemento: "Conhecimento",
    vd: 20,
    tipo: "Criatura - Médio",
    presenca: "Perturbadora (DT 14 • 1d6 mental • NEX 25%+ é imune)",
    foto: "/assets/bestiario/existido.webp", // Certifique-se de ter essa imagem
    sentidos: "Percepção 2d20+5, Percepção às cegas",
    iniciativa: "2d20+5",
    defesa: 13,
    fortitude: "2d20",
    reflexos: "1d20", // Baseado em Agi 1
    vontade: "2d20+10",
    pv_max: 36,
    pv_atual: 36,
    machucado: 18,
    resistencias: "Balístico, corte e impacto 5, Conhecimento 10",
    vulnerabilidades: "Sangue",
    atributos: { agi: 1, for: 1, int: 4, pre: 2, vig: 2 },
    deslocamento: "9m | 6q",
    acoes: [
      {
        nome: "Agredir (Padrão)",
        descricao: "PANCADA (Corpo a corpo). Teste 2d20+5 | Dano 1d4+1 impacto."
      },
      {
        nome: "Brilho Enlouquecedor (Livre)",
        descricao: "1/rodada. Seres em alcance médio sofrem 1d6 mental (Vontade DT 14 reduz à metade)."
      },
      {
        nome: "Fortalecimento Paranormal (Movimento)",
        descricao: "Até o fim da cena, recebe +2d20 em testes de AGI, FOR e VIG e pancadas causam +2d4 Conhecimento. (Só pode usar se tiver causado dano mental com Brilho nesta cena)."
      }
    ]
  }
];