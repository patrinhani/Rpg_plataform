// src/lib/calculosCombate.js

const MODIFICACOES_DE_DANO = new Set([
  'calibre_grosso',
  'cruel',
  'lancinante',
  'erosiva',
  'explosiva',
]);

function modificarParcelaDano(parcela, modificacoes) {
  const match = String(parcela).trim().match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/i);
  if (!match) return null;

  let quantidade = Number.parseInt(match[1], 10);
  const faces = Number.parseInt(match[2], 10);
  let bonusFixo = match[4] ? Number.parseInt(match[4], 10) : 0;
  if (match[3] === '-') bonusFixo *= -1;

  if (modificacoes.includes('calibre_grosso')) quantidade += 1;
  if (modificacoes.includes('cruel')) bonusFixo += 2;

  const bonusFormatado = bonusFixo === 0
    ? ''
    : `${bonusFixo > 0 ? '+' : ''}${bonusFixo}`;
  return `${quantidade}d${faces}${bonusFormatado}`;
}

export function calcularDanoArma(item) {
  if (!item.dano) return null;

  const modificacoes = Array.isArray(item.modificacoes) ? item.modificacoes : [];
  if (!modificacoes.some(modificacao => MODIFICACOES_DE_DANO.has(modificacao))) return item.dano;

  const parcelasAlternativas = String(item.dano).split('/');
  const parcelasModificadas = parcelasAlternativas.map(parcela =>
    modificarParcelaDano(parcela, modificacoes),
  );
  const danoBase = parcelasModificadas.every(Boolean)
    ? parcelasModificadas.join('/')
    : String(item.dano);

  const danosExtras = [];
  if (modificacoes.includes('lancinante')) danosExtras.push('1d8');
  if (modificacoes.includes('erosiva')) danosExtras.push('1d8');
  if (modificacoes.includes('explosiva')) danosExtras.push('2d6');

  return [danoBase, ...danosExtras].join(' + ');
}
