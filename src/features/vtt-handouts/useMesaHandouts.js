import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import {
  normalizeVttMesaId,
  normalizeVttRoomId,
  normalizeVttServerOrigin,
} from '../../lib/vtt-link.js';
import { VTT_INTEGRATED_SESSION_REFRESH_MS } from '../../lib/vtt-session.js';
import { projectMesaHandoutSnapshot } from './mesa-handouts.js';

const REQUEST_TIMEOUT_MS = 12_000;
const SOCKET_TIMEOUT_MS = 12_000;
const VALID_ROLES = new Set(['master', 'player']);

const EMPTY_VIEW = Object.freeze({
  deliveredHandouts: [],
  handoutCatalog: [],
  masterReferences: [],
});

function createCommandId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `cmd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildWebSocketUrl(serverOrigin, roomId, ticket) {
  const url = new URL(
    `/ws/vtt/rooms/${encodeURIComponent(roomId)}`,
    `${serverOrigin}/`,
  );
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

function closeOpenSocket(socket, reason) {
  if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
    socket.close(1000, reason);
  }
}

export function useMesaHandouts({
  mesaId,
  serverOrigin,
  enabled = true,
} = {}) {
  const { usuario } = useAuth();
  const normalizedMesaId = normalizeVttMesaId(mesaId);
  const normalizedServerOrigin = normalizeVttServerOrigin(serverOrigin);
  const [status, setStatus] = useState(enabled ? 'disconnected' : 'idle');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState(EMPTY_VIEW);

  const socketRef = useRef(null);
  const requestControllerRef = useRef(null);
  const socketTimerRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const grantRef = useRef(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);

  const clearSocketTimer = useCallback(() => {
    if (socketTimerRef.current !== null) {
      globalThis.clearTimeout(socketTimerRef.current);
      socketTimerRef.current = null;
    }
  }, []);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      globalThis.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const clearSession = useCallback((reason = 'Sessão substituída') => {
    generationRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    clearSocketTimer();
    clearRefreshTimer();
    const socket = socketRef.current;
    socketRef.current = null;
    grantRef.current = null;
    closeOpenSocket(socket, reason);
  }, [clearRefreshTimer, clearSocketTimer]);

  const fail = useCallback((message) => {
    if (!mountedRef.current) return;
    setStatus('error');
    setRole('');
    setError(message);
    setRevision(0);
    setView(EMPTY_VIEW);
  }, []);

  const connect = useCallback(async () => {
    clearSession('Nova autenticação da Mesa');
    const generation = generationRef.current;

    if (!enabled) {
      if (mountedRef.current) {
        setStatus('idle');
        setRole('');
        setError('');
        setRevision(0);
        setView(EMPTY_VIEW);
      }
      return false;
    }
    if (!normalizedMesaId) {
      fail('A Mesa informada não é válida.');
      return false;
    }
    if (!normalizedServerOrigin) {
      fail('O servidor VTT desta Mesa ainda não foi configurado.');
      return false;
    }
    if (!usuario || typeof usuario.getIdToken !== 'function') {
      fail('Sua sessão não pode autenticar os documentos da Mesa. Entre novamente na conta.');
      return false;
    }

    const requestController = new AbortController();
    requestControllerRef.current = requestController;
    if (mountedRef.current) {
      setStatus('connecting');
      setRole('');
      setError('');
      setRevision(0);
      setView(EMPTY_VIEW);
    }

    let requestTimedOut = false;
    const requestTimer = globalThis.setTimeout(() => {
      requestTimedOut = true;
      requestController.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const idToken = String(await usuario.getIdToken(true)).trim();
      if (!idToken) throw new Error('A sessão Firebase não forneceu uma credencial válida.');
      if (requestController.signal.aborted) {
        if (requestTimedOut) throw new Error('O servidor não respondeu em 12 segundos.');
        return false;
      }

      const response = await fetch(`${normalizedServerOrigin}/api/vtt/mesa-access`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mesaId: normalizedMesaId }),
        signal: requestController.signal,
      });
      const data = await readJsonResponse(response);

      if (
        !mountedRef.current
        || requestController.signal.aborted
        || generationRef.current !== generation
      ) return false;

      const roomId = normalizeVttRoomId(data.roomId);
      const nextRole = String(data.role || '');
      const ticket = String(data.ticket || '').trim();
      const mediaToken = String(data.mediaToken || '').trim();
      if (!roomId || !ticket || !mediaToken || !VALID_ROLES.has(nextRole)) {
        throw new Error('A resposta de acesso aos documentos está incompleta.');
      }

      const grant = {
        serverOrigin: normalizedServerOrigin,
        roomId,
        mediaToken,
        role: nextRole,
      };
      grantRef.current = grant;
      setRole(nextRole);
      setRevision(Number.isFinite(Number(data.revision)) ? Number(data.revision) : 0);

      const socket = new WebSocket(buildWebSocketUrl(
        normalizedServerOrigin,
        roomId,
        ticket,
      ));
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        if (!mountedRef.current || socketRef.current !== socket) return;
        clearSocketTimer();
        setStatus('connected');
        setError('');
      });

      socket.addEventListener('message', (event) => {
        if (!mountedRef.current || socketRef.current !== socket) return;
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          setError('O servidor enviou uma resposta inválida.');
          return;
        }

        if (message?.type === 'room.snapshot') {
          const currentGrant = grantRef.current;
          if (!currentGrant) return;
          setRevision(Number.isFinite(Number(message.revision)) ? Number(message.revision) : 0);
          setView(projectMesaHandoutSnapshot(message.state, currentGrant));
          return;
        }

        if (message?.type === 'error' || String(message?.type || '').endsWith('.error')) {
          setError(String(
            message.error?.message
            || message.detail
            || message.message
            || 'O servidor não conseguiu concluir a operação.',
          ));
        }
      });

      socket.addEventListener('error', () => {
        if (!mountedRef.current || socketRef.current !== socket) return;
        clearSocketTimer();
        socketRef.current = null;
        grantRef.current = null;
        closeOpenSocket(socket, 'Erro de conexão');
        fail('A conexão com os documentos da Mesa encontrou um erro.');
      });

      socket.addEventListener('close', (event) => {
        if (!mountedRef.current || socketRef.current !== socket) return;
        clearSocketTimer();
        socketRef.current = null;
        grantRef.current = null;
        if (event.code === 1000) {
          setStatus('disconnected');
          setRole('');
          setRevision(0);
          setView(EMPTY_VIEW);
          return;
        }
        fail(`A conexão com os documentos foi encerrada (código ${event.code}).`);
      });

      socketTimerRef.current = globalThis.setTimeout(() => {
        if (!mountedRef.current || socketRef.current !== socket || socket.readyState === WebSocket.OPEN) {
          return;
        }
        socketRef.current = null;
        grantRef.current = null;
        socketTimerRef.current = null;
        closeOpenSocket(socket, 'Tempo limite de conexão');
        fail('O servidor não concluiu a conexão em 12 segundos.');
      }, SOCKET_TIMEOUT_MS);
      return true;
    } catch (caughtError) {
      if (
        generationRef.current !== generation
        || !mountedRef.current
        || (caughtError?.name === 'AbortError' && !requestTimedOut)
      ) return false;
      const message = requestTimedOut
        ? 'O servidor não respondeu em 12 segundos.'
        : (caughtError instanceof Error
          ? caughtError.message
          : 'Não foi possível acessar os documentos desta Mesa.');
      fail(message);
      return false;
    } finally {
      globalThis.clearTimeout(requestTimer);
      if (requestControllerRef.current === requestController) {
        requestControllerRef.current = null;
      }
    }
  }, [
    clearSession,
    clearSocketTimer,
    enabled,
    fail,
    normalizedMesaId,
    normalizedServerOrigin,
    usuario,
  ]);

  const reconnect = useCallback(() => connect(), [connect]);

  const sendHandoutCommand = useCallback((type, assetId) => {
    const normalizedAssetId = String(assetId || '').trim();
    const socket = socketRef.current;
    if (grantRef.current?.role !== 'master') {
      setError('Apenas o Mestre pode entregar ou recolher documentos.');
      return false;
    }
    if (!normalizedAssetId) {
      setError('Selecione um documento válido.');
      return false;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('Conecte os documentos da Mesa antes de alterar uma entrega.');
      return false;
    }

    try {
      socket.send(JSON.stringify({
        type,
        commandId: createCommandId(),
        payload: { assetId: normalizedAssetId },
      }));
      setError('');
      return true;
    } catch {
      setError('Não foi possível enviar a alteração ao servidor.');
      return false;
    }
  }, []);

  const deliverHandout = useCallback(
    (assetId) => sendHandoutCommand('handout.deliver', assetId),
    [sendHandoutCommand],
  );
  const revokeHandout = useCallback(
    (assetId) => sendHandoutCommand('handout.revoke', assetId),
    [sendHandoutCommand],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSession('Visualização de documentos encerrada');
    };
  }, [clearSession]);

  useEffect(() => {
    const timeoutId = globalThis.setTimeout(() => {
      void connect();
    }, 0);
    return () => globalThis.clearTimeout(timeoutId);
  }, [connect]);

  useEffect(() => {
    clearRefreshTimer();
    if (status !== 'connected') return undefined;
    refreshTimerRef.current = globalThis.setTimeout(() => {
      refreshTimerRef.current = null;
      void reconnect();
    }, VTT_INTEGRATED_SESSION_REFRESH_MS);
    return clearRefreshTimer;
  }, [clearRefreshTimer, reconnect, status]);

  return {
    status,
    role,
    error,
    revision,
    deliveredHandouts: view.deliveredHandouts,
    handoutCatalog: view.handoutCatalog,
    masterReferences: view.masterReferences,
    deliverHandout,
    revokeHandout,
    reconnect,
  };
}

export default useMesaHandouts;
