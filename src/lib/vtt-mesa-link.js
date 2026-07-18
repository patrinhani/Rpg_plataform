import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import {
  normalizeVttCampaignId,
  normalizeVttMesaId,
  normalizeVttRoomId,
} from './vtt-link.js';

export async function vincularVttMesa(mesaId, campaignId = 'mnemosyne', roomId = '') {
  const normalizedMesaId = normalizeVttMesaId(mesaId);
  const normalizedCampaignId = normalizeVttCampaignId(campaignId);
  const rawRoomId = String(roomId || '').trim();
  const normalizedRoomId = normalizeVttRoomId(rawRoomId);
  if (!normalizedMesaId || !normalizedCampaignId || (rawRoomId && !normalizedRoomId)) {
    throw new Error('Configuração de VTT inválida.');
  }

  await updateDoc(doc(db, 'mesas', normalizedMesaId), {
    vtt: {
      enabled: true,
      campaignId: normalizedCampaignId,
      roomId: normalizedRoomId || null,
      updatedAt: new Date().toISOString(),
    },
  });
}
