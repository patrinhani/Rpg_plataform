import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './vtt-board.css';
import {
  filterHandouts,
  resolveHandoutView,
  resolveMasterReferenceView,
} from './handouts.js';
import { resolvePropStateOptions } from './prop-state-groups.js';

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3.2;
const DEFAULT_TOKEN_SIZE = 0.075;
const MIN_TOKEN_SIZE = 0.01;
const MAX_TOKEN_SIZE = 0.25;
const DEFAULT_FOG_BRUSH_RADIUS = 0.045;
const DEFAULT_PROP_SIZE = 0.18;
const MIN_PROP_SIZE = 0.025;
const MAX_PROP_SIZE = 0.8;
const FOG_STROKE_BATCH_SIZE = 128;

function snapToDevicePixel(value) {
  const ratio = typeof window === 'undefined' ? 1 : Math.max(1, window.devicePixelRatio || 1);
  return Math.round(Number(value || 0) * ratio) / ratio;
}

function clamp(value, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return minimum;
  return Math.max(minimum, Math.min(maximum, numeric));
}

function humanize(value) {
  return String(value || '')
    .replace(/^scene:/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function tokenInitials(label) {
  const words = String(label || '?').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '?';
}

function decodeBase64(value) {
  const binary = globalThis.atob(String(value || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function decodeFogMask(fog) {
  if (!fog?.data) return null;
  const compressed = decodeBase64(fog.data);
  if (fog.encoding === 'raw-base64') return compressed;
  if (fog.encoding !== 'zlib-base64' || typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador não consegue visualizar a máscara privada da névoa.');
  }
  const stream = new Blob([compressed]).stream()
    .pipeThrough(new DecompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function VttOverlayImage({ overlay }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      className={`vtt-board__overlay ${loaded ? 'is-loaded' : ''}`}
      src={overlay.url}
      alt=""
      aria-hidden="true"
      draggable="false"
      onLoad={() => setLoaded(true)}
    />
  );
}

function VttSceneLayerImage({ layer, placement, placementIndex }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      className={`vtt-board__scene-layer ${loaded ? 'is-loaded' : ''}`}
      src={layer.assetUrl}
      alt=""
      aria-hidden="true"
      draggable="false"
      style={{
        '--vtt-layer-x': `${clamp(placement.x, 0, 1) * 100}%`,
        '--vtt-layer-y': `${clamp(placement.y, 0, 1) * 100}%`,
        '--vtt-layer-width': `${clamp(placement.width, 0.01, 1) * 100}%`,
        '--vtt-layer-height': `${clamp(placement.height, 0.01, 1) * 100}%`,
        '--vtt-layer-rotation': `${clamp(placement.rotation ?? 0, -360, 360)}deg`,
      }}
      data-placement={placementIndex}
      onLoad={() => setLoaded(true)}
    />
  );
}

function normalizeTokens(rawTokens, role) {
  if (!rawTokens || typeof rawTokens !== 'object') return [];
  return Object.values(rawTokens)
    .filter((token) => token && (role === 'master' || token.visible !== false))
    .map((token) => ({
      ...token,
      id: String(token.id || ''),
      label: String(token.label || token.id || 'Token'),
      x: clamp(token.x, 0, 1),
      y: clamp(token.y, 0, 1),
      size: clamp(token.size ?? DEFAULT_TOKEN_SIZE, MIN_TOKEN_SIZE, MAX_TOKEN_SIZE),
    }))
    .filter((token) => token.id);
}

function normalizeProps(rawProps, role) {
  if (!rawProps || typeof rawProps !== 'object') return [];
  return Object.values(rawProps)
    .filter((prop) => prop && (role === 'master' || prop.visible !== false))
    .map((prop) => ({
      ...prop,
      id: String(prop.id || ''),
      label: String(prop.label || prop.id || 'Objeto'),
      x: clamp(prop.x, 0, 1),
      y: clamp(prop.y, 0, 1),
      width: clamp(prop.width ?? DEFAULT_PROP_SIZE, MIN_PROP_SIZE, MAX_PROP_SIZE),
      height: clamp(prop.height ?? prop.width ?? DEFAULT_PROP_SIZE, MIN_PROP_SIZE, MAX_PROP_SIZE),
      rotation: clamp(prop.rotation ?? 0, -360, 360),
    }))
    .filter((prop) => prop.id);
}

export default function VttBoard({
  state = {},
  role = 'player',
  connected = false,
  onCommand,
}) {
  const scene = state.scene || null;
  const catalog = role === 'master' ? state.catalog : null;
  const revision = Number(state.revision || 0);
  const viewportRef = useRef(null);
  const stageRef = useRef(null);
  const panRef = useRef(null);
  const tokenDragRef = useRef(null);
  const propDragRef = useRef(null);
  const fogCanvasRef = useRef(null);
  const fogStrokeRef = useRef(null);
  const deliveredHandoutIdsRef = useRef(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [draftPositions, setDraftPositions] = useState({});
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedPropId, setSelectedPropId] = useState('');
  const [selectedPropAssetId, setSelectedPropAssetId] = useState('');
  const [selectedPropStateAssetId, setSelectedPropStateAssetId] = useState('');
  const [draftPropPositions, setDraftPropPositions] = useState({});
  const [showGrid, setShowGrid] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [mapLoadState, setMapLoadState] = useState('idle');
  const [nativeZoomLimit, setNativeZoomLimit] = useState(MAX_ZOOM);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideZoom, setGuideZoom] = useState(1);
  const [fogEditMode, setFogEditMode] = useState(false);
  const [fogRevealMode, setFogRevealMode] = useState(true);
  const [fogBrushRadius, setFogBrushRadius] = useState(DEFAULT_FOG_BRUSH_RADIUS);
  const [fogMask, setFogMask] = useState(null);
  const [fogMaskError, setFogMaskError] = useState('');
  const [fogDraftPoints, setFogDraftPoints] = useState([]);
  const [handoutsOpen, setHandoutsOpen] = useState(false);
  const [handoutQuery, setHandoutQuery] = useState('');
  const [previewHandoutId, setPreviewHandoutId] = useState('');
  const [handoutZoom, setHandoutZoom] = useState(0.65);

  const tokens = useMemo(
    () => normalizeTokens(state.tokens, role),
    [role, state.tokens],
  );
  const props = useMemo(
    () => normalizeProps(state.props, role),
    [role, state.props],
  );
  const overlays = useMemo(
    () => (Array.isArray(scene?.overlays) ? scene.overlays : []),
    [scene?.overlays],
  );
  const sceneLayers = useMemo(
    () => (Array.isArray(scene?.layers) ? scene.layers : []),
    [scene?.layers],
  );
  const fog = state.fog && typeof state.fog === 'object' ? state.fog : null;
  const scenes = useMemo(
    () => (Array.isArray(catalog?.scenes) ? catalog.scenes : []),
    [catalog?.scenes],
  );
  const tokenAssets = useMemo(
    () => (Array.isArray(catalog?.tokenAssets) ? catalog.tokenAssets : []),
    [catalog?.tokenAssets],
  );
  const propAssets = useMemo(
    () => (Array.isArray(catalog?.propAssets) ? catalog.propAssets : []),
    [catalog?.propAssets],
  );
  const propStateGroups = useMemo(
    () => (Array.isArray(catalog?.propStateGroups) ? catalog.propStateGroups : []),
    [catalog?.propStateGroups],
  );
  const handouts = useMemo(
    () => resolveHandoutView(state, role),
    [role, state],
  );
  const masterReferences = useMemo(
    () => resolveMasterReferenceView(state, role),
    [role, state],
  );
  const filteredHandouts = useMemo(
    () => filterHandouts(handouts, handoutQuery),
    [handoutQuery, handouts],
  );
  const filteredMasterReferences = useMemo(
    () => filterHandouts(masterReferences, handoutQuery),
    [handoutQuery, masterReferences],
  );
  const drawerItems = useMemo(
    () => [...filteredMasterReferences, ...filteredHandouts],
    [filteredHandouts, filteredMasterReferences],
  );
  const deliveredHandoutCount = useMemo(
    () => handouts.filter((item) => item.delivered).length,
    [handouts],
  );
  const previewHandout = useMemo(
    () => [...masterReferences, ...handouts]
      .find((item) => item.assetId === previewHandoutId) || null,
    [handouts, masterReferences, previewHandoutId],
  );
  const selectedProp = useMemo(
    () => props.find((item) => item.id === selectedPropId) || null,
    [props, selectedPropId],
  );
  const selectedPropStates = useMemo(
    () => resolvePropStateOptions(propStateGroups, selectedProp?.assetId),
    [propStateGroups, selectedProp?.assetId],
  );
  const isMaster = role === 'master';
  const mapWidth = Math.max(1, Number(scene?.map?.width) || 1);
  const mapHeight = Math.max(1, Number(scene?.map?.height) || 1);
  const gridColumns = Math.max(1, Number(scene?.gridHint?.columns) || 1);
  const gridRows = Math.max(1, Number(scene?.gridHint?.rows) || 1);
  const hasGrid = scene?.gridHint?.type === 'square';
  const maximumZoom = clamp(nativeZoomLimit, MIN_ZOOM, MAX_ZOOM);

  const emitCommand = useCallback((type, payload = {}) => {
    if (!connected || typeof onCommand !== 'function') return false;
    onCommand({ type, payload });
    return true;
  }, [connected, onCommand]);

  const confirmMasterCommand = useCallback((message, type, payload = {}) => {
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm(message)) return false;
    return emitCommand(type, payload);
  }, [emitCommand]);

  useEffect(() => {
    setCamera({ x: 0, y: 0, scale: 1 });
    setDraftPositions({});
    setSelectedTokenId('');
    setSelectedPropId('');
    setSelectedPropStateAssetId('');
    setDraftPropPositions({});
    setIsPanning(false);
    setGuideOpen(false);
    setGuideZoom(1);
    setFogEditMode(false);
    setFogDraftPoints([]);
  }, [scene?.id]);

  useEffect(() => {
    const deliveredIds = new Set(
      handouts.filter((item) => item.delivered).map((item) => item.assetId),
    );
    const previousIds = deliveredHandoutIdsRef.current;
    deliveredHandoutIdsRef.current = deliveredIds;
    if (role !== 'player' || previousIds === null) return;

    const newlyDelivered = [...deliveredIds].filter((assetId) => !previousIds.has(assetId));
    if (newlyDelivered.length > 0) {
      setHandoutsOpen(true);
      setPreviewHandoutId(newlyDelivered.at(-1));
      setHandoutZoom(0.65);
    }
  }, [handouts, role]);

  useEffect(() => {
    if (previewHandoutId && !previewHandout) setPreviewHandoutId('');
  }, [previewHandout, previewHandoutId]);

  useEffect(() => {
    let cancelled = false;
    setFogMaskError('');
    if (!isMaster || !fog?.enabled || !fog.data) {
      setFogMask(null);
      return () => { cancelled = true; };
    }
    decodeFogMask(fog)
      .then((mask) => {
        if (!cancelled) setFogMask(mask);
      })
      .catch((error) => {
        if (!cancelled) {
          setFogMask(null);
          setFogMaskError(error instanceof Error ? error.message : 'Falha ao abrir a máscara da névoa.');
        }
      });
    return () => { cancelled = true; };
  }, [fog, isMaster]);

  useEffect(() => {
    const canvas = fogCanvasRef.current;
    if (!canvas || !fog?.enabled || !isMaster) return;
    const width = Math.max(1, Number(fog.width) || 256);
    const height = Math.max(1, Number(fog.height) || 256);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (fogMask?.length === width * height) {
      const pixels = context.createImageData(width, height);
      for (let index = 0; index < fogMask.length; index += 1) {
        const offset = index * 4;
        pixels.data[offset] = 2;
        pixels.data[offset + 1] = 8;
        pixels.data[offset + 2] = 12;
        pixels.data[offset + 3] = fogMask[index] > 127 ? 0 : (fogEditMode ? 190 : 130);
      }
      context.putImageData(pixels, 0, 0);
    }

    if (fogDraftPoints.length > 0) {
      const points = fogDraftPoints.map((point) => ({ x: point.x * width, y: point.y * height }));
      context.save();
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = Math.max(2, fogBrushRadius * width * 2);
      context.globalCompositeOperation = fogRevealMode ? 'destination-out' : 'source-over';
      context.strokeStyle = 'rgba(2, 8, 12, 0.9)';
      context.fillStyle = 'rgba(2, 8, 12, 0.9)';
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
      context.stroke();
      if (points.length === 1) {
        context.beginPath();
        context.arc(points[0].x, points[0].y, context.lineWidth / 2, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
  }, [fog?.enabled, fog?.height, fog?.width, fogBrushRadius, fogDraftPoints, fogEditMode, fogMask, fogRevealMode, isMaster]);

  useEffect(() => {
    if (!fog?.enabled) {
      setFogEditMode(false);
      setFogDraftPoints([]);
    }
  }, [fog?.enabled]);

  useEffect(() => {
    setMapLoadState(scene?.map?.url ? 'loading' : 'idle');
  }, [scene?.map?.url]);

  useEffect(() => {
    setDraftPositions({});
    setDraftPropPositions({});
  }, [revision]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !scene?.map?.url || typeof ResizeObserver === 'undefined') return undefined;

    const updateNativeZoom = () => {
      const renderedWidth = stage.offsetWidth;
      if (!renderedWidth) return;
      const limit = clamp(mapWidth / renderedWidth, 1, MAX_ZOOM);
      setNativeZoomLimit(limit);
      setCamera((current) => ({
        ...current,
        scale: Math.min(current.scale, limit),
      }));
    };

    updateNativeZoom();
    const observer = new ResizeObserver(updateNativeZoom);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [mapWidth, scene?.map?.url]);

  useEffect(() => {
    if (!guideOpen && !handoutsOpen && !previewHandoutId) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (previewHandoutId) {
        setPreviewHandoutId('');
      } else if (handoutsOpen) {
        setHandoutsOpen(false);
      } else {
        setGuideOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guideOpen, handoutsOpen, previewHandoutId]);

  useEffect(() => {
    if (!selectedAssetId && tokenAssets[0]?.assetId) {
      setSelectedAssetId(tokenAssets[0].assetId);
    }
  }, [selectedAssetId, tokenAssets]);

  useEffect(() => {
    if (!selectedPropAssetId && propAssets[0]?.assetId) {
      setSelectedPropAssetId(propAssets[0].assetId);
    }
  }, [propAssets, selectedPropAssetId]);

  useEffect(() => {
    setSelectedPropStateAssetId(selectedPropStates?.currentStateAssetId || '');
  }, [selectedPropId, selectedPropStates?.currentStateAssetId]);

  const setZoom = useCallback((nextScale) => {
    setCamera((current) => ({
      ...current,
      scale: clamp(nextScale, MIN_ZOOM, maximumZoom),
    }));
  }, [maximumZoom]);

  const resetCamera = useCallback(() => {
    setCamera({ x: 0, y: 0, scale: 1 });
  }, []);

  const handleWheel = (event) => {
    if (!scene) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    setCamera((current) => ({
      ...current,
      scale: clamp(current.scale * factor, MIN_ZOOM, maximumZoom),
    }));
  };

  const handleViewportKeyDown = (event) => {
    if (event.target !== event.currentTarget || !scene) return;
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (event.key === 'Home') {
      event.preventDefault();
      resetCamera();
      return;
    }
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 50 : 20;
    setCamera((current) => ({
      ...current,
      x: current.x + direction[0] * step,
      y: current.y + direction[1] * step,
    }));
  };

  const handlePanPointerDown = (event) => {
    if (!scene || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    };
  };

  const handlePanPointerMove = (event) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setCamera((current) => ({
      ...current,
      x: pan.cameraX + event.clientX - pan.startX,
      y: pan.cameraY + event.clientY - pan.startY,
    }));
  };

  const finishPan = (event) => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const pointerToMap = useCallback((event) => {
    const stage = stageRef.current;
    if (!stage) return null;
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  }, []);

  const handleFogPointerDown = (event) => {
    if (!fogEditMode || !connected || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointerToMap(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    fogStrokeRef.current = { pointerId: event.pointerId, points: [point] };
    setFogDraftPoints([point]);
  };

  const handleFogPointerMove = (event) => {
    const stroke = fogStrokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointerToMap(event);
    const previous = stroke.points.at(-1);
    if (!point || (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.0025)) return;
    stroke.points.push(point);
    if (stroke.points.length >= FOG_STROKE_BATCH_SIZE) {
      emitCommand('fog.stroke', {
        points: stroke.points,
        radius: fogBrushRadius,
        reveal: fogRevealMode,
      });
      stroke.points = [point];
      setFogDraftPoints([point]);
      return;
    }
    setFogDraftPoints([...stroke.points]);
  };

  const finishFogStroke = (event, cancelled = false) => {
    const stroke = fogStrokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    fogStrokeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!cancelled && stroke.points.length > 0) {
      emitCommand('fog.stroke', {
        points: stroke.points,
        radius: fogBrushRadius,
        reveal: fogRevealMode,
      });
    }
    setFogDraftPoints([]);
  };

  const canMoveToken = useCallback((token) => (
    connected && (isMaster || token.movable !== false)
  ), [connected, isMaster]);

  const handleTokenPointerDown = (event, token) => {
    event.stopPropagation();
    setSelectedTokenId(token.id);
    setSelectedPropId('');
    if (!canMoveToken(token)) return;
    event.preventDefault();
    const pointer = pointerToMap(event);
    const shown = draftPositions[token.id] || token;
    event.currentTarget.setPointerCapture(event.pointerId);
    tokenDragRef.current = {
      pointerId: event.pointerId,
      tokenId: token.id,
      offsetX: pointer ? pointer.x - shown.x : 0,
      offsetY: pointer ? pointer.y - shown.y : 0,
    };
  };

  const handlePropPointerDown = (event, prop) => {
    event.stopPropagation();
    setSelectedPropId(prop.id);
    setSelectedTokenId('');
    if (!connected || !isMaster) return;
    event.preventDefault();
    const pointer = pointerToMap(event);
    const shown = draftPropPositions[prop.id] || prop;
    event.currentTarget.setPointerCapture(event.pointerId);
    propDragRef.current = {
      pointerId: event.pointerId,
      propId: prop.id,
      offsetX: pointer ? pointer.x - shown.x : 0,
      offsetY: pointer ? pointer.y - shown.y : 0,
    };
  };

  const handlePropPointerMove = (event, prop) => {
    const drag = propDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.propId !== prop.id) return;
    const point = pointerToMap(event);
    if (!point) return;
    setDraftPropPositions((current) => ({
      ...current,
      [prop.id]: {
        x: clamp(point.x - drag.offsetX, 0, 1),
        y: clamp(point.y - drag.offsetY, 0, 1),
      },
    }));
  };

  const finishPropDrag = (event, prop, cancelled = false) => {
    const drag = propDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.propId !== prop.id) return;
    propDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancelled) {
      setDraftPropPositions((current) => {
        const next = { ...current };
        delete next[prop.id];
        return next;
      });
      return;
    }
    const point = pointerToMap(event);
    if (!point) return;
    const position = {
      x: clamp(point.x - drag.offsetX, 0, 1),
      y: clamp(point.y - drag.offsetY, 0, 1),
    };
    setDraftPropPositions((current) => ({ ...current, [prop.id]: position }));
    emitCommand('prop.update', { propId: prop.id, ...position });
  };

  const handlePropKeyDown = (event, prop) => {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction || !connected || !isMaster) return;
    event.preventDefault();
    const shown = draftPropPositions[prop.id] || prop;
    const step = event.shiftKey ? 0.05 : 0.02;
    const position = {
      x: clamp(shown.x + direction[0] * step, 0, 1),
      y: clamp(shown.y + direction[1] * step, 0, 1),
    };
    setDraftPropPositions((current) => ({ ...current, [prop.id]: position }));
    emitCommand('prop.update', { propId: prop.id, ...position });
  };

  const handleTokenPointerMove = (event, token) => {
    const drag = tokenDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.tokenId !== token.id) return;
    const point = pointerToMap(event);
    if (point) {
      setDraftPositions((current) => ({
        ...current,
        [token.id]: {
          x: clamp(point.x - drag.offsetX, 0, 1),
          y: clamp(point.y - drag.offsetY, 0, 1),
        },
      }));
    }
  };

  const finishTokenDrag = (event, token, cancelled = false) => {
    const drag = tokenDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.tokenId !== token.id) return;
    tokenDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancelled) {
      setDraftPositions((current) => {
        const next = { ...current };
        delete next[token.id];
        return next;
      });
      return;
    }
    const point = pointerToMap(event);
    if (point) {
      const position = {
        x: clamp(point.x - drag.offsetX, 0, 1),
        y: clamp(point.y - drag.offsetY, 0, 1),
      };
      setDraftPositions((current) => ({ ...current, [token.id]: position }));
      emitCommand('token.move', { tokenId: token.id, ...position });
    }
  };

  const handleTokenKeyDown = (event, token) => {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction || !canMoveToken(token)) return;
    event.preventDefault();
    const shown = draftPositions[token.id] || token;
    const step = event.shiftKey ? 0.05 : 0.02;
    const point = {
      x: clamp(shown.x + direction[0] * step, 0, 1),
      y: clamp(shown.y + direction[1] * step, 0, 1),
    };
    setDraftPositions((current) => ({ ...current, [token.id]: point }));
    emitCommand('token.move', { tokenId: token.id, ...point });
  };

  const handleSpawn = () => {
    if (!selectedAssetId) return;
    const asset = tokenAssets.find((item) => item.assetId === selectedAssetId);
    emitCommand('token.spawn', {
      assetId: selectedAssetId,
      label: asset?.label || humanize(selectedAssetId.split('/').pop()),
      x: 0.5,
      y: 0.5,
      size: DEFAULT_TOKEN_SIZE,
    });
  };

  const handleRemoveSelected = () => {
    if (!selectedTokenId) return;
    emitCommand('token.remove', { tokenId: selectedTokenId });
    setSelectedTokenId('');
  };

  const handleSpawnProp = () => {
    if (!selectedPropAssetId) return;
    const asset = propAssets.find((item) => item.assetId === selectedPropAssetId);
    const stateGroup = resolvePropStateOptions(propStateGroups, selectedPropAssetId);
    emitCommand('prop.spawn', {
      assetId: selectedPropAssetId,
      label: stateGroup?.groupLabel || asset?.label || humanize(selectedPropAssetId.split('/').pop()),
      x: 0.5,
      y: 0.5,
      width: DEFAULT_PROP_SIZE,
      height: DEFAULT_PROP_SIZE,
      rotation: 0,
    });
  };

  const handleUpdateSelectedProp = (patch) => {
    if (!selectedPropId) return;
    emitCommand('prop.update', { propId: selectedPropId, ...patch });
  };

  const handleRemoveSelectedProp = () => {
    if (!selectedPropId) return;
    emitCommand('prop.remove', { propId: selectedPropId });
    setSelectedPropId('');
  };

  const openHandoutPreview = (assetId) => {
    setPreviewHandoutId(String(assetId || ''));
    setHandoutZoom(0.65);
  };

  const handleHandoutDelivery = (handout) => {
    if (!isMaster || !handout?.assetId) return;
    const isRevoke = Boolean(handout.delivered);
    const prompt = isRevoke
      ? `Recolher “${handout.label}”? Novos acessos serão bloqueados, mas cópias ou capturas já salvas pelos jogadores não podem ser apagadas.`
      : `Entregar “${handout.label}” para todos os jogadores desta mesa, inclusive quem entrar depois?`;
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm(prompt)) return;
    emitCommand(
      isRevoke ? 'handout.revoke' : 'handout.deliver',
      { assetId: handout.assetId },
    );
  };

  return (
    <section className="vtt-board" aria-label="Mesa virtual C.A.O.S.">
      <header className="vtt-board__toolbar">
        <div className="vtt-board__scene-title">
          <span>Mesa ativa</span>
          <strong>{scene?.label || humanize(scene?.key) || 'Nenhuma cena selecionada'}</strong>
        </div>

        <div className="vtt-board__camera-controls" aria-label="Controles de visualização">
          <button
            type="button"
            onClick={() => setZoom(camera.scale - 0.15)}
            disabled={!scene}
            aria-label="Diminuir zoom"
          >−</button>
          <output aria-label="Nível de zoom">{Math.round(camera.scale * 100)}%</output>
          <button
            type="button"
            onClick={() => setZoom(camera.scale + 0.15)}
            disabled={!scene}
            aria-label="Aumentar zoom"
          >+</button>
          <button type="button" onClick={resetCamera} disabled={!scene}>Enquadrar</button>
          <small title="Limite antes de ampliar o bitmap">
            nativo {Math.round(maximumZoom * 100)}%
          </small>
          {hasGrid && (
            <button
              type="button"
              className={showGrid ? 'is-active' : ''}
              onClick={() => setShowGrid((current) => !current)}
              aria-pressed={showGrid}
            >
              Grade
            </button>
          )}
        </div>

        <div className="vtt-board__session-actions">
          <button
            type="button"
            className="vtt-board__handout-trigger"
            onClick={() => setHandoutsOpen(true)}
            aria-haspopup="dialog"
          >
            <span aria-hidden="true">▤</span>
            {isMaster ? 'Handouts' : 'Arquivos'}
            <strong>
              {isMaster
                ? `${deliveredHandoutCount}/${handouts.length}${masterReferences.length ? ` +${masterReferences.length}` : ''}`
                : handouts.length}
            </strong>
          </button>
          <span className={`vtt-board__connection is-${connected ? 'online' : 'offline'}`}>
          {connected ? (isMaster ? 'Mestre conectado' : 'Jogador conectado') : 'Sem conexão'}
          </span>
        </div>
      </header>

      <div className={`vtt-board__layout ${isMaster ? 'has-director' : ''}`}>
        <div
          ref={viewportRef}
          className={`vtt-board__viewport ${isPanning ? 'is-panning' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={finishPan}
          onPointerCancel={finishPan}
          onKeyDown={handleViewportKeyDown}
          tabIndex={scene ? 0 : undefined}
          aria-label={scene ? 'Mapa interativo. Use as setas para navegar e Home para enquadrar.' : undefined}
        >
          {scene?.map?.url ? (
            <div
              ref={stageRef}
              className="vtt-board__stage"
              style={{
                aspectRatio: `${mapWidth} / ${mapHeight}`,
                transform: `translate3d(${snapToDevicePixel(camera.x)}px, ${snapToDevicePixel(camera.y)}px, 0) scale(${camera.scale})`,
              }}
            >
              <img
                className={`vtt-board__map is-${mapLoadState}`}
                src={scene.map.url}
                alt={`Mapa de ${scene.label || humanize(scene.key)}`}
                draggable="false"
                onLoad={() => setMapLoadState('ready')}
                onError={() => setMapLoadState('error')}
              />

              {sceneLayers.flatMap((layer) => (
                layer.assetUrl && Array.isArray(layer.placements)
                  ? layer.placements.map((placement, placementIndex) => (
                    <VttSceneLayerImage
                      key={`${layer.id}:${layer.assetId}:${placementIndex}`}
                      layer={layer}
                      placement={placement}
                      placementIndex={placementIndex}
                    />
                  ))
                  : []
              ))}

              {props.map((prop) => {
                const position = draftPropPositions[prop.id] || prop;
                const selected = selectedPropId === prop.id;
                return (
                  <button
                    key={prop.id}
                    type="button"
                    className={`vtt-board__prop ${selected ? 'is-selected' : ''} ${prop.visible === false ? 'is-hidden' : ''}`}
                    style={{
                      '--vtt-prop-x': `${position.x * 100}%`,
                      '--vtt-prop-y': `${position.y * 100}%`,
                      '--vtt-prop-width': `${prop.width * 100}%`,
                      '--vtt-prop-height': `${prop.height * 100}%`,
                      '--vtt-prop-rotation': `${prop.rotation}deg`,
                    }}
                    onPointerDown={(event) => handlePropPointerDown(event, prop)}
                    onPointerMove={(event) => handlePropPointerMove(event, prop)}
                    onPointerUp={(event) => finishPropDrag(event, prop)}
                    onPointerCancel={(event) => finishPropDrag(event, prop, true)}
                    onKeyDown={(event) => handlePropKeyDown(event, prop)}
                    aria-label={`${prop.label}. Objeto de cenário.${isMaster ? ' Use as setas para mover.' : ''}`}
                    aria-pressed={selected}
                  >
                    {prop.assetUrl && <img src={prop.assetUrl} alt="" draggable="false" />}
                    <small>{prop.label}</small>
                  </button>
                );
              })}

              {mapLoadState !== 'ready' && (
                <div className={`vtt-board__map-status is-${mapLoadState}`} role="status">
                  {mapLoadState === 'error' ? 'Não foi possível carregar este mapa.' : 'Carregando mapa...'}
                </div>
              )}

              {overlays.filter((overlay) => overlay.enabled).map((overlay) => (
                <VttOverlayImage
                  key={overlay.assetId}
                  overlay={overlay}
                />
              ))}

              {isMaster && fog?.enabled && (
                <canvas
                  ref={fogCanvasRef}
                  className={`vtt-board__fog-mask ${fogEditMode ? 'is-editing' : ''}`}
                  onPointerDown={handleFogPointerDown}
                  onPointerMove={handleFogPointerMove}
                  onPointerUp={(event) => finishFogStroke(event)}
                  onPointerCancel={(event) => finishFogStroke(event, true)}
                  aria-label={fogEditMode ? 'Editor da névoa de guerra' : undefined}
                />
              )}

              {hasGrid && showGrid && (
                <div
                  className="vtt-board__grid"
                  style={{
                    '--vtt-grid-columns': gridColumns,
                    '--vtt-grid-rows': gridRows,
                  }}
                  aria-hidden="true"
                />
              )}

              {tokens.map((token) => {
                const position = draftPositions[token.id] || token;
                const selected = selectedTokenId === token.id;
                return (
                  <button
                    key={token.id}
                    type="button"
                    className={`vtt-board__token ${selected ? 'is-selected' : ''} ${token.visible === false ? 'is-hidden' : ''}`}
                    style={{
                      '--vtt-token-x': `${position.x * 100}%`,
                      '--vtt-token-y': `${position.y * 100}%`,
                      '--vtt-token-size': `${token.size * 100}%`,
                    }}
                    onPointerDown={(event) => handleTokenPointerDown(event, token)}
                    onPointerMove={(event) => handleTokenPointerMove(event, token)}
                    onPointerUp={(event) => finishTokenDrag(event, token)}
                    onPointerCancel={(event) => finishTokenDrag(event, token, true)}
                    onKeyDown={(event) => handleTokenKeyDown(event, token)}
                    aria-label={`${token.label}. Posição X ${position.x.toFixed(2)}, Y ${position.y.toFixed(2)}.${canMoveToken(token) ? ' Use as setas para mover.' : ' Movimento restrito ao Mestre.'}`}
                    aria-pressed={selected}
                  >
                    {token.assetUrl && (
                      <img
                        src={token.assetUrl}
                        alt=""
                        draggable="false"
                        onError={(event) => { event.currentTarget.hidden = true; }}
                      />
                    )}
                    <span aria-hidden="true">{tokenInitials(token.label)}</span>
                    <small>{token.label}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="vtt-board__empty">
              <span aria-hidden="true">◇</span>
              <strong>Aguardando uma cena</strong>
              <p>O Mestre pode selecionar um mapa no painel de direção.</p>
            </div>
          )}

          <div className="vtt-board__viewport-hint" aria-hidden="true">
            Arraste o fundo para navegar · use a roda para ampliar
          </div>
        </div>

        {isMaster && (
          <aside className="vtt-board__director" aria-label="Painel de direção do Mestre">
            <div className="vtt-board__director-heading">
              <span>Controle do Mestre</span>
              <strong>Direção da cena</strong>
            </div>

            {scene?.gmGuideMap?.url && (
              <details className="vtt-board__gm-guide">
                <summary>Guia privado do Mestre</summary>
                <button
                  type="button"
                  className="vtt-board__gm-guide-preview"
                  onClick={() => setGuideOpen(true)}
                  aria-label="Abrir guia privado do Mestre em tela cheia"
                >
                  <img
                    src={scene.gmGuideMap.url}
                    alt={`Guia do Mestre para ${scene.label || humanize(scene.key)}`}
                    draggable="false"
                  />
                  <span>Ampliar guia</span>
                </button>
                <small>Esta imagem nunca é enviada aos jogadores.</small>
              </details>
            )}

            <label className="vtt-board__field" htmlFor="vtt-board-scene">
              <span>Cena ativa</span>
              <select
                id="vtt-board-scene"
                value={scene?.id || ''}
                onChange={(event) => emitCommand('scene.select', { sceneId: event.target.value })}
                disabled={!connected || scenes.length === 0}
              >
                <option value="" disabled>Selecione uma cena</option>
                {scenes.map((item) => (
                  <option key={item.id} value={item.id}>{item.label || humanize(item.key)}</option>
                ))}
              </select>
            </label>

            <fieldset className="vtt-board__effects" disabled={!connected || overlays.length === 0}>
              <legend>Efeitos e overlays</legend>
              {overlays.length === 0 && <p>Esta cena não possui overlays.</p>}
              {overlays.map((overlay) => (
                <label key={overlay.assetId}>
                  <input
                    type="checkbox"
                    checked={Boolean(overlay.enabled)}
                    onChange={(event) => emitCommand('overlay.set', {
                      assetId: overlay.assetId,
                      enabled: event.target.checked,
                    })}
                  />
                  <span>{overlay.label || humanize(overlay.name)}</span>
                </label>
              ))}
            </fieldset>

            <fieldset className="vtt-board__layers" disabled={!connected || sceneLayers.length === 0}>
              <legend>Composição da cena</legend>
              {sceneLayers.length === 0 && <p>Esta cena não possui objetos ancorados.</p>}
              {sceneLayers.map((layer) => (
                <label key={layer.id} className="vtt-board__field">
                  <span>{layer.label || humanize(layer.key)}</span>
                  <select
                    value={layer.state || ''}
                    onChange={(event) => emitCommand('layer.set', {
                      layerId: layer.id,
                      state: event.target.value || null,
                    })}
                  >
                    <option value="">Não exibir</option>
                    {(Array.isArray(layer.options) ? layer.options : []).map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label || humanize(option.key)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>

            <fieldset className="vtt-board__fog-controls" disabled={!connected || !scene}>
              <legend>Névoa de guerra</legend>
              <label className="vtt-board__fog-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(fog?.enabled)}
                  onChange={(event) => {
                    const enabled = event.target.checked;
                    if (enabled) {
                      emitCommand('fog.set_enabled', { enabled: true });
                      return;
                    }
                    confirmMasterCommand(
                      'Desativar a névoa libera o mapa completo, os efeitos e os objetos para todos os jogadores. Continuar?',
                      'fog.set_enabled',
                      { enabled: false },
                    );
                  }}
                />
                <span>
                  <strong>{fog?.enabled ? 'Proteção ativa' : 'Proteção desativada'}</strong>
                  <small>Oculta mapa, efeitos e tokens ainda não revelados.</small>
                </span>
              </label>

              {fog?.enabled && (
                <>
                  <button
                    type="button"
                    className={fogEditMode ? 'is-active' : ''}
                    onClick={() => setFogEditMode((current) => !current)}
                    aria-pressed={fogEditMode}
                  >
                    {fogEditMode ? 'Concluir desenho' : 'Editar no mapa'}
                  </button>
                  <div className="vtt-board__fog-modes" aria-label="Modo do pincel">
                    <button
                      type="button"
                      className={fogRevealMode ? 'is-active' : ''}
                      onClick={() => setFogRevealMode(true)}
                      aria-pressed={fogRevealMode}
                    >Revelar</button>
                    <button
                      type="button"
                      className={!fogRevealMode ? 'is-active' : ''}
                      onClick={() => setFogRevealMode(false)}
                      aria-pressed={!fogRevealMode}
                    >Ocultar</button>
                  </div>
                  <label className="vtt-board__fog-radius">
                    <span>Raio do pincel <output>{Math.round(fogBrushRadius * 100)}%</output></span>
                    <input
                      type="range"
                      min="1"
                      max="15"
                      step="1"
                      value={Math.round(fogBrushRadius * 100)}
                      onChange={(event) => setFogBrushRadius(Number(event.target.value) / 100)}
                    />
                  </label>
                  <div className="vtt-board__fog-actions">
                    <button
                      type="button"
                      onClick={() => confirmMasterCommand(
                        'Ocultar tudo apaga as áreas já reveladas desta cena. Continuar?',
                        'fog.reset',
                      )}
                    >Ocultar tudo</button>
                    <button
                      type="button"
                      onClick={() => confirmMasterCommand(
                        'Revelar tudo deixará o mapa inteiro visível aos jogadores. Continuar?',
                        'fog.reveal_all',
                      )}
                    >Revelar tudo</button>
                  </div>
                  <small className="vtt-board__fog-status">
                    Máscara privada · revisão {Number(fog.revision || 0)}
                  </small>
                  {fogMaskError && <p className="vtt-board__fog-error" role="alert">{fogMaskError}</p>}
                </>
              )}
            </fieldset>

            <div className="vtt-board__spawn">
              <label className="vtt-board__field" htmlFor="vtt-board-token-asset">
                <span>Adicionar token</span>
                <select
                  id="vtt-board-token-asset"
                  value={selectedAssetId}
                  onChange={(event) => setSelectedAssetId(event.target.value)}
                  disabled={!connected || tokenAssets.length === 0}
                >
                  {tokenAssets.length === 0 && <option value="">Nenhum token disponível</option>}
                  {tokenAssets.map((asset) => (
                    <option key={asset.assetId} value={asset.assetId}>
                      {asset.label || humanize(asset.assetId.split('/').pop())}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={handleSpawn} disabled={!connected || !selectedAssetId}>
                Posicionar no centro
              </button>
            </div>

            <button
              type="button"
              className="vtt-board__remove"
              onClick={handleRemoveSelected}
              disabled={!connected || !selectedTokenId}
            >
              Remover token selecionado
            </button>

            <div className="vtt-board__prop-editor">
              <label className="vtt-board__field" htmlFor="vtt-board-prop-asset">
                <span>Objetos de cenário</span>
                <select
                  id="vtt-board-prop-asset"
                  value={selectedPropAssetId}
                  onChange={(event) => setSelectedPropAssetId(event.target.value)}
                  disabled={!connected || propAssets.length === 0}
                >
                  {propAssets.length === 0 && <option value="">Nenhum objeto disponível</option>}
                  {propAssets.map((asset) => (
                    <option key={asset.assetId} value={asset.assetId}>
                      {asset.label || humanize(asset.assetId.split('/').pop())}
                    </option>
                  ))}
                </select>
              </label>
              <div className="vtt-board__prop-primary-actions">
                <button type="button" onClick={handleSpawnProp} disabled={!selectedPropAssetId}>
                  Posicionar objeto
                </button>
              </div>
              <label className="vtt-board__field" htmlFor="vtt-board-prop-state">
                <span>Estado do objeto selecionado</span>
                <select
                  id="vtt-board-prop-state"
                  value={selectedPropStateAssetId}
                  onChange={(event) => setSelectedPropStateAssetId(event.target.value)}
                  disabled={!selectedPropId || !selectedPropStates?.options.length}
                >
                  {!selectedPropStates?.options.length && (
                    <option value="">Este objeto não possui estados alternativos</option>
                  )}
                  {selectedPropStates?.options.map((state) => (
                    <option key={state.assetId} value={state.assetId}>
                      {state.label}{state.version > 1 ? ` · v${state.version}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="vtt-board__prop-primary-actions">
                <button
                  type="button"
                  onClick={() => handleUpdateSelectedProp({
                    assetId: selectedPropStateAssetId,
                    label: selectedPropStates?.groupLabel || selectedProp?.label,
                  })}
                  disabled={
                    !selectedPropId
                    || !selectedPropStateAssetId
                    || selectedPropStateAssetId === selectedProp?.assetId
                  }
                >
                  Aplicar estado
                </button>
              </div>
              <div className="vtt-board__prop-transform" aria-label="Ajustes do objeto selecionado">
                <button
                  type="button"
                  onClick={() => {
                    const prop = props.find((item) => item.id === selectedPropId);
                    if (prop) handleUpdateSelectedProp({
                      width: clamp(prop.width * 0.85, MIN_PROP_SIZE, MAX_PROP_SIZE),
                      height: clamp(prop.height * 0.85, MIN_PROP_SIZE, MAX_PROP_SIZE),
                    });
                  }}
                  disabled={!selectedPropId}
                  aria-label="Diminuir objeto"
                >−</button>
                <button
                  type="button"
                  onClick={() => {
                    const prop = props.find((item) => item.id === selectedPropId);
                    if (prop) handleUpdateSelectedProp({
                      rotation: ((((prop.rotation - 15) + 180) % 360) + 360) % 360 - 180,
                    });
                  }}
                  disabled={!selectedPropId}
                  aria-label="Girar objeto à esquerda"
                >↺</button>
                <button
                  type="button"
                  onClick={() => {
                    const prop = props.find((item) => item.id === selectedPropId);
                    if (prop) handleUpdateSelectedProp({
                      rotation: ((((prop.rotation + 15) + 180) % 360) + 360) % 360 - 180,
                    });
                  }}
                  disabled={!selectedPropId}
                  aria-label="Girar objeto à direita"
                >↻</button>
                <button
                  type="button"
                  onClick={() => {
                    const prop = props.find((item) => item.id === selectedPropId);
                    if (prop) handleUpdateSelectedProp({
                      width: clamp(prop.width * 1.15, MIN_PROP_SIZE, MAX_PROP_SIZE),
                      height: clamp(prop.height * 1.15, MIN_PROP_SIZE, MAX_PROP_SIZE),
                    });
                  }}
                  disabled={!selectedPropId}
                  aria-label="Aumentar objeto"
                >+</button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const prop = props.find((item) => item.id === selectedPropId);
                  if (prop) handleUpdateSelectedProp({ visible: prop.visible === false });
                }}
                disabled={!selectedPropId}
              >
                {props.find((item) => item.id === selectedPropId)?.visible === false
                  ? 'Mostrar aos jogadores'
                  : 'Ocultar dos jogadores'}
              </button>
              <button
                type="button"
                className="vtt-board__remove"
                onClick={handleRemoveSelectedProp}
                disabled={!selectedPropId}
              >
                Remover objeto selecionado
              </button>
            </div>

            <p className="vtt-board__director-note">
              A mesa sincroniza posições e efeitos. Rolagens continuam sendo feitas com dados físicos.
            </p>
          </aside>
        )}
      </div>

      {handoutsOpen && (
        <div
          className="vtt-board__handout-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setHandoutsOpen(false);
          }}
        >
          <aside
            className="vtt-board__handout-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vtt-handouts-title"
          >
            <header className="vtt-board__handout-header">
              <div>
                <span>{isMaster ? 'Dossiê privado' : 'Evidências recebidas'}</span>
                <h2 id="vtt-handouts-title">
                  {isMaster ? 'Handouts e referências' : 'Arquivos da investigação'}
                </h2>
                <p>
                  {isMaster
                    ? `${deliveredHandoutCount} de ${handouts.length} handouts entregues${masterReferences.length ? ` · ${masterReferences.length} referência privada` : ''}.`
                    : `${handouts.length} ${handouts.length === 1 ? 'documento liberado' : 'documentos liberados'} pelo Mestre.`}
                </p>
              </div>
              <button
                type="button"
                className="vtt-board__handout-close"
                onClick={() => setHandoutsOpen(false)}
                aria-label="Fechar arquivos"
              >×</button>
            </header>

            <label className="vtt-board__handout-search">
              <span>Buscar documento</span>
              <input
                type="search"
                value={handoutQuery}
                onChange={(event) => setHandoutQuery(event.target.value)}
                placeholder="Nome, código ou pista..."
                autoComplete="off"
              />
            </label>

            <div className="vtt-board__handout-list" aria-live="polite">
              {drawerItems.length === 0 && (
                <div className="vtt-board__handout-empty">
                  <span aria-hidden="true">▤</span>
                  <strong>
                    {handouts.length + masterReferences.length === 0
                      ? 'Nenhum arquivo disponível'
                      : 'Nenhum resultado'}
                  </strong>
                  <p>
                    {isMaster && handouts.length + masterReferences.length === 0
                      ? 'O catálogo da campanha ainda não possui handouts.'
                      : handouts.length === 0 && masterReferences.length === 0
                        ? 'Os documentos aparecerão aqui assim que o Mestre entregá-los.'
                        : 'Tente buscar por outro termo.'}
                  </p>
                </div>
              )}

              {drawerItems.map((handout) => (
                <article
                  key={handout.assetId}
                  className={`vtt-board__handout-card ${handout.delivered ? 'is-delivered' : ''} ${handout.privateReference ? 'is-reference' : ''}`}
                >
                  <button
                    type="button"
                    className="vtt-board__handout-thumbnail"
                    onClick={() => openHandoutPreview(handout.assetId)}
                    disabled={!handout.url}
                    aria-label={`Abrir ${handout.label}`}
                  >
                    <span aria-hidden="true">▤</span>
                    <small>{handout.image ? `${handout.image.width} × ${handout.image.height}` : 'Documento'}</small>
                  </button>

                  <div className="vtt-board__handout-card-body">
                    <span className="vtt-board__handout-status">
                      {handout.privateReference
                        ? 'Referência privada do Mestre'
                        : handout.delivered
                          ? 'Entregue à mesa'
                          : 'Somente Mestre'}
                    </span>
                    <strong title={handout.label}>{handout.label}</strong>
                    <div className="vtt-board__handout-card-actions">
                      <button
                        type="button"
                        onClick={() => openHandoutPreview(handout.assetId)}
                        disabled={!handout.url}
                      >
                        Visualizar
                      </button>
                      {isMaster && !handout.privateReference && (
                        <button
                          type="button"
                          className={handout.delivered ? 'is-revoke' : 'is-deliver'}
                          onClick={() => handleHandoutDelivery(handout)}
                          disabled={!connected}
                        >
                          {handout.delivered ? 'Recolher' : 'Entregar'}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <footer className="vtt-board__handout-footer">
              {isMaster
                ? 'Referências privadas nunca podem ser entregues. Nos handouts, entregar revela o arquivo para a sala inteira; recolher bloqueia novos acessos, mas não apaga cópias já feitas.'
                : 'Arquivos recolhidos pelo Mestre deixam de aparecer e não aceitam novos acessos. Cópias ou capturas já salvas não podem ser apagadas.'}
            </footer>
          </aside>
        </div>
      )}

      {previewHandout && (
        <div
          className="vtt-board__handout-preview"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vtt-handout-preview-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewHandoutId('');
          }}
        >
          <header>
            <div>
              <span>
                {previewHandout.privateReference
                  ? 'Referência privada do Mestre'
                  : isMaster && !previewHandout.delivered
                    ? 'Prévia privada'
                    : 'Documento da investigação'}
              </span>
              <strong id="vtt-handout-preview-title">{previewHandout.label}</strong>
            </div>
            <div className="vtt-board__handout-preview-actions">
              <button
                type="button"
                onClick={() => setHandoutZoom((value) => clamp(value - 0.15, 0.25, 2))}
                aria-label="Diminuir documento"
              >−</button>
              <output>{Math.round(handoutZoom * 100)}%</output>
              <button
                type="button"
                onClick={() => setHandoutZoom((value) => clamp(value + 0.15, 0.25, 2))}
                aria-label="Aumentar documento"
              >+</button>
              <button type="button" onClick={() => setHandoutZoom(0.65)}>Enquadrar</button>
              <button type="button" onClick={() => setPreviewHandoutId('')}>Fechar</button>
            </div>
          </header>
          <div className="vtt-board__handout-preview-canvas">
            {previewHandout.url && previewHandout.mediaType.startsWith('image/') ? (
              <img
                src={previewHandout.url}
                alt={previewHandout.label}
                draggable="false"
                style={{
                  width: `${Math.max(480, previewHandout.image?.width || 1600) * handoutZoom}px`,
                }}
              />
            ) : (
              <div className="vtt-board__handout-preview-error">
                Este formato não possui prévia visual no VTT.
              </div>
            )}
          </div>
        </div>
      )}

      {isMaster && guideOpen && scene?.gmGuideMap?.url && (
        <div
          className="vtt-board__guide-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Guia privado do Mestre para ${scene.label || humanize(scene.key)}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGuideOpen(false);
          }}
        >
          <header>
            <div>
              <span>Somente Mestre</span>
              <strong>{scene.label || humanize(scene.key)}</strong>
            </div>
            <div className="vtt-board__guide-actions">
              <button type="button" onClick={() => setGuideZoom((value) => clamp(value - 0.25, 0.5, 3))}>−</button>
              <output>{Math.round(guideZoom * 100)}%</output>
              <button type="button" onClick={() => setGuideZoom((value) => clamp(value + 0.25, 0.5, 3))}>+</button>
              <button type="button" onClick={() => setGuideZoom(1)}>Tamanho real</button>
              <button type="button" onClick={() => setGuideOpen(false)} aria-label="Fechar guia">Fechar</button>
            </div>
          </header>
          <div className="vtt-board__guide-canvas">
            <img
              src={scene.gmGuideMap.url}
              alt={`Guia privado do Mestre para ${scene.label || humanize(scene.key)}`}
              draggable="false"
              style={{
                width: `${Math.max(1, Number(scene.gmGuideMap.width) || mapWidth) * guideZoom}px`,
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
