function humanizeHandoutAssetId(assetId) {
  const filename = String(assetId || '')
    .replace(/^asset:/i, '')
    .split('/')
    .pop()
    ?.replace(/\.[a-z\d]+$/i, '')
    .replace(/-handout-v\d+$/i, '')
    .replace(/-v\d+$/i, '')
    .replace(/^\d+[a-z]?[-_]+/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  if (!filename) return 'Documento sem título';
  return filename.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function normalizeHandoutItem(value, fallbackAssetId = '') {
  const item = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
  const assetId = String(
    typeof value === 'string'
      ? value
      : item.assetId || item.id || fallbackAssetId,
  ).trim();
  if (!assetId) return null;

  const width = Number(item.image?.width);
  const height = Number(item.image?.height);
  return {
    ...item,
    assetId,
    label: String(item.label || humanizeHandoutAssetId(assetId)),
    mediaType: String(item.mediaType || 'image/*'),
    image: Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? { ...item.image, width, height }
      : null,
    deliveredAt: item.deliveredAt ? String(item.deliveredAt) : null,
    url: String(item.url || item.assetUrl || ''),
  };
}

export function isCampaignVttState(rawState) {
  if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) return false;
  return Object.prototype.hasOwnProperty.call(rawState, 'scene')
    || Object.prototype.hasOwnProperty.call(rawState, 'catalog')
    || Object.prototype.hasOwnProperty.call(rawState, 'deliveredHandouts');
}

export function normalizeHandoutCollection(rawCollection) {
  const entries = Array.isArray(rawCollection)
    ? rawCollection.map((value) => ['', value])
    : rawCollection && typeof rawCollection === 'object'
      ? Object.entries(rawCollection)
      : [];
  const handoutsById = new Map();

  entries.forEach(([fallbackAssetId, value]) => {
    const item = normalizeHandoutItem(value, fallbackAssetId);
    if (item) handoutsById.set(item.assetId, item);
  });

  return [...handoutsById.values()];
}

export function resolveHandoutView(state = {}, role = 'player') {
  const delivered = normalizeHandoutCollection(state.deliveredHandouts);
  const deliveredById = new Map(delivered.map((item) => [item.assetId, item]));

  if (role !== 'master') {
    return delivered.map((item) => ({ ...item, delivered: true }));
  }

  const catalog = normalizeHandoutCollection(
    state.catalog?.handoutAssets ?? state.handoutAssets,
  );
  const source = catalog.length > 0 ? catalog : delivered;

  return source.map((item) => {
    const deliveredItem = deliveredById.get(item.assetId);
    return {
      ...item,
      ...deliveredItem,
      image: deliveredItem?.image || item.image,
      url: deliveredItem?.url || item.url,
      delivered: Boolean(deliveredItem || item.deliveredAt),
    };
  });
}

export function resolveMasterReferenceView(state = {}, role = 'player') {
  if (role !== 'master') return [];
  return normalizeHandoutCollection(state.catalog?.masterReferenceAssets).map((item) => ({
    ...item,
    delivered: false,
    privateReference: true,
  }));
}

export function filterHandouts(handouts, query) {
  const normalizedQuery = String(query || '').trim().toLocaleLowerCase('pt-BR');
  if (!normalizedQuery) return handouts;
  return handouts.filter((item) => (
    `${item.label} ${item.assetId}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery)
  ));
}
