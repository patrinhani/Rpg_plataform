import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import {
  normalizeVttCampaignId,
  normalizeVttMesaId,
  normalizeVttRoomId,
  normalizeVttServerOrigin,
} from './vtt-link.js';

export async function vincularVttMesa(
  mesaId,
  campaignId = 'mnemosyne',
  roomId = '',
  serverOrigin = undefined,
) {
  const normalizedMesaId = normalizeVttMesaId(mesaId);
  const normalizedCampaignId = normalizeVttCampaignId(campaignId);
  const rawRoomId = String(roomId || '').trim();
  const normalizedRoomId = normalizeVttRoomId(rawRoomId);
  if (!normalizedMesaId || !normalizedCampaignId || (rawRoomId && !normalizedRoomId)) {
    throw new Error('Configuração de VTT inválida.');
  }

  const rawServerOrigin = serverOrigin === undefined ? undefined : String(serverOrigin || '').trim();
  const normalizedServerOrigin = rawServerOrigin === undefined
    ? undefined
    : normalizeVttServerOrigin(rawServerOrigin);
  if (rawServerOrigin && !normalizedServerOrigin) {
    throw new Error('Origem do servidor VTT inválida.');
  }

  const updates = {
    'vtt.enabled': true,
    'vtt.campaignId': normalizedCampaignId,
    'vtt.roomId': normalizedRoomId || null,
    'vtt.updatedAt': serverTimestamp(),
  };
  if (normalizedServerOrigin !== undefined) {
    updates['vtt.serverOrigin'] = normalizedServerOrigin || null;
  }

  await updateDoc(doc(db, 'mesas', normalizedMesaId), updates);
}
