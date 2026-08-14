import Personagem from './personagem.js';
import { database, OpcoesOrigem } from './database.js';

const ATRIBUTOS_CRIACAO = [
  { key: 'agi', nome: 'Agilidade', sigla: 'AGI', descricao: 'Reflexos, coordenação, pontaria e velocidade.' },
  { key: 'for', nome: 'Força', sigla: 'FOR', descricao: 'Potência física, luta e capacidade de carga.' },
  { key: 'int', nome: 'Intelecto', sigla: 'INT', descricao: 'Raciocínio, investigação e quantidade de perícias.' },
  { key: 'pre', nome: 'Presença', sigla: 'PRE', descricao: 'Vontade, percepção social e pontos de esforço.' },
  { key: 'vig', nome: 'Vigor', sigla: 'VIG', descricao: 'Resistência física, fortitude e pontos de vida.' },
];

const PERICIAS_CRIACAO = [
  { key: 'acrobacia', nome: 'Acrobacia', atributo: 'AGI' },
  { key: 'adestramento', nome: 'Adestramento', atributo: 'PRE' },
  { key: 'artes', nome: 'Artes', atributo: 'PRE' },
  { key: 'atletismo', nome: 'Atletismo', atributo: 'FOR' },
  { key: 'atualidades', nome: 'Atualidades', atributo: 'INT' },
  { key: 'ciencias', nome: 'Ciências', atributo: 'INT' },
  { key: 'crime', nome: 'Crime', atributo: 'AGI' },
  { key: 'diplomacia', nome: 'Diplomacia', atributo: 'PRE' },
  { key: 'enganacao', nome: 'Enganação', atributo: 'PRE' },
  { key: 'fortitude', nome: 'Fortitude', atributo: 'VIG' },
  { key: 'furtividade', nome: 'Furtividade', atributo: 'AGI' },
  { key: 'iniciativa', nome: 'Iniciativa', atributo: 'AGI' },
  { key: 'intimidacao', nome: 'Intimidação', atributo: 'PRE' },
  { key: 'intuicao', nome: 'Intuição', atributo: 'PRE' },
  { key: 'investigacao', nome: 'Investigação', atributo: 'INT' },
  { key: 'luta', nome: 'Luta', atributo: 'FOR' },
  { key: 'medicina', nome: 'Medicina', atributo: 'INT' },
  { key: 'ocultismo', nome: 'Ocultismo', atributo: 'INT' },
  { key: 'percepcao', nome: 'Percepção', atributo: 'PRE' },
  { key: 'pilotagem', nome: 'Pilotagem', atributo: 'AGI' },
  { key: 'pontaria', nome: 'Pontaria', atributo: 'AGI' },
  { key: 'profissao', nome: 'Profissão', atributo: 'INT' },
  { key: 'reflexos', nome: 'Reflexos', atributo: 'AGI' },
  { key: 'religiao', nome: 'Religião', atributo: 'PRE' },
  { key: 'sobrevivencia', nome: 'Sobrevivência', atributo: 'INT' },
  { key: 'tatica', nome: 'Tática', atributo: 'INT' },
  { key: 'tecnologia', nome: 'Tecnologia', atributo: 'INT' },
  { key: 'vontade', nome: 'Vontade', atributo: 'PRE' },
];

