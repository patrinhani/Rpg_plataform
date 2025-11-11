// /src/lib/progressao.js
/**
 * Mapeamento da progressão de habilidades para as classes baseadas no NEX.
 * (Sobrevivente é adaptado de Estágio para NEX para simplificação na ficha).
 */

const progressaoClasses = {
  combatente: {
    nome: "Combatente",
    escala: "NEX",
    habilidades: {
      5: "Ataque especial (2 PE, +5)",
      10: "Habilidade de trilha",
      15: "Poder de combatente",
      20: "Aumento de atributo",
      25: "Ataque especial (3 PE, +10)",
      30: "Poder de combatente",
      35: "Grau de treinamento",
      40: "Habilidade de trilha",
      45: "Poder de combatente",
      50: "Aumento de atributo, Versatilidade",
      55: "Ataque especial (4 PE, +15)",
      60: "Poder de combatente",
      65: "Habilidade de trilha",
      70: "Grau de treinamento",
      75: "Poder de combatente",
      80: "Aumento de atributo",
      85: "Ataque especial (5 PE, +20)",
      90: "Poder de combatente",
      95: "Aumento de atributo",
      99: "Habilidade de trilha",
    }
  },
  especialista: {
    nome: "Especialista",
    escala: "NEX",
    habilidades: {
      5: "Eclético, Perito (2 PE, +1d6)",
      10: "Habilidade de trilha",
      14: "Poder de especialista",
      20: "Aumento de atributo",
      25: "Perito (3 PE, +1d8)",
      30: "Poder de especialista",
      35: "Grau de treinamento",
      40: "Engenhosidade (veterano), Habilidade de trilha",
      45: "Poder de especialista",
      50: "Aumento de atributo, Versatilidade",
      55: "Perito (4 PE, +1d10)",
      60: "Poder de especialista",
      65: "Habilidade de trilha",
      70: "Grau de treinamento",
      75: "Engenhosidade (expert), Poder de especialista",
      80: "Aumento de atributo",
      85: "Perito (5 PE, +1d12)",
      90: "Poder de especialista",
      95: "Aumento de atributo",
      99: "Habilidade de trilha",
    }
  },
  ocultista: {
    nome: "Ocultista",
    escala: "NEX",
    habilidades: {
      5: "Escolhido pelo Outro Lado (1º círculo)",
      10: "Habilidade de trilha",
      15: "Poder de ocultista",
      20: "Aumento de atributo",
      25: "Escolhido pelo Outro Lado (2º círculo)",
      30: "Poder de ocultista",
      35: "Grau de treinamento",
      40: "Habilidade de trilha",
      48: "Poder de ocultista",
      50: "Aumento de atributo, Versatilidade",
      55: "Escolhido pelo Outro Lado (3º círculo)",
      60: "Poder de ocultista",
      65: "Habilidade de trilha",
      70: "Grau de treinamento",
      75: "Poder de ocultista",
      80: "Aumento de atributo",
      85: "Escolhido pelo Outro Lado (4º círculo)",
      90: "Poder de ocultista",
      95: "Aumento de atributo",
      99: "Habilidade de trilha",
    }
  },
  sobrevivente: {
    nome: "Sobrevivente",
    escala: "Estágio",
    // Mapeamento de Estágio para NEX (Estágio 1=5%, 2=15%, 3=35%, 4=55%, 5=75%)
    habilidades: {
      5: "Empenho",
      15: "Trilha (1º habilidade)",
      35: "Aumento de atributo",
      55: "Trilha (2º habilidade)",
      75: "Cicatrizado",
    }
  }
};

