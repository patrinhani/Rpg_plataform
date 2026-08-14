import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampVttCharacterField,
  normalizeVttCharacterSheet,
  normalizeVttCharacterSheets,
} from '../src/lib/vtt-character-monitor.js';

test('normaliza recursos e perseguição para o monitor do mestre', () => {
  const sheet = normalizeVttCharacterSheet(' agente-1 ', {
    info: { nome: 'Carina', classe: 'Especialista', nex: '15%' },
    recursos: {
      pv_atual: 17,
      pv_max: 20,
      pe_atual: 99,
      pe_max: 12,
      san_atual: -2,
      san_max: 24,
    },
    perseguicao: { sucessos: 4, falhas: 9, metaSucessos: 5, metaFalhas: 3 },
  });

  assert.equal(sheet.uid, 'agente-1');
  assert.deepEqual(sheet.resources, {
    pv: { current: 17, maximum: 20 },
    pe: { current: 12, maximum: 12 },
    san: { current: 0, maximum: 24 },
  });
  assert.deepEqual(sheet.pursuit, {
    successes: 4,
    failures: 3,
    successTarget: 5,
    failureTarget: 3,
  });
});

test('remove fichas duplicadas e recusa campos arbitrários', () => {
  const sheets = normalizeVttCharacterSheets([
    { uid: 'a', data: { recursos: { pv_max: 10 } } },
    { uid: 'a', data: { recursos: { pv_max: 99 } } },
    { uid: '', data: {} },
  ]);

  assert.equal(sheets.length, 1);
  assert.equal(clampVttCharacterField('recursos.pv_atual', 18, sheets[0]), 10);
  assert.equal(clampVttCharacterField('perseguicao.falhas', -1, sheets[0]), 0);
  assert.throws(
    () => clampVttCharacterField('info.nome', 1, sheets[0]),
    /não permitido/,
  );
});
