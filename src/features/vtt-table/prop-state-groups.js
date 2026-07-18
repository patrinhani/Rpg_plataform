function normalizedGroups(groups) {
  return Array.isArray(groups) ? groups.filter((group) => group && Array.isArray(group.states)) : [];
}

export function resolvePropStateOptions(groups, currentAssetId) {
  const assetId = String(currentAssetId || '');
  if (!assetId) return null;

  for (const group of normalizedGroups(groups)) {
    const currentState = group.states.find((state) => (
      state?.assetId === assetId
      || (Array.isArray(state?.variants)
        && state.variants.some((variant) => variant?.assetId === assetId))
    ));
    if (!currentState) continue;

    const seen = new Set();
    const options = group.states
      .filter((state) => state?.assetId && !seen.has(state.assetId) && seen.add(state.assetId))
      .map((state) => ({
        assetId: state.assetId,
        name: String(state.name || ''),
        label: String(state.label || state.name || state.assetId),
        version: Number(state.version || 0),
      }));

    return {
      groupId: String(group.id || ''),
      groupLabel: String(group.label || group.key || ''),
      currentStateAssetId: String(currentState.assetId || ''),
      options,
    };
  }
  return null;
}
