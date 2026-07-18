import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MESA_LEGADA_MEMBROS_ERRO,
  criarMembrosIniciais,
  obterMembrosMesa,
  obterPapelNaMesa,
  removerMembroDaMesa,
} from '../src/lib/mesa-membership.js';

test('mesa nova começa somente com o mestre na lista de membros', () => {
  assert.deepEqual(criarMembrosIniciais(' mestre-1 '), ['mestre-1']);
  assert.throws(() => criarMembrosIniciais(''), /UID do mestre inválido/);
});

test('papel é derivado de mestre e membroUids sem depender da lista visual', () => {
  const mesa = {
    mestre: 'mestre-1',
    membroUids: ['mestre-1', 'agente-1'],
    jogadores: [],
  };

  assert.equal(obterPapelNaMesa(mesa, 'mestre-1'), 'mestre');
  assert.equal(obterPapelNaMesa(mesa, 'agente-1'), 'jogador');
  assert.equal(obterPapelNaMesa(mesa, 'intruso'), null);
});

test('mesa legada falha com orientação explícita de backfill', () => {
  assert.throws(
    () => obterMembrosMesa({ mestre: 'mestre-1', jogadores: [] }),
    erro => erro.message === MESA_LEGADA_MEMBROS_ERRO,
  );
});

test('lista inconsistente não concede acesso e não permite remover o mestre', () => {
  assert.throws(
    () => obterMembrosMesa({ mestre: 'mestre-1', membroUids: ['agente-1'] }),
    /não inclui o mestre/,
  );
  assert.throws(
    () => obterMembrosMesa({ mestre: 'mestre-1', membroUids: ['mestre-1', 'mestre-1'] }),
    /inconsistente/,
  );

  const mesa = { mestre: 'mestre-1', membroUids: ['mestre-1', 'agente-1'] };
  assert.deepEqual(removerMembroDaMesa(mesa, 'agente-1'), ['mestre-1']);
  assert.throws(() => removerMembroDaMesa(mesa, 'mestre-1'), /não pode ser removido/);
});
