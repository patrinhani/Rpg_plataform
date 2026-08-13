import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AFFINITY_NEX_THRESHOLD,
  crossedAffinityThreshold,
  getNexAffinityState,
  normalizeNex,
} from '../src/lib/nex-affinity.js';

test('normaliza o NEX usado pela progressão de afinidade', () => {
  assert.equal(normalizeNex('35%'), 35);
  assert.equal(normalizeNex(-10), 0);
  assert.equal(normalizeNex('sem nex'), 0);
  assert.equal(normalizeNex('120%'), 99);
});

test('evolui continuamente até desbloquear a afinidade no NEX 50%', () => {
  assert.deepEqual(getNexAffinityState('0%'), {
    nex: 0,
    progress: 0,
    stage: 'latente',
    unlocked: false,
    remaining: 50,
  });
  assert.equal(getNexAffinityState('25%').progress, 0.5);
  assert.equal(getNexAffinityState('35%').stage, 'iminente');
  assert.deepEqual(getNexAffinityState('50%'), {
    nex: AFFINITY_NEX_THRESHOLD,
    progress: 1,
    stage: 'desperto',
    unlocked: true,
    remaining: 0,
  });
});

test('anima somente quando a ficha cruza o limiar durante a sessão', () => {
  assert.equal(crossedAffinityThreshold(null, '50%'), false);
  assert.equal(crossedAffinityThreshold('40%', '49%'), false);
  assert.equal(crossedAffinityThreshold('49%', '50%'), true);
  assert.equal(crossedAffinityThreshold('40%', '55%'), true);
  assert.equal(crossedAffinityThreshold('50%', '55%'), false);
});
