import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db } from '../../lib/firebase.js';
import { vincularVttMesa } from '../../lib/vtt-mesa-link.js';
import { normalizeVttServerOrigin, readVttLaunchContext } from '../../lib/vtt-link.js';
import VttLab from './VttLab.jsx';

export default function VttLabIntegrated() {
  const { usuario, devVisualMode } = useAuth();
  const launchContext = useMemo(
    () => readVttLaunchContext(globalThis.location?.search || ''),
    [],
  );
  const [resolvedOrigin, setResolvedOrigin] = useState('');
  const [canEditServerUrl, setCanEditServerUrl] = useState(false);
  const [originReady, setOriginReady] = useState(
    () => devVisualMode || !launchContext.mesaId,
  );

  useEffect(() => {
    if (devVisualMode || !launchContext.mesaId) return undefined;

    let active = true;
    void getDoc(doc(db, 'mesas', launchContext.mesaId))
      .then((snapshot) => {
        if (!active || !snapshot.exists()) return;
        const mesa = snapshot.data();
        const origin = normalizeVttServerOrigin(mesa?.vtt?.serverOrigin);
        setCanEditServerUrl(mesa?.mestre === usuario?.uid);
        if (origin) setResolvedOrigin(origin);
      })
      .catch(() => {
        // A leitura serve apenas para recuperar a origem. A autorização real
        // continua sendo feita pelo backend com o token Firebase.
      })
      .finally(() => {
        if (active) setOriginReady(true);
      });

    return () => {
      active = false;
    };
  }, [devVisualMode, launchContext.mesaId, usuario?.uid]);

  const getIdToken = useCallback(async () => {
    if (!usuario || typeof usuario.getIdToken !== 'function') {
      throw new Error('Sua sessão não pode autenticar o VTT. Entre novamente na conta.');
    }
    return usuario.getIdToken(true);
  }, [usuario]);

  const automaticAccess = useMemo(() => ({
    enabled: Boolean(launchContext.mesaId) && !devVisualMode,
    getIdToken,
    initialServerUrl: resolvedOrigin,
    autoStart: Boolean(resolvedOrigin),
    canEditServerUrl,
  }), [canEditServerUrl, devVisualMode, getIdToken, launchContext.mesaId, resolvedOrigin]);

  if (!devVisualMode && launchContext.mesaId && !originReady) {
    return (
      <main className="vtt-lab" aria-busy="true" aria-live="polite">
        <header className="vtt-lab__header">
          <div>
            <span className="vtt-lab__eyebrow">C.A.O.S. · acesso pela Mesa</span>
            <h1>Preparando mesa virtual</h1>
            <p>Recuperando o endereço seguro do servidor VTT...</p>
          </div>
        </header>
      </main>
    );
  }

  return (
    <VttLab
      automaticAccess={automaticAccess}
      onPersistLinkedRoom={vincularVttMesa}
    />
  );
}
