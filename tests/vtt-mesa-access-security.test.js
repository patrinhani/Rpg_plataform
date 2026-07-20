import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('fluxo integrado nao envia token Firebase ao servidor VTT', async () => {
  const [grantHelper, vttLab, integratedEntry, handouts] = await Promise.all([
    read('../src/lib/vtt-mesa-access.js'),
    read('../src/features/vtt-lab/VttLab.jsx'),
    read('../src/features/vtt-lab/VttLabIntegrated.jsx'),
    read('../src/features/vtt-handouts/useMesaHandouts.js'),
  ]);
  const automaticStart = vttLab.indexOf('const handleAutomaticAccess');
  const automaticEnd = vttLab.indexOf('const handleDisconnect', automaticStart);
  assert.ok(automaticStart >= 0 && automaticEnd > automaticStart);
  const integratedFlow = [
    grantHelper,
    vttLab.slice(automaticStart, automaticEnd),
    integratedEntry,
    handouts,
  ].join('\n');

  assert.doesNotMatch(integratedFlow, /getIdToken/);
  assert.doesNotMatch(integratedFlow, /Authorization\s*:/);
  assert.match(integratedFlow, /vttAccessGrants/);
  assert.match(integratedFlow, /serverTimestamp\(\)/);
  assert.match(integratedFlow, /campaignId/);
  assert.match(integratedFlow, /\/api\/vtt\/mesa-challenges/);
});

test('regras derivam master ou player da Mesa e bloqueiam enumeracao', async () => {
  const rules = await read('../firestore.rules');

  assert.match(rules, /request\.resource\.data\.uid == request\.auth\.uid/);
  assert.match(rules, /request\.resource\.data\.campaignId == campanhaVttDaMesa\(mesa\)/);
  assert.match(rules, /mesa\.mestre == request\.auth\.uid \? 'master' : 'player'/);
  assert.match(rules, /allow get: if resource\.data\.issuedAt is timestamp/);
  assert.match(rules, /allow list, update: if false/);
  assert.match(rules, /duration\.value\(5, 'm'\)/);
});

test('backend consulta grant anonimo sem cabecalho Firebase', async () => {
  const verifier = await read('../server/caos_vtt/firestore_auth.py');

  assert.doesNotMatch(verifier, /id_token|Authorization/);
  assert.match(verifier, /vttAccessGrants/);
  assert.match(verifier, /GRANT_TTL_SECONDS = 5 \* 60/);
});
