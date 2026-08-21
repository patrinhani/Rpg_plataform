import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import './vtt-board.css';
import { constrainVttCamera, zoomVttCameraAtPoint } from './camera.js';
import { resolvePropStateOptions } from './prop-state-groups.js';
import {
  canOpenTokenCharacterSheet,
  normalizeCharacterSheetUids,
} from './token-sheets.js';
import {
  overlayMotionLabel,
  resolveOverlayMotionPreset,
} from './overlay-motion.js';

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3.2;
const DEFAULT_TOKEN_SIZE = 0.075;
const MIN_TOKEN_SIZE = 0.01;
const MAX_TOKEN_SIZE = 0.25;
const DEFAULT_PROP_SIZE = 0.18;
const MIN_PROP_SIZE = 0.025;
const MAX_PROP_SIZE = 0.8;
const MAX_FOG_REGION_POINTS = 64;

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

function createFogRegionId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `fog-${globalThis.crypto.randomUUID()}`;
  }
  return `fog-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeFogRegions(fog) {
  if (!Array.isArray(fog?.regions)) return [];
  return fog.regions
    .map((region) => ({
      regionId: String(region?.regionId || ''),
      label: String(region?.label || 'Área sem nome'),
      revealed: Boolean(region?.revealed),
      points: Array.isArray(region?.points)
        ? region.points.map((point) => ({
          x: clamp(point?.x, 0, 1),
          y: clamp(point?.y, 0, 1),
        }))
        : [],
    }))
    .filter((region) => region.regionId && region.points.length >= 3);
}

function fogPolygonPoints(points) {
  return points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ');
}

function VttOverlayImage({
  overlay,
  editable = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
}) {
  const [loaded, setLoaded] = useState(false);
  const motionPreset = resolveOverlayMotionPreset(overlay);
  const motionLabel = overlayMotionLabel(motionPreset);
  const placement = overlay.placement || {};
  const className = `vtt-board__overlay-frame is-motion-${motionPreset} ${loaded ? 'is-loaded' : ''} ${editable ? 'is-editing' : ''} ${placement.locked === false ? 'is-unlocked' : 'is-locked'}`;
  const style = {
    '--vtt-overlay-x': `${clamp(placement.x ?? 0.5, 0, 1) * 100}%`,
    '--vtt-overlay-y': `${clamp(placement.y ?? 0.5, 0, 1) * 100}%`,
    '--vtt-overlay-width': `${clamp(placement.width ?? 1, 0.01, 1) * 100}%`,
    '--vtt-overlay-height': `${clamp(placement.height ?? 1, 0.01, 1) * 100}%`,
    '--vtt-overlay-rotation': `${clamp(placement.rotation ?? 0, -360, 360)}deg`,
  };
  const images = (
    <>
      <img
        className="vtt-board__overlay"
        src={overlay.url}
        alt=""
        draggable="false"
        onLoad={() => setLoaded(true)}
      />
      {motionPreset !== 'none' && (
        <img
          className="vtt-board__overlay-motion"
          src={overlay.url}
          alt=""
          draggable="false"
        />
      )}
    </>
  );

  if (editable) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        title={motionLabel || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        aria-label={`${overlay.label || humanize(overlay.name)}. ${placement.locked === false ? 'Destravado para ajuste.' : 'Posição travada.'}`}
      >
        {images}
      </button>
    );
  }
  return (
    <span
      className={className}
      style={style}
      title={motionLabel || undefined}
      aria-hidden="true"
    >
      {images}
    </span>
  );
}

function VttSceneLayerImage({
  layer,
  placement,
  placementIndex,
  selected = false,
  editable = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
}) {
  const [loaded, setLoaded] = useState(false);
  const style = {
    '--vtt-layer-x': `${clamp(placement.x, 0, 1) * 100}%`,
    '--vtt-layer-y': `${clamp(placement.y, 0, 1) * 100}%`,
    '--vtt-layer-width': `${clamp(placement.width, 0.01, 1) * 100}%`,
    '--vtt-layer-height': `${clamp(placement.height, 0.01, 1) * 100}%`,
    '--vtt-layer-rotation': `${clamp(placement.rotation ?? 0, -360, 360)}deg`,
  };
  const className = `vtt-board__scene-layer ${loaded ? 'is-loaded' : ''} ${selected ? 'is-selected' : ''} ${placement.locked !== false ? 'is-locked' : 'is-unlocked'}`;

  if (!editable) {
    return (
      <img
        className={className}
        src={layer.assetUrl}
        alt=""
        aria-hidden="true"
        draggable="false"
        style={style}
        data-placement={placementIndex}
        onLoad={() => setLoaded(true)}
      />
    );
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      data-placement={placementIndex}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      aria-label={`${layer.label || humanize(layer.key)}. ${placement.locked === false ? 'Destravado para ajuste.' : 'Posição travada.'}`}
      aria-pressed={selected}
    >
      <img src={layer.assetUrl} alt="" draggable="false" onLoad={() => setLoaded(true)} />
      <small>{placement.locked === false ? 'Destravado' : 'Travado'}</small>
    </button>
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
  const sectionClassName = `vtt-board__director-section ${open ? 'is-open' : ''} ${id === 'vtt-board-tokens-section' ? 'vtt-board__piece-drawer' : ''}`;
  return (
    <section className={sectionClassName}>
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

function DirectorDrawer({
  title,
  summary,
  badge,
  defaultOpen = false,
  reveal = false,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (reveal) setOpen(true);
  }, [reveal]);

  return (
    <details
      className="vtt-board__director-drawer"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>{title}</strong>
          {summary && <small>{summary}</small>}
        </span>
        {badge && <em>{badge}</em>}
        <i aria-hidden="true">⌄</i>
      </summary>
      <div className="vtt-board__director-drawer-body">
        {children}
      </div>
    </details>
  );
}

function MasterAgentMonitor({ agents, onOpenSheet, onUpdateSheet }) {
  const [pendingField, setPendingField] = useState('');
  const [error, setError] = useState('');
  const canEdit = typeof onUpdateSheet === 'function';

  const updateField = async (agent, field, value) => {
    if (!canEdit || !agent?.uid) return;
    const operationKey = `${agent.uid}:${field}`;
    setPendingField(operationKey);
    setError('');
    try {
      await onUpdateSheet(agent.uid, field, value);
    } catch (updateError) {
      setError(updateError?.message || 'Não foi possível atualizar a ficha do agente.');
    } finally {
      setPendingField((current) => (current === operationKey ? '' : current));
    }
  };

  if (agents.length === 0) {
    return <p className="vtt-board__drawer-empty">Nenhuma ficha vinculada à Mesa.</p>;
  }

  return (
    <section className="vtt-board__agent-monitor" aria-label="Monitor dos agentes">
      {error && <p className="vtt-board__agent-monitor-error" role="alert">{error}</p>}
      {agents.map((agent) => {
        const sheet = agent.sheet;
        const displayName = sheet?.characterName || agent.name;
        const resources = [
          ['pv', 'PV', 'recursos.pv_atual'],
          ['pe', 'PE', 'recursos.pe_atual'],
          ['san', 'SAN', 'recursos.san_atual'],
        ];
        const pursuit = sheet?.pursuit || {
          successes: 0,
          failures: 0,
          successTarget: 3,
          failureTarget: 3,
        };

        const conditions = Array.isArray(sheet?.conditions) ? sheet.conditions : [];
        return (
          <article
            key={agent.uid}
            className={`vtt-board__agent-monitor-card ${conditions.length > 0 ? 'has-conditions' : ''}`}
          >
            <header>
              <span className="vtt-board__agent-monitor-avatar" aria-hidden="true">
                {sheet?.photo
                  ? <img src={sheet.photo} alt="" loading="lazy" decoding="async" />
                  : tokenInitials(displayName)}
              </span>
              <span className="vtt-board__agent-monitor-identity">
                <em><i aria-hidden="true" /> Agente vinculado</em>
                <strong>{displayName}</strong>
                <small>{sheet?.className || 'Classe não informada'}{sheet?.nex ? ` · NEX ${sheet.nex}` : ''}</small>
              </span>
              <button type="button" onClick={() => onOpenSheet?.(agent.uid)}>Abrir ficha</button>
            </header>

            <div className="vtt-board__agent-resource-grid">
              {resources.map(([key, label, field]) => {
                const resource = sheet?.resources?.[key] || { current: 0, maximum: 0 };
                const operationKey = `${agent.uid}:${field}`;
                return (
                  <div
                    key={key}
                    className={`is-${key}`}
                    style={{ '--vtt-agent-resource': `${resource.maximum > 0 ? clamp((resource.current / resource.maximum) * 100, 0, 100) : 0}%` }}
                  >
                    <header>
                      <span>{label}</span>
                      <output aria-label={`${label} de ${displayName}`}>{resource.current}<small>/{resource.maximum}</small></output>
                    </header>
                    <span className="vtt-board__agent-resource-meter" aria-hidden="true"><i /></span>
                    <div className="vtt-board__agent-resource-actions">
                      <button
                        type="button"
                        onClick={() => updateField(agent, field, resource.current - 1)}
                        disabled={!canEdit || pendingField === operationKey || resource.current <= 0}
                        aria-label={`Reduzir ${label} de ${displayName}`}
                      >−</button>
                      <span>Ajustar</span>
                      <button
                        type="button"
                        onClick={() => updateField(agent, field, resource.current + 1)}
                        disabled={!canEdit || pendingField === operationKey || resource.current >= resource.maximum}
                        aria-label={`Aumentar ${label} de ${displayName}`}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <section className="vtt-board__agent-conditions" aria-label={`Condições ativas de ${displayName}`}>
              <span>Condições ativas</span>
              <div>
                {conditions.length > 0 ? (
                  conditions.map((condition) => (
                    <span key={condition.id} className="vtt-board__agent-condition-chip">
                      {condition.label}
                    </span>
                  ))
                ) : (
                  <small>Sem condições ativas</small>
                )}
              </div>
            </section>

            <span className="vtt-board__agent-pursuit-title">Rastro da operação</span>
            <div className="vtt-board__agent-pursuit">
              {[
                ['successes', 'Sucessos', 'perseguicao.sucessos', pursuit.successTarget],
                ['failures', 'Falhas', 'perseguicao.falhas', pursuit.failureTarget],
              ].map(([key, label, field, target]) => {
                const value = pursuit[key];
                const operationKey = `${agent.uid}:${field}`;
                return (
                  <div key={key} className={`is-${key}`}>
                    <span>{label}</span>
                    <div>
                      <button
                        type="button"
                        onClick={() => updateField(agent, field, value - 1)}
                        disabled={!canEdit || pendingField === operationKey || value <= 0}
                        aria-label={`Remover ${label.toLowerCase()} de ${displayName}`}
                      >−</button>
                      <output aria-label={`${label} de ${displayName}`}>{value}/{target}</output>
                      <button
                        type="button"
                        onClick={() => updateField(agent, field, value + 1)}
                        disabled={!canEdit || pendingField === operationKey || value >= target}
                        aria-label={`Adicionar ${label.toLowerCase()} a ${displayName}`}
                      >+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default function VttBoard({
  state = {},
  role = 'player',
  connected = false,
  members = [],
  characterSheetUids = [],
  characterSheets = [],
  onOpenCharacterSheet,
  onUpdateCharacterSheet,
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
  const layerDragRef = useRef(null);
  const overlayDragRef = useRef(null);
  const fogVertexDragRef = useRef(null);
  const fogMaskId = useId().replace(/:/g, '');
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [draftPositions, setDraftPositions] = useState({});
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [newTokenControllerUid, setNewTokenControllerUid] = useState('');
  const [selectedPropId, setSelectedPropId] = useState('');
  const [selectedPropAssetId, setSelectedPropAssetId] = useState('');
  const [selectedPropStateAssetId, setSelectedPropStateAssetId] = useState('');
  const [draftPropPositions, setDraftPropPositions] = useState({});
  const [selectedLayerPlacementKey, setSelectedLayerPlacementKey] = useState('');
  const [draftLayerPositions, setDraftLayerPositions] = useState({});
  const [selectedOverlayAssetId, setSelectedOverlayAssetId] = useState('');
  const [draftOverlayPositions, setDraftOverlayPositions] = useState({});
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
  const [fogDraftPoints, setFogDraftPoints] = useState([]);
  const [fogRegionLabel, setFogRegionLabel] = useState('');
  const [editingFogRegionId, setEditingFogRegionId] = useState('');
  const [selectedFogRegionIds, setSelectedFogRegionIds] = useState([]);
  const [fogPlayerPreview, setFogPlayerPreview] = useState(false);
  const [fogControlMode, setFogControlMode] = useState(false);

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
  const fogRegions = useMemo(() => normalizeFogRegions(fog), [fog]);
  const fogRegionById = useMemo(
    () => new Map(fogRegions.map((region) => [region.regionId, region])),
    [fogRegions],
  );
  const revealedFogRegionCount = fogRegions.filter((region) => region.revealed).length;
  const scenes = useMemo(
    () => (Array.isArray(catalog?.scenes) ? catalog.scenes : []),
    [catalog?.scenes],
  );
  const tokenAssets = useMemo(
    () => (Array.isArray(catalog?.tokenAssets) ? catalog.tokenAssets : []),
    [catalog?.tokenAssets],
  );
  const selectedTokenAsset = useMemo(
    () => tokenAssets.find((asset) => asset.assetId === selectedAssetId) || null,
    [selectedAssetId, tokenAssets],
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
  const controllerByUid = useMemo(
    () => new Map(controllerMembers.map((member) => [member.uid, member])),
    [controllerMembers],
  );
  const characterSheetUidSet = useMemo(
    () => normalizeCharacterSheetUids(characterSheetUids),
    [characterSheetUids],
  );
  const characterSheetByUid = useMemo(
    () => new Map((Array.isArray(characterSheets) ? characterSheets : [])
      .filter((sheet) => sheet?.uid)
      .map((sheet) => [String(sheet.uid).trim(), sheet])),
    [characterSheets],
  );
  const characterSheetMembers = useMemo(
    () => controllerMembers
      .filter((member) => characterSheetUidSet.has(member.uid))
      .map((member) => ({
        ...member,
        sheet: characterSheetByUid.get(member.uid) || null,
        tokenCount: tokens.filter((token) => token.controllerUid === member.uid).length,
      })),
    [characterSheetByUid, characterSheetUidSet, controllerMembers, tokens],
  );
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
  const selectedLayerPlacement = useMemo(() => {
    for (const layer of sceneLayers) {
      const placements = Array.isArray(layer.placements) ? layer.placements : [];
      for (let placementIndex = 0; placementIndex < placements.length; placementIndex += 1) {
        const key = `${layer.id}:${placementIndex}`;
        if (key === selectedLayerPlacementKey) {
          return { key, layer, placementIndex, placement: placements[placementIndex] };
        }
      }
    }
    return null;
  }, [sceneLayers, selectedLayerPlacementKey]);
  const selectedOverlay = useMemo(
    () => overlays.find((overlay) => overlay.assetId === selectedOverlayAssetId) || null,
    [overlays, selectedOverlayAssetId],
  );
  const selectedTokenController = selectedToken?.controllerUid
    ? controllerByUid.get(selectedToken.controllerUid) || null
    : null;
  const isMaster = role === 'master';
  const canBrowseCharacterSheets = isMaster && typeof onOpenCharacterSheet === 'function';
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
    setSelectedLayerPlacementKey('');
    setDraftLayerPositions({});
    setSelectedOverlayAssetId('');
    setDraftOverlayPositions({});
    setIsPanning(false);
    setGuideOpen(false);
    setGuideZoom(1);
    setFogEditMode(false);
    setFogDraftPoints([]);
    setFogRegionLabel('');
    setEditingFogRegionId('');
    setSelectedFogRegionIds([]);
    setFogPlayerPreview(false);
    setFogControlMode(false);
  }, [scene?.id]);

  useEffect(() => {
    if (!fog?.enabled) {
      setFogEditMode(false);
      setFogDraftPoints([]);
      setEditingFogRegionId('');
      setFogControlMode(false);
      setFogPlayerPreview(false);
    }
  }, [fog?.enabled]);

  useEffect(() => {
    setSelectedFogRegionIds((current) => current.filter((id) => fogRegionById.has(id)));
  }, [fogRegionById]);

  useEffect(() => {
    setMapLoadState(scene?.map?.url ? 'loading' : 'idle');
  }, [scene?.map?.url]);

  useEffect(() => {
    setDraftPositions({});
    setDraftPropPositions({});
    setDraftLayerPositions({});
    setDraftOverlayPositions({});
  }, [revision]);

  useEffect(() => {
    if (selectedOverlayAssetId && !selectedOverlay) setSelectedOverlayAssetId('');
  }, [selectedOverlay, selectedOverlayAssetId]);

  useEffect(() => {
    if (selectedLayerPlacementKey && !selectedLayerPlacement) setSelectedLayerPlacementKey('');
  }, [selectedLayerPlacement, selectedLayerPlacementKey]);

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
    if (!selectedLayerPlacementKey) return;
    setDirectorOpen(true);
    openDirectorSection('props');
  }, [openDirectorSection, selectedLayerPlacementKey]);

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
    if (!scene || fogEditMode || fogControlMode || event.button !== 0) return;
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

  const handleFogEditorClick = (event) => {
    if (!fogEditMode || !connected || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointerToMap(event);
    if (!point || fogDraftPoints.length >= MAX_FOG_REGION_POINTS) return;
    setFogDraftPoints((current) => [...current, point]);
  };

  const saveFogRegion = () => {
    if (fogDraftPoints.length < 3) return false;
    const label = fogRegionLabel.trim() || `Área ${fogRegions.length + 1}`;
    const sent = emitCommand(
      editingFogRegionId ? 'fog.region.update' : 'fog.region.create',
      {
        regionId: editingFogRegionId || createFogRegionId(),
        label,
        points: fogDraftPoints,
      },
    );
    if (sent) {
      setFogDraftPoints([]);
      setFogRegionLabel('');
      setEditingFogRegionId('');
    }
    return sent;
  };

  const editSelectedFogRegion = () => {
    if (selectedFogRegionIds.length !== 1) return false;
    const region = fogRegionById.get(selectedFogRegionIds[0]);
    if (!region) return false;
    setEditingFogRegionId(region.regionId);
    setFogRegionLabel(region.label);
    setFogDraftPoints(region.points.map((point) => ({ ...point })));
    setFogEditMode(true);
    setFogControlMode(false);
    setFogPlayerPreview(false);
    return true;
  };

  const cancelFogRegionDraft = () => {
    setFogDraftPoints([]);
    setFogRegionLabel('');
    setEditingFogRegionId('');
  };

  const handleFogVertexPointerDown = (event, pointIndex) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    fogVertexDragRef.current = { pointerId: event.pointerId, pointIndex };
  };

  const handleFogVertexPointerMove = (event) => {
    const drag = fogVertexDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const point = pointerToMap(event);
    if (!point) return;
    setFogDraftPoints((current) => current.map((item, index) => (
      index === drag.pointIndex ? point : item
    )));
  };

  const finishFogVertexDrag = (event) => {
    const drag = fogVertexDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    fogVertexDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toggleFogRegionSelection = (regionId, additive = false) => {
    setSelectedFogRegionIds((current) => {
      const present = current.includes(regionId);
      if (!additive) return present && current.length === 1 ? [] : [regionId];
      return present ? current.filter((id) => id !== regionId) : [...current, regionId];
    });
  };

  const setSelectedFogRegionsRevealed = (revealed) => {
    if (selectedFogRegionIds.length === 0) return false;
    return emitCommand('fog.region.set_revealed', {
      regionIds: selectedFogRegionIds,
      revealed,
    });
  };

  const removeSelectedFogRegions = () => {
    if (selectedFogRegionIds.length !== 1) return false;
    const [regionId] = selectedFogRegionIds;
    const region = fogRegionById.get(regionId);
    const removed = confirmMasterCommand(
      `Remover definitivamente a região “${region?.label || regionId}”?`,
      'fog.region.remove',
      { regionId },
    );
    if (removed) setSelectedFogRegionIds([]);
    return removed;
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
    setSelectedLayerPlacementKey('');
    if (!connected || !isMaster || prop.locked !== false) return;
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
    if (!direction || !connected || !isMaster || prop.locked !== false) return;
    event.preventDefault();
    const shown = draftPropPositions[prop.id] || prop;
    const step = event.shiftKey ? 0.01 : 0.002;
    const position = {
      x: clamp(shown.x + direction[0] * step, 0, 1),
      y: clamp(shown.y + direction[1] * step, 0, 1),
    };
    setDraftPropPositions((current) => ({ ...current, [prop.id]: position }));
    emitCommand('prop.update', { propId: prop.id, ...position });
  };

  const handleLayerPointerDown = (event, layer, placementIndex, placement) => {
    event.stopPropagation();
    const key = `${layer.id}:${placementIndex}`;
    setSelectedLayerPlacementKey(key);
    setSelectedPropId('');
    setSelectedTokenId('');
    if (!connected || !isMaster || placement.locked !== false) return;
    event.preventDefault();
    const pointer = pointerToMap(event);
    const shown = draftLayerPositions[key] || placement;
    event.currentTarget.setPointerCapture(event.pointerId);
    layerDragRef.current = {
      pointerId: event.pointerId,
      key,
      layerId: layer.id,
      placementIndex,
      offsetX: pointer ? pointer.x - shown.x : 0,
      offsetY: pointer ? pointer.y - shown.y : 0,
    };
  };

  const handleLayerPointerMove = (event, key) => {
    const drag = layerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.key !== key) return;
    const point = pointerToMap(event);
    if (!point) return;
    setDraftLayerPositions((current) => ({
      ...current,
      [key]: {
        x: clamp(point.x - drag.offsetX, 0, 1),
        y: clamp(point.y - drag.offsetY, 0, 1),
      },
    }));
  };

  const finishLayerDrag = (event, key, cancelled = false) => {
    const drag = layerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.key !== key) return;
    layerDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancelled) {
      setDraftLayerPositions((current) => {
        const next = { ...current };
        delete next[key];
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
    setDraftLayerPositions((current) => ({ ...current, [key]: position }));
    emitCommand('layer.update', {
      layerId: drag.layerId,
      placementIndex: drag.placementIndex,
      ...position,
    });
  };

  const handleLayerKeyDown = (event, layer, placementIndex, placement) => {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction || !connected || !isMaster || placement.locked !== false) return;
    event.preventDefault();
    const key = `${layer.id}:${placementIndex}`;
    const shown = draftLayerPositions[key] || placement;
    const step = event.shiftKey ? 0.01 : 0.002;
    const position = {
      x: clamp(shown.x + direction[0] * step, 0, 1),
      y: clamp(shown.y + direction[1] * step, 0, 1),
    };
    setDraftLayerPositions((current) => ({ ...current, [key]: position }));
    emitCommand('layer.update', { layerId: layer.id, placementIndex, ...position });
  };

  const handleUpdateSelectedLayer = (patch) => {
    if (!selectedLayerPlacement) return;
    emitCommand('layer.update', {
      layerId: selectedLayerPlacement.layer.id,
      placementIndex: selectedLayerPlacement.placementIndex,
      ...patch,
    });
  };

  const handleOverlayPointerDown = (event, overlay) => {
    event.stopPropagation();
    setSelectedOverlayAssetId(overlay.assetId);
    setSelectedLayerPlacementKey('');
    setSelectedPropId('');
    setSelectedTokenId('');
    if (!connected || !isMaster || overlay.placement?.locked !== false) return;
    event.preventDefault();
    const pointer = pointerToMap(event);
    const shown = draftOverlayPositions[overlay.assetId] || overlay.placement || { x: 0.5, y: 0.5 };
    event.currentTarget.setPointerCapture(event.pointerId);
    overlayDragRef.current = {
      pointerId: event.pointerId,
      assetId: overlay.assetId,
      offsetX: pointer ? pointer.x - shown.x : 0,
      offsetY: pointer ? pointer.y - shown.y : 0,
    };
  };

  const handleOverlayPointerMove = (event, assetId) => {
    const drag = overlayDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.assetId !== assetId) return;
    const point = pointerToMap(event);
    if (!point) return;
    setDraftOverlayPositions((current) => ({
      ...current,
      [assetId]: {
        x: clamp(point.x - drag.offsetX, 0, 1),
        y: clamp(point.y - drag.offsetY, 0, 1),
      },
    }));
  };

  const finishOverlayDrag = (event, assetId, cancelled = false) => {
    const drag = overlayDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.assetId !== assetId) return;
    overlayDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancelled) {
      setDraftOverlayPositions((current) => {
        const next = { ...current };
        delete next[assetId];
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
    setDraftOverlayPositions((current) => ({ ...current, [assetId]: position }));
    emitCommand('overlay.update', { assetId, ...position });
  };

  const handleOverlayKeyDown = (event, overlay) => {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction || !connected || !isMaster || overlay.placement?.locked !== false) return;
    event.preventDefault();
    const shown = draftOverlayPositions[overlay.assetId] || overlay.placement;
    const step = event.shiftKey ? 0.01 : 0.002;
    const position = {
      x: clamp(shown.x + direction[0] * step, 0, 1),
      y: clamp(shown.y + direction[1] * step, 0, 1),
    };
    setDraftOverlayPositions((current) => ({ ...current, [overlay.assetId]: position }));
    emitCommand('overlay.update', { assetId: overlay.assetId, ...position });
  };

  const handleUpdateSelectedOverlay = (patch) => {
    if (!selectedOverlay) return;
    emitCommand('overlay.update', { assetId: selectedOverlay.assetId, ...patch });
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

  const handleOpenCharacterSheet = (uid) => {
    const normalizedUid = String(uid || '').trim();
    if (
      !isMaster
      || !normalizedUid
      || !canOpenTokenCharacterSheet({
        role,
        controllerUid: normalizedUid,
        characterSheetUids: characterSheetUidSet,
      })
      || typeof onOpenCharacterSheet !== 'function'
    ) return;
    onOpenCharacterSheet(normalizedUid);
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
      locked: false,
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
              className="vtt-board__piece-toggle"
              onClick={() => {
                setDirectorOpen(true);
                openDirectorSection('tokens');
              }}
              aria-expanded={directorSections.tokens}
            >
              Tokens <span>{tokens.length}</span>
            </button>
          )}
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
                      placement={{
                        ...placement,
                        ...(draftLayerPositions[`${layer.id}:${placementIndex}`] || {}),
                      }}
                      placementIndex={placementIndex}
                      selected={selectedLayerPlacementKey === `${layer.id}:${placementIndex}`}
                      editable={isMaster}
                      onPointerDown={(event) => handleLayerPointerDown(event, layer, placementIndex, placement)}
                      onPointerMove={(event) => handleLayerPointerMove(event, `${layer.id}:${placementIndex}`)}
                      onPointerUp={(event) => finishLayerDrag(event, `${layer.id}:${placementIndex}`)}
                      onPointerCancel={(event) => finishLayerDrag(event, `${layer.id}:${placementIndex}`, true)}
                      onKeyDown={(event) => handleLayerKeyDown(event, layer, placementIndex, placement)}
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
                    className={`vtt-board__prop ${selected ? 'is-selected' : ''} ${prop.visible === false ? 'is-hidden' : ''} ${prop.locked !== false ? 'is-locked' : 'is-unlocked'}`}
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
                  overlay={{
                    ...overlay,
                    placement: {
                      ...(overlay.placement || {}),
                      ...(draftOverlayPositions[overlay.assetId] || {}),
                    },
                  }}
                  editable={isMaster}
                  onPointerDown={(event) => handleOverlayPointerDown(event, overlay)}
                  onPointerMove={(event) => handleOverlayPointerMove(event, overlay.assetId)}
                  onPointerUp={(event) => finishOverlayDrag(event, overlay.assetId)}
                  onPointerCancel={(event) => finishOverlayDrag(event, overlay.assetId, true)}
                  onKeyDown={(event) => handleOverlayKeyDown(event, overlay)}
                />
              ))}

              {fog?.enabled && (
                <svg
                  className={`vtt-board__fog-mask ${fogEditMode ? 'is-editing' : ''} ${fogControlMode ? 'is-controlling' : ''} ${fogPlayerPreview ? 'is-player-preview' : ''}`}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  onClick={handleFogEditorClick}
                  role={fogEditMode || fogControlMode ? 'application' : undefined}
                  aria-label={fogEditMode
                    ? 'Editor de salas e setores da névoa de guerra'
                    : fogControlMode ? 'Controle de revelação por salas e setores' : undefined}
                  aria-hidden={fogEditMode || fogControlMode ? undefined : 'true'}
                >
                  <defs>
                    <mask id={fogMaskId}>
                      <rect width="100" height="100" fill="white" />
                      {fog?.revealAll ? (
                        <rect width="100" height="100" fill="black" />
                      ) : fogRegions.filter((region) => region.revealed).map((region) => (
                        <polygon
                          key={`hole:${region.regionId}`}
                          points={fogPolygonPoints(region.points)}
                          fill="black"
                        />
                      ))}
                    </mask>
                  </defs>
                  {(!isMaster || fogPlayerPreview || fogEditMode || fogControlMode) && (
                    <rect
                      className="vtt-board__fog-cover"
                      width="100"
                      height="100"
                      mask={`url(#${fogMaskId})`}
                    />
                  )}
                  {isMaster && (fogEditMode || fogControlMode) && fogRegions.map((region) => (
                    <polygon
                      key={region.regionId}
                      className={`vtt-board__fog-region ${region.revealed ? 'is-revealed' : 'is-hidden'} ${selectedFogRegionIds.includes(region.regionId) ? 'is-selected' : ''}`}
                      points={fogPolygonPoints(region.points)}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (fogControlMode) {
                          emitCommand('fog.region.set_revealed', {
                            regionIds: [region.regionId],
                            revealed: !region.revealed,
                          });
                          return;
                        }
                        toggleFogRegionSelection(region.regionId, event.shiftKey);
                      }}
                    >
                      <title>{`${region.label} · ${region.revealed ? 'revelada' : 'oculta'}`}</title>
                    </polygon>
                  ))}
                  {isMaster && fogEditMode && fogDraftPoints.length > 0 && (
                    <>
                      <polyline
                        className="vtt-board__fog-draft"
                        points={fogPolygonPoints(fogDraftPoints)}
                      />
                      {fogDraftPoints.map((point, pointIndex) => (
                        <circle
                          key={`${point.x}:${point.y}:${pointIndex}`}
                          className="vtt-board__fog-vertex"
                          cx={point.x * 100}
                          cy={point.y * 100}
                          r="0.9"
                          onPointerDown={(event) => handleFogVertexPointerDown(event, pointIndex)}
                          onPointerMove={handleFogVertexPointerMove}
                          onPointerUp={finishFogVertexDrag}
                          onPointerCancel={finishFogVertexDrag}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                        />
                      ))}
                    </>
                  )}
                </svg>
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
                <button type="button" className="is-piece-trigger" onClick={() => openDirectorSection('tokens')}>
                  <span>Tokens</span>
                  <strong>{tokens.length}</strong>
                  <small>Abrir gaveta</small>
                </button>
                <button type="button" onClick={() => openDirectorSection('props')}>
                  <span>Objetos</span>
                  <strong>{props.length}</strong>
                </button>
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

            <DirectorDrawer
              title="Mapa e guia"
              summary="Cena ativa e referência privada"
              badge={scene ? 'Mapa' : 'Vazio'}
              defaultOpen
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
            <div className="vtt-board__drawer-actions">
              <button type="button" onClick={resetCamera} disabled={!scene}>Enquadrar mapa</button>
            </div>
            </DirectorDrawer>

            <DirectorDrawer
              title="Efeitos visuais"
              summary="Ativar e posicionar overlays"
              badge={`${activeOverlayCount}/${overlays.length}`}
              reveal={Boolean(selectedOverlay)}
            >
            <fieldset className="vtt-board__effects" disabled={!connected || overlays.length === 0}>
              <legend>Efeitos e overlays</legend>
              {overlays.length === 0 && <p>Esta cena não possui overlays.</p>}
              {overlays.map((overlay) => (
                <div key={overlay.assetId} className="vtt-board__overlay-control-row">
                  <label>
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
                  {overlay.enabled && (
                    <button
                      type="button"
                      className={overlay.placement?.locked === false ? 'is-unlocked' : 'is-locked'}
                      onClick={() => {
                        setSelectedOverlayAssetId(overlay.assetId);
                        emitCommand('overlay.update', {
                          assetId: overlay.assetId,
                          locked: overlay.placement?.locked === false,
                        });
                      }}
                    >
                      {overlay.placement?.locked === false ? 'Travar' : 'Ajustar'}
                    </button>
                  )}
                </div>
              ))}
            </fieldset>
            {selectedOverlay && selectedOverlay.enabled && (
              <section className="vtt-board__asset-lock-panel">
                <div>
                  <span>Efeito selecionado</span>
                  <strong>{selectedOverlay.label || humanize(selectedOverlay.name)}</strong>
                </div>
                <div className="vtt-board__prop-transform" aria-label="Ajuste fino do efeito selecionado">
                  <button
                    type="button"
                    onClick={() => handleUpdateSelectedOverlay({
                      width: clamp(selectedOverlay.placement.width * 0.995, 0.01, 1),
                      height: clamp(selectedOverlay.placement.height * 0.995, 0.01, 1),
                    })}
                    disabled={selectedOverlay.placement?.locked !== false}
                    aria-label="Diminuir efeito"
                  >−</button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSelectedOverlay({
                      rotation: ((((selectedOverlay.placement.rotation - 1) + 180) % 360) + 360) % 360 - 180,
                    })}
                    disabled={selectedOverlay.placement?.locked !== false}
                    aria-label="Girar efeito à esquerda"
                  >↺</button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSelectedOverlay({
                      rotation: ((((selectedOverlay.placement.rotation + 1) + 180) % 360) + 360) % 360 - 180,
                    })}
                    disabled={selectedOverlay.placement?.locked !== false}
                    aria-label="Girar efeito à direita"
                  >↻</button>
                  <button
                    type="button"
                    onClick={() => handleUpdateSelectedOverlay({
                      width: clamp(selectedOverlay.placement.width * 1.005, 0.01, 1),
                      height: clamp(selectedOverlay.placement.height * 1.005, 0.01, 1),
                    })}
                    disabled={selectedOverlay.placement?.locked !== false}
                    aria-label="Aumentar efeito"
                  >+</button>
                </div>
                <small>
                  {selectedOverlay.placement?.locked === false
                    ? 'Arraste o efeito no mapa ou use as setas; depois trave.'
                    : 'Posição protegida contra alterações acidentais.'}
                </small>
              </section>
            )}
            </DirectorDrawer>

            <DirectorDrawer
              title="Elementos ancorados"
              summary="Corpos, emissores e composição"
              badge={`${sceneLayers.length}`}
              reveal={Boolean(selectedLayerPlacement)}
            >
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
            </DirectorDrawer>

            </DirectorSection>

            <DirectorSection
              id="vtt-board-fog-section"
              title="Névoa de guerra"
              summary={fog?.enabled ? 'Proteção ativa' : 'Mapa liberado'}
              badge={fog?.enabled ? `Rev. ${Number(fog.revision || 0)}` : 'Livre'}
              open={directorSections.fog}
              onToggle={() => toggleDirectorSection('fog')}
            >

            <DirectorDrawer
              title="Proteção do mapa"
              summary="Ativar, pré-visualizar e controlar"
              badge={fog?.enabled ? 'Ativa' : 'Livre'}
              defaultOpen
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
            </fieldset>
            </DirectorDrawer>

            {fog?.enabled && (
              <DirectorDrawer
                title="Salas e setores"
                summary="Revelar, ocultar e desenhar regiões"
                badge={`${revealedFogRegionCount}/${fogRegions.length}`}
                defaultOpen
              >
                <fieldset className="vtt-board__fog-controls" disabled={!connected || !scene}>
                  <legend>Controle por regiões</legend>
                  <button
                    type="button"
                    className={fogControlMode ? 'is-active' : ''}
                    disabled={fogRegions.length === 0}
                    onClick={() => {
                      setFogControlMode((current) => !current);
                      setFogEditMode(false);
                      setFogPlayerPreview(false);
                    }}
                    aria-pressed={fogControlMode}
                  >
                    {fogControlMode ? 'Sair do controle no mapa' : 'Controlar salas no mapa'}
                  </button>
                  <button
                    type="button"
                    className={fogEditMode ? 'is-active' : ''}
                    onClick={() => {
                      setFogEditMode((current) => !current);
                      setFogControlMode(false);
                      setFogPlayerPreview(false);
                    }}
                    aria-pressed={fogEditMode}
                  >
                    {fogEditMode ? 'Concluir edição' : 'Editar regiões no mapa'}
                  </button>
                  <button
                    type="button"
                    className={fogPlayerPreview ? 'is-active' : ''}
                    onClick={() => {
                      setFogPlayerPreview((current) => !current);
                      setFogEditMode(false);
                      setFogControlMode(false);
                    }}
                    aria-pressed={fogPlayerPreview}
                  >
                    {fogPlayerPreview ? 'Sair da prévia' : 'Prévia do jogador'}
                  </button>

                  {fogEditMode && (
                    <div className="vtt-board__fog-region-editor">
                      <label className="vtt-board__field">
                        <span>Nome da região</span>
                        <input
                          type="text"
                          maxLength="80"
                          value={fogRegionLabel}
                          placeholder={`Área ${fogRegions.length + 1}`}
                          onChange={(event) => setFogRegionLabel(event.target.value)}
                        />
                      </label>
                      <p>
                        Clique nos cantos da sala ou setor. As paredes que ficarem fora do polígono
                        continuam cobertas. Arraste os pontos para ajustar.
                      </p>
                      <div className="vtt-board__fog-actions">
                        <button
                          type="button"
                          disabled={fogDraftPoints.length < 3}
                          onClick={saveFogRegion}
                        >
                          {editingFogRegionId ? 'Salvar alterações' : 'Criar região'}
                        </button>
                        <button
                          type="button"
                          disabled={fogDraftPoints.length === 0}
                          onClick={() => setFogDraftPoints((current) => current.slice(0, -1))}
                        >Desfazer ponto</button>
                        <button
                          type="button"
                          disabled={fogDraftPoints.length === 0}
                          onClick={cancelFogRegionDraft}
                        >Cancelar desenho</button>
                      </div>
                      <small>{fogDraftPoints.length} de {MAX_FOG_REGION_POINTS} pontos</small>
                    </div>
                  )}

                  <div className="vtt-board__fog-region-list" aria-label="Regiões da névoa">
                    {fogRegions.length === 0 && (
                      <p>Nenhuma região definida. Até criar uma área, o mapa permanece totalmente oculto.</p>
                    )}
                    {fogRegions.map((region) => (
                      <label
                        key={region.regionId}
                        className={`vtt-board__fog-region-item ${selectedFogRegionIds.includes(region.regionId) ? 'is-selected' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFogRegionIds.includes(region.regionId)}
                          onChange={(event) => toggleFogRegionSelection(region.regionId, event.nativeEvent?.shiftKey)}
                        />
                        <span>
                          <strong>{region.label}</strong>
                          <small>{region.revealed ? 'Revelada' : 'Oculta'} · {region.points.length} pontos</small>
                        </span>
                        <button
                          type="button"
                          onClick={() => emitCommand('fog.region.set_revealed', {
                            regionIds: [region.regionId],
                            revealed: !region.revealed,
                          })}
                        >{region.revealed ? 'Ocultar' : 'Revelar'}</button>
                      </label>
                    ))}
                  </div>

                  <div className="vtt-board__fog-modes" aria-label="Ações das regiões selecionadas">
                    <button
                      type="button"
                      disabled={selectedFogRegionIds.length === 0}
                      onClick={() => setSelectedFogRegionsRevealed(true)}
                    >Revelar selecionadas</button>
                    <button
                      type="button"
                      disabled={selectedFogRegionIds.length === 0}
                      onClick={() => setSelectedFogRegionsRevealed(false)}
                    >Ocultar selecionadas</button>
                    <button
                      type="button"
                      disabled={selectedFogRegionIds.length !== 1}
                      onClick={editSelectedFogRegion}
                    >Editar formato</button>
                    <button
                      type="button"
                      disabled={selectedFogRegionIds.length !== 1}
                      onClick={removeSelectedFogRegions}
                    >Remover região</button>
                  </div>
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
                    {revealedFogRegionCount} de {fogRegions.length} regiões reveladas · revisão {Number(fog.revision || 0)}
                  </small>
                </fieldset>
              </DirectorDrawer>
            )}

            </DirectorSection>

            <DirectorSection
              id="vtt-board-tokens-section"
              title="Gaveta de tokens"
              summary={selectedToken?.label || 'Escolha, atribua e posicione sem cobrir o mapa'}
              badge={`${tokens.length} ${tokens.length === 1 ? 'peça' : 'peças'}`}
              open={directorSections.tokens}
              onToggle={() => toggleDirectorSection('tokens')}
            >

            <DirectorDrawer
              title="1 · Escolha a peça"
              summary="Retratos disponíveis na campanha"
              badge={`${tokenAssets.length}`}
              defaultOpen={tokens.length === 0}
            >
            <div className="vtt-board__spawn">
              <div
                className="vtt-board__token-gallery"
                role="listbox"
                aria-label="Tokens disponíveis para adicionar"
                aria-disabled={!connected || tokenAssets.length === 0}
              >
                {tokenAssets.length === 0 && (
                  <p>Nenhum token disponível nesta campanha.</p>
                )}
                {tokenAssets.map((asset) => {
                  const label = asset.label || humanize(asset.assetId.split('/').pop());
                  const selected = selectedAssetId === asset.assetId;
                  return (
                    <button
                      key={asset.assetId}
                      type="button"
                      role="option"
                      className={selected ? 'is-selected' : ''}
                      aria-selected={selected}
                      onClick={() => setSelectedAssetId(asset.assetId)}
                      disabled={!connected}
                    >
                      <span className="vtt-board__token-gallery-image">
                        {asset.assetUrl
                          ? <img src={asset.assetUrl} alt="" loading="lazy" decoding="async" />
                          : <span aria-hidden="true">{tokenInitials(label)}</span>}
                      </span>
                      <span className="vtt-board__token-gallery-copy">
                        <strong>{label}</strong>
                        <small>{selected ? 'Selecionado' : 'Selecionar'}</small>
                      </span>
                    </button>
                  );
                })}
              </div>
              <section className="vtt-board__token-launchpad" aria-label="Preparar novo token">
                <span className="vtt-board__token-launchpad-preview" aria-hidden="true">
                  {selectedTokenAsset?.assetUrl
                    ? <img src={selectedTokenAsset.assetUrl} alt="" loading="lazy" decoding="async" />
                    : <span>{selectedTokenAsset ? tokenInitials(selectedTokenAsset.label) : '◇'}</span>}
                </span>
                <div className="vtt-board__token-launchpad-copy">
                  <span>Token preparado</span>
                  <strong>{selectedTokenAsset?.label || 'Selecione um retrato'}</strong>
                  <small>Ele será criado no centro do mapa e poderá ser arrastado em seguida.</small>
                </div>
                <label className="vtt-board__field" htmlFor="vtt-board-new-token-controller">
                  <span>Quem controla</span>
                  <select
                    id="vtt-board-new-token-controller"
                    value={newTokenControllerUid}
                    onChange={(event) => setNewTokenControllerUid(event.target.value)}
                    disabled={!connected || controllerMembers.length === 0}
                  >
                    <option value="">Somente Mestre</option>
                    {controllerMembers.map((member) => (
                      <option key={member.uid} value={member.uid}>{member.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="vtt-board__token-launchpad-action"
                  onClick={handleSpawn}
                  disabled={!connected || !selectedAssetId}
                >
                  Adicionar ao mapa
                </button>
              </section>
            </div>
            </DirectorDrawer>

            <DirectorDrawer
              title="2 · Peças em cena"
              summary="Selecione para ajustar controle ou abrir a ficha"
              badge={`${tokens.length}`}
              reveal={Boolean(selectedToken)}
            >
            <section className="vtt-board__token-roster" aria-label="Peças em cena">
              {tokens.length === 0 ? (
                <p>Adicione um token para vinculá-lo a um jogador e à ficha dele.</p>
              ) : (
                <div className="vtt-board__token-roster-list">
                  {tokens.map((token) => {
                    const controller = token.controllerUid
                      ? controllerByUid.get(token.controllerUid) || null
                      : null;
                    const hasSheet = canBrowseCharacterSheets && canOpenTokenCharacterSheet({
                      role,
                      controllerUid: controller?.uid,
                      characterSheetUids: characterSheetUidSet,
                    });
                    return (
                      <article
                        key={token.id}
                        className={selectedTokenId === token.id ? 'is-selected' : ''}
                      >
                        <button
                          type="button"
                          className="vtt-board__token-roster-select"
                          onClick={() => setSelectedTokenId(token.id)}
                        >
                          <span className="vtt-board__token-roster-image">
                            {token.assetUrl
                              ? <img src={token.assetUrl} alt="" loading="lazy" decoding="async" />
                              : <span aria-hidden="true">{tokenInitials(token.label)}</span>}
                          </span>
                          <span>
                            <strong>{token.label}</strong>
                            <small>{controller?.name || 'Somente Mestre'}</small>
                          </span>
                        </button>
                        {hasSheet ? (
                          <button
                            type="button"
                            className="vtt-board__token-sheet-button"
                            onClick={() => handleOpenCharacterSheet(controller.uid)}
                            aria-label={`Abrir ficha de ${controller.name}`}
                          >
                            Ficha
                          </button>
                        ) : (
                          <span className="vtt-board__token-sheet-status">
                            {controller ? 'Sem ficha' : 'Mestre'}
                          </span>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            </DirectorDrawer>

            <DirectorDrawer
              title="3 · Painel dos agentes"
              summary="PV, PE, SAN, condições e perseguição"
              badge={`${characterSheetMembers.length}`}
              defaultOpen={characterSheetMembers.length > 0}
            >
              <MasterAgentMonitor
                agents={canBrowseCharacterSheets ? characterSheetMembers : []}
                onOpenSheet={handleOpenCharacterSheet}
                onUpdateSheet={onUpdateCharacterSheet}
              />
            </DirectorDrawer>

            <DirectorDrawer
              title="Ajustar token selecionado"
              summary={selectedToken?.label || 'Escolha uma peça já posicionada'}
              badge={selectedToken ? 'Editar' : '—'}
              reveal={Boolean(selectedToken)}
            >
            <section className="vtt-board__token-controller" aria-label="Controle do token selecionado">
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
              {canBrowseCharacterSheets && selectedTokenController && canOpenTokenCharacterSheet({
                role,
                controllerUid: selectedTokenController.uid,
                characterSheetUids: characterSheetUidSet,
              }) && (
                <button
                  type="button"
                  className="vtt-board__token-open-sheet"
                  onClick={() => handleOpenCharacterSheet(selectedTokenController.uid)}
                >
                  Abrir ficha de {selectedTokenController.name}
                </button>
              )}
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
            </DirectorDrawer>

            </DirectorSection>

            <DirectorSection
              id="vtt-board-props-section"
              title="Objetos de cenário"
              summary={selectedLayerPlacement?.layer.label || selectedProp?.label || 'Posicionar e ajustar objetos'}
              badge={`${props.length} ${props.length === 1 ? 'objeto' : 'objetos'}`}
              open={directorSections.props}
              onToggle={() => toggleDirectorSection('props')}
            >

            <div className="vtt-board__prop-editor">
              <DirectorDrawer
                title="Catálogo de objetos"
                summary="Escolher e posicionar um novo asset"
                badge={`${propAssets.length} disponíveis`}
                defaultOpen={!selectedProp && !selectedLayerPlacement}
              >
                <label className="vtt-board__field" htmlFor="vtt-board-prop-asset">
                  <span>Objeto de cenário</span>
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
              </DirectorDrawer>

              <DirectorDrawer
                title="Objeto livre selecionado"
                summary={selectedProp?.label || 'Selecione um objeto no mapa'}
                badge={selectedProp ? (selectedProp.locked === false ? 'Editando' : 'Travado') : '—'}
                reveal={Boolean(selectedProp)}
              >
                {selectedProp ? (
                  <>
                    <label className="vtt-board__field" htmlFor="vtt-board-prop-state">
                      <span>Estado visual</span>
                      <select
                        id="vtt-board-prop-state"
                        value={selectedPropStateAssetId}
                        onChange={(event) => setSelectedPropStateAssetId(event.target.value)}
                        disabled={!selectedPropStates?.options.length}
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
                          label: selectedPropStates?.groupLabel || selectedProp.label,
                        })}
                        disabled={!selectedPropStateAssetId || selectedPropStateAssetId === selectedProp.assetId}
                      >
                        Aplicar estado
                      </button>
                    </div>
                    <div className="vtt-board__prop-transform" aria-label="Ajustes do objeto selecionado">
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedProp({
                          width: clamp(selectedProp.width * 0.85, MIN_PROP_SIZE, MAX_PROP_SIZE),
                          height: clamp(selectedProp.height * 0.85, MIN_PROP_SIZE, MAX_PROP_SIZE),
                        })}
                        disabled={selectedProp.locked !== false}
                        aria-label="Diminuir objeto"
                      >−</button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedProp({
                          rotation: ((((selectedProp.rotation - 15) + 180) % 360) + 360) % 360 - 180,
                        })}
                        disabled={selectedProp.locked !== false}
                        aria-label="Girar objeto à esquerda"
                      >↺</button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedProp({
                          rotation: ((((selectedProp.rotation + 15) + 180) % 360) + 360) % 360 - 180,
                        })}
                        disabled={selectedProp.locked !== false}
                        aria-label="Girar objeto à direita"
                      >↻</button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedProp({
                          width: clamp(selectedProp.width * 1.15, MIN_PROP_SIZE, MAX_PROP_SIZE),
                          height: clamp(selectedProp.height * 1.15, MIN_PROP_SIZE, MAX_PROP_SIZE),
                        })}
                        disabled={selectedProp.locked !== false}
                        aria-label="Aumentar objeto"
                      >+</button>
                    </div>
                    <button
                      type="button"
                      className={`vtt-board__asset-lock-button ${selectedProp.locked !== false ? 'is-locked' : 'is-unlocked'}`}
                      onClick={() => handleUpdateSelectedProp({ locked: selectedProp.locked === false })}
                      disabled={!connected}
                    >
                      {selectedProp.locked === false ? 'Travar posição do objeto' : 'Destravar objeto para ajustar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateSelectedProp({ visible: selectedProp.visible === false })}
                    >
                      {selectedProp.visible === false ? 'Mostrar aos jogadores' : 'Ocultar dos jogadores'}
                    </button>
                    <button
                      type="button"
                      className="vtt-board__remove"
                      onClick={handleRemoveSelectedProp}
                    >
                      Remover objeto selecionado
                    </button>
                  </>
                ) : (
                  <p className="vtt-board__drawer-empty">Clique em um objeto livre no mapa para editar.</p>
                )}
              </DirectorDrawer>

              <DirectorDrawer
                title="Elemento ancorado selecionado"
                summary={selectedLayerPlacement?.layer.label || 'Selecione um elemento integrado ao mapa'}
                badge={selectedLayerPlacement
                  ? (selectedLayerPlacement.placement.locked === false ? 'Editando' : 'Travado')
                  : '—'}
                reveal={Boolean(selectedLayerPlacement)}
              >
                {selectedLayerPlacement ? (
                  <>
                    <section className="vtt-board__asset-lock-panel" aria-live="polite">
                      <div>
                        <span>Elemento selecionado</span>
                        <strong>{selectedLayerPlacement.layer.label || humanize(selectedLayerPlacement.layer.key)}</strong>
                        <small>Posição {selectedLayerPlacement.placementIndex + 1}</small>
                      </div>
                      <button
                        type="button"
                        className={selectedLayerPlacement.placement.locked === false ? 'is-unlocked' : 'is-locked'}
                        onClick={() => handleUpdateSelectedLayer({
                          locked: selectedLayerPlacement.placement.locked === false,
                        })}
                        disabled={!connected}
                      >
                        {selectedLayerPlacement.placement.locked === false ? 'Travar posição' : 'Destravar para ajustar'}
                      </button>
                      <small>
                        {selectedLayerPlacement.placement.locked === false
                          ? 'Arraste no mapa ou use as setas. Shift faz um ajuste maior.'
                          : 'Travado contra movimentos acidentais.'}
                      </small>
                    </section>
                    <div className="vtt-board__prop-transform" aria-label="Ajuste fino do elemento ancorado">
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedLayer({
                          width: clamp(selectedLayerPlacement.placement.width * 0.98, 0.01, 1),
                          height: clamp(selectedLayerPlacement.placement.height * 0.98, 0.01, 1),
                        })}
                        disabled={selectedLayerPlacement.placement.locked !== false}
                        aria-label="Diminuir elemento ancorado"
                      >−</button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedLayer({
                          rotation: ((((selectedLayerPlacement.placement.rotation - 1) + 180) % 360) + 360) % 360 - 180,
                        })}
                        disabled={selectedLayerPlacement.placement.locked !== false}
                        aria-label="Girar elemento ancorado à esquerda"
                      >↺</button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedLayer({
                          rotation: ((((selectedLayerPlacement.placement.rotation + 1) + 180) % 360) + 360) % 360 - 180,
                        })}
                        disabled={selectedLayerPlacement.placement.locked !== false}
                        aria-label="Girar elemento ancorado à direita"
                      >↻</button>
                      <button
                        type="button"
                        onClick={() => handleUpdateSelectedLayer({
                          width: clamp(selectedLayerPlacement.placement.width * 1.02, 0.01, 1),
                          height: clamp(selectedLayerPlacement.placement.height * 1.02, 0.01, 1),
                        })}
                        disabled={selectedLayerPlacement.placement.locked !== false}
                        aria-label="Aumentar elemento ancorado"
                      >+</button>
                    </div>
                  </>
                ) : (
                  <p className="vtt-board__drawer-empty">Clique em um elemento ancorado no mapa para editar.</p>
                )}
              </DirectorDrawer>
            </div>

            </DirectorSection>

            <p className="vtt-board__director-note">
              A mesa sincroniza posições e efeitos. Rolagens continuam sendo feitas com dados físicos.
            </p>
          </aside>
        )}
      </div>

      {isMaster && directorOpen && (
        <section className="vtt-board__agent-deck" aria-label="Agentes em operação">
          <header>
            <div>
              <span>Leitura de campo</span>
              <strong>Agentes em operação</strong>
            </div>
            <span>{characterSheetMembers.length} ficha{characterSheetMembers.length === 1 ? '' : 's'} vinculada{characterSheetMembers.length === 1 ? '' : 's'}</span>
          </header>
          <MasterAgentMonitor
            agents={canBrowseCharacterSheets ? characterSheetMembers : []}
            onOpenSheet={handleOpenCharacterSheet}
            onUpdateSheet={onUpdateCharacterSheet}
          />
        </section>
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
