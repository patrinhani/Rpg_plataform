import test from 'node:test';
import assert from 'node:assert/strict';

import {
  overlayMotionLabel,
  resolveOverlayMotionPreset,
} from '../src/features/vtt-table/overlay-motion.js';

test('respeita um preset explícito de movimento', () => {
  assert.equal(resolveOverlayMotionPreset({ motionPreset: 'water', name: 'eletricidade' }), 'water');
  assert.equal(resolveOverlayMotionPreset({ motion: 'none', name: 'inundação' }), 'none');
});

test('infere efeitos seguros a partir da semântica do overlay', () => {
  assert.equal(resolveOverlayMotionPreset({ name: 'eletrificação' }), 'electric');
  assert.equal(resolveOverlayMotionPreset({ label: 'Área inundada' }), 'water');
  assert.equal(resolveOverlayMotionPreset({ assetId: 'asset:telas-quebradas-overlay.png' }), 'glitch');
  assert.equal(resolveOverlayMotionPreset({ name: 'fragmento-removido' }), 'none');
});

test('expõe rótulos somente para presets animados', () => {
  assert.equal(overlayMotionLabel('electric'), 'Pulso elétrico');
  assert.equal(overlayMotionLabel('water'), 'Reflexo de água');
  assert.equal(overlayMotionLabel('glitch'), 'Interferência');
  assert.equal(overlayMotionLabel('none'), '');
});

