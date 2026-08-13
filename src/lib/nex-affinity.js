export const AFFINITY_NEX_THRESHOLD = 50;

export function normalizeNex(value) {
  const match = String(value ?? '').match(/-?\d+/);
  const parsed = match ? Number.parseInt(match[0], 10) : Number.NaN;
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(99, Math.max(0, parsed));
}

export function getNexAffinityState(value) {
  const nex = normalizeNex(value);
  const progress = Math.min(1, nex / AFFINITY_NEX_THRESHOLD);
  const unlocked = nex >= AFFINITY_NEX_THRESHOLD;

  let stage = 'latente';
  if (unlocked) stage = 'desperto';
  else if (nex >= 35) stage = 'iminente';
  else if (nex >= 20) stage = 'ressonante';

  return {
    nex,
    progress,
    stage,
    unlocked,
    remaining: Math.max(0, AFFINITY_NEX_THRESHOLD - nex),
  };
}

export function crossedAffinityThreshold(previousValue, currentValue) {
  if (previousValue === null || previousValue === undefined) return false;
  return normalizeNex(previousValue) < AFFINITY_NEX_THRESHOLD
    && normalizeNex(currentValue) >= AFFINITY_NEX_THRESHOLD;
}
