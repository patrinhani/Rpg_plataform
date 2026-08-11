import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { FichaProvider } from '../../contexts/FichaContext.jsx';
import { db } from '../../lib/firebase.js';
import { vincularVttMesa } from '../../lib/vtt-mesa-link.js';
import { normalizeVttServerOrigin, readVttLaunchContext } from '../../lib/vtt-link.js';
import { requestMesaVttAccess } from '../../lib/vtt-mesa-access.js';
import VttLab from './VttLab.jsx';

const Ficha = lazy(() => import('../../pages/Ficha/index.jsx'));

const DEV_VTT_MEMBERS = [
  { uid: 'dev-rafael', name: 'Rafael Nunes' },
  { uid: 'dev-helena', name: 'Helena Vargas' },
];

function normalizeMesaPlayers(mesa) {
  const masterUid = String(mesa?.mestre || '').trim();
  const seen = new Set();
  return (Array.isArray(mesa?.jogadores) ? mesa.jogadores : [])
    .map((member) => ({
      uid: String(member?.uid || '').trim(),
      name: String(member?.nome || '').trim() || 'Agente',
    }))
    .filter((member) => (
      member.uid
      && member.uid !== masterUid
      && !seen.has(member.uid)
      && seen.add(member.uid)
    ));
}

export default function VttLabIntegrated() {
  const { usuario, devVisualMode } = useAuth();
  const launchContext = useMemo(
    () => readVttLaunchContext(globalThis.location?.search || ''),
    [],
  );
  const [resolvedOrigin, setResolvedOrigin] = useState('');
  const [canEditServerUrl, setCanEditServerUrl] = useState(false);
  const [members, setMembers] = useState(() => (devVisualMode ? DEV_VTT_MEMBERS : []));
  const [characterSheetUids, setCharacterSheetUids] = useState(
    () => (devVisualMode ? DEV_VTT_MEMBERS.map((member) => member.uid) : []),
  );
  const [activeCharacterSheetUid, setActiveCharacterSheetUid] = useState('');
  const [originReady, setOriginReady] = useState(
    () => devVisualMode || !launchContext.mesaId,
  );

  useEffect(() => {
    if (devVisualMode || !launchContext.mesaId) return undefined;

    let firstSnapshotResolved = false;
    const markOriginReady = () => {
      if (firstSnapshotResolved) return;
      firstSnapshotResolved = true;
      setOriginReady(true);
    };
    const unsubscribe = onSnapshot(
      doc(db, 'mesas', launchContext.mesaId),
      (snapshot) => {
        if (!snapshot.exists()) {
          markOriginReady();
          return;
        }
        const mesa = snapshot.data();
        const origin = normalizeVttServerOrigin(mesa?.vtt?.serverOrigin);
        setCanEditServerUrl(mesa?.mestre === usuario?.uid);
        setMembers(normalizeMesaPlayers(mesa));
        if (origin) setResolvedOrigin(origin);
        markOriginReady();
      },
      () => {
        // A leitura serve apenas para recuperar a origem. A autorização real
        // continua sendo feita pelo grant curto validado no Firestore.
        markOriginReady();
      },
    );

    return unsubscribe;
  }, [devVisualMode, launchContext.mesaId, usuario?.uid]);

  useEffect(() => {
    if (devVisualMode) {
      setCharacterSheetUids(DEV_VTT_MEMBERS.map((member) => member.uid));
      return undefined;
    }
    if (!canEditServerUrl || !launchContext.mesaId) {
      setCharacterSheetUids([]);
      return undefined;
    }
    const unsubscribe = onSnapshot(
      collection(db, 'mesas', launchContext.mesaId, 'personagens'),
      (snapshot) => setCharacterSheetUids(snapshot.docs.map((item) => item.id)),
      () => setCharacterSheetUids([]),
    );
    return unsubscribe;
  }, [canEditServerUrl, devVisualMode, launchContext.mesaId]);

  useEffect(() => {
    if (
      activeCharacterSheetUid
      && !characterSheetUids.includes(activeCharacterSheetUid)
    ) {
      setActiveCharacterSheetUid('');
    }
  }, [activeCharacterSheetUid, characterSheetUids]);

  const automaticAccess = useMemo(() => ({
    enabled: Boolean(launchContext.mesaId) && !devVisualMode,
    requestAccess: ({ mesaId, serverOrigin, signal }) => requestMesaVttAccess({
      mesaId,
      serverOrigin,
      usuario,
      signal,
    }),
    initialServerUrl: resolvedOrigin,
    autoStart: Boolean(resolvedOrigin),
    canEditServerUrl,
    members,
    characterSheetUids,
  }), [
    canEditServerUrl,
    characterSheetUids,
    devVisualMode,
    launchContext.mesaId,
    members,
    resolvedOrigin,
    usuario,
  ]);
  const sheetIsOpen = Boolean(
    activeCharacterSheetUid
    && characterSheetUids.includes(activeCharacterSheetUid),
  );

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
    <>
      <div
        className="vtt-integrated-session"
        aria-hidden={sheetIsOpen ? true : undefined}
        inert={sheetIsOpen ? true : undefined}
      >
        <VttLab
          automaticAccess={automaticAccess}
          onOpenCharacterSheet={(uid) => {
            const normalizedUid = String(uid || '').trim();
            if (
              normalizedUid
              && characterSheetUids.includes(normalizedUid)
            ) {
              setActiveCharacterSheetUid(normalizedUid);
            }
          }}
          onPersistLinkedRoom={vincularVttMesa}
        />
      </div>

      {sheetIsOpen && (
        <div className="vtt-integrated-sheet-overlay">
          <Suspense fallback={<div className="ficha-loading" role="status">Abrindo ficha...</div>}>
            <FichaProvider>
              <div className="mesa-ficha-shell">
                <Ficha
                  fichaId={activeCharacterSheetUid}
                  mesaContexto={launchContext.mesaId}
                  onBack={() => setActiveCharacterSheetUid('')}
                />
              </div>
            </FichaProvider>
          </Suspense>
        </div>
      )}
    </>
  );
}
