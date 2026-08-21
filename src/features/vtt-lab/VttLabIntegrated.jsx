import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { FichaProvider } from '../../contexts/FichaContext.jsx';
import { db } from '../../lib/firebase.js';
import { vincularVttMesa } from '../../lib/vtt-mesa-link.js';
import { normalizeVttServerOrigin, readVttLaunchContext } from '../../lib/vtt-link.js';
import { requestMesaVttAccess } from '../../lib/vtt-mesa-access.js';
import {
  clampVttCharacterField,
  normalizeVttCharacterSheets,
  VTT_CHARACTER_MONITOR_FIELDS,
} from '../../lib/vtt-character-monitor.js';
import VttLab from './VttLab.jsx';

const Ficha = lazy(() => import('../../pages/Ficha/index.jsx'));

const DEV_VTT_MEMBERS = [
  { uid: 'dev-rafael', name: 'Rafael Nunes' },
  { uid: 'dev-helena', name: 'Helena Vargas' },
];

const DEV_VTT_CHARACTER_SHEETS = normalizeVttCharacterSheets([
  {
    uid: 'dev-rafael',
    data: {
      info: { nome: 'Rafael Nunes', classe: 'Combatente', nex: '20%' },
      recursos: { pv_atual: 31, pv_max: 38, pe_atual: 8, pe_max: 12, san_atual: 17, san_max: 24 },
      perseguicao: { sucessos: 2, falhas: 1, metaSucessos: 5, metaFalhas: 3 },
      condicoesEfetivas: ['machucado'],
    },
  },
  {
    uid: 'dev-helena',
    data: {
      info: { nome: 'Helena Vargas', classe: 'Especialista', nex: '20%' },
      recursos: { pv_atual: 21, pv_max: 26, pe_atual: 13, pe_max: 16, san_atual: 26, san_max: 32 },
      perseguicao: { sucessos: 1, falhas: 0, metaSucessos: 5, metaFalhas: 3 },
      condicoesEfetivas: ['perturbado'],
    },
  },
]);

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
  const [characterSheets, setCharacterSheets] = useState(
    () => (devVisualMode ? DEV_VTT_CHARACTER_SHEETS : []),
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
      setCharacterSheets(DEV_VTT_CHARACTER_SHEETS);
      return undefined;
    }
    if (!canEditServerUrl || !launchContext.mesaId) {
      setCharacterSheets([]);
      return undefined;
    }
    const unsubscribe = onSnapshot(
      collection(db, 'mesas', launchContext.mesaId, 'personagens'),
      (snapshot) => setCharacterSheets(normalizeVttCharacterSheets(
        snapshot.docs.map((item) => ({ uid: item.id, data: item.data() })),
      )),
      () => setCharacterSheets([]),
    );
    return unsubscribe;
  }, [canEditServerUrl, devVisualMode, launchContext.mesaId]);

  const updateCharacterSheetField = useCallback(async (uid, field, value) => {
    const normalizedUid = String(uid || '').trim();
    const sheet = characterSheets.find((item) => item.uid === normalizedUid) || null;
    if (!normalizedUid || !sheet || !VTT_CHARACTER_MONITOR_FIELDS.has(field)) {
      throw new Error('Ficha ou campo de monitoramento inválido.');
    }
    const nextValue = clampVttCharacterField(field, value, sheet);

    if (devVisualMode) {
      setCharacterSheets((current) => current.map((item) => {
        if (item.uid !== normalizedUid) return item;
        if (field.startsWith('recursos.')) {
          const resourceKey = field.split('.')[1].split('_')[0];
          return {
            ...item,
            resources: {
              ...item.resources,
              [resourceKey]: { ...item.resources[resourceKey], current: nextValue },
            },
          };
        }
        const pursuitKey = field.endsWith('sucessos') ? 'successes' : 'failures';
        return { ...item, pursuit: { ...item.pursuit, [pursuitKey]: nextValue } };
      }));
      return;
    }

    if (!canEditServerUrl || !launchContext.mesaId) {
      throw new Error('Somente o mestre pode alterar o monitor dos agentes.');
    }
    await updateDoc(
      doc(db, 'mesas', launchContext.mesaId, 'personagens', normalizedUid),
      { [field]: nextValue },
    );
  }, [canEditServerUrl, characterSheets, devVisualMode, launchContext.mesaId]);

  const characterSheetUids = useMemo(
    () => characterSheets.map((item) => item.uid),
    [characterSheets],
  );

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
    characterSheets,
    updateCharacterSheetField,
  }), [
    canEditServerUrl,
    characterSheetUids,
    characterSheets,
    devVisualMode,
    launchContext.mesaId,
    members,
    resolvedOrigin,
    usuario,
    updateCharacterSheetField,
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
