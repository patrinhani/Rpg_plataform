const MOTION_PRESETS = new Set(['none', 'electric', 'water', 'glitch']);

function normalizeHint(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function resolveOverlayMotionPreset(overlay) {
  const explicit = normalizeHint(overlay?.motionPreset || overlay?.motion);
  if (MOTION_PRESETS.has(explicit)) return explicit;

  const hint = normalizeHint([
    overlay?.name,
    overlay?.label,
    overlay?.assetId,
  ].filter(Boolean).join(' '));

  if (/eletr|electric|choque|shock|spark|arco/.test(hint)) return 'electric';
  if (/inunda|agua|water|flood|alag/.test(hint)) return 'water';
  if (/tela|screen|glitch|corromp|interfer/.test(hint)) return 'glitch';
  return 'none';
}

export function overlayMotionLabel(preset) {
  if (preset === 'electric') return 'Pulso elétrico';
  if (preset === 'water') return 'Reflexo de água';
  if (preset === 'glitch') return 'Interferência';
  return '';
}

