import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './vtt-board.css';
import { constrainVttCamera, zoomVttCameraAtPoint } from './camera.js';
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

function DirectorSection({
  id,
  title,
  summary,
  badge,
  open,
  onToggle,
  children,
}) {
  return (
    <section className={`vtt-board__director-section ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="vtt-board__director-section-toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-content`}
      >
        <span className="vtt-board__director-section-copy">
          <strong>{title}</strong>
          <small>{summary}</small>
        </span>
        {badge && <span className="vtt-board__director-section-badge">{badge}</span>}
        <span className="vtt-board__director-section-chevron" aria-hidden="true">⌄</span>
      </button>
      {open && (
        <div id={`${id}-content`} className="vtt-board__director-section-body">
          {children}
        </div>
      )}
    </section>
  );
}

export default function VttBoard({
  state = {},
  role = 'player',
  connected = false,
  members = [],
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
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [draftPositions, setDraftPositions] = useState({});
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [newTokenControllerUid, setNewTokenControllerUid] = useState('');
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
  const [directorOpen, setDirectorOpen] = useState(true);
  const [directorSections, setDirectorSections] = useState({
    scene: false,
    fog: false,
    tokens: false,
    props: false,
  });
  const [fogEditMode, setFogEditMode] = useState(false);
  const [fogRevealMode, setFogRevealMode] = useState(true);
  const [fogBrushRadius, setFogBrushRadius] = useState(DEFAULT_FOG_BRUSH_RADIUS);
  const [fogMask, setFogMask] = useState(null);
  const [fogMaskError, setFogMaskError] = useState('');
  const [fogDraftPoints, setFogDraftPoints] = useState([]);

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
  const controllerMembers = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(members) ? members : [])
      .map((member) => ({
        uid: String(member?.uid || '').trim(),
        name: String(member?.name || member?.nome || '').trim() || 'Agente',
      }))
      .filter((member) => member.uid && !seen.has(member.uid) && seen.add(member.uid));
  }, [members]);
  const selectedToken = useMemo(
    () => tokens.find((item) => item.id === selectedTokenId) || null,
    [selectedTokenId, tokens],
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
  const activeOverlayCount = overlays.filter((overlay) => overlay.enabled).length;
  const controlledTokenCount = isMaster
    ? 0
    : tokens.filter((token) => token.movable !== false).length;
  const mapWidth = Math.max(1, Number(scene?.map?.width) || 1);
  const mapHeight = Math.max(1, Number(scene?.map?.height) || 1);
  const gridColumns = Math.max(1, Number(scene?.gridHint?.columns) || 1);
  const gridRows = Math.max(1, Number(scene?.gridHint?.rows) || 1);
  const hasGrid = scene?.gridHint?.type === 'square';
  const maximumZoom = clamp(nativeZoomLimit, MIN_ZOOM, MAX_ZOOM);

  const constrainCamera = useCallback((candidate) => {
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    return constrainVttCamera(candidate, {
      minimumZoom: MIN_ZOOM,
      maximumZoom: MAX_ZOOM,
      stageWidth: stage?.offsetWidth || 0,
      stageHeight: stage?.offsetHeight || 0,
      viewportWidth: viewport?.clientWidth || 0,
      viewportHeight: viewport?.clientHeight || 0,
    });
  }, []);

  const emitCommand = useCallback((type, payload = {}) => {
    if (!connected || typeof onCommand !== 'function') return false;
    onCommand({ type, payload });
    return true;
  }, [connected, onCommand]);

  const confirmMasterCommand = useCallback((message, type, payload = {}) => {
    if (typeof globalThis.confirm === 'function' && !globalThis.confirm(message)) return false;
    return emitCommand(type, payload);
  }, [emitCommand]);

  const toggleDirectorSection = useCallback((section) => {
    setDirectorSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }, []);

  const openDirectorSection = useCallback((section) => {
    setDirectorSections((current) => ({
      ...current,
      [section]: true,
    }));
  }, []);

  const handleFogEnabledChange = useCallback((enabled) => {
    if (enabled) return emitCommand('fog.set_enabled', { enabled: true });
    return confirmMasterCommand(
      'Desativar a névoa libera o mapa completo, os efeitos e os objetos para todos os jogadores. Continuar?',
      'fog.set_enabled',
      { enabled: false },
    );
  }, [confirmMasterCommand, emitCommand]);

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
      setCamera((current) => constrainCamera({
        ...current,
        scale: Math.min(current.scale, limit),
      }));
    };

    updateNativeZoom();
    const observer = new ResizeObserver(updateNativeZoom);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [constrainCamera, mapWidth, scene?.map?.url]);

  useEffect(() => {
    if (!guideOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setGuideOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guideOpen]);

  useEffect(() => {
    if (!selectedAssetId && tokenAssets[0]?.assetId) {
      setSelectedAssetId(tokenAssets[0].assetId);
    }
  }, [selectedAssetId, tokenAssets]);

  useEffect(() => {
    if (
      newTokenControllerUid
      && !controllerMembers.some((member) => member.uid === newTokenControllerUid)
    ) {
      setNewTokenControllerUid('');
    }
  }, [controllerMembers, newTokenControllerUid]);

  useEffect(() => {
    if (selectedTokenId && !selectedToken) setSelectedTokenId('');
  }, [selectedToken, selectedTokenId]);

  useEffect(() => {
    if (selectedTokenId) openDirectorSection('tokens');
  }, [openDirectorSection, selectedTokenId]);

  useEffect(() => {
    if (selectedPropId) openDirectorSection('props');
  }, [openDirectorSection, selectedPropId]);

  useEffect(() => {
    if (fogEditMode) openDirectorSection('fog');
  }, [fogEditMode, openDirectorSection]);

  useEffect(() => {
    if (!selectedPropAssetId && propAssets[0]?.assetId) {
      setSelectedPropAssetId(propAssets[0].assetId);
    }
  }, [propAssets, selectedPropAssetId]);

  useEffect(() => {
    setSelectedPropStateAssetId(selectedPropStates?.currentStateAssetId || '');
  }, [selectedPropId, selectedPropStates?.currentStateAssetId]);

  const setZoom = useCallback((nextScale) => {
    setCamera((current) => constrainCamera({
      ...current,
      scale: clamp(nextScale, MIN_ZOOM, maximumZoom),
    }));
  }, [constrainCamera, maximumZoom]);

  const resetCamera = useCallback(() => {
    setCamera({ x: 0, y: 0, scale: 1 });
  }, []);

  const handleWheel = useCallback((event) => {
    if (!scene) return;
    event.preventDefault();
    event.stopPropagation();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pointerX = event.clientX - (rect.left + rect.width / 2);
    const pointerY = event.clientY - (rect.top + rect.height / 2);
    const stage = stageRef.current;
    setCamera((current) => zoomVttCameraAtPoint(current, {
      pointerX,
      pointerY,
      deltaY: event.deltaY,
      minimumZoom: MIN_ZOOM,
      maximumZoom,
      stageWidth: stage?.offsetWidth || 0,
      stageHeight: stage?.offsetHeight || 0,
      viewportWidth: viewport.clientWidth,
      viewportHeight: viewport.clientHeight,
    }));
  }, [maximumZoom, scene]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

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
    setCamera((current) => constrainCamera({
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
    setCamera((current) => constrainCamera({
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
      ...(newTokenControllerUid ? { controllerUid: newTokenControllerUid } : {}),
    });
  };

  const handleAssignSelectedToken = (controllerUid) => {
    if (!selectedTokenId) return;
    emitCommand('token.assign', {
      tokenId: selectedTokenId,
      controllerUid: controllerUid || null,
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
          {!isMaster && connected && (
            <span className="vtt-board__ownership-summary">
              {controlledTokenCount === 0
                ? 'Nenhuma peça atribuída'
                : `${controlledTokenCount} ${controlledTokenCount === 1 ? 'peça sua' : 'peças suas'}`}
            </span>
          )}
          <span className={`vtt-board__connection is-${connected ? 'online' : 'offline'}`}>
          {connected ? (isMaster ? 'Mestre conectado' : 'Jogador conectado') : 'Sem conexão'}
          </span>
          {isMaster && (
            <button
              type="button"
              className="vtt-board__director-toggle"
              onClick={() => setDirectorOpen((current) => !current)}
              aria-expanded={directorOpen}
            >
              {directorOpen ? 'Ocultar direção' : 'Abrir direção'}
            </button>
          )}
        </div>
      </header>

      <div className={`vtt-board__layout ${isMaster && directorOpen ? 'has-director' : ''}`}>
        <div
          ref={viewportRef}
          className={`vtt-board__viewport ${isPanning ? 'is-panning' : ''}`}
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
                    className={`vtt-board__token ${selected ? 'is-selected' : ''} ${token.visible === false ? 'is-hidden' : ''} ${!isMaster && token.movable !== false ? 'is-owned' : ''} ${!isMaster && token.movable === false ? 'is-locked' : ''}`}
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
                    {!isMaster && token.movable !== false && (
                      <i className="vtt-board__token-owner-marker" aria-hidden="true">Sua</i>
                    )}
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

        {isMaster && directorOpen && (
          <aside className="vtt-board__director" aria-label="Painel de direção do Mestre">
            <div className="vtt-board__director-heading">
              <span>Controle do Mestre</span>
              <strong>Central de direção</strong>
            </div>

            <section className="vtt-board__master-hub" aria-labelledby="vtt-board-master-hub-title">
              <div className="vtt-board__master-hub-heading">
                <div>
                  <span id="vtt-board-master-hub-title">Visão geral</span>
                  <strong>{scene?.label || 'Nenhuma cena ativa'}</strong>
                </div>
                <span className={`vtt-board__master-live ${connected ? 'is-online' : ''}`}>
                  {connected ? 'Ao vivo' : 'Offline'}
                </span>
              </div>

              <div className="vtt-board__master-metrics">
                <button type="button" onClick={() => openDirectorSection('scene')}>
                  <span>Cena</span>
                  <strong>{scenes.length}</strong>
                </button>
                <button type="button" onClick={() => openDirectorSection('fog')}>
                  <span>Névoa</span>
                  <strong>{fog?.enabled ? 'Ativa' : 'Livre'}</strong>
                </button>
                <button type="button" onClick={() => openDirectorSection('tokens')}>
                  <span>Tokens</span>
                  <strong>{tokens.length}</strong>
                </button>
                <button type="button" onClick={() => openDirectorSection('props')}>
                  <span>Objetos</span>
                  <strong>{props.length}</strong>
                </button>
              </div>

              <div className="vtt-board__master-quick-actions">
                <span>Ações rápidas</span>
                <button
                  type="button"
                  className={fog?.enabled ? 'is-active' : ''}
                  onClick={() => handleFogEnabledChange(!fog?.enabled)}
                  disabled={!connected || !scene}
                >
                  {fog?.enabled ? 'Desativar névoa' : 'Ativar névoa'}
                </button>
                <button type="button" onClick={resetCamera} disabled={!scene}>
                  Enquadrar mapa
                </button>
              </div>

              <div className="vtt-board__master-effects" aria-label="Efeitos rápidos">
                <div>
                  <span>Efeitos rápidos</span>
                  <small>{activeOverlayCount}/{overlays.length} ativos</small>
                </div>
                {overlays.length === 0 ? (
                  <p>Esta cena não possui efeitos alternáveis.</p>
                ) : (
                  <div>
                    {overlays.map((overlay) => (
                      <button
                        key={overlay.assetId}
                        type="button"
                        className={overlay.enabled ? 'is-active' : ''}
                        onClick={() => emitCommand('overlay.set', {
                          assetId: overlay.assetId,
                          enabled: !overlay.enabled,
                        })}
                        aria-pressed={Boolean(overlay.enabled)}
                        disabled={!connected}
                      >
                        {overlay.label || humanize(overlay.name)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <DirectorSection
              id="vtt-board-scene-section"
              title="Cena e efeitos"
              summary={scene?.label || 'Escolha o mapa ativo'}
              badge={activeOverlayCount > 0 ? `${activeOverlayCount} efeito${activeOverlayCount === 1 ? '' : 's'}` : 'Cena'}
              open={directorSections.scene}
              onToggle={() => toggleDirectorSection('scene')}
            >

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

            </DirectorSection>

            <DirectorSection
              id="vtt-board-fog-section"
              title="Névoa de guerra"
              summary={fog?.enabled ? 'Proteção ativa' : 'Mapa liberado'}
              badge={fog?.enabled ? `Rev. ${Number(fog.revision || 0)}` : 'Livre'}
              open={directorSections.fog}
              onToggle={() => toggleDirectorSection('fog')}
            >

            <fieldset className="vtt-board__fog-controls" disabled={!connected || !scene}>
              <legend>Névoa de guerra</legend>
              <label className="vtt-board__fog-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(fog?.enabled)}
                  onChange={(event) => handleFogEnabledChange(event.target.checked)}
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

            </DirectorSection>

            <DirectorSection
              id="vtt-board-tokens-section"
              title="Tokens e jogadores"
              summary={selectedToken?.label || 'Posicionar e atribuir peças'}
              badge={`${tokens.length} ${tokens.length === 1 ? 'peça' : 'peças'}`}
              open={directorSections.tokens}
              onToggle={() => toggleDirectorSection('tokens')}
            >

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
              {controllerMembers.length > 0 && (
                <label className="vtt-board__field" htmlFor="vtt-board-new-token-controller">
                  <span>Controle inicial</span>
                  <select
                    id="vtt-board-new-token-controller"
                    value={newTokenControllerUid}
                    onChange={(event) => setNewTokenControllerUid(event.target.value)}
                    disabled={!connected}
                  >
                    <option value="">Somente Mestre</option>
                    {controllerMembers.map((member) => (
                      <option key={member.uid} value={member.uid}>{member.name}</option>
                    ))}
                  </select>
                </label>
              )}
              <button type="button" onClick={handleSpawn} disabled={!connected || !selectedAssetId}>
                Posicionar no centro
              </button>
            </div>

            <section className="vtt-board__token-controller" aria-labelledby="vtt-board-token-controller-title">
              <div>
                <span id="vtt-board-token-controller-title">Token selecionado</span>
                <strong>{selectedToken?.label || 'Selecione uma peça no mapa'}</strong>
              </div>
              <label className="vtt-board__field" htmlFor="vtt-board-token-controller">
                <span>Quem pode movimentar</span>
                <select
                  id="vtt-board-token-controller"
                  value={selectedToken?.controllerUid || ''}
                  onChange={(event) => handleAssignSelectedToken(event.target.value)}
                  disabled={!connected || !selectedToken || controllerMembers.length === 0}
                >
                  <option value="">Somente Mestre</option>
                  {selectedToken?.controllerUid
                    && !controllerMembers.some((member) => member.uid === selectedToken.controllerUid)
                    && (
                      <option value={selectedToken.controllerUid}>Jogador indisponível</option>
                    )}
                  {controllerMembers.map((member) => (
                    <option key={member.uid} value={member.uid}>{member.name}</option>
                  ))}
                </select>
              </label>
              <small>
                {controllerMembers.length === 0
                  ? 'Os jogadores da Mesa aparecerão aqui quando o acesso for integrado.'
                  : 'A atribuição vale somente para esta peça e é validada pelo servidor.'}
              </small>
            </section>

            <button
              type="button"
              className="vtt-board__remove"
              onClick={handleRemoveSelected}
              disabled={!connected || !selectedTokenId}
            >
              Remover token selecionado
            </button>

            </DirectorSection>

            <DirectorSection
              id="vtt-board-props-section"
              title="Objetos de cenário"
              summary={selectedProp?.label || 'Posicionar e ajustar objetos'}
              badge={`${props.length} ${props.length === 1 ? 'objeto' : 'objetos'}`}
              open={directorSections.props}
              onToggle={() => toggleDirectorSection('props')}
            >

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

            </DirectorSection>

            <p className="vtt-board__director-note">
              A mesa sincroniza posições e efeitos. Rolagens continuam sendo feitas com dados físicos.
            </p>
          </aside>
        )}
      </div>

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
