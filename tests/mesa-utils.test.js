import assert from 'node:assert/strict';
import test from 'node:test';

import {
  criarIdEntidadeMesa,
  criarListaInicialIniciativa,
  removerParticipanteDaIniciativa,
  resolverNomeLegivelJogador,
} from '../src/lib/mesa-utils.js';

test('iniciativa inicial ignora o mestre e participantes duplicados', () => {
  const iniciativas = criarListaInicialIniciativa([
    { uid: 'mestre-1', nome: 'Mestre' },
    { uid: 'agente-1', nome: 'Lívia' },
    { uid: 'agente-1', nome: 'Lívia repetida' },
    { uid: 'agente-2', nome: '' },
  ], 'mestre-1');

  assert.deepEqual(iniciativas, [
    { uid: 'agente-1', nome: 'Lívia', valor: 0, isNPC: false },
    { uid: 'agente-2', nome: 'Agente', valor: 0, isNPC: false },
  ]);
});

test('remoção preserva o participante ativo e avança quando ele é removido', () => {
  const lista = [
    { uid: 'a' },
    { uid: 'b' },
    { uid: 'c' },
  ];

  assert.deepEqual(removerParticipanteDaIniciativa(lista, 'a', 1), {
    iniciativas: [{ uid: 'b' }, { uid: 'c' }],
    turnoAtual: 0,
  });
  assert.deepEqual(removerParticipanteDaIniciativa(lista, 'b', 1), {
    iniciativas: [{ uid: 'a' }, { uid: 'c' }],
    turnoAtual: 1,
  });
});

test('nome do jogador nunca é substituído pelo UID técnico', () => {
  assert.equal(resolverNomeLegivelJogador('uid-123', ' Patrícia ', 'Nome antigo'), 'Patrícia');
  assert.equal(resolverNomeLegivelJogador('uid-123', 'uid-123', 'Lívia'), 'Lívia');
  assert.equal(resolverNomeLegivelJogador('uid-123', '', 'uid-123'), 'Agente');
});

test('IDs da mesa usam randomUUID e possuem fallback Web Crypto', () => {
  assert.equal(
    criarIdEntidadeMesa('npc', { randomUUID: () => 'uuid-controlado' }),
    'npc_uuid-controlado',
  );

  const idFallback = criarIdEntidadeMesa('monster', {
    getRandomValues(bytes) {
      bytes.fill(0xab);
      return bytes;
    },
  });

  assert.match(idFallback, /^monster_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.throws(
    () => criarIdEntidadeMesa('npc', {}),
    /Web Crypto não está disponível/,
  );
});
