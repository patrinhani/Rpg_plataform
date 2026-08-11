export function normalizeCharacterSheetUids(rawUids) {
  return new Set((Array.isArray(rawUids) ? rawUids : [])
    .map((uid) => String(uid || '').trim())
    .filter(Boolean));
}

export function canOpenTokenCharacterSheet({
  role,
  controllerUid,
  characterSheetUids,
}) {
  const uid = String(controllerUid || '').trim();
  return role === 'master'
    && Boolean(uid)
    && characterSheetUids instanceof Set
    && characterSheetUids.has(uid);
}
