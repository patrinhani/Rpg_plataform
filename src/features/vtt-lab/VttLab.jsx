import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  readVttLaunchContext,
  resolveAuthenticatedVttServerOrigin,
} from '../../lib/vtt-link.js';
import { readVttPersistenceWarning } from '../../lib/vtt-persistence.js';
import { getIntegratedVttSessionRefreshDelay } from '../../lib/vtt-session.js';
import VttBoard from '../vtt-table/index.js';
import './vtt-lab.css';

const SERVER_URL_STORAGE_KEY = 'caos.vttLab.serverUrl';
const LOCAL_DEVELOPMENT_SERVER_URL = 'http://127.0.0.1:8765';
const DEMO_TOKEN_ID = 'demo-token';
const LOG_LIMIT = 80;
const SOCKET_CONNECTION_TIMEOUT_MS = 12_000;
const REST_REQUEST_TIMEOUT_MS = 12_000;
const MISSING_INTEGRATED_SERVER_ORIGIN_ERROR = 'O mestre ainda precisa configurar o servidor VTT desta Mesa.';
const BOARD_COMMAND_TYPES = new Set([
  'scene.select',
  'overlay.set',
  'layer.set',
  'token.spawn',
  'token.move',
  'token.remove',
  'prop.spawn',
  'prop.update',
  'prop.remove',
  'fog.set_enabled',
  'fog.stroke',
  'fog.reset',
  'fog.reveal_all',
]);
const BOARD_COMMANDS_WITHOUT_PAYLOAD = new Set(['fog.reset', 'fog.reveal_all']);

const STATUS_LABELS = {
  disconnected: 'Desconectado',
  connecting: 'Conectando',
  connected: 'Conectado',
  error: 'Erro',
};

function clampCoordinate(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0.5;
  return Math.max(0, Math.min(1, numericValue));
}

function createCommandId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getRuntimeDefaultServerUrl() {
  const location = globalThis.location;
  if (
    location
    && ['http:', 'https:'].includes(location.protocol)
    && !import.meta.env.DEV
  ) {
    return location.origin;
  }
  return LOCAL_DEVELOPMENT_SERVER_URL;
}

function getInitialServerUrl({ integrated = false } = {}) {
  if (integrated) return LOCAL_DEVELOPMENT_SERVER_URL;

  try {
    return localStorage.getItem(SERVER_URL_STORAGE_KEY) || getRuntimeDefaultServerUrl();
  } catch {
    return getRuntimeDefaultServerUrl();
  }
}

function readLaunchContext() {
  return readVttLaunchContext(globalThis.location?.search || '');
}

function normalizeServerUrl(value) {
  const trimmedValue = String(value || '').trim();
  if (!trimmedValue) throw new Error('Informe a URL do servidor.');

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmedValue)
    ? trimmedValue
    : `http://${trimmedValue}`;
  const url = new URL(withProtocol);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('A URL precisa usar http:// ou https://.');
  }
  if (url.username || url.password) {
    throw new Error('A URL do servidor não pode conter usuário ou senha.');
  }
  if ((url.pathname && url.pathname !== '/') || url.search || url.hash) {
    throw new Error('Informe somente a origem do servidor, sem caminho, consulta ou fragmento.');
  }

  return url.origin;
}

function buildHttpUrl(serverUrl, path) {
  return `${normalizeServerUrl(serverUrl)}${path.startsWith('/') ? path : `/${path}`}`;
}

