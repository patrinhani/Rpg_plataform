import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getIntegratedVttSessionRefreshDelay,
  VTT_INTEGRATED_SESSION_REFRESH_MS,
} from '../src/lib/vtt-session.js';

test('agenda renovação integrada aos 45 minutos somente enquanto conectado', () => {
  assert.equal(VTT_INTEGRATED_SESSION_REFRESH_MS, 45 * 60 * 1000);
  assert.equal(getIntegratedVttSessionRefreshDelay({
    usesAutomaticAccess: true,
    connectionStatus: 'connected',
  }), VTT_INTEGRATED_SESSION_REFRESH_MS);
  assert.equal(getIntegratedVttSessionRefreshDelay({
    usesAutomaticAccess: true,
    connectionStatus: 'disconnected',
  }), null);
});

test('modo portátil nunca agenda renovação Firebase', () => {
  assert.equal(getIntegratedVttSessionRefreshDelay({
    usesAutomaticAccess: false,
    connectionStatus: 'connected',
  }), null);
  assert.equal(getIntegratedVttSessionRefreshDelay(), null);
});
