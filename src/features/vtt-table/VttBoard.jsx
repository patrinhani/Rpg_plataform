import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './vtt-board.css';

const MIN_ZOOM = 0.55;
const MAX_ZOOM = 3.2;
const DEFAULT_TOKEN_SIZE = 0.075;
const MIN_TOKEN_SIZE = 0.01;
const MAX_TOKEN_SIZE = 0.25;

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
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [draftPositions, setDraftPositions] = useState({});
  const [selectedTokenId, setSelectedTokenId] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [showGrid, setShowGrid] = useState(true);
  const [isPanning, setIsPanning] = useState(false);
  const [mapLoadState, setMapLoadState] = useState('idle');
  const [nativeZoomLimit, setNativeZoomLimit] = useState(MAX_ZOOM);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideZoom, setGuideZoom] = useState(1);

  const tokens = useMemo(
    () => normalizeTokens(state.tokens, role),
    [role, state.tokens],
  );
  const overlays = useMemo(
    () => (Array.isArray(scene?.overlays) ? scene.overlays : []),
    [scene?.overlays],
  );
  const scenes = useMemo(
    () => (Array.isArray(catalog?.scenes) ? catalog.scenes : []),
    [catalog?.scenes],
  );
  const tokenAssets = useMemo(
    () => (Array.isArray(catalog?.tokenAssets) ? catalog.tokenAssets : []),
    [catalog?.tokenAssets],
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

  useEffect(() => {
    setCamera({ x: 0, y: 0, scale: 1 });
    setDraftPositions({});
    setSelectedTokenId('');
    setIsPanning(false);
    setGuideOpen(false);
    setGuideZoom(1);
  }, [scene?.id]);

  useEffect(() => {
    setMapLoadState(scene?.map?.url ? 'loading' : 'idle');
  }, [scene?.map?.url]);

  useEffect(() => {
    setDraftPositions({});
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
    if (!guideOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setGuideOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [guideOpen]);

  useEffect(() => {
    if (!selectedAssetId && tokenAssets[0]?.assetId) {
      setSelectedAssetId(tokenAssets[0].assetId);
    }
  }, [selectedAssetId, tokenAssets]);

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

  const canMoveToken = useCallback((token) => (
    connected && (isMaster || token.movable !== false)
  ), [connected, isMaster]);

  const handleTokenPointerDown = (event, token) => {
    event.stopPropagation();
    setSelectedTokenId(token.id);
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

        <span className={`vtt-board__connection is-${connected ? 'online' : 'offline'}`}>
          {connected ? (isMaster ? 'Mestre conectado' : 'Jogador conectado') : 'Sem conexão'}
        </span>
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
