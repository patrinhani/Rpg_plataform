const TRACKER_MAX = 20;

function finiteInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeResource(resources, key) {
  const maximum = Math.max(0, finiteInteger(resources?.[`${key}_max`], 0));
  const current = clamp(finiteInteger(resources?.[`${key}_atual`], maximum), 0, maximum);
  return { current, maximum };
}

function humanizeCondition(value) {
  return String(value || '')
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

function normalizeConditions(raw = {}) {
  const candidates = [
    raw?.condicoesEfetivas,
    raw?.condicoesAtivas,
    raw?.condicoesAutomaticas,
  ].flatMap((source) => (Array.isArray(source) ? source : []));
  const seen = new Set();

  return candidates
    .map((condition) => String(condition || '').trim())
    .filter((condition) => condition && !seen.has(condition) && seen.add(condition))
    .slice(0, 12)
    .map((condition) => ({ id: condition, label: humanizeCondition(condition) }));
}

export function normalizeVttCharacterSheet(uid, raw = {}) {
  const normalizedUid = String(uid || '').trim();
  if (!normalizedUid) return null;

  const pursuit = raw?.perseguicao || {};
  const successTarget = clamp(finiteInteger(pursuit.metaSucessos, 3), 1, TRACKER_MAX);
  const failureTarget = clamp(finiteInteger(pursuit.metaFalhas, 3), 1, TRACKER_MAX);

  return {
    uid: normalizedUid,
    characterName: String(raw?.info?.nome || '').trim(),
    className: String(raw?.info?.classe || '').trim(),
    nex: String(raw?.info?.nex || '').trim(),
    photo: String(raw?.info?.foto || '').trim(),
    resources: {
      pv: normalizeResource(raw?.recursos, 'pv'),
      pe: normalizeResource(raw?.recursos, 'pe'),
      san: normalizeResource(raw?.recursos, 'san'),
    },
    pursuit: {
      successes: clamp(finiteInteger(pursuit.sucessos, 0), 0, successTarget),
      failures: clamp(finiteInteger(pursuit.falhas, 0), 0, failureTarget),
      successTarget,
      failureTarget,
    },
    conditions: normalizeConditions(raw),
  };
}

export function normalizeVttCharacterSheets(documents = []) {
  const seen = new Set();
  return (Array.isArray(documents) ? documents : [])
    .map((item) => normalizeVttCharacterSheet(item?.uid, item?.data || item))
    .filter((item) => item && !seen.has(item.uid) && seen.add(item.uid));
}

export function clampVttCharacterField(field, value, sheet = null) {
  const numeric = finiteInteger(value, 0);
  const resourceBounds = {
    'recursos.pv_atual': sheet?.resources?.pv?.maximum,
    'recursos.pe_atual': sheet?.resources?.pe?.maximum,
    'recursos.san_atual': sheet?.resources?.san?.maximum,
  };
  if (Object.hasOwn(resourceBounds, field)) {
    return clamp(numeric, 0, Math.max(0, finiteInteger(resourceBounds[field], 0)));
  }
  if (field === 'perseguicao.sucessos') {
    return clamp(numeric, 0, clamp(finiteInteger(sheet?.pursuit?.successTarget, 3), 1, TRACKER_MAX));
  }
  if (field === 'perseguicao.falhas') {
    return clamp(numeric, 0, clamp(finiteInteger(sheet?.pursuit?.failureTarget, 3), 1, TRACKER_MAX));
  }
  throw new Error('Campo de monitoramento da ficha não permitido.');
}

export const VTT_CHARACTER_MONITOR_FIELDS = Object.freeze(new Set([
  'recursos.pv_atual',
  'recursos.pe_atual',
  'recursos.san_atual',
  'perseguicao.sucessos',
  'perseguicao.falhas',
]));
