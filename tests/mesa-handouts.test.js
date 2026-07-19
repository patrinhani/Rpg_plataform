import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMesaHandoutAssetUrl,
  projectMesaHandoutSnapshot,
} from '../src/features/vtt-handouts/mesa-handouts.js';

const grant = {
  serverOrigin: 'http://127.0.0.1:8765',
  roomId: 'sala-ordem',
  mediaToken: 'token temporário/seguro',
  role: 'master',
};

test('monta URL protegida codificando asset e credencial efêmera', () => {
  const value = buildMesaHandoutAssetUrl({
    ...grant,
    assetId: 'asset:documento com espaço.png',
  });
  const url = new URL(value);

  assert.equal(url.origin, 'http://127.0.0.1:8765');
  assert.equal(url.pathname, '/api/vtt/rooms/sala-ordem/assets');
  assert.equal(url.searchParams.get('assetId'), 'asset:documento com espaço.png');
  assert.equal(url.searchParams.get('access'), 'token temporário/seguro');
});

test('projeta catálogo e referências privadas somente para o Mestre', () => {
  const view = projectMesaHandoutSnapshot({
    catalog: {
      handoutAssets: [
        { assetId: 'asset:bilhete', label: 'Bilhete' },
        { assetId: 'asset:foto', label: 'Fotografia' },
      ],
      masterReferenceAssets: [
        { assetId: 'asset:guia-mestre', label: 'Guia do Mestre' },
      ],
    },
    deliveredHandouts: [
      { assetId: 'asset:bilhete', label: 'Bilhete entregue', deliveredAt: '2026-07-18T20:00:00Z' },
    ],
  }, grant);

  assert.equal(view.deliveredHandouts.length, 1);
  assert.equal(view.deliveredHandouts[0].delivered, true);
  assert.match(view.deliveredHandouts[0].url, /access=/);
  assert.deepEqual(
    view.handoutCatalog.map(({ assetId, delivered }) => ({ assetId, delivered })),
    [
      { assetId: 'asset:bilhete', delivered: true },
      { assetId: 'asset:foto', delivered: false },
    ],
  );
  assert.equal(view.masterReferences[0].privateReference, true);
  assert.match(view.masterReferences[0].url, /asset%3Aguia-mestre/);
});

test('jogador nunca recebe catálogo nem referências privadas', () => {
  const view = projectMesaHandoutSnapshot({
    catalog: {
      handoutAssets: [{ assetId: 'asset:segredo', label: 'Segredo' }],
      masterReferenceAssets: [{ assetId: 'asset:guia', label: 'Guia' }],
    },
    deliveredHandouts: [{ assetId: 'asset:publico', label: 'Pista pública' }],
  }, { ...grant, role: 'player' });

  assert.deepEqual(view.handoutCatalog, []);
  assert.deepEqual(view.masterReferences, []);
  assert.equal(view.deliveredHandouts.length, 1);
  assert.equal(view.deliveredHandouts[0].assetId, 'asset:publico');
  assert.match(view.deliveredHandouts[0].url, /asset%3Apublico/);
});

test('nega hidratação quando a concessão de mídia está incompleta', () => {
  const view = projectMesaHandoutSnapshot({
    deliveredHandouts: [{ assetId: 'asset:publico' }],
  }, { ...grant, mediaToken: '' });

  assert.deepEqual(view, {
    deliveredHandouts: [],
    handoutCatalog: [],
    masterReferences: [],
  });
});