const CLASSES_CRIACAO = {
  combatente: {
    nome: 'Combatente',
    chamada: 'Resista e controle o confronto',
    descricao: 'Tem mais pontos de vida e ferramentas para enfrentar ameaças diretamente.',
    recomendado: 'Ideal para quem quer proteger o grupo, usar armas e permanecer na linha de frente.',
    pericias: 'Luta ou Pontaria; Fortitude ou Reflexos; mais 1 + Intelecto.',
  },
  especialista: {
    nome: 'Especialista',
    chamada: 'Investigue e resolva problemas',
    descricao: 'É versátil e domina mais perícias que qualquer outra classe.',
    recomendado: 'Ideal para investigação, suporte, tecnologia, medicina ou infiltração.',
    pericias: 'Escolha 7 + Intelecto perícias.',
  },
  ocultista: {
    nome: 'Ocultista',
    chamada: 'Compreenda e manipule o paranormal',
    descricao: 'Possui mais sanidade e pontos de esforço, mas é fisicamente mais vulnerável.',
    recomendado: 'Ideal para quem quer estudar o Outro Lado e aprender rituais.',
    pericias: 'Ocultismo e Vontade; mais 3 + Intelecto.',
  },
  sobrevivente: {
    nome: 'Sobrevivente',
    chamada: 'Enfrente o horror como uma pessoa comum',
    descricao: 'Começa no NEX 0% e progride por estágios, com recursos bem mais limitados.',
    recomendado: 'Ideal para campanhas de terror em que os personagens ainda não são agentes.',
    pericias: 'Escolha 1 + Intelecto perícias.',
  },
};

const ETAPAS_CRIACAO = [
  { id: 'conceito', nome: 'Conceito', resumo: 'Quem é o personagem' },
  { id: 'origem', nome: 'Origem', resumo: 'A vida antes do paranormal' },
  { id: 'classe', nome: 'Classe', resumo: 'O papel dentro do grupo' },
  { id: 'atributos', nome: 'Atributos', resumo: 'Pontos fortes e limitações' },
  { id: 'pericias', nome: 'Perícias', resumo: 'Treinamentos do personagem' },
  { id: 'revisao', nome: 'Revisão', resumo: 'Confira antes de concluir' },
];

const copiar = (valor) => JSON.parse(JSON.stringify(valor));

function limitarEtapa(etapa) {
  return Math.min(ETAPAS_CRIACAO.length - 1, Math.max(0, Number.parseInt(etapa, 10) || 0));
}

function obterDadosOrigem(origem) {
  return database.periciasPorOrigem?.[origem] || { fixas: [], escolhas: [], poder: null };
}

function obterPericiasOrigem(rascunho) {
  const dadosOrigem = obterDadosOrigem(rascunho.origem);
  const fixas = Array.isArray(dadosOrigem.fixas) ? dadosOrigem.fixas : [];
  const escolhas = Array.isArray(rascunho.periciasOrigemEscolhidas)
    ? rascunho.periciasOrigemEscolhidas
    : [];
  return [...new Set([...fixas, ...escolhas])];
}

function obterPericiasClasse(rascunho) {
  const livres = Array.isArray(rascunho.periciasClasseLivres)
    ? rascunho.periciasClasseLivres
    : [];
  if (rascunho.classe === 'combatente') {
    return [...new Set([
      rascunho.periciaCombate,
      rascunho.periciaResistencia,
      ...livres,
    ].filter(Boolean))];
  }
  if (rascunho.classe === 'ocultista') {
    return [...new Set(['ocultismo', 'vontade', ...livres])];
  }
  return [...new Set(livres)];
}

function obterQuantidadePericiasLivres(rascunho) {
  const intelecto = Number.parseInt(rascunho.atributos?.int, 10) || 0;
  if (rascunho.classe === 'especialista') return 7 + intelecto;
  if (rascunho.classe === 'ocultista') {
    const origem = new Set(obterPericiasOrigem(rascunho));
    const sobreposicoes = ['ocultismo', 'vontade'].filter(pericia => origem.has(pericia)).length;
    return 3 + intelecto + sobreposicoes;
  }
  return 1 + intelecto;
}

