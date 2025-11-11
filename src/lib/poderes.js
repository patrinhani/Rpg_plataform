// /src/lib/poderes.js
/**
 * Lista de Poderes de Classe (Combatente, Especialista, Ocultista).
 * Estes poderes são escolhidos em NEX 15%, 30%, e a cada 15% subsequentes.
 *
 * Estrutura:
 * {
 * key: string,
 * nome: string,
 * tipo: string, // 'Geral', 'Combate', 'Pericia', 'Paranormal', 'Investigacao'
 * prerequisito: string
 * descricao: string
 * }
 */

const poderesCombatente = [
    {
        key: "armamento_pesado",
        nome: "Armamento Pesado",
        tipo: "Combate",
        prerequisito: "For 2",
        descricao: "Você recebe proficiência com armas pesadas."
    },
    {
        key: "artista_marcial",
        nome: "Artista Marcial",
        tipo: "Combate",
        prerequisito: null,
        descricao: "Seus ataques desarmados causam 1d6 pontos de dano, podem causar dano letal e contam como armas ágeis. Em NEX 35%, o dano aumenta para 1d8 e, em NEX 70%, para 1d10."
    },
    {
        key: "ataque_oportunidade",
        nome: "Ataque de Oportunidade",
        tipo: "Combate",
        prerequisito: null,
        descricao: "Sempre que um ser sair voluntariamente de um espaço adjacente ao seu, você pode gastar uma reação e 1 PE para fazer um ataque corpo a corpo contra ele."
    },
    {
        key: "combater_duas_armas",
        nome: "Combater com Duas Armas",
        tipo: "Combate",
        prerequisito: "Agi 3, treinado em Luta ou Pontaria",
        descricao: "Se estiver usando duas armas (e pelo menos uma for leve) e fizer a ação agredir, você pode fazer dois ataques, um com cada arma. Se fizer isso, sofre –O em todos os testes de ataque até o seu próximo turno."
    },
    {
        key: "combate_defensivo",
        nome: "Combate Defensivo",
        tipo: "Combate",
        prerequisito: "Int 2",
        descricao: "Quando usa a ação agredir, você pode combater defensivamente. Se fizer isso, até seu próximo turno, sofre –O em todos os testes de ataque, mas recebe +5 na Defesa."
    },
    {
        key: "golpe_demolidor",
        nome: "Golpe Demolidor",
        tipo: "Combate",
        prerequisito: "For 2, treinado em Luta",
        descricao: "Quando usa a manobra quebrar ou ataca um objeto, você pode gastar 1 PE para causar dois dados de dano extra do mesmo tipo de sua arma."
    },
    {
        key: "golpe_pesado",
        nome: "Golpe Pesado",
        tipo: "Combate",
        prerequisito: null,
        descricao: "O dano de suas armas corpo a corpo aumenta em mais um dado do mesmo tipo."
    },
    {
        key: "incansavel",
        nome: "Incansável",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Uma vez por cena, você pode gastar 2 PE para fazer uma ação de investigação adicional, mas deve usar Força ou Agilidade como atributo-base do teste."
    },
    {
        key: "presteza_atletica",
        nome: "Presteza Atlética",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Quando faz um teste de facilitar a investigação, você pode gastar 1 PE para usar Força ou Agilidade no lugar do atributo-base da perícia. Se passar no teste, o próximo aliado que usar seu bônus também recebe +O no teste."
    },
    {
        key: "protecao_pesada",
        nome: "Proteção Pesada",
        tipo: "Geral",
        prerequisito: "NEX 30%",
        descricao: "Você recebe proficiência com Proteções Pesadas."
    },
    {
        key: "reflexos_defensivos",
        nome: "Reflexos Defensivos",
        tipo: "Geral",
        prerequisito: "Agi 2",
        descricao: "Você recebe +2 em Defesa e em testes de resistência."
    },
    {
        key: "saque_rapido",
        nome: "Saque Rápido",
        tipo: "Combate",
        prerequisito: "Treinado em Iniciativa",
        descricao: "Você pode sacar ou guardar itens como uma ação livre (em vez de ação de movimento). Além disso, caso esteja usando a regra opcional de contagem de munição, uma vez por rodada pode recarregar uma arma de disparo como uma ação livre."
    },
    {
        key: "segurar_gatilho",
        nome: "Segurar o Gatilho",
        tipo: "Combate",
        prerequisito: "NEX 60%",
        descricao: "Sempre que acerta um ataque com uma arma de fogo, pode fazer outro ataque com a mesma arma contra o mesmo alvo, pagando 2 PE por cada ataque já realizado no turno."
    },
    {
        key: "sentido_tatico",
        nome: "Sentido Tático",
        tipo: "Pericia",
        prerequisito: "Int 2, treinado em Percepção e Tática",
        descricao: "Você pode gastar uma ação de movimento e 2 PE para analisar o ambiente. Se fizer isso, recebe um bônus em Defesa e em testes de resistência igual ao seu Intelecto até o final da cena."
    },
    {
        key: "tanque_guerra",
        nome: "Tanque de Guerra",
        tipo: "Geral",
        prerequisito: "Proteção Pesada",
        descricao: "Se estiver usando uma proteção pesada, a Defesa e a resistência a dano que ela fornece aumentam em +2."
    },
    {
        key: "tiro_certeiro",
        nome: "Tiro Certeiro",
        tipo: "Combate",
        prerequisito: "Treinado em Pontaria",
        descricao: "Se estiver usando uma arma de disparo, você soma sua Agilidade nas rolagens de dano e ignora a penalidade contra alvos envolvidos em combate corpo a corpo (mesmo se não usar a ação mirar)."
    },
    {
        key: "tiro_cobertura",
        nome: "Tiro de Cobertura",
        tipo: "Combate",
        prerequisito: null,
        descricao: "Você pode gastar uma ação padrão e 1 PE para disparar uma arma de fogo na direção de um personagem no alcance da arma para forçá-lo a se proteger. Se vencer, até o início do seu próximo turno o alvo não pode sair do lugar onde está e sofre –5 em testes de ataque. Este é um efeito de medo."
    },
    {
        key: "transcender",
        nome: "Transcender",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Escolha um poder paranormal (veja a página 114). Você recebe o poder escolhido, mas não ganha Sanidade neste aumento de NEX. Você pode escolher este poder várias vezes."
    },
    {
        key: "treinamento_pericia",
        nome: "Treinamento em Perícia",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Escolha duas perícias. Você se torna treinado nessas perícias. A partir de NEX 35%, você pode escolher perícias nas quais já é treinado para se tornar veterano. A partir de NEX 70%, pode escolher perícias nas quais já é veterano para se tornar expert. Você pode escolher este poder várias vezes."
    },
    {
        key: "caminho_forca",
        nome: "Caminho para Força",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Quando usa a ação sacrifício em uma cena de perseguição, você pode gastar 1 PE para fornecer +O extra (para um total de +2O) nos testes dos outros personagens. Quando usa a ação chamar atenção em uma cena de furtividade, você pode gastar 1 PE para diminuir a visibilidade de todos os seus aliados próximos em –2 (em vez de –1)."
    },
    {
        key: "ciente_cicatrizes",
        nome: "Ciente das Cicatrizes",
        tipo: "Pericia",
        prerequisito: "Treinado em Luta ou Pontaria",
        descricao: "Quando faz um teste para encontrar uma pista relacionada a armas ou ferimentos (como um teste para necropsia ou para identificar uma arma amaldiçoada), você pode usar Luta ou Pontaria no lugar da perícia original."
    },
    {
        key: "correria_desesperada",
        nome: "Correria Desesperada",
        tipo: "Geral",
        prerequisito: null,
        descricao: "Você recebe +3m em seu deslocamento e +O em testes de perícia para fugir em uma perseguição."
    },
    {
        key: "engolir_choro",
        nome: "Engolir o Choro",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Você não sofre penalidades por condições em testes de perícia para fugir e em testes de Furtividade."
    },
    {
        key: "instinto_fuga",
        nome: "Instinto de Fuga",
        tipo: "Pericia",
        prerequisito: "Treinado em Intuição",
        descricao: "Quando uma cena de perseguição (ou semelhante) tem início, você recebe +2 em todos os testes de perícia que fizer durante a cena."
    },
    {
        key: "mochileiro",
        nome: "Mochileiro",
        tipo: "Geral",
        prerequisito: "Vig 2",
        descricao: "Seu limite de carga aumenta em 5 espaços e você pode se beneficiar de uma vestimenta adicional."
    },
    {
        key: "paranoia_defensiva",
        nome: "Paranoia Defensiva",
        tipo: "Geral",
        prerequisito: null,
        descricao: "Uma vez por cena, você pode gastar uma rodada e 3 PE. Você e cada aliado presente escolhe entre receber +5 na Defesa contra o próximo ataque que sofrer na cena ou receber um bônus de +5 em um único teste de perícia feito até o fim da cena."
    },
    {
        key: "sacrificar_joelhos",
        nome: "Sacrificar os Joelhos",
        tipo: "Pericia",
        prerequisito: "Treinado em Atletismo",
        descricao: "Uma vez por cena de perseguição (p. 90), quando faz a ação esforço extra, você pode gastar 2 PE para passar automaticamente no teste de perícia."
    },
    {
        key: "sem_tempo_irmao",
        nome: "Sem Tempo, Irmão",
        tipo: "Investigacao",
        prerequisito: null,
        descricao: "Uma vez por cena de investigação, quando usa a ação facilitar investigação, você passa automaticamente no teste para auxiliar seus aliados, mas faz uma rolagem adicional na tabela de eventos de investigação (p. 82)."
    },
    {
        key: "valentao",
        nome: "Valentão",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Você pode usar Força no lugar de Presença para Intimidação. Além disso, uma vez por cena, pode gastar 1 PE para fazer um teste de Intimidação para assustar como uma ação livre."
    },
    {
        key: "apego_angustiado",
        nome: "Apego Angustiado",
        tipo: "Geral",
        prerequisito: null,
        descricao: "Você não fica inconsciente por estar morrendo, mas sempre que terminar uma rodada nesta condição e consciente, perde 2 pontos de Sanidade."
    }
];

