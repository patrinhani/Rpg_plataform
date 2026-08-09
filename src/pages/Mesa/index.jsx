import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../lib/firebase.js';
import { criarIdEntidadeMesa, removerParticipanteDaIniciativa } from '../../lib/mesa-utils.js';
import {
  buildVttLaunchPath,
  normalizeVttRoomId,
  normalizeVttServerOrigin,
} from '../../lib/vtt-link.js';
import {
  adicionarMonstroIniciativa,
  adicionarNPCIniciativa,
  alternarCombate,
  atualizarIniciativa,
  atualizarNomeMesa,
  importarPersonagemParaMesa,
  listarPersonagensPessoais,
  removerJogadorDaMesa,
  vincularVttMesa,
} from '../../lib/mesas.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { FichaProvider } from '../../contexts/FichaContext.jsx';
import ElementRail from '../../components/ElementRail.jsx';
import ModalBase from '../../components/ModalBase.jsx';
import HandoutEvidencePanel from '../../components/handouts/HandoutEvidencePanel.jsx';
import { AppIcon } from '../../components/icons/NavigationIcons.jsx';
import FichaCriatura from '../../components/mesa/FichaCriatura.jsx';
import IniciativaTracker from '../../components/mesa/IniciativaTracker.jsx';
import { useMesaHandouts } from '../../features/vtt-handouts/useMesaHandouts.js';
import Ficha from '../Ficha/index.jsx';
import '../../styles/mesa.css';

const DEV_AGENTES = [
  { uid: 'dev-rafael', nome: 'Rafael Nunes' },
  { uid: 'dev-helena', nome: 'Helena Vargas' },
];

const DEV_FICHAS = [
  {
    uid: 'dev-rafael',
    info: {
      nome: 'Rafael Nunes',
      classe: 'Ocultista',
      nex: '25%',
      foto: '/assets/images/optimized/CharacterMorte-640.webp',
    },
    recursos: { pv_atual: 28, pv_max: 36 },
  },
  {
    uid: 'dev-helena',
    info: {
      nome: 'Helena Vargas',
      classe: 'Combatente',
      nex: '60%',
      foto: '/assets/images/optimized/CharacterSangue-640.webp',
    },
    recursos: { pv_atual: 54, pv_max: 72 },
  },
];

function ordenarIniciativas(iniciativas) {
  return [...iniciativas].sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));
}

