import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canOpenTokenCharacterSheet,
  normalizeCharacterSheetUids,
} from '../src/features/vtt-table/token-sheets.js';

test('normaliza UIDs de fichas disponíveis sem aceitar entradas vazias', () => {
  assert.deepEqual(
    [...normalizeCharacterSheetUids([' agente-1 ', '', null, 'agente-2'])],
    ['agente-1', 'agente-2'],
  );
});

test('somente mestre abre a ficha vinculada ao controlador do token', () => {
  const available = normalizeCharacterSheetUids(['agente-1']);
  assert.equal(canOpenTokenCharacterSheet({
    role: 'master',
    controllerUid: 'agente-1',
    characterSheetUids: available,
  }), true);
  assert.equal(canOpenTokenCharacterSheet({
    role: 'player',
    controllerUid: 'agente-1',
    characterSheetUids: available,
  }), false);
  assert.equal(canOpenTokenCharacterSheet({
    role: 'master',
    controllerUid: 'agente-sem-ficha',
    characterSheetUids: available,
  }), false);
});
