import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVttLaunchPath,
  normalizeVttCampaignId,
  normalizeVttMesaId,
  normalizeVttRoomId,
  normalizeVttServerOrigin,
  readVttLaunchContext,
  resolveAuthenticatedVttServerOrigin,
} from '../src/lib/vtt-link.js';

test('normaliza apenas identificadores seguros do vínculo VTT', () => {
  assert.equal(normalizeVttMesaId(' mesa_ABC-123 '), 'mesa_ABC-123');
  assert.equal(normalizeVttCampaignId('mnemosyne.v2'), 'mnemosyne.v2');
  assert.equal(normalizeVttRoomId('room-123_ABC'), 'room-123_ABC');
  assert.equal(normalizeVttRoomId('room/../../segredo'), '');
  assert.equal(normalizeVttCampaignId('campanha com espaços'), '');
});

test('aceita HTTPS remoto e HTTP apenas em loopback, sempre como origem limpa', () => {
  assert.equal(normalizeVttServerOrigin('https://mesa.exemplo.test:8443/'), 'https://mesa.exemplo.test:8443');
  assert.equal(normalizeVttServerOrigin('http://127.0.0.1:8765'), 'http://127.0.0.1:8765');
  assert.equal(normalizeVttServerOrigin('http://localhost:8765/'), 'http://localhost:8765');
  assert.equal(normalizeVttServerOrigin('http://[::1]:8765'), 'http://[::1]:8765');
  assert.equal(normalizeVttServerOrigin('http://192.168.1.20:8765'), '');
  assert.equal(normalizeVttServerOrigin('http://vtt.example.test'), '');
  assert.equal(normalizeVttServerOrigin('https://mesa.test/api'), '');
  assert.equal(normalizeVttServerOrigin('https://mesa.test?'), '');
  assert.equal(normalizeVttServerOrigin('https://mesa.test#'), '');
  assert.equal(normalizeVttServerOrigin('https://user:secret@mesa.test'), '');
  assert.equal(normalizeVttServerOrigin('javascript:alert(1)'), '');
  assert.equal(normalizeVttServerOrigin('//mesa.test'), '');
});

test('jogador fica preso à origem confiável da Mesa e somente mestre pode substituí-la', () => {
  const origins = {
    trustedOrigin: 'https://vtt.mesa.test',
    requestedOrigin: 'https://origem-injetada.test',
  };

  assert.equal(
    resolveAuthenticatedVttServerOrigin({ ...origins, canEditServerUrl: false }),
    'https://vtt.mesa.test',
  );
  assert.equal(
    resolveAuthenticatedVttServerOrigin({ ...origins, canEditServerUrl: true }),
    'https://origem-injetada.test',
  );
  assert.equal(
    resolveAuthenticatedVttServerOrigin({
      trustedOrigin: '',
      requestedOrigin: 'https://origem-injetada.test',
      canEditServerUrl: false,
    }),
    '',
  );
});

test('monta e recupera contexto não secreto da Mesa', () => {
  const launchPath = buildVttLaunchPath({
    mesaId: 'mesa-123',
    campaignId: 'mnemosyne',
    roomId: 'room-456',
    roomName: 'Operação Mnemosyne',
  });
  const context = readVttLaunchContext(new URL(launchPath, 'http://localhost').search);

  assert.deepEqual(context, {
    mesaId: 'mesa-123',
    campaignId: 'mnemosyne',
    roomId: 'room-456',
    roomName: 'Operação Mnemosyne',
  });
  assert.equal(launchPath.includes('serverOrigin'), false);
  assert.equal(launchPath.includes('token'), false);
  assert.equal(launchPath.includes('invite'), false);
});

test('ignora roomId inválido e nunca lê credenciais da URL de abertura', () => {
  const context = readVttLaunchContext(
    '?mesaId=mesa-1&campaignId=mnemosyne&roomId=../../x&hostToken=host&invite=secret',
  );

  assert.equal(context.roomId, '');
  assert.equal(Object.hasOwn(context, 'hostToken'), false);
  assert.equal(Object.hasOwn(context, 'invite'), false);
  assert.equal(Object.hasOwn(context, 'serverOrigin'), false);
});

test('nunca transporta origem do servidor no caminho de abertura', () => {
  const launchPath = buildVttLaunchPath({
    mesaId: 'mesa-1',
    campaignId: 'mnemosyne',
    serverOrigin: 'https://vtt.example.test',
  });

  assert.equal(launchPath.includes('serverOrigin'), false);

  const context = readVttLaunchContext(
    '?mesaId=mesa-1&campaignId=mnemosyne&serverOrigin=https%3A%2F%2Fevil.example.test',
  );
  assert.equal(Object.hasOwn(context, 'serverOrigin'), false);
});