const poderesEspecialista = [
    {
        key: "artista_marcial_esp",
        nome: "Artista Marcial",
        tipo: "Combate",
        prerequisito: null,
        descricao: "Seus ataques desarmados causam 1d6 pontos de dano, podem causar dano letal e contam como armas ágeis. Em NEX 35%, o dano aumenta para 1d8 e, em NEX 70%, para 1d10."
    },
    {
        key: "balistica_avancada",
        nome: "Balística Avançada",
        tipo: "Combate",
        prerequisito: null,
        descricao: "Você recebe proficiência com armas táticas de fogo e +2 em rolagens de dano com essas armas."
    },
    {
        key: "conhecimento_aplicado",
        nome: "Conhecimento Aplicado",
        tipo: "Pericia",
        prerequisito: "Int 2",
        descricao: "Quando faz um teste de perícia (exceto Luta e Pontaria), você pode gastar 2 PE para mudar o atributo-base da perícia para Int."
    },
    {
        key: "hacker",
        nome: "Hacker",
        tipo: "Pericia",
        prerequisito: "Treinado em Tecnologia",
        descricao: "Você recebe +5 em testes de Tecnologia para invadir sistemas e diminui o tempo necessário para hackear qualquer sistema para uma ação completa."
    },
    {
        key: "maos_rapidas",
        nome: "Mãos Rápidas",
        tipo: "Pericia",
        prerequisito: "Agi 3, treinado em Crime",
        descricao: "Ao fazer um teste de Crime, você pode pagar 1 PE para fazê-lo como uma ação livre."
    },
    {
        key: "mochila_utilidades",
        nome: "Mochila de Utilidades",
        tipo: "Geral",
        prerequisito: null,
        descricao: "Um item a sua escolha (exceto armas) conta como uma categoria abaixo e ocupa 1 espaço a menos."
    },
    {
        key: "movimento_tatico",
        nome: "Movimento Tático",
        tipo: "Geral",
        prerequisito: "Treinado em Atletismo",
        descricao: "Você pode gastar 1 PE para ignorar a penalidade em deslocamento por terreno difícil e por escalar até o final do turno."
    },
    {
        key: "na_trilha_certa",
        nome: "Na Trilha Certa",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Sempre que tiver sucesso em um teste para procurar pistas, você pode gastar 1 PE para receber +O no próximo teste. Os custos e os bônus são cumulativos."
    },
    {
        key: "nerd",
        nome: "Nerd",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Uma vez por cena, pode gastar 2 PE para fazer um teste de Atualidades (DT 20). Se passar, recebe uma informação útil para essa cena."
    },
    {
        key: "ninja_urbano",
        nome: "Ninja Urbano",
        tipo: "Combate",
        prerequisito: null,
        descricao: "Você recebe proficiência com armas táticas de ataque corpo a corpo e de disparo (exceto de fogo) +2 em rolagens de dano com essas armas."
    },
    {
        key: "pensamento_agil",
        nome: "Pensamento Ágil",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Uma vez por rodada, durante uma cena de investigação, você pode gastar 2 PE para fazer uma ação de procurar pistas adicional."
    },
    {
        key: "perito_explosivos",
        nome: "Perito em Explosivos",
        tipo: "Combate",
        prerequisito: null,
        descricao: "Você soma seu Intelecto na DT para resistir aos seus explosivos e pode excluir dos efeitos da explosão um número de alvos igual ao seu valor de Intelecto."
    },
    {
        key: "primeira_impressao",
        nome: "Primeira Impressão",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Você recebe +OO no primeiro teste de Diplomacia, Enganação, Intimidação ou Intuição que fizer em uma cena."
    },
    {
        key: "transcender_esp",
        nome: "Transcender",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Escolha um poder paranormal (veja a página 114). Você recebe o poder escolhido, mas não ganha Sanidade neste aumento de NEX. Você pode escolher este poder várias vezes."
    },
    {
        key: "treinamento_pericia_esp",
        nome: "Treinamento em Perícia",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Escolha duas perícias. Você se torna treinado nessas perícias. A partir de NEX 35%, você pode escolher perícias nas quais já é treinado para se tornar veterano. A partir de NEX 70%, pode escolher perícias nas quais já é veterano para se tornar expert. Você pode escolher este poder várias vezes."
    },
    {
        key: "esconderijo_desesperado",
        nome: "Esconderijo Desesperado",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Você não sofre –O em testes de Furtividade por se mover ao seu deslocamento normal. Em cenas de furtividade, sempre que passa em um teste para esconder-se, sua visibilidade diminui em –2 (em vez de apenas –1)."
    },
    {
        key: "especialista_diletante",
        nome: "Especialista Diletante",
        tipo: "Geral",
        prerequisito: "NEX 30%",
        descricao: "Você aprende um poder que não pertença à sua classe (exceto poderes de trilha ou paranormais), à sua escolha, cujos pré-requisitos possa cumprir."
    },
    {
        key: "flashback",
        nome: "Flashback",
        tipo: "Geral",
        prerequisito: null,
        descricao: "Escolha uma origem que não seja a sua. Você recebe o poder dessa origem."
    },
    {
        key: "leitura_fria",
        nome: "Leitura Fria",
        tipo: "Pericia",
        prerequisito: "Treinado em Intuição",
        descricao: "Uma vez em cada interlúdio, você pode fazer três perguntas pessoais sobre uma pessoa com quem interagir/observar. Para cada pergunta não respondida, você recebe 2 PE temporários que duram até o fim da missão."
    },
    {
        key: "maos_firmes",
        nome: "Mãos Firmes",
        tipo: "Pericia",
        prerequisito: "Treinado em Furtividade",
        descricao: "Quando faz um teste de Furtividade para esconder-se ou para executar uma ação discreta que envolva manipular um objeto, você pode gastar 2 PE para receber +O nesse teste."
    },
    {
        key: "acolher_terror",
        nome: "Acolher o Terror",
        tipo: "Geral",
        prerequisito: null,
        descricao: "Você pode se entregar para o medo uma vez por sessão de jogo adicional."
    },
    {
        key: "contatos_oportunos",
        nome: "Contatos Oportunos",
        tipo: "Geral",
        prerequisito: "Treinado em Crime",
        descricao: "Você pode usar uma ação de interlúdio para acionar seus contatos locais e recebe um aliado de um tipo à sua escolha, que lhe acompanha até o fim da missão."
    },
    {
        key: "disfarce_sutil",
        nome: "Disfarce Sutil",
        tipo: "Pericia",
        prerequisito: "Pre 2, treinado em Enganação",
        descricao: "Você pode gastar 1 PE para se disfarçar como uma ação completa e sem necessidade de um kit de disfarces."
    },
    {
        key: "plano_fuga",
        nome: "Plano de Fuga",
        tipo: "Geral",
        prerequisito: null,
        descricao: "Você pode usar Intelecto no lugar de Força para a ação criar obstáculos em uma perseguição. Uma vez por cena, pode gastar 2 PE para dispensar o teste e ser bem-sucedido nesta ação."
    },
    {
        key: "remoer_memorias",
        nome: "Remoer Memórias",
        tipo: "Pericia",
        prerequisito: "Int 1",
        descricao: "Uma vez por cena, gaste 2 PE para substituir um teste de perícia baseada em Int ou Pre por um teste de Intelecto com DT 15."
    },
    {
        key: "resistir_pressao",
        nome: "Resistir à Pressão",
        tipo: "Pericia",
        prerequisito: "Treinado em Investigação",
        descricao: "Uma vez por cena de investigação, você pode gastar 5 PE para coordenar os esforços, aumentando a urgência em 1 rodada, e durante esta rodada adicional todos recebem +2 em testes de perícia."
    }
];

