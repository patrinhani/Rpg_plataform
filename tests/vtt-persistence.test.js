import assert from 'node:assert/strict';
import test from 'node:test';
import { readVttPersistenceWarning } from '../src/lib/vtt-persistence.js';

test('mostra falha de persistência somente ao mestre', () => {
  const state = {
    persistence: {
      saved: false,
      message: '  A gravação no disco falhou.  ',
    },
  };

  assert.equal(readVttPersistenceWarning(state, 'master'), 'A gravação no disco falhou.');
  assert.equal(readVttPersistenceWarning(state, 'player'), '');
});

test('limpa o aviso quando o snapshot volta a estar salvo', () => {
  assert.equal(readVttPersistenceWarning({ persistence: { saved: true } }, 'master'), '');
  assert.equal(readVttPersistenceWarning({}, 'master'), '');
});

test('usa mensagem segura quando o backend não envia detalhe', () => {
  assert.match(
    readVttPersistenceWarning({ persistence: { saved: false } }, 'master'),
    /não foi salva no disco/i,
  );
});