const progressaoTrilhas = {
    // --- COMBATENTE ---
    aniquilador: {
        nome: "Aniquilador",
        classe: "combatente",
        escala: "NEX",
        habilidades: {
            10: "A Favorita (Categoria -I)",
            40: "Técnica Secreta (Categoria -II, +2 PE: Amplo ou Destruidor)",
            65: "Técnica Sublime (Acréscimo: Letal, Perfurante)",
            99: "Máquina de Matar (Categoria -III, +2 Margem Ameaça, +1d Dano)",
        },
    },
    comandante_campo: {
        nome: "Comandante de Campo",
        classe: "combatente",
        escala: "NEX",
        habilidades: {
            10: "Inspirar Confiança (2 PE: refazer teste de aliado em alcance curto)",
            40: "Estrategista (1 PE/aliado: +1 Ação de Movimento no próximo turno)",
            65: "Brecha na Guarda (2 PE: ataque adicional de aliado/você em alcance curto)",
            99: "Oficial Comandante (5 PE: +1 Ação Padrão p/ todos aliados em alcance médio)",
        },
    },
    guerreiro: {
        nome: "Guerreiro",
        classe: "combatente",
        escala: "NEX",
        habilidades: {
            10: "Técnica Letal (+2 na margem de ameaça c/ ataques corpo a corpo)",
            40: "Revidar (2 PE: ataque corpo a corpo após Bloqueio)",
            65: "Força Opressora (1 PE: manobra derrubar/empurrar após acerto c/ ataque corpo a corpo)",
            99: "Potência Máxima (Bônus numéricos do Ataque Especial dobrados c/ corpo a corpo)",
        },
    },
    operacoes_especiais: {
        nome: "Operações Especiais",
        classe: "combatente",
        escala: "NEX",
        habilidades: {
            10: "Iniciativa Aprimorada (+5 Iniciativa, +1 Ação Mov. na 1ª rodada)",
            40: "Ataque Extra (2 PE: +1 ataque adicional 1x/rodada)",
            65: "Surto de Adrenalina (5 PE: +1 Ação Padrão/Movimento adicional 1x/rodada)",
            99: "Sempre Alerta (+1 Ação Padrão no início de cada cena de combate)",
        },
    },
    tropa_choque: {
        nome: "Tropa de Choque",
        classe: "combatente",
        escala: "NEX",
        habilidades: {
            10: "Casca Grossa (+1 PV/5% NEX, +VIG na RD de Bloqueio)",
            40: "Cai Dentro (1 PE: forçar inimigo a atacar você, Vontade DT VIG)",
            65: "Duro de Matar (2 PE: reduzir dano não paranormal à metade, NEX 85% p/ dano paranormal)",
            99: "Inquebrável (Machucado: +5 Defesa, RD 5; Morrendo: não fica indefeso e pode agir)",
        },
    },
    agente_secreto: {
        nome: "Agente Secreto",
        classe: "combatente",
        escala: "NEX",
        habilidades: {
            10: "Carteirada (Treinamento em Diplomacia ou Enganação, recebe documentos)",
            40: "O Sorriso (+2 Diplomacia/Enganação, 2 PE p/ refazer teste 1x/teste)",
            65: "Método Investigativo (+1 rodada na urgência de investigação, 2 PE p/ transformar evento em 'sem evento')",
            99: "Multifacetado (5 SAN: recebe todas habilidades até NEX 65% de outra trilha/classe 1x/cena)",
        },
    },
    cacador: {
        nome: "Caçador",
        classe: "combatente",
        escala: "NEX",
        habilidades: {
            10: "Rastrear o Paranormal (Treinamento em Sobrevivência, usa p/ Ocultismo/Investigação/Percepção em rastros paranormais)",
            40: "Estudar Fraquezas (Interlúdio c/ pista: 1 informação útil sobre o ser, +1 em testes/pista)",
            65: "Atacar das Sombras (Sem penalidade em Furtividade por deslocamento normal, -O penalidade por atacar c/ arma silenciosa)",
            99: "Estudar a Presa (Tipo de ser vira 'presa': +O em perícias, +1 Margem Ameaça/Multiplicador Crítico, RD 5)",
        },
    },
    monstruoso: {
        nome: "Monstruoso (Especial)",
        classe: "combatente", // A classe original é Combatente
        escala: "NEX",
        requiresChoice: 'elemento', 
        habilidades: {
            10: "Ser Amaldiçoado (Escolha Elemento, RES 5, Bônus/Penalidade -O)",
            40: "Ser Macabro (RES 10, Penalidade -2O, Bônus adicionais de PE/Atributo)",
            65: "Ser Assustador (RES 15, PRE -1, Bônus adicionais de combate/cura)",
            99: "Ser Aterrorizante (RES 20, NEX 75%: Perturbado; NEX 99%: Sanidade 1, risco de se tornar criatura)",
        },
    },

    // --- ESPECIALISTA ---
    atirador_elite: {
        nome: "Atirador de Elite",
        classe: "especialista",
        escala: "NEX",
        habilidades: {
            10: "Mira de Elite (Proficiência c/ armas de balas longas, +INT em dano)",
            40: "Disparo Letal (1 PE: +2 Margem Ameaça no próximo ataque após Mirar)",
            65: "Disparo Impactante (2 PE: manobras derrubar, desarmar, empurrar, quebrar a distância)",
            99: "Atirar para Matar (Dano máximo em acerto crítico c/ arma de fogo)",
        },
    },
    infiltrador: {
        nome: "Infiltrador",
        classe: "especialista",
        escala: "NEX",
        habilidades: {
            10: "Ataque Furtivo (+1d6 dano extra, +2d6 em 40%, +3d6 em 65%, +4d6 em 99%)",
            40: "Gatuno (+5 Atletismo e Crime, deslocamento normal em Furtividade sem penalidade)",
            65: "Assassinar (3 PE: dados de Ataque Furtivo dobrados, alvo inconsciente/morrendo - Fort DT AGI evita)",
            99: "Sombra Fugaz (3 PE: não sofre penalidade de -15 em Furtividade após ação chamativa)",
        },
    },
    medico_campo: {
        nome: "Médico de Campo",
        classe: "especialista",
        escala: "NEX",
        habilidades: {
            10: "Paramédico (2 PE: cura 2d10 PV de aliado adjacente)",
            40: "Equipe de Trauma (2 PE: remove 1 condição negativa - exceto morrendo)",
            65: "Resgate (Ação livre para se aproximar de aliado ferido/morrendo, bônus +5 DEF/RES após curar)",
            99: "Reanimação (1x/cena, 10 PE: ressuscita personagem que morreu na cena - exceto dano massivo)",
        },
    },
    negociador: {
        nome: "Negociador",
        classe: "especialista",
        escala: "NEX",
        habilidades: {
            10: "Eloquência (1 PE/alvo: fascinar c/ Diplomacia/Enganação/Intimidação contra Vontade)",
            40: "Discurso Motivador (4 PE: +O em testes de perícia para aliados; 8 PE em 65%: +OO)",
            65: "Eu Conheço um Cara (1x/missão: favor da rede de contatos - ex: trocar equipamento, resgate)",
            99: "Truque de Mestre (5 PE: simular efeito de habilidade de aliado vista na cena)",
        },
    },
    tecnico: {
        nome: "Técnico",
        classe: "especialista",
        escala: "NEX",
        habilidades: {
            10: "Inventário Otimizado (+INT em Força para calcular capacidade de carga)",
            40: "Remendão (1 PE: remover condição quebrado de equipamento adjacente, Categoria -I em equipamento geral)",
            65: "Improvisar (2 PE + 2 PE/categoria: criar equipamento geral improvisado até o fim da cena)",
            99: "Preparado para Tudo (3 PE/categoria: produzir item de até Categoria III - exceto armas - da bolsa)",
        },
    },
    bibliotecario: {
        nome: "Bibliotecário",
        classe: "especialista",
        escala: "NEX",
        habilidades: {
            10: "Conhecimento Prático (2 PE: mudar atributo-base da perícia para INT)",
            40: "Leitor Contumaz (Bônus de Ler aumenta p/ 1d8, 2 PE: +1d8 adicional)",
            65: "Rato de Biblioteca (1x/cena: gastar tempo p/ receber benefícios de Ler ou Revisar Caso)",
            99: "A Força do Saber (INT +1, +INT em PE, 1 perícia troca atributo-base para INT)",
        },
    },
    perseverante: {
        nome: "Perseverante",
        classe: "especialista",
        escala: "NEX",
        habilidades: {
            10: "Soluções Improvisadas (2 PE: rolar novamente 1 dado de teste recém-realizado)",
            40: "Fuga Obstinada (+O em testes de perícia para fugir, acumula até 4 falhas em perseguição)",
            65: "Determinação Inquestionável (5 PE: remover condição de medo, mental ou paralisia 1x/cena)",
            99: "Só Mais um Passo... (1x/rodada, 5 PE: se PV iria a 0, fica c/ 1 PV - exceto dano massivo)",
        },
    },
    muambeiro: {
        nome: "Muambeiro",
        classe: "especialista",
        escala: "NEX",
        habilidades: {
            10: "Mascate (Treinamento em Profissão (Armeiro, Eng. ou Químico), +5 capacidade de carga, DT fabricação -10)",
            40: "Fabricação Própria (Metade do tempo para fabricar itens mundanos)",
            65: "Laboratório de Campo (Treinamento em Profissão/Profissão +5, fabricar e consertar itens paranormais)",
            99: "Achado Conveniente (5 PE: 'produzir' item de até Categoria III - exceto paranormais - da bolsa)",
        },
    },

    // --- OCULTISTA ---
    conduite: {
        nome: "Conduíte",
        classe: "ocultista",
        escala: "NEX",
        habilidades: {
            10: "Ampliar Ritual (2 PE: +1 passo em alcance ou dobrar área)",
            40: "Acelerar Ritual (4 PE: conjurar ritual c/ ação livre 1x/rodada)",
            65: "Anular Ritual (PE = custo ritual: teste oposto de Ocultismo p/ anular ritual)",
            99: "Canalizar o Medo (Aprende o ritual Canalizar o Medo)",
        },
    },
    flagelador: {
        nome: "Flagelador",
        classe: "ocultista",
        escala: "NEX",
        habilidades: {
            10: "Poder do Flagelo (Pagar custo de PE de ritual com PV, 2 PV por 1 PE)",
            40: "Abraçar a Dor (2 PE: reduzir dano não paranormal à metade 1x/rodada)",
            65: "Absorver Agonia (Recupera PE temporários = Círculo do ritual ao reduzir inimigos a 0 PV)",
            99: "Medo Tangível (Aprende o ritual Medo Tangível)",
        },
    },
    graduado: {
        nome: "Graduado",
        classe: "ocultista",
        escala: "NEX",
        habilidades: {
            10: "Saber Ampliado (Aprende 1 ritual adicional de 1º Círculo, +1 ritual adicional por novo círculo)",
            40: "Grimório Ritualístico (Aprende rituais = INT de 1º/2º Círculo, precisa empunhar p/ usar)",
            65: "Rituais Eficientes (DT de resistência de todos os rituais +5)",
            99: "Conhecendo o Medo (Aprende o ritual Conhecendo o Medo)",
        },
    },
    intuitivo: {
        nome: "Intuitivo",
        classe: "ocultista",
        escala: "NEX",
        habilidades: {
            10: "Mente Sã (RES Paranormal +5, +5 em testes de resistência contra efeitos paranormais)",
            40: "Presença Poderosa (+PRE no limite de PE por turno p/ conjurar rituais)",
            65: "Inabalável (RES Dano Mental/Paranormal 10, se passar em teste VONT p/ metade do dano, não sofre dano)",
            99: "Presença do Medo (Aprende o ritual Presença do Medo)",
        },
    },
    lamina_paranormal: {
        nome: "Lâmina Paranormal",
        classe: "ocultista",
        escala: "NEX",
        habilidades: {
            10: "Lâmina Maldita (Aprende Amaldiçoar Arma, usa Ocultismo p/ testes de ataque)",
            40: "Gladiador Paranormal (Recebe 2 PE temporários ao acertar ataque corpo a corpo, máx = limite PE)",
            65: "Conjuração Marcial (2 PE: +1 ataque corpo a corpo c/ ação livre após lançar ritual)",
            99: "Lâmina do Medo (Aprende o ritual Lâmina do Medo)",
        },
    },
    exorcista: {
        nome: "Exorcista",
        classe: "ocultista",
        escala: "NEX",
        habilidades: {
            10: "Revelação do Mal (Treinado em Religião, usa no lugar de Ocultismo/Investigação/Percepção para traços paranormais)",
            40: "Poder da Fé (Veterano em Religião, 2 PE: repete teste de resistência falho c/ Religião)",
            65: "Parareligiosidade (2 PE: adicionar efeito de 1 catalisador ritualístico ao conjurar ritual)",
            99: "Chagas da Resistência (SAN reduzida a 0: 10 PV p/ ficar c/ SAN 1)",
        },
    },
    possuido: {
        nome: "Possuído",
        classe: "ocultista",
        escala: "NEX",
        requiresChoice: 'elemento', 
        habilidades: {
            10: "Poder Não Desejado (Recebe Transcender, total PP = 3 + 2 por Transcender, gasta PP p/ recuperar PV/PE)",
            40: "As Sombras Dentro de Mim (Recuperação PP p/ 2/ação dormir, 2 PE: +O em Acrobacia/Atletismo/Furtividade)",
            65: "Ele Me Ensina (Transcender ou 1º poder de outra trilha de Ocultista)",
            99: "Tornamo-nos Um (Poder de NEX 99% baseado no elemento de afinidade)",
        },
    },
    parapsicologo: {
        nome: "Parapsicólogo",
        classe: "ocultista",
        escala: "NEX",
        habilidades: {
            10: "Terapia (Usa Profissão (psicólogo) como Diplomacia, 2 PE: usa Profissão no lugar de teste de RES falho)",
            40: "Palavras-chave (PE gasto = SAN/PD recuperado em acalmar, máx = limite PE)",
            65: "Reprogramação Mental (5 PE + Ação Interlúdio: aliado ganha poder de classe/geral/1ª trilha até o próximo interlúdio)",
            99: "A Sanidade Está Lá Fora (5 PE: remove todas as condições de medo/mentais de pessoa adjacente)",
        },
    },

    // --- SOBREVIVENTE ---
    durao: {
        nome: "Durão",
        classe: "sobrevivente",
        escala: "Estágio",
        habilidades: {
            15: "Durão (+4 PV, +2 PV no 3º estágio)",
            55: "Pancada Forte (1 PE: +O no teste de ataque)",
        },
    },
    esperto: {
        nome: "Esperto",
        classe: "sobrevivente",
        escala: "Estágio",
        habilidades: {
            15: "Esperto (Treinado em 1 perícia adicional)",
            55: "Entendido (1 PE: +1d4 em teste de 2 perícias treinadas)",
        },
    },
    esoterico: {
        nome: "Esotérico",
        classe: "sobrevivente",
        escala: "Estágio",
        habilidades: {
            15: "Esotérico (1 PE: sentir energias paranormais em alcance curto)",
            55: "Iniciado (Aprende e pode conjurar 1 ritual de 1º círculo)",
        },
    },
};


