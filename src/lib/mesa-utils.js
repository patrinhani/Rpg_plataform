function uuidComRandomValues(cryptoApi) {
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hexadecimal = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [
    hexadecimal.slice(0, 8),
    hexadecimal.slice(8, 12),
    hexadecimal.slice(12, 16),
    hexadecimal.slice(16, 20),
    hexadecimal.slice(20),
  ].join('-');
}

export function criarIdEntidadeMesa(prefixo, cryptoApi = globalThis.crypto) {
  let identificador;

  if (typeof cryptoApi?.randomUUID === 'function') {
    identificador = cryptoApi.randomUUID();
  } else if (typeof cryptoApi?.getRandomValues === 'function') {
    identificador = uuidComRandomValues(cryptoApi);
  } else {
    throw new Error('Web Crypto não está disponível para gerar um ID seguro.');
  }

  return `${prefixo}_${identificador}`;
}

export function criarListaInicialIniciativa(jogadores, mestreUid) {
  const idsIncluidos = new Set();

  return (Array.isArray(jogadores) ? jogadores : [])
    .filter((jogador) => {
      const uid = String(jogador?.uid || '').trim();
      if (!uid || uid === mestreUid || idsIncluidos.has(uid)) return false;
      idsIncluidos.add(uid);
      return true;
    })
    .map((jogador) => ({
      uid: jogador.uid,
      nome: String(jogador.nome || '').trim() || 'Agente',
      valor: 0,
      isNPC: false,
    }));
}

export function resolverNomeLegivelJogador(jogadorUid, jogadorNome, nomeExistente) {
  const candidatos = [jogadorNome, nomeExistente];
  const nome = candidatos
    .map((candidato) => String(candidato || '').trim())
    .find((candidato) => candidato && candidato !== jogadorUid);

  return nome || 'Agente';
}

export function removerParticipanteDaIniciativa(iniciativas, uidAlvo, turnoAtual = 0) {
  const listaAtual = Array.isArray(iniciativas) ? iniciativas : [];
  const novaLista = listaAtual.filter((iniciativa) => iniciativa?.uid !== uidAlvo);

  if (novaLista.length === 0 || listaAtual.length === 0) {
    return { iniciativas: novaLista, turnoAtual: 0 };
  }

  const indiceInformado = Number.isInteger(turnoAtual) ? turnoAtual : 0;
  const indiceAtual = ((indiceInformado % listaAtual.length) + listaAtual.length) % listaAtual.length;
  const participanteAtual = listaAtual[indiceAtual];

  if (participanteAtual?.uid !== uidAlvo) {
    const indiceMantido = novaLista.findIndex((iniciativa) => iniciativa.uid === participanteAtual?.uid);
    return { iniciativas: novaLista, turnoAtual: Math.max(0, indiceMantido) };
  }

  for (let deslocamento = 1; deslocamento < listaAtual.length; deslocamento += 1) {
    const sucessor = listaAtual[(indiceAtual + deslocamento) % listaAtual.length];
    const indiceSucessor = novaLista.findIndex((iniciativa) => iniciativa.uid === sucessor?.uid);
    if (indiceSucessor >= 0) {
      return { iniciativas: novaLista, turnoAtual: indiceSucessor };
    }
  }

  return { iniciativas: novaLista, turnoAtual: 0 };
}
