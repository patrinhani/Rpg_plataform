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
  assert.match(rules, /: 'caos-empty';/);
  assert.doesNotMatch(rules, /: 'mnemosyne';/);
});

test('mesa sem pacote usa workspace vazio sem fixar campanha de exemplo', async () => {
  const [grantHelper, mesaLink, mesaPage] = await Promise.all([
    read('../src/lib/vtt-mesa-access.js'),
    read('../src/lib/vtt-mesa-link.js'),
    read('../src/pages/Mesa/index.jsx'),
  ]);
  const runtime = [grantHelper, mesaLink, mesaPage].join('\n');

  assert.match(runtime, /caos-empty/);
  assert.doesNotMatch(runtime, /\|\| 'mnemosyne'/);
});

test('backend consulta grant anonimo sem cabecalho Firebase', async () => {
  const verifier = await read('../server/caos_vtt/firestore_auth.py');

  assert.doesNotMatch(verifier, /id_token|Authorization/);
  assert.match(verifier, /vttAccessGrants/);
  assert.match(verifier, /GRANT_TTL_SECONDS = 5 \* 60/);
});

test('acesso integrado usa abertura neutra e nao exibe a interface legada antes do snapshot', async () => {
  const vttLab = await read('../src/features/vtt-lab/VttLab.jsx');
  const bootstrapCondition = vttLab.indexOf('const showIntegratedBootstrap = Boolean(');
  const bootstrapReturn = vttLab.indexOf('if (showIntegratedBootstrap)');
  const fullInterfaceReturn = vttLab.indexOf('className={`vtt-lab ${isConnected');

  assert.ok(bootstrapCondition >= 0);
  assert.ok(bootstrapReturn > bootstrapCondition);
  assert.ok(fullInterfaceReturn > bootstrapReturn);
  assert.match(vttLab, /usesAutomaticAccess\s*&&\s*!campaignState/);
  assert.match(vttLab, /const integratedSceneStatus = connectionStatus === 'error'/);
  assert.match(vttLab, /Sincronizando a sessão atual com o servidor/);
  assert.match(vttLab.slice(bootstrapReturn, fullInterfaceReturn), /vtt-lab__bootstrap-card/);
  assert.match(vttLab.slice(bootstrapReturn, fullInterfaceReturn), /Tentar novamente/);
});
