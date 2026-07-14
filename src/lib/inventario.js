import {
  modificacoesAcessorios,
  modificacoesArmas,
  modificacoesProtecoes,
} from './database.js';

const TODAS_MODIFICACOES = [
  ...modificacoesArmas,
  ...modificacoesProtecoes,
  ...modificacoesAcessorios,
];

const MODIFICACOES_POR_CHAVE = new Map(
  TODAS_MODIFICACOES.map(modificacao => [modificacao.key, modificacao]),
);

const ARMAS_DE_FOGO = new Set([
  'pistola',
  'revolver',
  'fuzil_caca',
  'revolver_compacto',
  'submetralhadora',
  'espingarda',
  'fuzil_assalto',
  'fuzil_precisao',
  'espingarda_cano_duplo',
  'pistola_pesada',
  'metralhadora',
  'gatling',
]);

const ARMAS_DE_DISPARO = new Set([
  'arco',
  'besta',
  'estilingue',
  'pregador_pneumatico',
  'arco_composto',
  'balestra',
]);

const MUNICOES_DE_BALAS = new Set(['balas_curtas', 'balas_longas']);
const ORDEM_ALCANCE = ['Curto', 'Médio', 'Longo', 'Extremo'];

export function getModificacao(chave) {
  return MODIFICACOES_POR_CHAVE.get(chave) || null;
}

export function getTodasModificacoes() {
  return [...TODAS_MODIFICACOES];
}

export function inferirTiposItem(item = {}) {
  const tipos = new Set(Array.isArray(item.tiposItem) ? item.tiposItem : []);
  if (item.tipoItem) tipos.add(item.tipoItem);
  if (item.tipoItem === 'arma-fogo') {
    tipos.add('arma');
    tipos.add('arma-fogo-mira');
  }
  if (item.tipoItem === 'arma-corpo-a-corpo') tipos.add('arma');
  if (item.tipoItem === 'protecao-leve' || item.tipoItem === 'protecao-pesada') tipos.add('protecao');

  if (item.dano) {
    tipos.add('arma');
    if (ARMAS_DE_FOGO.has(item.id)) {
      tipos.add('arma-fogo');
      tipos.add('arma-fogo-mira');
      if (/autom[aá]tica/i.test(item.descricao || '')) tipos.add('arma-fogo-automatica');
    } else {
      tipos.add('arma-corpo-a-corpo');
      if (ARMAS_DE_DISPARO.has(item.id)) tipos.add('arma-disparo');
    }
  }

  if (MUNICOES_DE_BALAS.has(item.id)) tipos.add('arma-fogo-balas');

  if (item.id === 'protecao_leve') tipos.add('protecao-leve');
  if (item.id === 'protecao_pesada') tipos.add('protecao-pesada');
  if (item.id?.startsWith('protecao_')) tipos.add('protecao');
  if (item.id?.startsWith('escudo')) tipos.add('protecao');

  if (['generico', 'custom', 'kit'].includes(item.tipoBonus)) tipos.add('acessorio');
  if (item.eletrico) tipos.add('acessorio-eletrico');

  return tipos;
}

export function getModificacoesCompativeis(item) {
  const tipos = inferirTiposItem(item);
  return TODAS_MODIFICACOES.filter(modificacao =>
    modificacao.tipo?.some(tipo => tipos.has(tipo)),
  );
}

export function normalizarModificacoes(modificacoes = []) {
  return [...new Set(modificacoes.filter(Boolean))];
}

export function calcularBonusCapacidadeCargaItem(item = {}) {
  const bonusDeclarado = Number.parseFloat(item.bonusCapacidadeCarga);
  if (Number.isFinite(bonusDeclarado)) return Math.max(0, bonusDeclarado);

  const idLegado = typeof item.inventarioId === 'string' ? item.inventarioId : null;
  return item.id === 'mochila_militar' || idLegado === 'mochila_militar' ? 2 : 0;
}

export function calcularStatsItem(item = {}) {
  const modificacoes = normalizarModificacoes(item.modificacoes);
  let categoria = Number.parseInt(item.categoriaBase ?? item.categoria, 10) || 0;
  let espacos = Number.parseFloat(item.espacosBase ?? item.espacos) || 0;

  for (const chave of modificacoes) {
    const modificacao = getModificacao(chave);
    categoria += modificacao?.cat ?? 1;
    espacos += modificacao?.espacos ?? 0;
  }

  return {
    categoria,
    espacos: Math.max(0, espacos),
    modificacoes,
  };
}

export function calcularDefesaItem(item = {}) {
  const base = Number.parseInt(item.defesa, 10) || 0;
  return base + (normalizarModificacoes(item.modificacoes).includes('reforcada') ? 2 : 0);
}

export function calcularBonusAtaqueItem(item = {}) {
  const modificacoes = normalizarModificacoes(item.modificacoes);
  return (modificacoes.includes('alongada') ? 2 : 0)
    + (modificacoes.includes('certeira') ? 2 : 0);
}

export function calcularCriticoItem(item = {}) {
  if (!item.critico) return null;

  const texto = String(item.critico).toLowerCase();
  const margemEncontrada = texto.match(/(?:^|\/)(1\d|20)(?:\/|$)/);
  const multiplicadorEncontrado = texto.match(/x(\d+)/);
  let margem = margemEncontrada ? Number.parseInt(margemEncontrada[1], 10) : 20;
  let multiplicador = multiplicadorEncontrado ? Number.parseInt(multiplicadorEncontrado[1], 10) : 2;
  const modificacoes = normalizarModificacoes(item.modificacoes);

  if (modificacoes.includes('mira_laser') || modificacoes.includes('perigosa')) margem -= 2;
  if (modificacoes.includes('dum_dum')) multiplicador += 1;

  margem = Math.max(2, margem);
  return `${margem}/x${multiplicador}`;
}

export function calcularAlcanceItem(item = {}) {
  const alcance = item.alcance || null;
  if (!alcance || !normalizarModificacoes(item.modificacoes).includes('mira_telescopica')) return alcance;

  const indice = ORDEM_ALCANCE.findIndex(valor => valor.toLowerCase() === String(alcance).toLowerCase());
  if (indice < 0) return alcance;
  return ORDEM_ALCANCE[Math.min(indice + 1, ORDEM_ALCANCE.length - 1)];
}

export function modificacoesSaoIncompativeis(primeira, segunda) {
  const par = new Set([primeira, segunda]);
  return par.has('reforcada') && par.has('discreta_protecao');
}
