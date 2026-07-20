import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { normalizeVttMesaId, normalizeVttServerOrigin } from './vtt-link.js';

const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

async function readJsonResponse(response) {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const detail = payload?.detail || payload?.message || payload?.error;
    throw new Error(detail || `O servidor respondeu com HTTP ${response.status}.`);
  }
  return payload || {};
}

function assertActiveUser(usuario) {
  const uid = String(usuario?.uid || '').trim();
  if (!uid) {
    throw new Error('Sua sessao nao pode autenticar o VTT. Entre novamente na conta.');
  }
  return uid;
}

export async function requestMesaVttAccess({
  mesaId,
  serverOrigin,
  usuario,
  signal,
  fetchImpl = globalThis.fetch,
}) {
  const normalizedMesaId = normalizeVttMesaId(mesaId);
  const normalizedServerOrigin = normalizeVttServerOrigin(serverOrigin);
  const uid = assertActiveUser(usuario);
  if (!normalizedMesaId) throw new Error('A Mesa informada nao e valida.');
  if (!normalizedServerOrigin) throw new Error('O servidor VTT desta Mesa nao foi configurado.');
  if (typeof fetchImpl !== 'function') throw new Error('A conexao HTTP nao esta disponivel.');

  const challengeResponse = await fetchImpl(
    `${normalizedServerOrigin}/api/vtt/mesa-challenges`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaId: normalizedMesaId }),
      signal,
    },
  );
  const challengePayload = await readJsonResponse(challengeResponse);
  const challenge = String(challengePayload.challenge || '').trim();
  if (!CHALLENGE_PATTERN.test(challenge)) {
    throw new Error('O servidor VTT forneceu um desafio de autenticacao invalido.');
  }

  const mesaSnapshot = await getDoc(doc(db, 'mesas', normalizedMesaId));
  if (!mesaSnapshot.exists()) throw new Error('Mesa nao encontrada.');
  const mesa = mesaSnapshot.data();
  if (!Array.isArray(mesa?.membroUids) || !mesa.membroUids.includes(uid)) {
    throw new Error('Voce nao participa desta Mesa.');
  }
  const role = mesa.mestre === uid ? 'master' : 'player';
  const roomName = String(mesa.nome || '').trim();
  const campaignId = String(mesa.vtt?.campaignId || 'mnemosyne').trim();
  if (!roomName) throw new Error('A Mesa nao possui um nome valido.');

  const grantRef = doc(db, 'vttAccessGrants', challenge);
  await setDoc(grantRef, {
    challenge,
    mesaId: normalizedMesaId,
    uid,
    role,
    roomName,
    campaignId,
    issuedAt: serverTimestamp(),
  });

  try {
    if (signal?.aborted) throw new DOMException('Operacao cancelada.', 'AbortError');
    const accessResponse = await fetchImpl(
      `${normalizedServerOrigin}/api/vtt/mesa-access`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mesaId: normalizedMesaId, challenge }),
        signal,
      },
    );
    return await readJsonResponse(accessResponse);
  } finally {
    void deleteDoc(grantRef).catch(() => {});
  }
}

export default requestMesaVttAccess;
