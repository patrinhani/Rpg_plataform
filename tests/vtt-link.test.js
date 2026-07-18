import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVttLaunchPath,
  normalizeVttCampaignId,
  normalizeVttMesaId,
  normalizeVttRoomId,
  readVttLaunchContext,
} from '../src/lib/vtt-link.js';

test('normaliza apenas identificadores seguros do vínculo VTT', () => {
  assert.equal(normalizeVttMesaId(' mesa_ABC-123 '), 'mesa_ABC-123');
  assert.equal(normalizeVttCampaignId('mnemosyne.v2'), 'mnemosyne.v2');
  assert.equal(normalizeVttRoomId('room-123_ABC'), 'room-123_ABC');
  assert.equal(normalizeVttRoomId('room/../../segredo'), '');
  assert.equal(normalizeVttCampaignId('campanha com espaços'), '');
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
});
