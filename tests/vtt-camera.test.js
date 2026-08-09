import assert from 'node:assert/strict';
import test from 'node:test';
import {
  constrainVttCamera,
  zoomVttCameraAtPoint,
} from '../src/features/vtt-table/camera.js';

const dimensions = {
  minimumZoom: 0.55,
  maximumZoom: 3.2,
  stageWidth: 1000,
  stageHeight: 800,
  viewportWidth: 800,
  viewportHeight: 600,
};

test('zoom mantém o ponto sob o cursor estável quando há área para navegar', () => {
  const current = { x: 0, y: 0, scale: 1 };
  const pointer = { x: 120, y: -80 };
  const next = zoomVttCameraAtPoint(current, {
    ...dimensions,
    pointerX: pointer.x,
    pointerY: pointer.y,
    deltaY: -300,
  });
  const worldBefore = {
    x: (pointer.x - current.x) / current.scale,
    y: (pointer.y - current.y) / current.scale,
  };
  const worldAfter = {
    x: (pointer.x - next.x) / next.scale,
    y: (pointer.y - next.y) / next.scale,
  };
  assert.ok(next.scale > current.scale);
  assert.ok(Math.abs(worldAfter.x - worldBefore.x) < 1e-9);
  assert.ok(Math.abs(worldAfter.y - worldBefore.y) < 1e-9);
});

test('câmera impede que um mapa enquadrado seja arrastado para fora da tela', () => {
  assert.deepEqual(constrainVttCamera(
    { x: 300, y: -250, scale: 1 },
    { ...dimensions, stageWidth: 700, stageHeight: 500 },
  ), { x: 0, y: 0, scale: 1 });
});

test('câmera limita zoom e deslocamento ao conteúdo visível', () => {
  assert.deepEqual(constrainVttCamera(
    { x: 1900, y: -1900, scale: 9 },
    dimensions,
  ), { x: 1200, y: -980, scale: 3.2 });
  const zoomedOut = zoomVttCameraAtPoint(
    { x: 0, y: 0, scale: 0.6 },
    { ...dimensions, pointerX: 0, pointerY: 0, deltaY: 1000 },
  );
  assert.equal(zoomedOut.scale, 0.55);
});
