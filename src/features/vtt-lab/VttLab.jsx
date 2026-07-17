import React, { useCallback, useEffect, useRef, useState } from 'react';
import './vtt-lab.css';

const SERVER_URL_STORAGE_KEY = 'caos.vttLab.serverUrl';
const DEFAULT_SERVER_URL = 'http://127.0.0.1:8765';
const DEMO_TOKEN_ID = 'demo-token';
const LOG_LIMIT = 80;
const SOCKET_CONNECTION_TIMEOUT_MS = 12_000;

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

function getInitialServerUrl() {
  try {
    return localStorage.getItem(SERVER_URL_STORAGE_KEY) || DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
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

  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function buildHttpUrl(serverUrl, path) {
  return `${normalizeServerUrl(serverUrl)}${path.startsWith('/') ? path : `/${path}`}`;
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

export default function VttLab() {
  const [serverUrl, setServerUrl] = useState(getInitialServerUrl);
  const [hostToken, setHostToken] = useState('');
  const [roomName, setRoomName] = useState('Laboratório C.A.O.S.');
  const [roomId, setRoomId] = useState('');
  const [masterInviteToken, setMasterInviteToken] = useState('');
  const [playerInviteToken, setPlayerInviteToken] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
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
  const [logs, setLogs] = useState([]);
  const [lastError, setLastError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  const socketRef = useRef(null);
  const boardRef = useRef(null);
  const dragRef = useRef(null);
  const logSequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const requestControllerRef = useRef(null);
  const connectionTimerRef = useRef(null);

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

    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
      socket.close(1000, reason);
    }

    if (!mountedRef.current) return;
    setConnectionStatus('disconnected');
    setConnectedRole('');
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
      if (Number.isFinite(Number(message.revision))) setRevision(Number(message.revision));
      setBoardTokens(normalizeBoardTokens(message.state?.tokens));
      appendLog('in', messageType, 'Snapshot aplicado ao laboratório.');
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
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      const errorMessage = 'A conexão WebSocket encontrou um erro.';
      setConnectedRole('');
      setConnectionStatus('error');
      setLastError(errorMessage);
      appendLog('error', 'socket.error', errorMessage);
    });

    socket.addEventListener('close', (event) => {
      if (!mountedRef.current || socketRef.current !== socket) return;
      clearConnectionTimer();
      socketRef.current = null;
      dragRef.current = null;
      setConnectedRole('');
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
      connectionTimerRef.current = null;
      socket.close(1000, 'Tempo limite de conexão');
      const errorMessage = 'O servidor não concluiu a conexão em 12 segundos.';
      setConnectedRole('');
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
      const response = await fetch(buildHttpUrl(normalizedServerUrl, '/api/vtt/rooms'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hostToken.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: roomName.trim() }),
        signal: requestController.signal,
      });
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
      const response = await fetch(buildHttpUrl(
        normalizedServerUrl,
        `/api/vtt/rooms/${encodeURIComponent(roomId.trim())}/tickets`,
      ), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${inviteToken}`,
        },
        signal: requestController.signal,
      });
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
      openSocket(normalizedServerUrl, roomId.trim(), String(data.ticket), String(data.role));
    } catch (error) {
      if (error.name === 'AbortError' || !mountedRef.current) return;
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
      if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        socket.close(1000, 'Laboratório desmontado');
      }
    };
  }, [clearConnectionTimer]);

  const isConnected = connectionStatus === 'connected';
  const canDisconnect = isConnected || connectionStatus === 'connecting';
  const controlsLocked = Boolean(busyAction) || canDisconnect;
  const operationLabel = busyAction === 'create'
    ? 'Criando sala'
    : (busyAction.startsWith('connect-') ? 'Solicitando ticket' : '');
  const statusLabel = operationLabel || STATUS_LABELS[connectionStatus] || connectionStatus;
  const statusVisualState = operationLabel ? 'working' : connectionStatus;

  return (
    <main className="vtt-lab" aria-labelledby="vtt-lab-title">
      <header className="vtt-lab__header">
        <div>
          <span className="vtt-lab__eyebrow">C.A.O.S. · experimento isolado</span>
          <h1 id="vtt-lab-title">Laboratório VTT portátil</h1>
          <p>Validação REST + WebSocket sem canvas, Firebase ou rolagens automáticas.</p>
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

      <div className="vtt-lab__layout">
        <aside className="vtt-lab__control-column" aria-label="Conexão do laboratório">
          <section className="vtt-lab__panel">
            <div className="vtt-lab__panel-heading">
              <div>
                <span>Endpoint</span>
                <h2>Servidor Python</h2>
              </div>
              <span className="vtt-lab__safe-chip">URL local</span>
            </div>

            <label className="vtt-lab__field" htmlFor="vtt-lab-server-url">
              <span>URL do servidor</span>
              <input
                id="vtt-lab-server-url"
                type="url"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                onBlur={persistServerUrl}
                placeholder={DEFAULT_SERVER_URL}
                autoComplete="url"
                spellCheck="false"
                disabled={controlsLocked}
              />
              <small>Somente esta URL é salva no navegador.</small>
            </label>
          </section>

          <section className="vtt-lab__panel">
            <div className="vtt-lab__panel-heading">
              <div>
                <span>Etapa 1</span>
                <h2>Criar sala</h2>
              </div>
            </div>

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
                {busyAction === 'create' ? 'Criando...' : 'Criar sala'}
              </button>
            </form>
          </section>

          <section className="vtt-lab__panel">
            <div className="vtt-lab__panel-heading">
              <div>
                <span>Etapa 2</span>
                <h2>Entrar na sala</h2>
              </div>
              <button type="button" className="vtt-lab__text-button" onClick={handleClearSecrets}>
                Limpar segredos
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
            </div>

            <p className="vtt-lab__security-note">
              O aplicativo não persiste host token, convites ou tickets. O navegador ainda pode
              oferecer recursos próprios de preenchimento.
            </p>
          </section>
        </aside>

        <section className="vtt-lab__workspace" aria-label="Área de teste do tabuleiro">
          <div className="vtt-lab__panel vtt-lab__board-panel">
            <div className="vtt-lab__panel-heading vtt-lab__board-heading">
              <div>
                <span>Etapa 3</span>
                <h2>Área 2D normalizada</h2>
              </div>
              <div className="vtt-lab__board-actions">
                <button type="button" onClick={handlePing} disabled={!isConnected}>Ping</button>
                <button type="button" onClick={handleDisconnect} disabled={!canDisconnect}>Desconectar</button>
              </div>
            </div>

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
