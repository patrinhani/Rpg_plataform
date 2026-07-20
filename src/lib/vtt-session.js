export const VTT_INTEGRATED_SESSION_REFRESH_MS = 4 * 60 * 1000;

export function getIntegratedVttSessionRefreshDelay({
  usesAutomaticAccess = false,
  connectionStatus = '',
} = {}) {
  if (!usesAutomaticAccess || connectionStatus !== 'connected') return null;
  return VTT_INTEGRATED_SESSION_REFRESH_MS;
}
