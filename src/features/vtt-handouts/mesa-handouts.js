import {
  normalizeVttRoomId,
  normalizeVttServerOrigin,
} from '../../lib/vtt-link.js';
import { normalizeHandoutCollection } from '../vtt-table/handouts.js';

function normalizeGrant(grant = {}) {
  const serverOrigin = normalizeVttServerOrigin(grant.serverOrigin);
  const roomId = normalizeVttRoomId(grant.roomId);
  const mediaToken = String(grant.mediaToken || '').trim();
  const role = ['master', 'player'].includes(grant.role) ? grant.role : '';

  if (!serverOrigin || !roomId || !mediaToken || !role) return null;
  return { serverOrigin, roomId, mediaToken, role };
}

export function buildMesaHandoutAssetUrl({
  serverOrigin,
  roomId,
  mediaToken,
  assetId,
} = {}) {
  const normalizedOrigin = normalizeVttServerOrigin(serverOrigin);
  const normalizedRoomId = normalizeVttRoomId(roomId);
  const normalizedAssetId = String(assetId || '').trim();
  const normalizedToken = String(mediaToken || '').trim();
  if (!normalizedOrigin || !normalizedRoomId || !normalizedAssetId || !normalizedToken) {
    return '';
  }

  const url = new URL(
    `/api/vtt/rooms/${encodeURIComponent(normalizedRoomId)}/assets`,
    `${normalizedOrigin}/`,
  );
  url.searchParams.set('assetId', normalizedAssetId);
  url.searchParams.set('access', normalizedToken);
  return url.toString();
}

function hydrateCollection(rawCollection, grant) {
  return normalizeHandoutCollection(rawCollection).map((item) => ({
    ...item,
    url: buildMesaHandoutAssetUrl({ ...grant, assetId: item.assetId }),
  }));
}

export function projectMesaHandoutSnapshot(rawState, grant) {
  const normalizedGrant = normalizeGrant(grant);
  if (!normalizedGrant || !rawState || typeof rawState !== 'object') {
    return {
      deliveredHandouts: [],
      handoutCatalog: [],
      masterReferences: [],
    };
  }

  const deliveredHandouts = hydrateCollection(
    rawState.deliveredHandouts,
    normalizedGrant,
  ).map((item) => ({ ...item, delivered: true }));

  // A projeção de jogador é deliberadamente restritiva. Mesmo que um servidor
  // defeituoso envie o catálogo privado, ele nunca chega ao estado da interface.
  if (normalizedGrant.role !== 'master') {
    return {
      deliveredHandouts,
      handoutCatalog: [],
      masterReferences: [],
    };
  }

  const deliveredById = new Map(
    deliveredHandouts.map((item) => [item.assetId, item]),
  );
  const catalog = hydrateCollection(
    rawState.catalog?.handoutAssets ?? rawState.handoutAssets,
    normalizedGrant,
  );
  const catalogSource = catalog.length > 0 ? catalog : deliveredHandouts;
  const handoutCatalog = catalogSource.map((item) => {
    const deliveredItem = deliveredById.get(item.assetId);
    return {
      ...item,
      ...deliveredItem,
      image: deliveredItem?.image || item.image,
      url: deliveredItem?.url || item.url,
      delivered: Boolean(deliveredItem || item.deliveredAt),
    };
  });
  const masterReferences = hydrateCollection(
    rawState.catalog?.masterReferenceAssets,
    normalizedGrant,
  ).map((item) => ({
    ...item,
    delivered: false,
    privateReference: true,
  }));

  return { deliveredHandouts, handoutCatalog, masterReferences };
}
