import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePropStateOptions } from '../src/features/vtt-table/prop-state-groups.js';

const groups = [
  {
    id: 'state-group:emissor',
    key: 'emissor',
    label: 'Emissor',
    states: [
      {
        name: 'ativo',
        label: 'Ativo',
        assetId: 'asset:emissor-ativo-v2',
        version: 2,
        variants: [
          { assetId: 'asset:emissor-ativo-v1', version: 1 },
          { assetId: 'asset:emissor-ativo-v2', version: 2 },
        ],
      },
      {
        name: 'desativado',
        label: 'Desativado',
        assetId: 'asset:emissor-desativado-v1',
        version: 1,
        variants: [{ assetId: 'asset:emissor-desativado-v1', version: 1 }],
      },
    ],
  },
];

test('resolve estados do mesmo grupo e reconhece uma variante antiga', () => {
  const result = resolvePropStateOptions(groups, 'asset:emissor-ativo-v1');

  assert.equal(result.groupId, 'state-group:emissor');
  assert.equal(result.groupLabel, 'Emissor');
  assert.equal(result.currentStateAssetId, 'asset:emissor-ativo-v2');
  assert.deepEqual(
    result.options.map((state) => state.assetId),
    ['asset:emissor-ativo-v2', 'asset:emissor-desativado-v1'],
  );
});

test('prop sem grupo nao recebe fallback para a lista global', () => {
  assert.equal(resolvePropStateOptions(groups, 'asset:corpo-conectado'), null);
  assert.equal(resolvePropStateOptions([], 'asset:emissor-ativo-v2'), null);
});