const poderesOcultista = [
    {
        key: "camuflar_ocultismo",
        nome: "Camuflar Ocultismo",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Você pode gastar uma ação livre para esconder símbolos e sigilos que estejam desenhados ou gravados em objetos ou em sua pele. Além disso, quando lança um ritual, pode gastar +2 PE para lançá-lo sem usar componentes ritualísticos e sem gesticular."
    },
    {
        key: "criar_selo",
        nome: "Criar Selo",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Você sabe fabricar selos paranormais de rituais que conheça. Fabricar um selo gasta uma ação de interlúdio e PE iguais ao custo do ritual. Você pode ter um número máximo de selos criados igual à sua Presença."
    },
    {
        key: "envolto_misterio",
        nome: "Envolto em Mistério",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Você recebe +5 em Enganação e Intimidação contra pessoas não treinadas em Ocultismo."
    },
    {
        key: "especialista_elemento",
        nome: "Especialista em Elemento",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Escolha um elemento. A DT para resistir aos seus rituais desse elemento aumenta em +2."
    },
    {
        key: "ferramentas_paranormais",
        nome: "Ferramentas Paranormais",
        tipo: "Geral",
        prerequisito: null,
        descricao: "Você reduz a categoria de um item paranormal em I e pode ativar itens paranormais sem pagar seu custo em PE."
    },
    {
        key: "fluxo_poder",
        nome: "Fluxo de Poder",
        tipo: "Paranormal",
        prerequisito: "NEX 60%",
        descricao: "Você pode manter dois efeitos sustentados de rituais ativos simultaneamente com apenas uma ação livre, pagando o custo de cada efeito separadamente."
    },
    {
        key: "guiado_paranormal",
        nome: "Guiado pelo Paranormal",
        tipo: "Investigacao",
        prerequisito: null,
        descricao: "Uma vez por cena, você pode gastar 2 PE para fazer uma ação de investigação adicional."
    },
    {
        key: "identificacao_paranormal",
        nome: "Identificação Paranormal",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Você recebe +10 em testes de Ocultismo para identificar criaturas, objetos ou rituais."
    },
    {
        key: "improvisar_componentes",
        nome: "Improvisar Componentes",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Uma vez por cena, você pode gastar uma ação completa para fazer um teste de Investigação (DT 15) e, se passar, encontra objetos que podem servir como componentes ritualísticos de um elemento à sua escolha."
    },
    {
        key: "intuicao_paranormal",
        nome: "Intuição Paranormal",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Sempre que usa a ação facilitar investigação, você soma seu Intelecto ou Presença no teste (à sua escolha)."
    },
    {
        key: "mestre_elemento",
        nome: "Mestre em Elemento",
        tipo: "Paranormal",
        prerequisito: "Especialista em Elemento no elemento escolhido, NEX 45%",
        descricao: "Escolha um elemento. O custo para lançar rituais desse elemento diminui em –1 PE."
    },
    {
        key: "ritual_potente",
        nome: "Ritual Potente",
        tipo: "Paranormal",
        prerequisito: "Int 2",
        descricao: "Você soma seu Intelecto nas rolagens de dano ou nos efeitos de cura de seus rituais."
    },
    {
        key: "ritual_predileto",
        nome: "Ritual Predileto",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Escolha um ritual que você conhece. Você reduz em –1 PE o custo do ritual."
    },
    {
        key: "tatuagem_ritualistica",
        nome: "Tatuagem Ritualística",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Símbolos marcados em sua pele reduzem em –1 PE o custo de rituais de alcance pessoal que têm você como alvo."
    },
    {
        key: "transcender_ocul",
        nome: "Transcender",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Escolha um poder paranormal. Você recebe o poder escolhido, mas não ganha Sanidade neste aumento de NEX. Você pode escolher este poder várias vezes."
    },
    {
        key: "treinamento_pericia_ocul",
        nome: "Treinamento em Perícia",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Escolha duas perícias. Você se torna treinado nessas perícias. A partir de NEX 35%, você pode escolher perícias nas quais já é treinado para se tornar veterano. A partir de NEX 70%, pode escolher perícias nas quais já é veterano para se tornar expert. Você pode escolher este poder várias vezes."
    },
    {
        key: "deixe_sussurros_guiarem",
        nome: "Deixe os Sussurros Guiarem",
        tipo: "Investigacao",
        prerequisito: null,
        descricao: "Uma vez por cena, você pode gastar 2 PE e uma rodada para receber +2 em testes de perícia para investigação até o fim da cena. Entretanto, enquanto este poder estiver ativo, sempre que falha em um teste de perícia, você perde 1 ponto de Sanidade."
    },
    {
        key: "dominio_esoterico",
        nome: "Domínio Esotérico",
        tipo: "Paranormal",
        prerequisito: "Int 3",
        descricao: "Ao lançar um ritual, você pode combinar os efeitos de até dois catalisadores ritualísticos diferentes ao mesmo tempo."
    },
    {
        key: "estalos_macabros",
        nome: "Estalos Macabros",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Gaste 1 PE para usar Ocultismo em vez da perícia original (distrair/fintar). Você recebe +5 no teste se o alvo for pessoa/animal."
    },
    {
        key: "minha_dor_impulsiona",
        nome: "Minha Dor me Impulsiona",
        tipo: "Geral",
        prerequisito: "Vig 2, pelo menos 5 pontos de dano em PV",
        descricao: "Gaste 1 PE para receber +1d6 em testes de Acrobacia, Atletismo ou Furtividade."
    },
    {
        key: "nos_olhos_monstro",
        nome: "Nos Olhos do Monstro",
        tipo: "Geral",
        prerequisito: null,
        descricao: "Se estiver em uma cena envolvendo uma criatura paranormal, gaste 3 PE e uma rodada para encarar a criatura. Você recebe +5 em testes contra a criatura (exceto testes de ataque) até o fim da cena."
    },
    {
        key: "olhar_sinistro",
        nome: "Olhar Sinistro",
        tipo: "Pericia",
        prerequisito: "Pre 1",
        descricao: "Você pode usar Presença no lugar de Intelecto para Ocultismo e pode usar esta perícia para coagir (Intimidação)."
    },
    {
        key: "sentido_premonitorio",
        nome: "Sentido Premonitório",
        tipo: "Pericia",
        prerequisito: null,
        descricao: "Gaste 3 PE para ativar. Você tem um déjà vu do futuro próximo (1 rodada) em investigação e sabe ações inimigas em furtividade/perseguição. Custo de manutenção: 1 PE/rodada."
    },
    {
        key: "sincronia_paranormal",
        nome: "Sincronia Paranormal",
        tipo: "Paranormal",
        prerequisito: "Pre 2",
        descricao: "Gaste uma ação padrão e 2 PE para sincronizar com aliados em alcance médio. Distribua O de bônus igual à sua Presença entre os participantes para testes de Intelecto/Presença no início de cada rodada. Custo de manutenção: 1 PE/rodada."
    },
    {
        key: "tracado_conjural",
        nome: "Traçado Conjuratória",
        tipo: "Paranormal",
        prerequisito: null,
        descricao: "Gaste 1 PE e uma ação completa para traçar um símbolo no chão (1,5m). Enquanto estiver no símbolo, você recebe +2 em Ocultismo e RES e a DT para resistir aos seus rituais aumenta em +2."
    }
];

export { poderesCombatente, poderesEspecialista, poderesOcultista };