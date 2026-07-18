import assert from 'node:assert/strict';
import test from 'node:test';

import { planejarBackfillMesa } from '../scripts/backfill-mesa-membership.mjs';

const mesaValida = {
  mestre: 'mestre-1',
  jogadores: [
    { uid: 'mestre-1', nome: 'Mestre' },
    { uid: 'agente-1', nome: 'Agente' },
  ],
};

test('backfill deriva membroUids sem alterar a ordem dos jogadores', () => {
  assert.deepEqual(planejarBackfillMesa(mesaValida), {
    status: 'pendente',
    membroUids: ['mestre-1', 'agente-1'],
  });
});

test('backfill é idempotente e aceita a mesma associação em outra ordem', () => {
  assert.deepEqual(planejarBackfillMesa({
    ...mesaValida,
    membroUids: ['agente-1', 'mestre-1'],
  }), {
    status: 'inalterada',
    membroUids: ['mestre-1', 'agente-1'],
  });
});

test('backfill bloqueia documentos ambíguos em vez de sobrescrevê-los', () => {
  assert.equal(planejarBackfillMesa({ ...mesaValida, mestre: '' }).status, 'bloqueada');
  assert.equal(planejarBackfillMesa({
    ...mesaValida,
    jogadores: [...mesaValida.jogadores, { uid: 'agente-1', nome: 'Duplicado' }],
  }).status, 'bloqueada');
  assert.equal(planejarBackfillMesa({
    ...mesaValida,
    membroUids: ['mestre-1', 'intruso'],
  }).status, 'conflito');
});
