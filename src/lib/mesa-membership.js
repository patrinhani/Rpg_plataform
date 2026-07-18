export const MESA_LEGADA_MEMBROS_ERRO =
  'Esta mesa ainda usa o formato antigo de participantes. O mestre precisa executar o backfill de membroUids antes de continuar.';

function normalizarUid(uid) {
  return typeof uid === 'string' ? uid.trim() : '';
}

export function criarMembrosIniciais(mestreUid) {
  const uid = normalizarUid(mestreUid);
  if (!uid) throw new Error('UID do mestre inválido.');
  return [uid];
}

export function obterMembrosMesa(dadosMesa) {
  if (!Array.isArray(dadosMesa?.membroUids)) {
    throw new Error(MESA_LEGADA_MEMBROS_ERRO);
  }

  const membros = dadosMesa.membroUids.map(normalizarUid).filter(Boolean);
  if (membros.length !== dadosMesa.membroUids.length || new Set(membros).size !== membros.length) {
    throw new Error('A lista de membros desta mesa está inconsistente. Peça ao mestre para revisar a migração.');
  }

  const mestreUid = normalizarUid(dadosMesa.mestre);
  if (!mestreUid || !membros.includes(mestreUid)) {
    throw new Error('A lista de membros desta mesa não inclui o mestre. Peça ao mestre para revisar a migração.');
  }

  return membros;
}

export function obterPapelNaMesa(dadosMesa, uid) {
  const uidNormalizado = normalizarUid(uid);
  const membros = obterMembrosMesa(dadosMesa);
  if (!uidNormalizado || !membros.includes(uidNormalizado)) return null;
  return dadosMesa.mestre === uidNormalizado ? 'mestre' : 'jogador';
}

export function removerMembroDaMesa(dadosMesa, uidAlvo) {
  const alvo = normalizarUid(uidAlvo);
  const membros = obterMembrosMesa(dadosMesa);
  if (alvo && alvo === normalizarUid(dadosMesa.mestre)) {
    throw new Error('O mestre não pode ser removido da própria mesa.');
  }
  return membros.filter(uid => uid !== alvo);
}
