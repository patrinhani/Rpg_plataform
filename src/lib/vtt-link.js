const MESA_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CAMPAIGN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const ROOM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function normalizeWithPattern(value, pattern) {
  const normalizedValue = String(value || '').trim();
  return pattern.test(normalizedValue) ? normalizedValue : '';
}

export function normalizeVttMesaId(value) {
  return normalizeWithPattern(value, MESA_ID_PATTERN);
}

export function normalizeVttCampaignId(value) {
  return normalizeWithPattern(value, CAMPAIGN_ID_PATTERN);
}

export function normalizeVttRoomId(value) {
  return normalizeWithPattern(value, ROOM_ID_PATTERN);
}

export function normalizeVttServerOrigin(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';

  try {
    const url = new URL(rawValue);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (!url.hostname || url.username || url.password) return '';
    if (!/^[a-z][a-z\d+.-]*:\/\/[^/?#]+\/?$/i.test(rawValue)) return '';
    if ((url.pathname && url.pathname !== '/') || url.search || url.hash) return '';
    if (
      url.protocol === 'http:'
      && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase())
    ) return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function resolveAuthenticatedVttServerOrigin({
  trustedOrigin,
  requestedOrigin,
  canEditServerUrl = false,
} = {}) {
  return normalizeVttServerOrigin(canEditServerUrl ? requestedOrigin : trustedOrigin);
}

export function readVttLaunchContext(search = '') {
  const params = new URLSearchParams(String(search || ''));
  return {
    mesaId: normalizeVttMesaId(params.get('mesaId')),
    campaignId: normalizeVttCampaignId(params.get('campaignId')),
    roomId: normalizeVttRoomId(params.get('roomId')),
    roomName: String(params.get('roomName') || '').trim().slice(0, 80),
  };
}

export function buildVttLaunchPath({ mesaId, campaignId, roomId, roomName } = {}) {
  const normalizedMesaId = normalizeVttMesaId(mesaId);
  const normalizedCampaignId = normalizeVttCampaignId(campaignId);
  if (!normalizedMesaId || !normalizedCampaignId) {
    throw new Error('Contexto da mesa para o VTT inválido.');
  }

  const params = new URLSearchParams({
    mesaId: normalizedMesaId,
    campaignId: normalizedCampaignId,
    roomName: String(roomName || '').trim().slice(0, 80),
  });
  const normalizedRoomId = normalizeVttRoomId(roomId);
  if (normalizedRoomId) params.set('roomId', normalizedRoomId);
  return `/vtt-lab?${params.toString()}`;
}
