import assert from 'node:assert/strict';
import test from 'node:test';

import {
  filterHandouts,
  isCampaignVttState,
  normalizeHandoutCollection,
  resolveHandoutView,
  resolveMasterReferenceView,
} from '../src/features/vtt-table/handouts.js';

test('distingue snapshots de campanha do tabuleiro de demonstração', () => {
  assert.equal(isCampaignVttState({
    tokens: { 'demo-token': { id: 'demo-token', x: 0.5, y: 0.5 } },
  }), false);
  assert.equal(isCampaignVttState({
    scene: null,
    deliveredHandouts: [],
    tokens: {},
  }), true);
  assert.equal(isCampaignVttState({
    scene: { id: 'scene:helix-9' },
    tokens: {},
  }), true);
});

test('normaliza listas e mapas de handouts sem duplicar assetId', () => {
  assert.deepEqual(
    normalizeHandoutCollection({
      'asset:primeiro': { label: 'Primeiro', image: { width: 800, height: 1200 } },
      alias: { assetId: 'asset:primeiro', label: 'Versão final' },
      'asset:segundo': 'asset:segundo',
    }).map(({ assetId, label }) => ({ assetId, label })),
    [
      { assetId: 'asset:primeiro', label: 'Versão final' },
      { assetId: 'asset:segundo', label: 'Segundo' },
    ],
  );
});

test('jogador enxerga somente a coleção entregue pelo snapshot', () => {
  const state = {
    catalog: {
      handoutAssets: [{ assetId: 'asset:secreto', label: 'Segredo do Mestre' }],
    },
    deliveredHandouts: [{ assetId: 'asset:publico', label: 'Bilhete', url: '/publico' }],
  };

  assert.deepEqual(resolveHandoutView(state, 'player'), [{
    assetId: 'asset:publico',
    label: 'Bilhete',
    mediaType: 'image/*',
    image: null,
    deliveredAt: null,
    url: '/publico',
    delivered: true,
  }]);
});

test('mestre recebe o catálogo completo com estado de entrega mesclado', () => {
  const result = resolveHandoutView({
    catalog: {
      handoutAssets: [
        { assetId: 'asset:a', label: 'A', url: '/a' },
        { assetId: 'asset:b', label: 'B', url: '/b' },
      ],
    },
    deliveredHandouts: [{ assetId: 'asset:b', label: 'B entregue', deliveredAt: '2026-07-18T20:00:00Z' }],
  }, 'master');

  assert.equal(result.length, 2);
  assert.equal(result[0].delivered, false);
  assert.equal(result[1].delivered, true);
  assert.equal(result[1].label, 'B entregue');
  assert.equal(result[1].url, '/b');
});

test('referências privadas existem apenas para o mestre e nunca são entregáveis', () => {
  const state = {
    catalog: {
      masterReferenceAssets: [{
        assetId: 'asset:referencia-mestre',
        label: 'Circuitos sobrepostos',
        url: '/privado',
      }],
    },
  };

  assert.deepEqual(resolveMasterReferenceView(state, 'player'), []);
  assert.deepEqual(resolveMasterReferenceView(state, 'master'), [{
    assetId: 'asset:referencia-mestre',
    label: 'Circuitos sobrepostos',
    mediaType: 'image/*',
    image: null,
    deliveredAt: null,
    url: '/privado',
    delivered: false,
    privateReference: true,
  }]);
});

test('busca considera título e identificador do arquivo', () => {
  const handouts = [
    { assetId: 'asset:relatorio-hm-09', label: 'Relatório' },
    { assetId: 'asset:bilhete-raul', label: 'Bilhete' },
  ];

  assert.deepEqual(filterHandouts(handouts, 'hm-09'), [handouts[0]]);
  assert.deepEqual(filterHandouts(handouts, 'bilhete'), [handouts[1]]);
});
