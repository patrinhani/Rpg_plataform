// src/lib/bestiario.js

export const bestiario = [
  {
    id: "aberracao_carne",
    nome: "Aberração de Carne",
    elemento: "Sangue",
    vd: 40,
    tipo: "Criatura - Grande",
    presenca: "Perturbadora (DT 15 • 3d6 mental • NEX 30%+ é imune)",
    
    // CORREÇÃO: Notação de dados clara (d20)
    sentidos: "Percepção 1d20+5, Percepção às cegas", // Ajustado conforme seu pedido
    iniciativa: "1d20", // Baseado em Agi 1 (se seguir o padrão da Percepção)
    
    defesa: 19,
    
    // Resistências com a notação correta (3d20, 2d20)
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
  }
];