/**
 * 1. Combina as trilhas padrão com as trilhas personalizadas salvas na ficha.
 * @param {Array} customTrilhas - Array de objetos de trilhas personalizadas.
 * @returns {Object} O objeto progressaoTrilhas unificado.
 */
const getMergedTrilhas = (customTrilhas) => {
    const mergedTrilhas = { ...progressaoTrilhas };

    if (!customTrilhas || customTrilhas.length === 0) {
        return mergedTrilhas;
    }

    customTrilhas.forEach(trilha => {
        const newKey = trilha.key; 
        
        const habilidadesObjeto = {};
        if (trilha.habilidades && Array.isArray(trilha.habilidades)) {
            trilha.habilidades.forEach(hab => {
                habilidadesObjeto[hab.nex] = hab.descricao; 
            });
        }

        mergedTrilhas[newKey] = {
            nome: trilha.nome,
            classe: trilha.classe, // Salva a classe associada na customizada
            escala: "NEX",
            requiresChoice: trilha.requiresChoice || null,
            habilidades: habilidadesObjeto,
            isCustom: true, // Marca como customizada
        };
    });

    return mergedTrilhas;
};


/**
 * 2. Agrupa as trilhas unificadas (padrão + customizadas) por classe.
 * @param {Object} trilhasUnificadas - O objeto de todas as trilhas.
 * @returns {Object} Um objeto onde a chave é a classe (combatente, especialista, etc.)
 * e o valor é um objeto das trilhas dessa classe.
 */
const groupTrilhasByClass = (trilhasUnificadas) => {
    const grouped = {
        combatente: { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } },
        especialista: { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } },
        ocultista: { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } },
        sobrevivente: { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } },
    };

    if (!trilhasUnificadas) return grouped;

    Object.keys(trilhasUnificadas).forEach(key => {
        const trilha = trilhasUnificadas[key];
        const classeKey = trilha.classe.toLowerCase();

        if (grouped[classeKey]) {
            grouped[classeKey][key] = {
                key: key,
                nome: trilha.nome,
                isCustom: !!trilha.isCustom
            };
        }
    });

    return grouped;
};

// A ÚNICA LINHA DE EXPORTAÇÃO FINAL:
export { progressaoClasses, progressaoTrilhas, getMergedTrilhas, groupTrilhasByClass };