async function fetchWithTimeout(url, options, controller) {
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REST_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, options);
  } catch (error) {
    if (timedOut) {
      throw new Error('O servidor não respondeu em 12 segundos.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function buildWebSocketUrl(serverUrl, roomId, ticket) {
  const url = new URL(buildHttpUrl(
    serverUrl,
    `/ws/vtt/rooms/${encodeURIComponent(roomId)}`,
  ));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('ticket', ticket);
  return url.toString();
}

function buildAssetUrl(serverUrl, roomId, mediaToken, assetId) {
  if (!mediaToken || !assetId) return '';
  const url = new URL(buildHttpUrl(
    serverUrl,
    `/api/vtt/rooms/${encodeURIComponent(roomId)}/assets`,
  ));
  url.searchParams.set('assetId', String(assetId));
  url.searchParams.set('access', String(mediaToken));
  return url.toString();
}

function buildFogMapUrl(serverUrl, roomId, mediaToken, sceneId, fogRevision) {
  if (!mediaToken) return '';
  const url = new URL(buildHttpUrl(
    serverUrl,
    `/api/vtt/rooms/${encodeURIComponent(roomId)}/fog-map`,
  ));
  url.searchParams.set('access', String(mediaToken));
  url.searchParams.set('scene', String(sceneId || ''));
  url.searchParams.set('revision', String(Math.max(0, Number(fogRevision) || 0)));
  return url.toString();
}

function readPlayerInviteFragment() {
  const location = globalThis.location;
  if (!location?.hash) return { roomId: '', inviteToken: '', present: false };
  const params = new URLSearchParams(location.hash.slice(1));
  if (params.get('join') !== 'player') {
    return { roomId: '', inviteToken: '', present: false };
  }
  const roomId = String(params.get('room') || '').trim();
  const inviteToken = String(params.get('invite') || '').trim();
  if (!roomId || !inviteToken) return { roomId: '', inviteToken: '', present: false };
  return { roomId, inviteToken, present: true };
}

function buildPlayerInviteUrl(serverUrl, roomId, inviteToken) {
  const url = new URL('/vtt-lab', `${normalizeServerUrl(serverUrl)}/`);
  url.hash = new URLSearchParams({
    join: 'player',
    room: String(roomId).trim(),
    invite: String(inviteToken).trim(),
  }).toString();
  return url.toString();
}

function hydrateCampaignState(rawState, revision, grant) {
  if (!rawState?.scene || !grant?.token) return null;
  const assetUrl = (assetId) => buildAssetUrl(
    grant.serverUrl,
    grant.roomId,
    grant.token,
    assetId,
  );
  const rawScene = rawState.scene;
  const rawTokens = rawState.tokens && typeof rawState.tokens === 'object'
    ? rawState.tokens
    : {};
  const rawProps = rawState.props && typeof rawState.props === 'object'
    ? rawState.props
    : {};
  const useProtectedMap = grant.role === 'player' && rawState.fog?.enabled;

  return {
    ...rawState,
    revision: Number.isFinite(Number(revision)) ? Number(revision) : 0,
    scene: {
      ...rawScene,
      map: rawScene.map ? {
        ...rawScene.map,
        url: useProtectedMap
          ? buildFogMapUrl(
              grant.serverUrl,
              grant.roomId,
              grant.token,
              rawScene.id,
              rawState.fog?.renderRevision ?? revision,
            )
          : assetUrl(rawScene.map.assetId),
      } : null,
      gmGuideMap: rawScene.gmGuideMap ? {
        ...rawScene.gmGuideMap,
        url: assetUrl(rawScene.gmGuideMap.assetId),
      } : null,
      overlays: Array.isArray(rawScene.overlays)
        ? rawScene.overlays.map((overlay) => ({
          ...overlay,
          url: assetUrl(overlay.assetId),
        }))
        : [],
      layers: Array.isArray(rawScene.layers)
        ? rawScene.layers.map((layer) => ({
          ...layer,
          assetUrl: layer.assetId ? assetUrl(layer.assetId) : '',
        }))
        : [],
    },
    tokens: Object.fromEntries(Object.entries(rawTokens).map(([key, tokenValue]) => {
      const token = tokenValue && typeof tokenValue === 'object' ? tokenValue : {};
      const id = String(token.id || key);
      return [id, {
        ...token,
        id,
        assetUrl: assetUrl(token.assetId),
      }];
    })),
    props: Object.fromEntries(Object.entries(rawProps).map(([key, propValue]) => {
      const prop = propValue && typeof propValue === 'object' ? propValue : {};
      const id = String(prop.id || key);
      return [id, {
        ...prop,
        id,
        assetUrl: assetUrl(prop.assetId),
      }];
    })),
  };
}

async function readJsonResponse(response) {
  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.detail || payload?.message || payload?.error;
    throw new Error(detail || `O servidor respondeu com HTTP ${response.status}.`);
  }

  return payload || {};
}

function normalizeBoardTokens(rawTokens) {
  if (!rawTokens || typeof rawTokens !== 'object' || Array.isArray(rawTokens)) return {};

  return Object.fromEntries(
    Object.entries(rawTokens).map(([key, rawToken]) => {
      const token = rawToken && typeof rawToken === 'object' ? rawToken : {};
      const id = String(token.id || key);
      return [id, {
        id,
        x: clampCoordinate(token.x),
        y: clampCoordinate(token.y),
        label: String(token.label || id),
      }];
    }),
  );
}

function roleLabel(role) {
  if (role === 'master') return 'Mestre';
  if (role === 'player') return 'Jogador';
  return 'Nenhum';
}

function directionLabel(direction) {
  if (direction === 'in') return 'Recebido';
  if (direction === 'out') return 'Enviado';
  if (direction === 'error') return 'Erro';
  return 'Sistema';
}

export default function VttLab({ onPersistLinkedRoom, automaticAccess = null }) {
  const [launchContext] = useState(readLaunchContext);
  const usesAutomaticAccess = Boolean(automaticAccess?.enabled && launchContext.mesaId);
  const integratedPlayerMissingServerOrigin = Boolean(
    usesAutomaticAccess
    && automaticAccess?.canEditServerUrl !== true
    && !automaticAccess?.initialServerUrl,
  );
  const [initialPlayerInvite] = useState(
    () => (usesAutomaticAccess
      ? { roomId: '', inviteToken: '', present: false }
      : readPlayerInviteFragment()),
  );
  const [serverUrl, setServerUrl] = useState(
    () => automaticAccess?.initialServerUrl
      || (integratedPlayerMissingServerOrigin
        ? ''
        : getInitialServerUrl({ integrated: usesAutomaticAccess })),
  );
  const [hostToken, setHostToken] = useState('');
  const [roomName, setRoomName] = useState(() => launchContext.roomName || 'Mesa C.A.O.S.');
  const [roomId, setRoomId] = useState(
    () => (usesAutomaticAccess ? '' : (initialPlayerInvite.roomId || launchContext.roomId)),
  );
  const [masterInviteToken, setMasterInviteToken] = useState('');
  const [playerInviteToken, setPlayerInviteToken] = useState(initialPlayerInvite.inviteToken);
  const [connectionStatus, setConnectionStatus] = useState(
    () => (integratedPlayerMissingServerOrigin ? 'error' : 'disconnected'),
  );
  const [connectedRole, setConnectedRole] = useState('');
  const [revision, setRevision] = useState(0);
  const [boardTokens, setBoardTokens] = useState(() => ({
    [DEMO_TOKEN_ID]: {
      id: DEMO_TOKEN_ID,
      x: 0.5,
      y: 0.5,
      label: 'Token de demonstração',
    },
  }));
  const [campaignState, setCampaignState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [lastError, setLastError] = useState(
    () => (integratedPlayerMissingServerOrigin ? MISSING_INTEGRATED_SERVER_ORIGIN_ERROR : ''),
  );
  const [persistenceWarning, setPersistenceWarning] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [linkStatus, setLinkStatus] = useState(
    () => (!usesAutomaticAccess && launchContext.roomId ? 'linked' : 'pending'),
  );

  const socketRef = useRef(null);
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const logSequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const requestControllerRef = useRef(null);
  const connectionTimerRef = useRef(null);
  const mediaGrantRef = useRef(null);
  const persistenceWarningRef = useRef('');
  const automaticAccessHandlerRef = useRef(null);

  const appendLog = useCallback((direction, type, message = '') => {
    logSequenceRef.current += 1;
    const logEntry = {
      id: logSequenceRef.current,
      time: new Date().toLocaleTimeString('pt-BR'),
      direction,
      type,
      message,
    };

    setLogs((currentLogs) => [...currentLogs.slice(-(LOG_LIMIT - 1)), logEntry]);
  }, []);

  const clearConnectionTimer = useCallback(() => {
    if (connectionTimerRef.current !== null) {
      window.clearTimeout(connectionTimerRef.current);
      connectionTimerRef.current = null;
    }
  }, []);

  const closeSocket = useCallback((reason, { log = false } = {}) => {
    clearConnectionTimer();
    const socket = socketRef.current;
    socketRef.current = null;
    dragRef.current = null;
    mediaGrantRef.current = null;

    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      socket.close(1000, reason);
    }

    if (!mountedRef.current) return;
    setConnectionStatus('disconnected');
    setConnectedRole('');
    setCampaignState(null);
    if (log) appendLog('system', 'socket.disconnect', 'Desconexão local solicitada.');
  }, [appendLog, clearConnectionTimer]);

  const persistServerUrl = useCallback(() => {
    try {
      const normalizedUrl = normalizeServerUrl(serverUrl);
      setServerUrl(normalizedUrl);
      localStorage.setItem(SERVER_URL_STORAGE_KEY, normalizedUrl);
      return normalizedUrl;
    } catch (error) {
      setLastError(error.message);
      appendLog('error', 'server.url.invalid', error.message);
      return null;
    }
  }, [appendLog, serverUrl]);

  const persistLinkedRoom = useCallback(async (nextRoomId, nextServerOrigin = serverUrl) => {
    if (!launchContext.mesaId || !launchContext.campaignId || !nextRoomId) return;

    try {
      if (typeof onPersistLinkedRoom !== 'function') return;
      await onPersistLinkedRoom(
        launchContext.mesaId,
        launchContext.campaignId,
        String(nextRoomId),
        normalizeServerUrl(nextServerOrigin),
      );
      if (!mountedRef.current) return;
      setLinkStatus('saved');
      appendLog('system', 'room.link.saved', 'Sala vinculada à Mesa sem salvar credenciais.');
    } catch (error) {
      if (!mountedRef.current) return;
      setLinkStatus('warning');
      appendLog(
        'error',
        'room.link.warning',
        `Sala aberta, mas o vínculo com a Mesa não foi atualizado: ${error.message}`,
      );
    }
  }, [appendLog, launchContext.campaignId, launchContext.mesaId, onPersistLinkedRoom, serverUrl]);

  const handleServerMessage = useCallback((event) => {
    let message;

    try {
      message = JSON.parse(event.data);
    } catch {
      appendLog('error', 'message.invalid', 'Mensagem WebSocket não contém JSON válido.');
      return;
    }

    const messageType = String(message?.type || 'message.unknown');

    if (messageType === 'room.snapshot') {
      if (message.protocolVersion !== 1) {
        appendLog(
          'error',
          messageType,
          `Versão de protocolo inesperada: ${message.protocolVersion ?? 'ausente'}.`,
        );
      }

      if (message.roomId) setRoomId(String(message.roomId));
      if (message.role) setConnectedRole(String(message.role));
      const snapshotRevision = Number.isFinite(Number(message.revision))
        ? Number(message.revision)
        : 0;
      const nextPersistenceWarning = readVttPersistenceWarning(message.state, message.role);
      if (nextPersistenceWarning !== persistenceWarningRef.current) {
        const persistenceRecovered = Boolean(persistenceWarningRef.current) && !nextPersistenceWarning;
        persistenceWarningRef.current = nextPersistenceWarning;
        setPersistenceWarning(nextPersistenceWarning);
        if (nextPersistenceWarning) {
          appendLog('error', 'persistence.unsaved', nextPersistenceWarning);
        } else if (persistenceRecovered) {
          appendLog('system', 'persistence.saved', 'A gravação da sessão no disco voltou a funcionar.');
        }
      }
      setRevision(snapshotRevision);
      setBoardTokens(normalizeBoardTokens(message.state?.tokens));
      setCampaignState(hydrateCampaignState(
        message.state,
        snapshotRevision,
        mediaGrantRef.current,
      ));
      appendLog(
        'in',
        messageType,
        message.state?.scene ? 'Cena da campanha sincronizada.' : 'Snapshot aplicado à mesa.',
      );
      return;
    }

    if (messageType === 'token.moved') {
      const tokenId = String(message.payload?.tokenId || '');
      if (!tokenId) {
        appendLog('error', messageType, 'Movimento recebido sem tokenId.');
        return;
      }

      setBoardTokens((currentTokens) => {
        const currentToken = currentTokens[tokenId] || {
          id: tokenId,
          label: tokenId,
        };
        return {
          ...currentTokens,
          [tokenId]: {
            ...currentToken,
            x: clampCoordinate(message.payload?.x),
            y: clampCoordinate(message.payload?.y),
          },
        };
      });
      if (Number.isFinite(Number(message.revision))) setRevision(Number(message.revision));
      setCampaignState((currentState) => {
        if (!currentState?.tokens?.[tokenId]) return currentState;
        const nextRevision = Number.isFinite(Number(message.revision))
          ? Number(message.revision)
          : currentState.revision;
        return {
          ...currentState,
          revision: nextRevision,
          tokens: {
            ...currentState.tokens,
            [tokenId]: {
              ...currentState.tokens[tokenId],
              x: clampCoordinate(message.payload?.x),
              y: clampCoordinate(message.payload?.y),
            },
          },
        };
      });
      appendLog('in', messageType, `Posição de ${tokenId} atualizada.`);
      return;
    }

    if (messageType === 'pong') {
      appendLog('in', messageType, 'Servidor respondeu ao ping.');
      return;
    }

    if (messageType === 'error' || messageType.endsWith('.error')) {
      const errorMessage = String(
        message.error?.message
        || message.detail
        || message.message
        || 'Erro informado pelo servidor.',
      );
      setLastError(errorMessage);
      appendLog('error', messageType, errorMessage);
      return;
    }

    if (Number.isFinite(Number(message.revision))) setRevision(Number(message.revision));
    appendLog('in', messageType, 'Mensagem recebida.');
  }, [appendLog]);

  const openSocket = useCallback((normalizedServerUrl, targetRoomId, ticket, role) => {
    if (!mountedRef.current) return;

    clearConnectionTimer();
    const previousSocket = socketRef.current;
    if (previousSocket) {
      socketRef.current = null;
      previousSocket.close(1000, 'Substituída por uma nova conexão');
    }

    setConnectionStatus('connecting');
    setConnectedRole(role);
    setLastError('');

    const socket = new WebSocket(buildWebSocketUrl(
      normalizedServerUrl,
      targetRoomId,
      ticket,
    ));
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      if (!mountedRef.current || socketRef.current !== socket) return;
      clearConnectionTimer();
      setConnectionStatus('connected');
      appendLog('system', 'socket.open', `Conectado como ${roleLabel(role)}.`);
    });

    socket.addEventListener('message', (event) => {
      if (!mountedRef.current || socketRef.current !== socket) return;
      handleServerMessage(event);
    });

    socket.addEventListener('error', () => {
      if (!mountedRef.current || socketRef.current !== socket) return;
      clearConnectionTimer();
      socketRef.current = null;
      dragRef.current = null;
      mediaGrantRef.current = null;
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      const errorMessage = 'A conexão WebSocket encontrou um erro.';
      setConnectedRole('');
      setCampaignState(null);
      setConnectionStatus('error');
      setLastError(errorMessage);
      appendLog('error', 'socket.error', errorMessage);
    });

    socket.addEventListener('close', (event) => {
      if (!mountedRef.current || socketRef.current !== socket) return;
      clearConnectionTimer();
      socketRef.current = null;
      dragRef.current = null;
      mediaGrantRef.current = null;
      setConnectedRole('');
      setCampaignState(null);
      setConnectionStatus(event.code === 1000 ? 'disconnected' : 'error');
      appendLog(
        event.code === 1000 ? 'system' : 'error',
        'socket.close',
        `Conexão encerrada (código ${event.code}).`,
      );
    });

    connectionTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current || socketRef.current !== socket || socket.readyState === WebSocket.OPEN) {
        return;
      }

      socketRef.current = null;
      dragRef.current = null;
      mediaGrantRef.current = null;
      connectionTimerRef.current = null;
      socket.close(1000, 'Tempo limite de conexão');
      const errorMessage = 'O servidor não concluiu a conexão em 12 segundos.';
      setConnectedRole('');
      setCampaignState(null);
      setConnectionStatus('error');
      setLastError(errorMessage);
      appendLog('error', 'socket.timeout', errorMessage);
    }, SOCKET_CONNECTION_TIMEOUT_MS);
  }, [appendLog, clearConnectionTimer, handleServerMessage]);

  const handleCreateRoom = async (event) => {
    event.preventDefault();
    if (busyAction) return;

    const normalizedServerUrl = persistServerUrl();
    if (!normalizedServerUrl) return;
    if (!hostToken.trim()) {
      setLastError('Informe o host token para criar a sala.');
      return;
    }
    if (!roomName.trim()) {
      setLastError('Informe um nome para a sala.');
      return;
    }

    closeSocket('Substituída pela criação de uma sala');
    requestControllerRef.current?.abort();
    const requestController = new AbortController();
    requestControllerRef.current = requestController;
    setBusyAction('create');
    setLastError('');

    try {
      const response = await fetchWithTimeout(buildHttpUrl(normalizedServerUrl, '/api/vtt/rooms'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hostToken.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: roomName.trim(),
          ...(launchContext.campaignId ? { campaignId: launchContext.campaignId } : {}),
        }),
        signal: requestController.signal,
      }, requestController);
      const data = await readJsonResponse(response);

      if (
        !mountedRef.current
        || requestController.signal.aborted
        || requestControllerRef.current !== requestController
      ) return;

      if (!data.roomId || !data.masterInviteToken || !data.playerInviteToken) {
        throw new Error('A resposta de criação da sala está incompleta.');
      }

      setRoomId(String(data.roomId));
      setMasterInviteToken(String(data.masterInviteToken));
      setPlayerInviteToken(String(data.playerInviteToken));
      setRevision(Number.isFinite(Number(data.revision)) ? Number(data.revision) : 0);
      setHostToken('');
      void persistLinkedRoom(String(data.roomId), normalizedServerUrl);
      appendLog('system', 'room.created', `Sala ${data.roomId} criada; host token removido da memória.`);
    } catch (error) {
      if (error.name === 'AbortError' || !mountedRef.current) return;
      setConnectionStatus('error');
      setLastError(error.message);
      appendLog('error', 'room.create.error', error.message);
    } finally {
      if (requestControllerRef.current === requestController) {
        requestControllerRef.current = null;
        if (mountedRef.current) setBusyAction('');
      }
    }
  };

  const handleConnect = async (expectedRole) => {
    if (busyAction) return;

    const normalizedServerUrl = persistServerUrl();
    if (!normalizedServerUrl) return;

    const inviteToken = expectedRole === 'master'
      ? masterInviteToken.trim()
      : playerInviteToken.trim();

    if (!roomId.trim()) {
      setLastError('Informe o ID da sala.');
      return;
    }
    if (!inviteToken) {
      setLastError(`Informe o convite de ${roleLabel(expectedRole).toLowerCase()}.`);
      return;
    }

    closeSocket('Substituída por uma nova conexão');
    requestControllerRef.current?.abort();
    const requestController = new AbortController();
    requestControllerRef.current = requestController;
    setBusyAction(`connect-${expectedRole}`);
    setLastError('');

    try {
      const response = await fetchWithTimeout(buildHttpUrl(
        normalizedServerUrl,
        `/api/vtt/rooms/${encodeURIComponent(roomId.trim())}/tickets`,
      ), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${inviteToken}`,
        },
        signal: requestController.signal,
      }, requestController);
      const data = await readJsonResponse(response);

      if (
        !mountedRef.current
        || requestController.signal.aborted
        || requestControllerRef.current !== requestController
      ) return;

      if (!data.ticket || !data.role) {
        throw new Error('A resposta do ticket está incompleta.');
      }
      if (data.role !== expectedRole) {
        throw new Error(`O convite pertence ao papel ${roleLabel(data.role)}, não ${roleLabel(expectedRole)}.`);
      }

      appendLog(
        'system',
        'ticket.issued',
        `Ticket efêmero emitido para ${roleLabel(data.role)} (${data.expiresIn ?? '?'} s).`,
      );
      mediaGrantRef.current = data.mediaToken ? {
        token: String(data.mediaToken),
        roomId: roomId.trim(),
        serverUrl: normalizedServerUrl,
        role: String(data.role),
      } : null;
      if (data.role === 'master') {
        void persistLinkedRoom(roomId.trim(), normalizedServerUrl);
      }
      openSocket(normalizedServerUrl, roomId.trim(), String(data.ticket), String(data.role));
    } catch (error) {
      if (error.name === 'AbortError' || !mountedRef.current) return;
      if (
        expectedRole === 'master'
        && launchContext.roomId
        && roomId.trim() === launchContext.roomId
      ) {
        setLinkStatus('warning');
      }
      setConnectionStatus('error');
      setLastError(error.message);
      appendLog('error', 'ticket.error', error.message);
    } finally {
      if (requestControllerRef.current === requestController) {
        requestControllerRef.current = null;
        if (mountedRef.current) setBusyAction('');
      }
    }
  };

  const handleAutomaticAccess = useCallback(async () => {
    if (!usesAutomaticAccess || busyAction) return;

    if (integratedPlayerMissingServerOrigin) {
      setLastError(MISSING_INTEGRATED_SERVER_ORIGIN_ERROR);
      setConnectionStatus('error');
      appendLog('error', 'server.url.missing', MISSING_INTEGRATED_SERVER_ORIGIN_ERROR);
      return;
    }

    const normalizedServerUrl = resolveAuthenticatedVttServerOrigin({
      trustedOrigin: automaticAccess?.initialServerUrl,
      requestedOrigin: serverUrl,
      canEditServerUrl: automaticAccess?.canEditServerUrl === true,
    });
    if (!normalizedServerUrl) {
      const errorMessage = 'Para autenticar pela Mesa, use HTTPS ou HTTP local em localhost, 127.0.0.1 ou [::1].';
      setLastError(errorMessage);
      setConnectionStatus('error');
      appendLog('error', 'server.url.untrusted', errorMessage);
      return;
    }
    if (typeof automaticAccess?.getIdToken !== 'function') {
      const errorMessage = 'A autenticação da Mesa não está disponível nesta sessão.';
      setLastError(errorMessage);
      setConnectionStatus('error');
      return;
    }

    setServerUrl(normalizedServerUrl);
    try {
      localStorage.setItem(SERVER_URL_STORAGE_KEY, normalizedServerUrl);
    } catch {
      // A conexão autenticada pode continuar sem persistir a preferência local.
    }

    closeSocket('Substituída por uma nova conexão autenticada');
    requestControllerRef.current?.abort();
    const requestController = new AbortController();
    requestControllerRef.current = requestController;
    setBusyAction('automatic-access');
    setLastError('');

    try {
      const idToken = String(await automaticAccess.getIdToken()).trim();
      if (!idToken) throw new Error('A sessão Firebase não forneceu uma credencial válida.');
      if (requestController.signal.aborted) return;

      const response = await fetchWithTimeout(
        buildHttpUrl(normalizedServerUrl, '/api/vtt/mesa-access'),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ mesaId: launchContext.mesaId }),
          signal: requestController.signal,
        },
        requestController,
      );
      const data = await readJsonResponse(response);

      if (
        !mountedRef.current
        || requestController.signal.aborted
        || requestControllerRef.current !== requestController
      ) return;

      const nextRoomId = String(data.roomId || '').trim();
      const nextRole = String(data.role || '');
      if (
        !nextRoomId
        || !data.ticket
        || !data.mediaToken
        || !['master', 'player'].includes(nextRole)
      ) {
        throw new Error('A resposta de acesso automático do VTT está incompleta.');
      }

      setRoomId(nextRoomId);
      setRevision(Number.isFinite(Number(data.revision)) ? Number(data.revision) : 0);
      mediaGrantRef.current = {
        token: String(data.mediaToken),
        roomId: nextRoomId,
        serverUrl: normalizedServerUrl,
        role: nextRole,
      };
      appendLog(
        'system',
        'mesa.access.granted',
        `A Mesa autorizou o acesso como ${roleLabel(nextRole)}.`,
      );
      if (nextRole === 'master') {
        void persistLinkedRoom(nextRoomId, normalizedServerUrl);
      }
      openSocket(normalizedServerUrl, nextRoomId, String(data.ticket), nextRole);
    } catch (error) {
      if (error.name === 'AbortError' || !mountedRef.current) return;
      const errorMessage = error instanceof Error
        ? error.message
        : 'Não foi possível validar o acesso desta Mesa.';
      setConnectionStatus('error');
      setLastError(errorMessage);
      appendLog('error', 'mesa.access.error', errorMessage);
    } finally {
      if (requestControllerRef.current === requestController) {
        requestControllerRef.current = null;
        if (mountedRef.current) setBusyAction('');
      }
    }
  }, [
    appendLog,
    automaticAccess,
    busyAction,
    closeSocket,
    integratedPlayerMissingServerOrigin,
    launchContext.mesaId,
    openSocket,
    persistLinkedRoom,
    serverUrl,
    usesAutomaticAccess,
  ]);
  automaticAccessHandlerRef.current = handleAutomaticAccess;

  const handleDisconnect = useCallback(() => {
    closeSocket('Desconexão solicitada pelo usuário', { log: true });
  }, [closeSocket]);

  const handleClearSecrets = () => {
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setBusyAction('');
    handleDisconnect();
    setHostToken('');
    setMasterInviteToken('');
    setPlayerInviteToken('');
    appendLog('system', 'secrets.cleared', 'Tokens removidos da memória da página.');
  };

  const handleCopySecret = async (secret, label) => {
    if (!secret) return;

    try {
      await navigator.clipboard.writeText(secret);
      appendLog('system', 'secret.copied', `${label} copiado para a área de transferência.`);
    } catch {
      const errorMessage = 'Não foi possível copiar o convite automaticamente.';
      setLastError(errorMessage);
      appendLog('error', 'secret.copy.error', errorMessage);
    }
  };

  const handleCopyPlayerLink = async () => {
    if (!roomId.trim() || !playerInviteToken.trim()) return;
    try {
      const inviteUrl = buildPlayerInviteUrl(serverUrl, roomId, playerInviteToken);
      await navigator.clipboard.writeText(inviteUrl);
      appendLog('system', 'invite.link.copied', 'Link completo de jogador copiado.');
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Não foi possível copiar o link do jogador.';
      setLastError(errorMessage);
      appendLog('error', 'invite.link.error', errorMessage);
    }
  };

  const updateTokenLocally = useCallback((tokenId, x, y) => {
    setBoardTokens((currentTokens) => {
      const currentToken = currentTokens[tokenId];
      if (!currentToken) return currentTokens;
      return {
        ...currentTokens,
        [tokenId]: {
          ...currentToken,
          x: clampCoordinate(x),
          y: clampCoordinate(y),
        },
      };
    });
  }, []);

  const sendTokenMove = useCallback((tokenId, x, y) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLastError('Conecte o WebSocket antes de mover o token.');
      return false;
    }

    const payload = {
      type: 'token.move',
      commandId: createCommandId(),
      payload: {
        tokenId,
        x: clampCoordinate(x),
        y: clampCoordinate(y),
      },
    };
    socket.send(JSON.stringify(payload));
    appendLog('out', payload.type, `Movimento de ${tokenId} enviado.`);
    return true;
  }, [appendLog]);

  const sendBoardCommand = useCallback((command) => {
    const type = String(command?.type || '');
    const socket = socketRef.current;
    if (!BOARD_COMMAND_TYPES.has(type)) {
      setLastError('A mesa tentou enviar um comando desconhecido.');
      return false;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setLastError('Conecte a sessão antes de controlar a mesa.');
      return false;
    }

    const payload = {
      type,
      commandId: createCommandId(),
    };
    if (!BOARD_COMMANDS_WITHOUT_PAYLOAD.has(type)) {
      payload.payload = command?.payload && typeof command.payload === 'object'
        ? command.payload
        : {};
    }
    socket.send(JSON.stringify(payload));
    appendLog('out', type, 'Comando da mesa enviado.');
    return true;
  }, [appendLog]);

  const getPointerCoordinates = useCallback((event) => {
    const board = boardRef.current;
    if (!board) return null;
    const rect = board.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: clampCoordinate((event.clientX - rect.left) / rect.width),
      y: clampCoordinate((event.clientY - rect.top) / rect.height),
    };
  }, []);

  const handleTokenPointerDown = (event, tokenId) => {
    if (connectionStatus !== 'connected') return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, tokenId };
  };

  const handleTokenPointerMove = (event, tokenId) => {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || dragState.tokenId !== tokenId) return;
    const point = getPointerCoordinates(event);
    if (point) updateTokenLocally(tokenId, point.x, point.y);
  };

  const handleTokenPointerUp = (event, tokenId) => {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || dragState.tokenId !== tokenId) return;

    const point = getPointerCoordinates(event);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!point) return;
    updateTokenLocally(tokenId, point.x, point.y);
    sendTokenMove(tokenId, point.x, point.y);
  };

  const handleTokenPointerCancel = (event, tokenId) => {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || dragState.tokenId !== tokenId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    appendLog('system', 'token.drag.cancelled', `Arraste de ${tokenId} cancelado.`);
  };

  const handleTokenKeyDown = (event, token) => {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction || connectionStatus !== 'connected') return;

    event.preventDefault();
    const step = event.shiftKey ? 0.05 : 0.02;
    const nextX = clampCoordinate(token.x + direction[0] * step);
    const nextY = clampCoordinate(token.y + direction[1] * step);
    updateTokenLocally(token.id, nextX, nextY);
    sendTokenMove(token.id, nextX, nextY);
  };

  const handlePing = () => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    const command = { type: 'ping', commandId: createCommandId() };
    socket.send(JSON.stringify(command));
    appendLog('out', command.type, 'Ping enviado.');
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      requestControllerRef.current?.abort();
      requestControllerRef.current = null;
      clearConnectionTimer();
      const socket = socketRef.current;
      socketRef.current = null;
      mediaGrantRef.current = null;
      if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        socket.close(1000, 'Mesa encerrada');
      }
    };
  }, [clearConnectionTimer]);

  useEffect(() => {
    if (!initialPlayerInvite.present || !globalThis.location?.hash) return;
    globalThis.history?.replaceState(
      globalThis.history.state,
      '',
      `${globalThis.location.pathname}${globalThis.location.search}`,
    );
    appendLog('system', 'invite.link.loaded', 'Convite de jogador preenchido pelo link seguro.');
  }, [appendLog, initialPlayerInvite]);

  useEffect(() => {
    if (!usesAutomaticAccess || automaticAccess?.autoStart === false) return undefined;
    const timeoutId = window.setTimeout(() => {
      void automaticAccessHandlerRef.current?.();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [automaticAccess?.autoStart, launchContext.mesaId, usesAutomaticAccess]);

  useEffect(() => {
    const refreshDelay = getIntegratedVttSessionRefreshDelay({
      usesAutomaticAccess,
      connectionStatus,
    });
    if (refreshDelay === null) return undefined;

    const timeoutId = window.setTimeout(() => {
      void automaticAccessHandlerRef.current?.();
    }, refreshDelay);
    return () => window.clearTimeout(timeoutId);
  }, [connectionStatus, usesAutomaticAccess]);

  const isConnected = connectionStatus === 'connected';
  const canDisconnect = isConnected || connectionStatus === 'connecting';
  const controlsLocked = Boolean(busyAction) || canDisconnect;
  const operationLabel = busyAction === 'create'
    ? 'Criando sala'
    : (busyAction === 'automatic-access'
      ? 'Validando acesso'
      : (busyAction.startsWith('connect-') ? 'Solicitando ticket' : ''));
  const statusLabel = operationLabel || STATUS_LABELS[connectionStatus] || connectionStatus;
  const statusVisualState = operationLabel ? 'working' : connectionStatus;

  return (
    <main
      className={`vtt-lab ${isConnected ? 'is-session-active' : ''}`}
      aria-labelledby="vtt-lab-title"
    >
      <header className="vtt-lab__header">
        <div>
          <span className="vtt-lab__eyebrow">
            {usesAutomaticAccess ? 'C.A.O.S. · acesso pela Mesa' : 'C.A.O.S. · mesa portátil'}
          </span>
          <h1 id="vtt-lab-title">Mesa virtual C.A.O.S.</h1>
          <p>Mapas, tokens e efeitos sincronizados. As rolagens continuam nos dados físicos.</p>
          {launchContext.mesaId && (
            <div className="vtt-lab__linked-table">
              <span>
                Vinculado à mesa {launchContext.roomName || launchContext.mesaId}
                {!usesAutomaticAccess && launchContext.roomId ? ` · sala ${launchContext.roomId}` : ''}
              </span>
              <span className={`vtt-lab__link-status is-${linkStatus}`}>
                {linkStatus === 'saved' && 'Vínculo atualizado'}
                {linkStatus === 'warning' && 'Vínculo pendente'}
                {linkStatus === 'linked' && 'ID recuperado'}
                {linkStatus === 'pending' && (usesAutomaticAccess ? 'Validando acesso' : 'Aguardando criação')}
              </span>
              <a href={`/mesa/${encodeURIComponent(launchContext.mesaId)}`}>Voltar para a mesa</a>
            </div>
          )}
        </div>

        <div className="vtt-lab__connection-summary" aria-live="polite">
          <span className={`vtt-lab__status-dot is-${statusVisualState}`} aria-hidden="true" />
          <div>
            <small>Conexão</small>
            <strong>{statusLabel}</strong>
          </div>
          <div>
            <small>Papel</small>
            <strong>{roleLabel(connectedRole)}</strong>
          </div>
          <div>
            <small>Revisão</small>
            <strong>{revision}</strong>
          </div>
        </div>
      </header>

      {lastError && (
        <div className="vtt-lab__error" role="alert">
          <span>{lastError}</span>
          <button type="button" onClick={() => setLastError('')} aria-label="Fechar mensagem de erro">
            ×
          </button>
        </div>
      )}

      {persistenceWarning && (
        <section
          className="vtt-lab__persistence-warning"
          role="alert"
          aria-atomic="true"
        >
          <span className="vtt-lab__persistence-warning-icon" aria-hidden="true">!</span>
          <div>
            <strong>Alterações ainda não foram salvas no disco</strong>
            <p>
              {persistenceWarning} A mesa continua funcionando, mas não feche o servidor até
              este aviso desaparecer automaticamente.
            </p>
          </div>
        </section>
      )}

      <div className="vtt-lab__layout">
        <aside className="vtt-lab__control-column" aria-label="Conexão da mesa">
          <section className="vtt-lab__panel vtt-lab__server-panel">
            <div className="vtt-lab__panel-heading">
              <div>
                <span>Conexão</span>
                <h2>Servidor da mesa</h2>
              </div>
              <span className="vtt-lab__safe-chip">Origem do VTT</span>
            </div>

            <label className="vtt-lab__field" htmlFor="vtt-lab-server-url">
              <span>URL do servidor</span>
              <input
                id="vtt-lab-server-url"
                type="url"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                onBlur={usesAutomaticAccess && automaticAccess?.canEditServerUrl !== true
                  ? undefined
                  : persistServerUrl}
                placeholder={integratedPlayerMissingServerOrigin
                  ? 'Aguardando configuração do mestre'
                  : (usesAutomaticAccess
                    ? LOCAL_DEVELOPMENT_SERVER_URL
                    : getRuntimeDefaultServerUrl())}
                autoComplete="url"
                spellCheck="false"
                readOnly={usesAutomaticAccess && automaticAccess?.canEditServerUrl !== true}
                disabled={controlsLocked}
              />
              <small>
                {usesAutomaticAccess
                  ? (automaticAccess?.canEditServerUrl === true
                    ? 'O mestre vincula esta origem à Mesa. Para outros dispositivos, use a URL HTTPS do túnel.'
                    : (integratedPlayerMissingServerOrigin
                      ? MISSING_INTEGRATED_SERVER_ORIGIN_ERROR
                      : 'Origem definida pelo mestre e recuperada diretamente da Mesa.'))
                  : 'Somente esta URL é salva no navegador.'}
              </small>
            </label>
          </section>

          {usesAutomaticAccess ? (
            <section className="vtt-lab__panel vtt-lab__join-panel">
              <div className="vtt-lab__panel-heading">
                <div>
                  <span>Acesso pela Mesa</span>
                  <h2>Entrada automática</h2>
                </div>
              </div>

              <p className="vtt-lab__linked-room-help">
                Sua conta é validada diretamente na Mesa. O servidor define o papel de mestre ou
                jogador; nenhum convite ou chave precisa ser informado aqui.
              </p>

              <div className="vtt-lab__field">
                <span>Papel concedido</span>
                <strong>{connectedRole ? roleLabel(connectedRole) : 'Aguardando validação'}</strong>
              </div>

              <div className="vtt-lab__invite-block">
                <button
                  type="button"
                  className="vtt-lab__primary-button"
                  onClick={handleAutomaticAccess}
                  disabled={Boolean(busyAction) || canDisconnect || integratedPlayerMissingServerOrigin}
                >
                  {busyAction === 'automatic-access'
                    ? 'Validando...'
                    : (connectionStatus === 'error' ? 'Retentar acesso' : 'Validar e entrar')}
                </button>
                <button
                  type="button"
                  className="vtt-lab__text-button"
                  onClick={handleDisconnect}
                  disabled={!canDisconnect}
                >
                  Desconectar
                </button>
              </div>

              <p className="vtt-lab__security-note">
                A credencial Firebase é usada apenas para solicitar um acesso temporário e não é
                salva pelo VTT.
              </p>
            </section>
          ) : (
            <>
          <section className="vtt-lab__panel vtt-lab__create-panel">
            <div className="vtt-lab__panel-heading">
              <div>
                <span>Hospedar</span>
                <h2>{launchContext.roomId ? 'Recuperar hospedagem' : 'Criar sala'}</h2>
              </div>
            </div>

            {launchContext.mesaId && (
              <p className="vtt-lab__linked-room-help">
                {launchContext.roomId
                  ? 'O ID vinculado já foi preenchido. Cole o convite de mestre e conecte abaixo para retomar. Se a sala não existir mais, use o host token aqui para recriá-la; o novo ID substituirá o vínculo.'
                  : 'Ao criar a sala, este dispositivo salvará na Mesa apenas o ID e a campanha. Host token, convites e tickets nunca são gravados.'}
              </p>
            )}

            <form className="vtt-lab__form" onSubmit={handleCreateRoom}>
              <label className="vtt-lab__field" htmlFor="vtt-lab-room-name">
                <span>Nome da sala</span>
                <input
                  id="vtt-lab-room-name"
                  type="text"
                  value={roomName}
                  onChange={(event) => setRoomName(event.target.value)}
                  autoComplete="off"
                />
              </label>

              <label className="vtt-lab__field" htmlFor="vtt-lab-host-token">
                <span>Host token</span>
                <input
                  id="vtt-lab-host-token"
                  type="password"
                  value={hostToken}
                  onChange={(event) => setHostToken(event.target.value)}
                  placeholder="Token de administração"
                  autoComplete="new-password"
                  spellCheck="false"
                />
              </label>

              <button className="vtt-lab__primary-button" type="submit" disabled={controlsLocked}>
                {busyAction === 'create'
                  ? 'Criando...'
                  : (launchContext.roomId ? 'Recriar sala' : 'Criar sala')}
              </button>
            </form>
          </section>

          <section className="vtt-lab__panel vtt-lab__join-panel">
            <div className="vtt-lab__panel-heading">
              <div>
                <span>Acesso</span>
                <h2>Entrar na sala</h2>
              </div>
              <button type="button" className="vtt-lab__text-button" onClick={handleClearSecrets}>
                {canDisconnect ? 'Desconectar e limpar' : 'Limpar segredos'}
              </button>
            </div>

            <label className="vtt-lab__field" htmlFor="vtt-lab-room-id">
              <span>ID da sala</span>
              <input
                id="vtt-lab-room-id"
                type="text"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                placeholder="room-id"
                autoComplete="off"
                spellCheck="false"
                disabled={controlsLocked}
              />
            </label>

            <div className="vtt-lab__invite-block">
              <div className="vtt-lab__field">
                <label htmlFor="vtt-lab-master-invite">Convite de mestre</label>
                <span className="vtt-lab__secret-row">
                  <input
                    id="vtt-lab-master-invite"
                    type="password"
                    value={masterInviteToken}
                    onChange={(event) => setMasterInviteToken(event.target.value)}
                    autoComplete="new-password"
                    spellCheck="false"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopySecret(masterInviteToken, 'Convite de mestre')}
                    disabled={!masterInviteToken}
                  >
                    Copiar
                  </button>
                </span>
              </div>
              <button
                type="button"
                className="vtt-lab__role-button is-master"
                onClick={() => handleConnect('master')}
                disabled={controlsLocked}
              >
                {busyAction === 'connect-master' ? 'Conectando...' : 'Conectar como mestre'}
              </button>
            </div>

            <div className="vtt-lab__invite-block">
              <div className="vtt-lab__field">
                <label htmlFor="vtt-lab-player-invite">Convite de jogador</label>
                <span className="vtt-lab__secret-row">
                  <input
                    id="vtt-lab-player-invite"
                    type="password"
                    value={playerInviteToken}
                    onChange={(event) => setPlayerInviteToken(event.target.value)}
                    autoComplete="new-password"
                    spellCheck="false"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopySecret(playerInviteToken, 'Convite de jogador')}
                    disabled={!playerInviteToken}
                  >
                    Copiar
                  </button>
                </span>
              </div>
              <button
                type="button"
                className="vtt-lab__role-button is-player"
                onClick={() => handleConnect('player')}
                disabled={controlsLocked}
              >
                {busyAction === 'connect-player' ? 'Conectando...' : 'Conectar como jogador'}
              </button>
              <button
                type="button"
                className="vtt-lab__share-button"
                onClick={handleCopyPlayerLink}
                disabled={!roomId.trim() || !playerInviteToken.trim()}
              >
                Copiar link completo para o jogador
              </button>
            </div>

            <p className="vtt-lab__security-note">
              O aplicativo não persiste host token, convites ou tickets. O navegador ainda pode
              oferecer recursos próprios de preenchimento. Links de jogador usam um fragmento que
              não é enviado ao servidor e é removido da barra após preencher o convite.
            </p>
          </section>
            </>
          )}
        </aside>

        <section className="vtt-lab__workspace" aria-label="Mesa sincronizada">
          <div className="vtt-lab__panel vtt-lab__board-panel">
            <div className="vtt-lab__panel-heading vtt-lab__board-heading">
              <div>
                <span>Sessão ativa</span>
                <h2>{campaignState ? 'Mesa Mnemosyne' : 'Aguardando cena'}</h2>
              </div>
              <div className="vtt-lab__board-actions">
                <button type="button" onClick={handlePing} disabled={!isConnected}>Verificar</button>
                <button type="button" onClick={handleDisconnect} disabled={!canDisconnect}>Desconectar</button>
              </div>
            </div>

            {campaignState ? (
              <VttBoard
                state={campaignState}
                role={connectedRole || 'player'}
                connected={isConnected}
                onCommand={sendBoardCommand}
              />
            ) : (
              <>
                <div
                  ref={boardRef}
                  className={`vtt-lab__board ${isConnected ? 'is-connected' : 'is-locked'}`}
                  aria-label="Tabuleiro de teste"
                >
                  <div className="vtt-lab__board-axis is-x" aria-hidden="true">0 → 1</div>
                  <div className="vtt-lab__board-axis is-y" aria-hidden="true">0 → 1</div>

                  {Object.values(boardTokens).map((token) => (
                    <button
                      key={token.id}
                      type="button"
                      className="vtt-lab__token"
                      style={{
                        '--vtt-token-x': `${token.x * 100}%`,
                        '--vtt-token-y': `${token.y * 100}%`,
                      }}
                      onPointerDown={(event) => handleTokenPointerDown(event, token.id)}
                      onPointerMove={(event) => handleTokenPointerMove(event, token.id)}
                      onPointerUp={(event) => handleTokenPointerUp(event, token.id)}
                      onPointerCancel={(event) => handleTokenPointerCancel(event, token.id)}
                      onKeyDown={(event) => handleTokenKeyDown(event, token)}
                      disabled={!isConnected}
                      aria-label={`${token.label}. Posição X ${token.x.toFixed(2)}, Y ${token.y.toFixed(2)}. Use as setas para mover.`}
                    >
                      <span aria-hidden="true">C</span>
                      <small>{token.label}</small>
                    </button>
                  ))}

                  {Object.keys(boardTokens).length === 0 && (
                    <p className="vtt-lab__board-empty">O snapshot não contém tokens.</p>
                  )}

                  {!isConnected && (
                    <div className="vtt-lab__board-lock" aria-hidden="true">
                      Conecte uma sessão WebSocket para mover o token
                    </div>
                  )}
                </div>

                <footer className="vtt-lab__board-footer">
                  <span>Sala: <strong>{roomId || '—'}</strong></span>
                  <span>Arraste o token ou use as setas. Shift aumenta o passo.</span>
                </footer>
              </>
            )}
          </div>

          <section className="vtt-lab__panel vtt-lab__log-panel" aria-labelledby="vtt-lab-log-title">
            <div className="vtt-lab__panel-heading">
              <div>
                <span>Diagnóstico</span>
                <h2 id="vtt-lab-log-title">Log da sessão</h2>
              </div>
              <button type="button" className="vtt-lab__text-button" onClick={() => setLogs([])}>
                Limpar log
              </button>
            </div>

            <ol className="vtt-lab__log" aria-live="polite">
              {logs.length === 0 && (
                <li className="vtt-lab__log-empty">As operações REST e WebSocket aparecerão aqui.</li>
              )}
              {logs.map((entry) => (
                <li key={entry.id} className={`is-${entry.direction}`}>
                  <time>{entry.time}</time>
                  <span>{directionLabel(entry.direction)}</span>
                  <code>{entry.type}</code>
                  {entry.message && <p>{entry.message}</p>}
                </li>
              ))}
            </ol>
          </section>
        </section>
      </div>
    </main>
  );
}