function obterOrigens() {
  return Object.entries(OpcoesOrigem)
    .map(([key, nome]) => ({ key, nome, ...obterDadosOrigem(key) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function criarRascunhoCriacao(dados, jogadorPadrao = '') {
  const info = dados?.info || {};
  const origem = info.origem || 'desgarrado';
  const classe = CLASSES_CRIACAO[info.classe] ? info.classe : 'especialista';
  const periciasOrigem = obterDadosOrigem(origem);
  const escolhasSalvas = Array.isArray(info.criacao_pericias_origem)
    ? info.criacao_pericias_origem
    : [];
  const livresSalvas = Array.isArray(info.criacao_pericias_classe)
    ? info.criacao_pericias_classe
    : [];

  return {
    nome: info.nome || '',
    jogador: info.jogador || jogadorPadrao || '',
    conceito: info.conceito || '',
    origem,
    opcoesOrigem: { ...(info.criacao_opcoes_origem || {}) },
    classe,
    atributos: ATRIBUTOS_CRIACAO.reduce((acc, atributo) => {
      acc[atributo.key] = Number.parseInt(dados?.atributos?.[atributo.key], 10) || 0;
      return acc;
    }, {}),
    periciasOrigemEscolhidas: escolhasSalvas.filter(pericia => !(periciasOrigem.fixas || []).includes(pericia)),
    periciaCombate: info.criacao_pericia_combate || '',
    periciaResistencia: info.criacao_pericia_resistencia || '',
    periciasClasseLivres: livresSalvas,
    etapa: limitarEtapa(info.criacao_etapa),
  };
}

function validarEtapaCriacao(etapa, rascunho) {
  if (etapa === 0) {
    if (rascunho.nome.trim().length < 2) return 'Dê um nome com pelo menos 2 caracteres ao personagem.';
    if (rascunho.conceito.trim().length > 240) return 'Resuma o conceito em até 240 caracteres.';
  }

  if (etapa === 1) {
    if (!OpcoesOrigem[rascunho.origem]) return 'Escolha uma origem para continuar.';
    const dadosOrigem = obterDadosOrigem(rascunho.origem);
    const opcoesNarrativas = dadosOrigem.opcoesNarrativas || [];
    const opcaoPendente = opcoesNarrativas.find(opcao => !rascunho.opcoesOrigem?.[opcao.key]);
    if (opcaoPendente) return `Escolha ${opcaoPendente.titulo.toLocaleLowerCase('pt-BR')} para continuar.`;
    const escolhas = dadosOrigem.escolhas || [];
    const quantidade = escolhas.reduce((total, escolha) => total + (escolha.quantidade || 0), 0);
    if ((rascunho.periciasOrigemEscolhidas || []).length !== quantidade) {
      return `Escolha ${quantidade} ${quantidade === 1 ? 'perícia' : 'perícias'} para completar esta origem.`;
    }
    const selecionadas = rascunho.periciasOrigemEscolhidas || [];
    const escolhasInvalidas = escolhas.some(escolha => {
      const narrativa = escolha.grupo ? rascunho.opcoesOrigem?.elemento_ritual : null;
      const permitidas = narrativa && escolha.opcoesPorNarrativa?.[narrativa]
        ? escolha.opcoesPorNarrativa[narrativa]
        : escolha.opcoes;
      return Array.isArray(permitidas)
        && selecionadas.filter(pericia => permitidas.includes(pericia)).length !== (escolha.quantidade || 0);
    });
    if (escolhasInvalidas) return 'A perícia escolhida não corresponde à opção definida para esta origem.';
  }

  if (etapa === 2 && !CLASSES_CRIACAO[rascunho.classe]) {
    return 'Escolha uma classe para continuar.';
  }

  if (etapa === 3) {
    const valores = ATRIBUTOS_CRIACAO.map(({ key }) => Number.parseInt(rascunho.atributos[key], 10) || 0);
    const limite = rascunho.classe === 'sobrevivente' ? 8 : 9;
    if (valores.some(valor => valor < 0 || valor > 3)) return 'Na criação, cada atributo deve ficar entre 0 e 3.';
    if (valores.filter(valor => valor === 0).length > 1) return 'Somente um atributo pode ser reduzido para 0.';
    if (valores.reduce((total, valor) => total + valor, 0) !== limite) {
      const pontos = rascunho.classe === 'sobrevivente' ? 3 : 4;
      return `Distribua exatamente ${pontos} pontos além dos valores iniciais.`;
    }
  }

  if (etapa === 4) {
    const origem = new Set(obterPericiasOrigem(rascunho));
    const livres = rascunho.periciasClasseLivres || [];
    const quantidade = obterQuantidadePericiasLivres(rascunho);
    if (rascunho.classe === 'combatente') {
      if (!['luta', 'pontaria'].includes(rascunho.periciaCombate) || origem.has(rascunho.periciaCombate)) {
        return 'Escolha Luta ou Pontaria como treinamento de combate.';
      }
      if (!['fortitude', 'reflexos'].includes(rascunho.periciaResistencia) || origem.has(rascunho.periciaResistencia)) {
        return 'Escolha Fortitude ou Reflexos como resistência.';
      }
    }
    if (livres.length !== quantidade) {
      return `Escolha exatamente ${quantidade} ${quantidade === 1 ? 'perícia livre' : 'perícias livres'}.`;
    }
    const reservadas = new Set([
      ...origem,
      rascunho.periciaCombate,
      rascunho.periciaResistencia,
      ...(rascunho.classe === 'ocultista' ? ['ocultismo', 'vontade'] : []),
    ].filter(Boolean));
    if (new Set(livres).size !== livres.length || livres.some(pericia => reservadas.has(pericia))) {
      return 'Há perícias repetidas entre sua origem e sua classe. Troque as opções destacadas.';
    }
  }

  return '';
}

function montarDadosCriacao(dadosBase, rascunho, { concluida = false, etapa = rascunho.etapa } = {}) {
  const dados = copiar(dadosBase || new Personagem().getDados());
  const periciasOrigem = obterPericiasOrigem(rascunho);
  const periciasClasse = obterPericiasClasse(rascunho);
  const periciasTreinadas = new Set([...periciasOrigem, ...periciasClasse]);

  dados.info = {
    ...(dados.info || {}),
    nome: rascunho.nome.trim(),
    jogador: rascunho.jogador.trim(),
    conceito: rascunho.conceito.trim(),
    origem: rascunho.origem,
    classe: rascunho.classe,
    trilha: 'nenhuma',
    nex: rascunho.classe === 'sobrevivente' ? '0%' : '5%',
    estagio_sobrevivente: 1,
    criacao_concluida: concluida,
    criacao_em_andamento: !concluida,
    criacao_etapa: limitarEtapa(etapa),
    criacao_opcoes_origem: { ...(rascunho.opcoesOrigem || {}) },
    criacao_pericias_origem: [...(rascunho.periciasOrigemEscolhidas || [])],
    criacao_pericia_combate: rascunho.periciaCombate || '',
    criacao_pericia_resistencia: rascunho.periciaResistencia || '',
    criacao_pericias_classe: [...(rascunho.periciasClasseLivres || [])],
  };
  dados.atributos = { ...rascunho.atributos };
  dados.pericias = Object.keys(dados.pericias || {}).reduce((acc, pericia) => {
    acc[pericia] = periciasTreinadas.has(pericia) ? 5 : 0;
    return acc;
  }, {});
  dados.periciasOrigemAplicadas = periciasOrigem;

  // Recalcula recursos do zero para que a ficha comece com PV, PE e SAN cheios.
  delete dados.recursos;
  const personagem = new Personagem();
  personagem.carregarDados(dados);
  personagem.calcularValoresMaximos();
  const resultado = personagem.getDados();
  resultado.recursos.pv_atual = resultado.recursos.pv_max;
  resultado.recursos.pe_atual = resultado.recursos.pe_max;
  resultado.recursos.san_atual = resultado.recursos.san_max;
  return resultado;
}

function deveExibirCriador(info = {}) {
  if (info.criacao_concluida === true) return false;
  return info.criacao_em_andamento === true || !String(info.nome || '').trim();
}

export {
  ATRIBUTOS_CRIACAO,
  CLASSES_CRIACAO,
  ETAPAS_CRIACAO,
  PERICIAS_CRIACAO,
  criarRascunhoCriacao,
  deveExibirCriador,
  montarDadosCriacao,
  obterDadosOrigem,
  obterOrigens,
  obterPericiasClasse,
  obterPericiasOrigem,
  obterQuantidadePericiasLivres,
  validarEtapaCriacao,
};