function normalizarBusca(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function slugElemento(valor) {
  return normalizarBusca(valor).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getBestiaryThumbnail(foto) {
  return typeof foto === 'string' && foto.startsWith('/assets/bestiario/')
    ? foto.replace('/assets/bestiario/', '/assets/bestiario/thumbs/')
    : foto;
}

export default function Mesa() {
  const { mesaId } = useParams();
  const navigate = useNavigate();
  const { usuario, devVisualMode } = useAuth();
  const { showAlert, showConfirm, showPrompt } = useDialog();

  const [mesaData, setMesaData] = useState(null);
  const [fichasDaMesa, setFichasDaMesa] = useState([]);
  const [fichaAbertaId, setFichaAbertaId] = useState(null);
  const [showTrackerModal, setShowTrackerModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBestiarioModal, setShowBestiarioModal] = useState(false);
  const [listaBestiario, setListaBestiario] = useState(null);
  const [bestiarioLoading, setBestiarioLoading] = useState(false);
  const [criaturaSelecionada, setCriaturaSelecionada] = useState(null);
  const [minhasFichas, setMinhasFichas] = useState([]);
  const [buscaBestiario, setBuscaBestiario] = useState('');
  const [filtroElemento, setFiltroElemento] = useState('todos');
  const [agenteIniUid, setAgenteIniUid] = useState('');
  const [agenteIniValor, setAgenteIniValor] = useState('');
  const [npcNome, setNpcNome] = useState('');
  const [npcIni, setNpcIni] = useState('');
  const [npcPV, setNpcPV] = useState(20);
  const [actionBusy, setActionBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [codigoCopiado, setCodigoCopiado] = useState(false);

  const parallaxRef = useRef(null);
  const busyRef = useRef(false);
  const encerrandoRef = useRef(false);
  const copyTimerRef = useRef(null);
  const bestiarySearchRef = useRef(null);
  const importFirstItemRef = useRef(null);

  const sairDaMesa = useCallback(() => navigate('/'), [navigate]);

  const executarAcao = useCallback(async (chave, acao, mensagemErro) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setActionBusy(chave);
    setActionError('');

    try {
      await acao();
      return true;
    } catch (error) {
      console.error(mensagemErro, error);
      setActionError(mensagemErro);
      return false;
    } finally {
      busyRef.current = false;
      setActionBusy('');
    }
  }, []);

  const notificarESair = useCallback(async (mensagem, titulo) => {
    if (encerrandoRef.current) return;
    encerrandoRef.current = true;
    await showAlert(mensagem, titulo);
    sairDaMesa();
  }, [sairDaMesa, showAlert]);

  const mestreUidDaMesa = mesaData?.mestre;

  useEffect(() => {
    if (fichaAbertaId) return;
    document.title = mesaData?.nome
      ? `C.A.O.S — ${mesaData.nome}`
      : 'C.A.O.S — Mesa';
  }, [fichaAbertaId, mesaData?.nome]);

  useEffect(() => () => {
    if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
  }, []);

  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!finePointer.matches) return undefined;

    let frameId = null;
    const handlePointerMove = (event) => {
      if (!parallaxRef.current || document.body.classList.contains('modo-economia')) return;
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const x = (window.innerWidth - event.clientX * 2) / 45;
        const y = (window.innerHeight - event.clientY * 2) / 45;
        parallaxRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    if (!mesaId || !usuario?.uid) return undefined;

    if (devVisualMode) {
      const jogadores = [
        { uid: usuario.uid, nome: usuario.displayName || 'Codex Visual' },
        ...DEV_AGENTES,
      ];
      setMesaData({
        nome: 'Operação Convergência',
        mestre: usuario.uid,
        jogadores,
        emCombate: true,
        rodada: 3,
        turnoAtual: 0,
        iniciativas: ordenarIniciativas([
          { uid: 'dev-helena', nome: 'Helena Vargas', valor: 18, isNPC: false },
          {
            uid: 'dev-criatura',
            nome: 'Aberração de Carne',
            valor: 14,
            isNPC: true,
            isMonster: true,
            pv_atual: 70,
            pv_max: 70,
            fichaCompleta: {
              nome: 'Aberração de Carne',
              elemento: 'Sangue',
              vd: 40,
              tipo: 'Criatura — Grande',
              foto: '/assets/bestiario/aberracao.webp',
              pv_atual: 70,
              pv_max: 70,
              atributos: { agi: 1, for: 3, int: 0, pre: 1, vig: 3 },
              acoes: [{ nome: 'Pancada', descricao: 'Ataque corpo a corpo. Resultado definido com dados físicos.' }],
            },
          },
          { uid: 'dev-rafael', nome: 'Rafael Nunes', valor: 11, isNPC: false },
        ]),
      });
      return undefined;
    }

    const unsubscribe = onSnapshot(doc(db, 'mesas', mesaId), (snapshot) => {
      if (!snapshot.exists()) {
        void notificarESair('Esta mesa foi excluída ou não existe.', 'Erro');
        return;
      }

      const data = snapshot.data();
      const jogadores = Array.isArray(data.jogadores) ? data.jogadores : [];
      if (!jogadores.some((jogador) => jogador.uid === usuario.uid)) {
        void notificarESair('Você foi removido desta mesa.', 'Aviso');
        return;
      }
      setMesaData({ ...data, jogadores });
    }, (error) => {
      console.error('Erro ao carregar mesa:', error);
      void notificarESair('Erro de permissão ou conexão ao carregar a mesa.', 'Erro');
    });

    return unsubscribe;
  }, [devVisualMode, mesaId, notificarESair, usuario]);

  useEffect(() => {
    if (!mesaId || !usuario?.uid) return undefined;

    if (devVisualMode) {
      setFichasDaMesa(DEV_FICHAS);
      return undefined;
    }

    if (!mestreUidDaMesa) return undefined;

    setFichasDaMesa([]);

    if (mestreUidDaMesa !== usuario.uid) {
      const unsubscribe = onSnapshot(
        doc(db, 'mesas', mesaId, 'personagens', usuario.uid),
        (snapshot) => {
          setFichasDaMesa(snapshot.exists()
            ? [{ uid: snapshot.id, ...snapshot.data() }]
            : []);
        },
        (error) => {
          console.error('Erro ao sincronizar sua ficha da mesa:', error);
          setActionError('Não foi possível sincronizar sua ficha desta mesa.');
        },
      );

      return unsubscribe;
    }

    const unsubscribe = onSnapshot(
      collection(db, 'mesas', mesaId, 'personagens'),
      (snapshot) => {
        setFichasDaMesa(snapshot.docs.map((documento) => ({ uid: documento.id, ...documento.data() })));
      },
      (error) => {
        console.error('Erro ao sincronizar fichas da mesa:', error);
        setActionError('Não foi possível sincronizar as fichas desta mesa.');
      },
    );

    return unsubscribe;
  }, [devVisualMode, mesaId, mestreUidDaMesa, usuario?.uid]);

  const jogadores = useMemo(
    () => (Array.isArray(mesaData?.jogadores) ? mesaData.jogadores : []),
    [mesaData?.jogadores],
  );
  const souMestre = mestreUidDaMesa === usuario?.uid;
  const emCombate = Boolean(mesaData?.emCombate);
  const isFichaOpen = Boolean(fichaAbertaId);
  const handoutSession = useMesaHandouts({
    mesaId,
    serverOrigin: mesaData?.vtt?.serverOrigin,
    enabled: Boolean(mesaData && (souMestre || isFichaOpen)),
  });
  const meuPersonagem = fichasDaMesa.find((ficha) => ficha.uid === usuario?.uid);
  const agentes = jogadores.filter((jogador) => jogador.uid !== mesaData?.mestre);
  const nomeJogadorAtual = jogadores.find((jogador) => jogador.uid === usuario?.uid)?.nome
    || usuario?.displayName
    || 'Agente';

  const abrirVtt = useCallback(() => {
    if (!mesaId || !mesaData) return;
    const campaignId = String(mesaData.vtt?.campaignId || 'caos-empty');
    const linkedRoomId = normalizeVttRoomId(mesaData.vtt?.roomId);
    const serverOrigin = normalizeVttServerOrigin(mesaData.vtt?.serverOrigin);
    if (!souMestre && !serverOrigin) {
      setActionError('O mestre ainda precisa abrir o VTT e registrar o endereço do servidor desta mesa.');
      return;
    }
    const launchPath = buildVttLaunchPath({
      mesaId,
      campaignId,
      roomName: String(mesaData.nome || 'Mesa C.A.O.S.'),
      roomId: linkedRoomId,
    });
    window.open(launchPath, '_blank', 'noopener,noreferrer');

    if (souMestre && !devVisualMode) {
      void executarAcao(
        'vtt-bind',
        () => vincularVttMesa(mesaId, campaignId, linkedRoomId, serverOrigin || undefined),
        'O VTT abriu, mas não foi possível registrar o vínculo desta mesa.',
      );
    }
  }, [devVisualMode, executarAcao, mesaData, mesaId, souMestre]);

  const elementosBestiario = useMemo(() => {
    if (!listaBestiario) return [];
    return [...new Set(listaBestiario.map((criatura) => criatura.elemento).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [listaBestiario]);

  const criaturasFiltradas = useMemo(() => {
    if (!listaBestiario) return [];
    const termo = normalizarBusca(buscaBestiario.trim());
    return listaBestiario.filter((criatura) => {
      const correspondeElemento = filtroElemento === 'todos'
        || normalizarBusca(criatura.elemento) === normalizarBusca(filtroElemento);
      const correspondeBusca = !termo
        || normalizarBusca(criatura.nome).includes(termo)
        || normalizarBusca(criatura.tipo).includes(termo);
      return correspondeElemento && correspondeBusca;
    });
  }, [buscaBestiario, filtroElemento, listaBestiario]);

  const carregarBestiario = async () => {
    if (bestiarioLoading) return;
    setBestiarioLoading(true);
    setActionError('');
    try {
      const modulo = await import('../../lib/bestiario.js');
      setListaBestiario(modulo.bestiario);
    } catch (error) {
      console.error('Erro ao carregar o bestiário:', error);
      setActionError('Não foi possível carregar o bestiário. Tente novamente.');
      setListaBestiario(null);
    } finally {
      setBestiarioLoading(false);
    }
  };

  const abrirBestiario = () => {
    setActionError('');
    setShowBestiarioModal(true);
    if (!listaBestiario) void carregarBestiario();
  };

  const handleCopiarCodigo = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API indisponível');
      await navigator.clipboard.writeText(mesaId);
      setCodigoCopiado(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCodigoCopiado(false), 2200);
    } catch (error) {
      console.error('Erro ao copiar código da mesa:', error);
      setActionError('Não foi possível copiar o código automaticamente. Selecione o código manualmente.');
    }
  };

  const handleEditarNome = async () => {
    if (!souMestre) return;
    const novoNome = await showPrompt('Novo nome da mesa:', 'Editar Mesa', 'Nome da Mesa', mesaData.nome);
    if (!novoNome?.trim()) return;

    if (devVisualMode) {
      setMesaData((atual) => ({ ...atual, nome: novoNome.trim() }));
      return;
    }

    await executarAcao(
      'nome',
      () => atualizarNomeMesa(mesaId, novoNome.trim()),
      'Não foi possível atualizar o nome da mesa.',
    );
  };

  const handleExpulsar = async (uid) => {
    const confirmado = await showConfirm('Tem certeza que deseja remover este jogador da mesa?', 'Expulsar Jogador');
    if (!confirmado) return;

    if (devVisualMode) {
      setMesaData((atual) => {
        const resultado = removerParticipanteDaIniciativa(
          atual.iniciativas,
          uid,
          atual.turnoAtual,
        );
        return {
          ...atual,
          jogadores: atual.jogadores.filter((jogador) => jogador.uid !== uid),
          iniciativas: resultado.iniciativas,
          turnoAtual: resultado.turnoAtual,
        };
      });
      setFichasDaMesa((atuais) => atuais.filter((ficha) => ficha.uid !== uid));
      return;
    }

    await executarAcao(
      `expulsar-${uid}`,
      () => removerJogadorDaMesa(mesaId, uid),
      'Não foi possível remover o jogador da mesa.',
    );
  };

  const toggleCombate = async () => {
    if (devVisualMode) {
      setMesaData((atual) => {
        const novoStatus = !atual.emCombate;
        return {
          ...atual,
          emCombate: novoStatus,
          iniciativas: novoStatus
            ? agentes.map((agente) => ({ ...agente, valor: 0, isNPC: false }))
            : [],
          turnoAtual: 0,
          rodada: 1,
        };
      });
      return;
    }

    await executarAcao(
      'combate',
      () => alternarCombate(mesaId, !emCombate, agentes),
      'Não foi possível alterar o estado do combate.',
    );
  };

  const registrarIniciativaAgente = async (event) => {
    event.preventDefault();
    if (!souMestre || agenteIniValor === '') return;
    const agente = agentes.find((item) => item.uid === agenteIniUid);
    if (!agente) return;
    const ficha = fichasDaMesa.find((item) => item.uid === agente.uid);
    const nomeExibicao = ficha?.info?.nome || agente.nome || 'Agente';

    if (devVisualMode) {
      setMesaData((atual) => ({
        ...atual,
        iniciativas: ordenarIniciativas([
          ...(atual.iniciativas || []).filter((item) => item.uid !== agente.uid),
          { uid: agente.uid, nome: nomeExibicao, valor: Number(agenteIniValor), isNPC: false },
        ]),
      }));
      setAgenteIniValor('');
      return;
    }

    const sucesso = await executarAcao(
      'iniciativa-agente',
      () => atualizarIniciativa(mesaId, agente.uid, nomeExibicao, agenteIniValor),
      `Não foi possível registrar a iniciativa de ${nomeExibicao}.`,
    );
    if (sucesso) setAgenteIniValor('');
  };

  const addNPC = async (event) => {
    event.preventDefault();
    if (!npcNome.trim() || npcIni === '') return;

    if (devVisualMode) {
      setMesaData((atual) => ({
        ...atual,
        iniciativas: ordenarIniciativas([
          ...(atual.iniciativas || []),
          {
            uid: criarIdEntidadeMesa('dev-npc'),
            nome: npcNome.trim(),
            valor: Number(npcIni),
            pv_atual: Number(npcPV),
            pv_max: Number(npcPV),
            isNPC: true,
          },
        ]),
      }));
      setNpcNome('');
      setNpcIni('');
      return;
    }

    const sucesso = await executarAcao(
      'npc',
      () => adicionarNPCIniciativa(mesaId, npcNome.trim(), npcIni, npcPV),
      'Não foi possível adicionar o NPC à iniciativa.',
    );
    if (sucesso) {
      setNpcNome('');
      setNpcIni('');
    }
  };

  const adicionarMonstro = async (monstro) => {
    const iniciativa = await showPrompt(
      `Informe o resultado físico da iniciativa de ${monstro.nome} (referência: ${monstro.iniciativa}):`,
      'Adicionar Criatura',
      'Resultado da iniciativa',
      '0',
    );
    if (iniciativa === null) return;

    if (devVisualMode) {
      setMesaData((atual) => ({
        ...atual,
        iniciativas: ordenarIniciativas([
          ...(atual.iniciativas || []),
          {
            uid: criarIdEntidadeMesa(`dev-monstro-${monstro.id}`),
            nome: monstro.nome,
            valor: Number(iniciativa || 0),
            pv_atual: monstro.pv_atual,
            pv_max: monstro.pv_max,
            isNPC: true,
            isMonster: true,
            fichaCompleta: monstro,
          },
        ]),
      }));
      setShowBestiarioModal(false);
      return;
    }

    const sucesso = await executarAcao(
      `monstro-${monstro.id}`,
      () => adicionarMonstroIniciativa(mesaId, monstro, iniciativa || '0'),
      `Não foi possível adicionar ${monstro.nome} à iniciativa.`,
    );
    if (sucesso) setShowBestiarioModal(false);
  };

  const abrirImportacao = async () => {
    setActionError('');
    if (devVisualMode) {
      setMinhasFichas(DEV_FICHAS.map((ficha, index) => ({
        id: `dev-import-${index}`,
        nome: ficha.info.nome,
        classe: ficha.info.classe,
        nex: ficha.info.nex,
        dadosCompletos: ficha,
      })));
      setShowImportModal(true);
      return;
    }

    const sucesso = await executarAcao(
      'listar-fichas',
      async () => setMinhasFichas(await listarPersonagensPessoais(usuario.uid)),
      'Não foi possível carregar suas fichas pessoais.',
    );
    if (sucesso) setShowImportModal(true);
  };

  const confirmarImportacao = async (dadosFicha) => {
    const nomeFicha = dadosFicha?.info?.nome || 'Sem nome';
    const confirmado = await showConfirm(`Importar "${nomeFicha}" para esta mesa?`, 'Importar Personagem');
    if (!confirmado) return;

    if (devVisualMode) {
      setFichasDaMesa((atuais) => [
        ...atuais.filter((ficha) => ficha.uid !== usuario.uid),
        {
          ...dadosFicha,
          uid: usuario.uid,
          info: { ...dadosFicha.info, jogador: nomeJogadorAtual },
        },
      ]);
      setShowImportModal(false);
      return;
    }

    const sucesso = await executarAcao(
      'importar-ficha',
      () => importarPersonagemParaMesa(mesaId, usuario.uid, dadosFicha, nomeJogadorAtual),
      'Não foi possível importar a ficha para esta mesa.',
    );
    if (sucesso) setShowImportModal(false);
  };

  const criarNova = async () => {
    const confirmado = await showConfirm('Criar uma ficha do zero nesta mesa?', 'Nova Ficha');
    if (!confirmado) return;

    if (devVisualMode) {
      setFichasDaMesa((atuais) => [
        ...atuais.filter((ficha) => ficha.uid !== usuario.uid),
        {
          uid: usuario.uid,
          info: {
            nome: 'Novo Agente',
            classe: 'Mundano',
            nex: '0%',
            jogador: nomeJogadorAtual,
          },
          recursos: { pv_atual: 8, pv_max: 8 },
        },
      ]);
      return;
    }

    await executarAcao(
      'nova-ficha',
      () => importarPersonagemParaMesa(mesaId, usuario.uid, null, nomeJogadorAtual),
      'Não foi possível criar a ficha nesta mesa.',
    );
  };

  if (!mesaData) {
    return (
      <div className="ficha-loading" role="status" aria-live="polite">
        <img src="/assets/images/optimized/SimboloSemafinidade-320.webp" alt="" aria-hidden="true" />
        <h1>Sincronizando mesa...</h1>
      </div>
    );
  }

  const tracker = (
    <IniciativaTracker
      mesaId={mesaId}
      iniciativas={mesaData.iniciativas || []}
      turnoAtual={mesaData.turnoAtual || 0}
      rodada={mesaData.rodada || 1}
      souMestre={souMestre}
      fichasDaMesa={fichasDaMesa}
      onVerFichaCriatura={setCriaturaSelecionada}
      compact={false}
    />
  );

  if (isFichaOpen) {
    return (
      <FichaProvider>
        <div className="mesa-ficha-shell">
          <Ficha
            fichaId={fichaAbertaId}
            mesaContexto={mesaId}
            handoutSession={handoutSession}
            onBack={() => setFichaAbertaId(null)}
            onOpenTracker={emCombate ? () => setShowTrackerModal(true) : undefined}
          />

          <ModalBase
            isOpen={showTrackerModal}
            onClose={() => setShowTrackerModal(false)}
            title="Tracker de Iniciativa"
            size="large"
            closeLabel="Fechar tracker de iniciativa"
            bodyClassName="mesa-tracker-modal__body"
          >
            {tracker}
          </ModalBase>

          {criaturaSelecionada && (
            <FichaCriatura dados={criaturaSelecionada} onClose={() => setCriaturaSelecionada(null)} />
          )}
        </div>
      </FichaProvider>
    );
  }

  return (
    <div className={`convergence-page dashboard-page mesa-page ${emCombate ? 'mesa-page--combat' : ''}`}>
      <div ref={parallaxRef} className="dashboard-ambient-art mesa-ambient-art" aria-hidden="true">
        <img src="/assets/images/optimized/Character-1280.webp" alt="" decoding="async" />
      </div>

      <ElementRail variante="dashboard" temaAtual="tema-ordem" />

      <main className="dashboard-workspace mesa-workspace" aria-busy={Boolean(actionBusy)}>
        <header className="dashboard-topbar mesa-topbar">
          <div className="mesa-heading">
            <span className="convergence-eyebrow">Operação compartilhada</span>
            <div className="mesa-title-row">
              <h1>{mesaData.nome || 'Mesa sem nome'}</h1>
              {souMestre && (
                <button
                  type="button"
                  className="mesa-edit-name"
                  onClick={handleEditarNome}
                  disabled={Boolean(actionBusy)}
                >
                  Editar
                </button>
              )}
            </div>
            {souMestre && (
              <div className="mesa-code-row">
                <span>Código</span>
                <code>{mesaId}</code>
                <button type="button" onClick={handleCopiarCodigo} aria-label="Copiar código da mesa">
                  <AppIcon name="code" size={16} />
                  <span>{codigoCopiado ? 'Copiado' : 'Copiar'}</span>
                </button>
                <span className="caos-visually-hidden" aria-live="polite">
                  {codigoCopiado ? 'Código copiado para a área de transferência.' : ''}
                </span>
              </div>
            )}
          </div>

          <div className="mesa-topbar-actions">
            <button
              type="button"
              className="mesa-vtt-launch"
              onClick={abrirVtt}
              disabled={Boolean(actionBusy)}
              title={souMestre
                ? (mesaData.vtt?.roomId ? 'Retomar a sala vinculada a esta mesa' : 'Criar ou vincular uma sala VTT')
                : 'Entrar no VTT desta mesa'}
            >
              <AppIcon name="map" size={18} />
              <span>
                {souMestre
                  ? (mesaData.vtt?.roomId ? 'Retomar VTT' : 'Abrir VTT')
                  : 'Entrar no VTT'}
              </span>
            </button>
            {souMestre && (
              <button
                type="button"
                className={`mesa-combat-toggle ${emCombate ? 'is-active' : ''}`}
                onClick={toggleCombate}
                disabled={Boolean(actionBusy)}
              >
                <AppIcon name="mission" size={18} />
                <span>{emCombate ? 'Encerrar combate' : 'Iniciar combate'}</span>
              </button>
            )}
            <button type="button" className="convergence-icon-button mesa-exit" onClick={sairDaMesa}>
              <AppIcon name="logout" size={18} />
              <span>Sair da mesa</span>
            </button>
          </div>
        </header>

        {actionError && !showBestiarioModal && !showImportModal && (
          <div className="mesa-action-error" role="alert">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError('')} aria-label="Fechar aviso de erro">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        {souMestre && (
          <div className="mesa-handout-panel">
            <HandoutEvidencePanel
              mode="manager"
              status={handoutSession.status}
              role={handoutSession.role}
              error={handoutSession.error}
              deliveredHandouts={handoutSession.deliveredHandouts}
              handoutCatalog={handoutSession.handoutCatalog}
              masterReferences={handoutSession.masterReferences}
              onDeliver={handoutSession.deliverHandout}
              onRevoke={handoutSession.revokeHandout}
              onReconnect={handoutSession.reconnect}
            />
          </div>
        )}

        <section className="mesa-overview-grid" aria-label="Resumo da mesa">
          <article className="convergence-panel mesa-hero-panel">
            <div className="mesa-hero-copy">
              <span className={`mesa-status-chip ${emCombate ? 'is-combat' : ''}`}>
                <i aria-hidden="true"></i>
                {emCombate ? 'Combate em andamento' : 'Operação ativa'}
              </span>
              <h2>{mesaData.nome || 'Operação sem nome'}</h2>
              <p>
                {souMestre
                  ? 'Coordene agentes, criaturas e a ordem de ação em um único terminal.'
                  : 'Acompanhe a equipe e abra sua ficha quando estiver pronto para a operação.'}
              </p>
              <dl className="mesa-metrics">
                <div><dt>Agentes</dt><dd>{agentes.length}</dd></div>
                <div><dt>Fichas</dt><dd>{fichasDaMesa.length}</dd></div>
                <div><dt>Rodada</dt><dd>{emCombate ? (mesaData.rodada || 1) : '—'}</dd></div>
              </dl>
            </div>
            <div className="mesa-hero-emblem" aria-hidden="true">
              <span></span>
              <img src="/assets/images/optimized/SimboloSemafinidade-320.webp" alt="" />
            </div>
          </article>

          <aside className="convergence-panel mesa-connected-panel">
            <div className="convergence-section-heading">
              <div>
                <span className="convergence-eyebrow">Canal seguro</span>
                <h2>Conectados</h2>
              </div>
              <span className="convergence-count">{jogadores.length}</span>
            </div>
            <ul className="mesa-connected-list">
              {jogadores.map((jogador) => {
                const isMaster = jogador.uid === mesaData.mestre;
                const isMe = jogador.uid === usuario.uid;
                return (
                  <li key={jogador.uid} className={isMe ? 'is-me' : ''}>
                    <span className={`mesa-presence-dot ${isMaster ? 'is-master' : ''}`} aria-hidden="true"></span>
                    <div>
                      <strong>{jogador.nome || 'Agente sem nome'}</strong>
                      <small>{isMaster ? 'Mestre da operação' : (isMe ? 'Você' : 'Agente conectado')}</small>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>
        </section>

        {emCombate && (
          <section className="convergence-panel mesa-combat-panel" aria-labelledby="mesa-combat-title">
            <div className="convergence-section-heading mesa-combat-heading">
              <div>
                <span className="convergence-eyebrow">Iniciativa manual</span>
                <h2 id="mesa-combat-title">Ordem de combate</h2>
              </div>
              <span className="mesa-manual-badge">Dados físicos</span>
            </div>

            <div className="mesa-combat-layout">
              <div className="mesa-combat-tracker">{tracker}</div>
              <aside className="mesa-combat-controls">
                {souMestre ? (
                  <>
                    <form className="mesa-player-initiative mesa-master-initiative" onSubmit={registrarIniciativaAgente}>
                      <AppIcon name="mission" size={27} />
                      <div>
                        <span>Resultado físico</span>
                        <strong>Iniciativa de agente</strong>
                      </div>
                      <label htmlFor="mesa-master-initiative-agent" className="caos-visually-hidden">Agente</label>
                      <select
                        id="mesa-master-initiative-agent"
                        value={agenteIniUid}
                        onChange={(event) => setAgenteIniUid(event.target.value)}
                        required
                      >
                        <option value="">Escolha um agente</option>
                        {agentes.map((agente) => (
                          <option key={agente.uid} value={agente.uid}>{agente.nome || 'Agente'}</option>
                        ))}
                      </select>
                      <label htmlFor="mesa-master-initiative-value" className="caos-visually-hidden">Resultado da iniciativa</label>
                      <input
                        id="mesa-master-initiative-value"
                        type="number"
                        value={agenteIniValor}
                        onChange={(event) => setAgenteIniValor(event.target.value)}
                        placeholder="Resultado informado pelo jogador"
                        required
                      />
                      <button type="submit" disabled={Boolean(actionBusy) || agentes.length === 0}>
                        {actionBusy === 'iniciativa-agente' ? 'Registrando...' : 'Registrar resultado'}
                      </button>
                    </form>
                    <button type="button" className="mesa-bestiary-button" onClick={abrirBestiario}>
                      <AppIcon name="rituals" size={21} />
                      <span><strong>Bestiário</strong><small>Adicionar criatura</small></span>
                    </button>
                    <form className="mesa-npc-form" onSubmit={addNPC}>
                      <div className="mesa-form-heading">
                        <span>Entrada rápida</span>
                        <strong>NPC manual</strong>
                      </div>
                      <label htmlFor="mesa-npc-nome">Nome</label>
                      <input id="mesa-npc-nome" type="text" value={npcNome} onChange={(event) => setNpcNome(event.target.value)} placeholder="Nome do NPC" required />
                      <div className="mesa-npc-numbers">
                        <label htmlFor="mesa-npc-iniciativa">Iniciativa
                          <input id="mesa-npc-iniciativa" type="number" value={npcIni} onChange={(event) => setNpcIni(event.target.value)} placeholder="0" required />
                        </label>
                        <label htmlFor="mesa-npc-pv">PV
                          <input id="mesa-npc-pv" type="number" value={npcPV} onChange={(event) => setNpcPV(event.target.value)} />
                        </label>
                      </div>
                      <button type="submit" disabled={Boolean(actionBusy)}>
                        <AppIcon name="plus" size={17} />
                        {actionBusy === 'npc' ? 'Adicionando...' : 'Adicionar à ordem'}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="mesa-player-initiative mesa-player-initiative--readonly">
                    <AppIcon name="mission" size={27} />
                    <div>
                      <span>Resultado nos dados</span>
                      <strong>Informe ao mestre</strong>
                      <p>Role os dados físicos e diga o total para o mestre registrar na ordem.</p>
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </section>
        )}

        {!souMestre && (
          <section className="convergence-panel mesa-my-character" aria-labelledby="mesa-my-character-title">
            <div className="convergence-section-heading">
              <div>
                <span className="convergence-eyebrow">Acesso pessoal</span>
                <h2 id="mesa-my-character-title">Meu personagem</h2>
              </div>
            </div>

            {meuPersonagem ? (
              <article className="mesa-character-feature">
                <span className="mesa-agent-avatar mesa-agent-avatar--large">
                  {meuPersonagem.info?.foto
                    ? <img src={meuPersonagem.info.foto} alt={`Retrato de ${meuPersonagem.info?.nome || 'personagem'}`} />
                    : <AppIcon name="user" size={29} />}
                </span>
                <div>
                  <span>Agente vinculado</span>
                  <h3>{meuPersonagem.info?.nome || 'Sem nome'}</h3>
                  <p>{meuPersonagem.info?.classe || 'Mundano'} · NEX {meuPersonagem.info?.nex || '0%'}</p>
                </div>
                <div className="mesa-character-actions">
                  <button type="button" onClick={() => setFichaAbertaId(usuario.uid)}>
                    Abrir ficha <span aria-hidden="true">›</span>
                  </button>
                  <button type="button" onClick={abrirImportacao}>Trocar ficha</button>
                </div>
              </article>
            ) : (
              <div className="mesa-character-empty">
                <button type="button" onClick={abrirImportacao}>
                  <AppIcon name="export" size={23} />
                  <strong>Importar ficha</strong>
                  <span>Usar um personagem pessoal</span>
                </button>
                <button type="button" onClick={criarNova}>
                  <AppIcon name="plus" size={23} />
                  <strong>Criar nova</strong>
                  <span>Começar uma ficha vazia</span>
                </button>
              </div>
            )}
          </section>
        )}

        <section className="convergence-panel mesa-agents-panel" aria-labelledby="mesa-agents-title">
          <div className="convergence-section-heading">
            <div>
              <span className="convergence-eyebrow">Equipe de campo</span>
              <h2 id="mesa-agents-title">Agentes da operação</h2>
            </div>
            <span className="convergence-count">{agentes.length}</span>
          </div>

          <div className="mesa-agent-grid">
            {agentes.map((jogador) => {
              const ficha = fichasDaMesa.find((item) => item.uid === jogador.uid);
              const isMe = jogador.uid === usuario.uid;
              const podeAbrir = souMestre || isMe;
              const nomeFicha = ficha?.info?.nome || 'Sem ficha vinculada';
              const foto = ficha?.info?.foto;

              return (
                <article key={jogador.uid} className={`mesa-agent-card ${isMe ? 'is-me' : ''} ${!ficha ? 'is-empty' : ''}`}>
                  <header>
                    <span className="mesa-agent-avatar">
                      {foto
                        ? <img src={foto} alt={`Retrato de ${nomeFicha}`} loading="lazy" decoding="async" />
                        : <AppIcon name="user" size={21} />}
                    </span>
                    <div>
                      <small>{isMe ? 'Você' : 'Agente conectado'}</small>
                      <strong>{jogador.nome || 'Agente sem nome'}</strong>
                    </div>
                    {souMestre && (
                      <button
                        type="button"
                        className="mesa-agent-remove"
                        onClick={() => handleExpulsar(jogador.uid)}
                        disabled={Boolean(actionBusy)}
                        aria-label={`Remover ${jogador.nome || 'agente'} da mesa`}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    )}
                  </header>

                  <div className="mesa-agent-sheet">
                    <span>Ficha operacional</span>
                    <h3>{nomeFicha}</h3>
                    {ficha ? (
                      <p>{ficha.info?.classe || 'Mundano'} · NEX {ficha.info?.nex || '0%'}</p>
                    ) : (
                      <p>Aguardando personagem.</p>
                    )}
                  </div>

                  {ficha && podeAbrir ? (
                    <button type="button" className="mesa-agent-open" onClick={() => setFichaAbertaId(jogador.uid)}>
                      {isMe ? 'Abrir minha ficha' : 'Ver ficha'} <span aria-hidden="true">›</span>
                    </button>
                  ) : (
                    <span className="mesa-agent-locked">{ficha ? 'Ficha reservada ao agente' : 'Sem ficha vinculada'}</span>
                  )}
                </article>
              );
            })}

            {agentes.length === 0 && (
              <div className="mesa-empty-state">
                <AppIcon name="user" size={28} />
                <strong>Nenhum agente conectado</strong>
                <span>Compartilhe o código da mesa para montar a equipe.</span>
              </div>
            )}
          </div>
        </section>
      </main>

      <ModalBase
        isOpen={showBestiarioModal}
        onClose={() => setShowBestiarioModal(false)}
        title="Bestiário"
        size="wide"
        closeLabel="Fechar bestiário"
        initialFocusRef={bestiarySearchRef}
        bodyClassName="mesa-bestiary-modal"
        footer={(
          <button type="button" className="caos-modal__button caos-modal__button--secondary" onClick={() => setShowBestiarioModal(false)}>
            Fechar
          </button>
        )}
      >
        {actionError && (
          <div className="mesa-action-error mesa-modal-error" role="alert">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError('')} aria-label="Fechar aviso de erro">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        <div className="mesa-bestiary-toolbar">
          <label htmlFor="mesa-bestiary-search">
            <span>Buscar criatura</span>
            <input ref={bestiarySearchRef} id="mesa-bestiary-search" type="search" value={buscaBestiario} onChange={(event) => setBuscaBestiario(event.target.value)} placeholder="Nome ou tipo" />
          </label>
          <label htmlFor="mesa-bestiary-element">
            <span>Elemento</span>
            <select id="mesa-bestiary-element" value={filtroElemento} onChange={(event) => setFiltroElemento(event.target.value)}>
              <option value="todos">Todos</option>
              {elementosBestiario.map((elemento) => <option key={elemento} value={elemento}>{elemento}</option>)}
            </select>
          </label>
        </div>

        {bestiarioLoading ? (
          <div className="mesa-modal-loading" role="status">Carregando grimório de criaturas...</div>
        ) : !listaBestiario ? (
          <div className="mesa-bestiary-retry">
            <AppIcon name="rituals" size={27} />
            <strong>O grimório não pôde ser aberto</strong>
            <span>Verifique a conexão e tente carregar o bestiário novamente.</span>
            <button type="button" className="caos-modal__button caos-modal__button--primary" onClick={carregarBestiario}>
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="mesa-creature-grid">
            {criaturasFiltradas.map((criatura) => {
              const elemento = slugElemento(criatura.elemento || 'medo');
              return (
                <button
                  type="button"
                  key={criatura.id}
                  className={`mesa-creature-card mesa-creature-card--${elemento}`}
                  onClick={() => adicionarMonstro(criatura)}
                  disabled={Boolean(actionBusy)}
                >
                  <span className="mesa-creature-thumb">
                    {criatura.foto
                      ? <img src={getBestiaryThumbnail(criatura.foto)} alt="" loading="lazy" decoding="async" />
                      : <AppIcon name="rituals" size={24} />}
                  </span>
                  <span className="mesa-creature-copy">
                    <strong>{criatura.nome}</strong>
                    <small>{criatura.tipo || 'Criatura'} · VD {criatura.vd}</small>
                    <em>{criatura.elemento || 'Medo'} · Referência {criatura.iniciativa}</em>
                  </span>
                  <span className="mesa-creature-add"><AppIcon name="plus" size={17} /> Adicionar</span>
                </button>
              );
            })}
            {criaturasFiltradas.length === 0 && (
              <div className="mesa-empty-state">
                <strong>Nenhuma criatura encontrada</strong>
                <span>Ajuste a busca ou o filtro de elemento.</span>
              </div>
            )}
          </div>
        )}
      </ModalBase>

      <ModalBase
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Importar Personagem"
        size="medium"
        closeLabel="Fechar importação de personagem"
        initialFocusRef={importFirstItemRef}
        footer={(
          <button type="button" className="caos-modal__button caos-modal__button--secondary" onClick={() => setShowImportModal(false)}>
            Cancelar
          </button>
        )}
      >
        {actionError && (
          <div className="mesa-action-error mesa-modal-error" role="alert">
            <span>{actionError}</span>
            <button type="button" onClick={() => setActionError('')} aria-label="Fechar aviso de erro">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        {minhasFichas.length === 0 ? (
          <div className="mesa-empty-state">
            <AppIcon name="user" size={27} />
            <strong>Nenhuma ficha pessoal encontrada</strong>
            <span>Crie uma ficha no painel antes de importá-la para a mesa.</span>
          </div>
        ) : (
          <div className="mesa-import-list">
            {minhasFichas.map((ficha, index) => (
              <button ref={index === 0 ? importFirstItemRef : undefined} type="button" key={ficha.id} onClick={() => confirmarImportacao(ficha.dadosCompletos)} disabled={Boolean(actionBusy)}>
                <span className="mesa-agent-avatar"><AppIcon name="user" size={20} /></span>
                <span><strong>{ficha.nome || 'Sem nome'}</strong><small>{ficha.classe || 'Mundano'} · NEX {ficha.nex || '0%'}</small></span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        )}
      </ModalBase>

      {criaturaSelecionada && (
        <FichaCriatura dados={criaturaSelecionada} onClose={() => setCriaturaSelecionada(null)} />
      )}
    </div>
  );
}
