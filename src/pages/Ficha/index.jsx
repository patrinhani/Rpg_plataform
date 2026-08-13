// src/pages/Ficha/index.jsx
import React, { useState, useEffect, Suspense, lazy, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from '../../lib/animacoes.js'; 
import { 
    poderesCombatente, poderesEspecialista, poderesOcultista, 
    poderesGerais, poderesParanormais, OpcoesClasse, database
} from '../../lib/database.js';
import { progressaoClasses, getMergedTrilhas, groupTrilhasByClass } from '../../lib/progressao.js'; 

import { useAuth } from '../../contexts/AuthContext.jsx';
import { useFicha } from '../../contexts/FichaContext.jsx';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { db } from '../../lib/firebase'; 
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';

// Lazy Loading de Componentes
const Inventario = lazy(() => import('../../components/Inventario.jsx'));
const PoderesAprendidos = lazy(() => import('../../components/PoderesAprendidos.jsx'));
const Rituais = lazy(() => import('../../components/Rituais.jsx'));
const Diario = lazy(() => import('../../components/Diario.jsx'));
const ProgressaoHabilidades = lazy(() => import('../../components/ficha/ProgressaoHabilidades.jsx'));
const ModalLoja = lazy(() => import('../../components/ModalLoja.jsx'));
const ModalEditarItem = lazy(() => import('../../components/ModalEditarItem.jsx'));
const ModalSelecao = lazy(() => import('../../components/ModalSelecao.jsx'));
const ModalPoderes = lazy(() => import('../../components/ModalPoderes.jsx'));
const ModalRituais = lazy(() => import('../../components/ModalRituais.jsx'));
const ModalTrilhaCustom = lazy(() => import('../../components/ModalTrilhaCustom.jsx'));
const ModalNota = lazy(() => import('../../components/ModalNota.jsx'));
const ModalInterludio = lazy(() => import('../../components/ModalInterludio.jsx'));
const ConfiguracoesFicha = lazy(() => import('../../components/ConfiguracoesFicha.jsx'));
import FichaPrincipal from '../../components/FichaPrincipal.jsx'; 
import Recursos from '../../components/ficha/recursos.jsx';
import ElementRail from '../../components/ElementRail.jsx';
import AffinityAwakening from '../../components/AffinityAwakening.jsx';
import NexAwakeningMeter from '../../components/NexAwakeningMeter.jsx';
import { AppIcon } from '../../components/icons/NavigationIcons.jsx';
import { crossedAffinityThreshold, getNexAffinityState } from '../../lib/nex-affinity.js';

const allPoderesList = [...poderesParanormais, ...poderesGerais, ...poderesCombatente, ...poderesEspecialista, ...poderesOcultista];
const opcoesElemento = [
    { nome: 'Sangue', valor: 'sangue' },
    { nome: 'Morte', valor: 'morte' },
    { nome: 'Conhecimento', valor: 'conhecimento' },
    { nome: 'Energia', valor: 'energia' },
];
const listaTodasPericias = ['acrobacia', 'adestramento', 'artes', 'atletismo', 'atualidades', 'ciencias', 'crime', 'diplomacia', 'enganacao', 'fortitude', 'furtividade', 'iniciativa', 'intimidacao', 'intuicao', 'investigacao', 'luta', 'medicina', 'ocultismo', 'percepcao', 'pilotagem', 'pontaria', 'profissao', 'reflexos', 'religiao', 'sobrevivencia', 'tatica', 'tecnologia', 'vontade'];
const opcoesPericia = listaTodasPericias
  .filter(p => p !== 'luta' && p !== 'pontaria') 
  .map(p => ({ nome: p.charAt(0).toUpperCase() + p.slice(1), valor: p }));

const ABAS_FICHA = [
    { id: 'principal', label: 'Resumo', icon: 'overview' },
    { id: 'inventario', label: 'Inventário', icon: 'inventory' },
    { id: 'rituais', label: 'Rituais', icon: 'rituals' },
    { id: 'poderes', label: 'Poderes', icon: 'powers' },
    { id: 'progressao', label: 'Progressão', icon: 'progress' },
    { id: 'diario', label: 'Diário', icon: 'journal' },
    { id: 'configuracoes', label: 'Configurações', icon: 'settings' },
];

function criarDadosVisualDev(base) {
    const dados = JSON.parse(JSON.stringify(base));

    dados.info = {
        ...dados.info,
        nome: 'Agente Visual',
        jogador: 'Codex',
        origem: 'desgarrado',
        classe: 'especialista',
        trilha: 'infiltrador',
        nex: '40%',
        prestigio: 25,
        tema: 'tema-ordem',
    };
    dados.atributos = { for: 2, agi: 3, int: 3, pre: 2, vig: 2 };
    dados.pericias = {
        ...dados.pericias,
        crime: 5,
        fortitude: 5,
        furtividade: 10,
        investigacao: 10,
        reflexos: 5,
        tecnologia: 5,
        custom_caos_ritual: 5,
    };
    dados.periciasCustom = [{ key: 'custom_caos_ritual', nome: 'Caos Ritual', attr: 'pre' }];
    dados.bonusPericiasManuais = { investigacao: 1, custom_caos_ritual: 2 };
    dados.defesa = { ...dados.defesa, equip: 2, outros: 1 };
    dados.bonusManuais = { ...dados.bonusManuais, defesa: 2, esquiva: 1, limite_pe: 1 };
    dados.recursos = { pv_atual: 24, pv_max: 24, pe_atual: 18, pe_max: 18, san_atual: 20, san_max: 20 };
    const itemDemo = (fonte, inventarioId, extras = {}) => fonte
        ? { ...fonte, inventarioId, ...extras }
        : null;
    dados.inventario = [
        itemDemo(database.armasSimples?.find(item => item.id === 'pistola'), 'dev-item-pistola', { modificacoes: ['certeira'] }),
        itemDemo(database.equipGeral?.find(item => item.id === 'mochila_militar'), 'dev-item-mochila'),
        itemDemo(database.protecoes?.find(item => item.id === 'protecao_leve'), 'dev-item-protecao'),
        itemDemo(database.equipGeral?.find(item => item.id === 'lanterna_tatica'), 'dev-item-lanterna', { quebrado: true }),
    ].filter(Boolean);
    dados.rituais = (database.rituais || []).slice(0, 3).map((ritual, index) => ({
        ...ritual,
        inventarioId: `dev-ritual-${index + 1}`,
    }));
    dados.poderes_aprendidos = poderesGerais[0] ? [poderesGerais[0]] : [];
    dados.diario = [
        { id: 'dev-nota-1', titulo: 'Eco no subsolo', conteudo: 'O padrão de interferência reaparece sempre que o grupo se aproxima do arquivo central.', data: new Date().toISOString() },
        { id: 'dev-nota-2', titulo: 'Pessoas de interesse', conteudo: 'Verificar o depoimento do vigia e cruzar o horário com as imagens da entrada lateral.', data: new Date(Date.now() - 86400000).toISOString() },
    ];

    return dados;
}

function debounce(func, delay) {
    let timeoutId;
    let lastArgs;
    let lastThis;

    const invoke = () => {
        const args = lastArgs;
        const context = lastThis;
        timeoutId = undefined;
        lastArgs = undefined;
        lastThis = undefined;
        return func.apply(context, args);
    };

    const debounced = function(...args) {
        if (timeoutId) clearTimeout(timeoutId);
        lastArgs = args;
        lastThis = this;
        timeoutId = setTimeout(invoke, delay);
    };

    debounced.cancel = () => {
        if (!timeoutId) return;
        clearTimeout(timeoutId);
        timeoutId = undefined;
        lastArgs = undefined;
        lastThis = undefined;
    };

    debounced.flush = () => {
        if (!timeoutId) return undefined;
        clearTimeout(timeoutId);
        return invoke();
    };

    return debounced;
}

const TEMPO_LIMITE_SALVAMENTO = 8000;

function aguardarComLimite(promessa, limite = TEMPO_LIMITE_SALVAMENTO) {
    return new Promise((resolve) => {
        const timeoutId = window.setTimeout(() => {
            resolve({ ok: false, timeout: true });
        }, limite);

        Promise.resolve(promessa).then(
            (resultado) => {
                window.clearTimeout(timeoutId);
                resolve(resultado);
            },
            (error) => {
                window.clearTimeout(timeoutId);
                resolve({ ok: false, error });
            },
        );
    });
}

export default function Ficha({ fichaId: propFichaId, mesaContexto, handoutSession, onBack, onOpenTracker }) {
  const { fichaId: paramFichaId } = useParams();
  const navigate = useNavigate();
  const { usuario, devVisualMode } = useAuth(); 
  const { showAlert, showConfirm } = useDialog(); 
  
  const { 
      personagem, calculados, carregarFicha, atualizarFicha, fichaInstance,
      addItem, removeItem, updateItem, toggleItem,
      addRitual, removeRitual,
      addPoder, removePoder,
      addTrilhaCustom, 
      addPericiaCustom, removePericiaCustom,
      addNota, updateNota, removeNota,
      toggleCondicao, reaplicarCondicao, aplicarInterludio, consumirBuffTemporario
  } = useFicha();
  
  const idAlvo = propFichaId || paramFichaId || usuario?.uid;
  const isModoMesa = !!mesaContexto;
  const podeExcluirFicha = !isModoMesa || propFichaId === usuario?.uid;
  const evidenceCount = Array.isArray(handoutSession?.deliveredHandouts)
    ? handoutSession.deliveredHandouts.length
    : 0;

  const [tema, setTema] = useState(() => localStorage.getItem("temaFichaOrdem") || "tema-ordem");
  const [showAffinityAwakening, setShowAffinityAwakening] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState('principal'); 
  const [trilhasPorClasse, setTrilhasPorClasse] = useState({});
  const trilhasUnificadas = useMemo(() => getMergedTrilhas(personagem.trilhas_personalizadas || []), [personagem.trilhas_personalizadas]);
  const periciasDeOrigem = useMemo(() => database.periciasPorOrigem?.[personagem.info.origem]?.fixas || [], [personagem.info.origem]);
  const periciasParaLoja = useMemo(() => [
      ...listaTodasPericias,
      ...(personagem.periciasCustom || []).map(pericia => pericia.key)
  ], [personagem.periciasCustom]);
  const opcoesPericiaFicha = useMemo(() => [
      ...opcoesPericia,
      ...(personagem.periciasCustom || []).map(pericia => ({ nome: pericia.nome, valor: pericia.key }))
  ], [personagem.periciasCustom]);
  
  const [loading, setLoading] = useState(true); 
  const [loadError, setLoadError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const docRef = useRef(null); 
  const isInitializing = useRef(true); 
  const devVisualLoaded = useRef(false);
  const localRevisionRef = useRef(0);
  const savedRevisionRef = useRef(0);
  const inFlightSaveRef = useRef(null);
  const inFlightSavesRef = useRef(new Set());
  const isDeletingRef = useRef(false);
  const previousNexRef = useRef(null);
  
  // Controle de Atualização Remota (IMPORTANTE PARA EVITAR LOOPS)
  const isRemoteUpdate = useRef(false);

  // Modais States
  const [isLojaOpen, setIsLojaOpen] = useState(false);
  const [isSelecaoOpen, setIsSelecaoOpen] = useState(false);
  const [itemPendente, setItemPendente] = useState(null); 
  const [isRitualModalOpen, setIsRitualModalOpen] = useState(false); 
  const [isTrilhaModalOpen, setIsTrilhaModalOpen] = useState(false); 
  const [isPoderesModalOpen, setIsPoderesModalOpen] = useState(false); 
  const [isModalEditarItemOpen, setIsModalEditarItemOpen] = useState(false); 
  const [itemParaEditar, setItemParaEditar] = useState(null); 
  const [isDiarioModalOpen, setIsDiarioModalOpen] = useState(false);
  const [notaParaEditar, setNotaParaEditar] = useState(null); 
  const [isInterludioModalOpen, setIsInterludioModalOpen] = useState(false);

  const saveToFirestore = useCallback(async (dadosCompletos, destino = docRef.current) => {
    if (isDeletingRef.current) return { ok: false, cancelado: true };
    if (!destino) return { ok: false, semDestino: true };
    try {
        await setDoc(destino, dadosCompletos, { merge: true });
        return { ok: true };
    } catch (error) {
        console.error("Erro ao salvar no Firestore:", error);
        return { ok: false, error };
    }
  }, []);
  
  const debouncedSave = useRef(debounce(async (dadosCompletos, destino, revision) => {
      if (isDeletingRef.current) return { ok: false, cancelado: true };
      const salvamento = saveToFirestore(dadosCompletos, destino);
      inFlightSaveRef.current = salvamento;
      inFlightSavesRef.current.add(salvamento);
      const resultado = await salvamento;
      inFlightSavesRef.current.delete(salvamento);
      if (inFlightSaveRef.current === salvamento) inFlightSaveRef.current = null;
      if (resultado.ok && docRef.current === destino) {
          savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
      }
      return resultado;
  }, 1000)).current;

  // --- 1. SINCRONIZAÇÃO EM TEMPO REAL ---
  useEffect(() => {
    debouncedSave.cancel();

    if (devVisualMode) {
        setLoadError('');
        docRef.current = null;
        if (!devVisualLoaded.current) {
            carregarFicha(criarDadosVisualDev(fichaInstance.getDados()));
            devVisualLoaded.current = true;
        }
        isInitializing.current = false;
        setLoading(false);
        return undefined;
    }

    if (!usuario || !idAlvo) {
        docRef.current = null;
        setLoading(false);
        return undefined;
    }

    isInitializing.current = true;
    isRemoteUpdate.current = false;
    localRevisionRef.current = 0;
    savedRevisionRef.current = 0;
    setLoading(true);
    setLoadError('');
    
    const destinoAtual = isModoMesa
      ? doc(db, "mesas", mesaContexto, "personagens", idAlvo)
      : doc(db, "users", usuario.uid, "personagens", idAlvo);

    docRef.current = destinoAtual;
    let assinaturaAtiva = true;
    
    const unsubscribe = onSnapshot(destinoAtual, async (docSnap) => {
        if (!assinaturaAtiva) return;
        if (isDeletingRef.current) return;

        try {
            if (docSnap.exists()) {
                docRef.current = destinoAtual;
                const possuiEdicaoLocalPendente = localRevisionRef.current > savedRevisionRef.current;
                const ecoDeEscritaLocal = docSnap.metadata.hasPendingWrites;

                if (!isInitializing.current && (possuiEdicaoLocalPendente || ecoDeEscritaLocal)) {
                    return;
                }

                debouncedSave.cancel();
                isRemoteUpdate.current = true;
                carregarFicha(docSnap.data());
            } else if (isInitializing.current) {
                const podeCriarDocumento = !isModoMesa || propFichaId === usuario.uid;

                if (!podeCriarDocumento) {
                    debouncedSave.cancel();
                    docRef.current = null;
                    setLoadError('Esta ficha não existe ou ainda não foi vinculada a este jogador.');
                    setLoading(false);
                    return;
                }

                await setDoc(destinoAtual, fichaInstance.getDados());
                if (!assinaturaAtiva) return;
                isRemoteUpdate.current = true;
            } else {
                debouncedSave.cancel();
                docRef.current = null;
                setLoadError('Esta ficha foi removida enquanto estava aberta.');
                setLoading(false);
                return;
            }

            if (!assinaturaAtiva) return;
            if (isInitializing.current) isInitializing.current = false;
            setLoadError('');
            setLoading(false);
        } catch (error) {
            if (!assinaturaAtiva) return;
            console.error("Erro ao inicializar ficha no Firestore:", error);
            debouncedSave.cancel();
            docRef.current = null;
            setLoadError('Não foi possível preparar esta ficha. Verifique sua conexão e tente novamente.');
            setLoading(false);
        }
    }, (error) => {
        if (!assinaturaAtiva) return;
        console.error("Erro Firestore:", error);
        debouncedSave.cancel();
        docRef.current = null;
        setLoadError('Não foi possível sincronizar esta ficha. Verifique sua conexão e tente novamente.');
        setLoading(false);
    });

    return () => {
        assinaturaAtiva = false;
        const salvamentoPendente = isDeletingRef.current ? undefined : debouncedSave.flush();
        salvamentoPendente?.then((resultado) => {
            if (resultado && !resultado.ok && !resultado.semDestino) {
                console.error("A última alteração da ficha não pôde ser sincronizada.", resultado.error);
            }
        });
        unsubscribe();
        if (docRef.current === destinoAtual) docRef.current = null;
    };
  }, [usuario, mesaContexto, idAlvo, carregarFicha, isModoMesa, propFichaId, fichaInstance, devVisualMode, debouncedSave, reloadToken]);

  // --- 2. SALVAMENTO OTIMIZADO ---
  useEffect(() => {
      if (devVisualMode) return;
      if (isDeletingRef.current) return;
      if (!loading && !isInitializing.current) {
          // Se for update remoto, ignora o salvamento
          if (isRemoteUpdate.current) {
              isRemoteUpdate.current = false;
              return;
          }
          const destinoAtual = docRef.current;
          if (!destinoAtual) return;
          const revision = localRevisionRef.current + 1;
          localRevisionRef.current = revision;
          debouncedSave(personagem, destinoAtual, revision);
      }
  }, [personagem, loading, debouncedSave, devVisualMode]);

  // --- 3. SINCRONIZAÇÃO DO TEMA ---
  useEffect(() => {
     if (personagem.info.tema && personagem.info.tema !== tema) {
         setTema(personagem.info.tema);
     }
  }, [personagem.info.tema, tema]);

  useEffect(() => {
    const temaNoDOM = document.documentElement.dataset.tema;
    const temaVisual = getNexAffinityState(personagem.info.nex).unlocked ? tema : 'tema-ordem';
    if (temaVisual !== temaNoDOM) {
        if (!temaNoDOM) {
            aplicarTemaSemAnimacao(temaVisual);
        } else aplicarTemaComAnimacao(temaVisual, temaNoDOM);
    }
  }, [personagem.info.nex, tema]);

  const nexAffinity = useMemo(
    () => getNexAffinityState(personagem.info.nex),
    [personagem.info.nex],
  );
  const temaVisual = nexAffinity.unlocked ? tema : 'tema-ordem';

  useEffect(() => {
    if (loading) return;

    const previous = previousNexRef.current;
    if (previous?.fichaId === idAlvo && crossedAffinityThreshold(previous.nex, nexAffinity.nex)) {
      setShowAffinityAwakening(true);
    }
    previousNexRef.current = { fichaId: idAlvo, nex: nexAffinity.nex };
  }, [idAlvo, loading, nexAffinity.nex]);

  useEffect(() => {
    return () => {
        aplicarTemaSemAnimacao('tema-ordem');
        document.documentElement.dataset.tema = 'tema-ordem';
        document.title = 'C.A.O.S';
    };
  }, []);

  // --- 4. MEMOIZAÇÃO DE DADOS COMPLEXOS ---
  useEffect(() => {
    if (loading) return;
    const trilhasAgrupadas = groupTrilhasByClass(trilhasUnificadas);
    setTrilhasPorClasse(trilhasAgrupadas);
  }, [trilhasUnificadas, loading]); 

  useEffect(() => {
    const title = personagem.info.nome ? `${personagem.info.nome} - NEX ${personagem.info.nex || "0%"}` : "Ficha";
    document.title = title;
  }, [personagem.info.nome, personagem.info.nex]); 

  // --- HANDLERS MEMOIZADOS ---
  const handleThemeChange = useCallback((novoTema) => {
      setTema(novoTema); 
      atualizarFicha('info', 'tema', novoTema); 
  }, [atualizarFicha]);

  const handleFichaChange = useCallback((secao, campo, valor) => {
       if (secao === 'info' && campo === 'trilha') {
           const trilha = valor;
           const customTrilhas = personagem.trilhas_personalizadas || [];
           const dados = getMergedTrilhas(customTrilhas)[trilha];
           if (dados && dados.requiresChoice === 'elemento' && trilha !== 'nenhuma') {
                setItemPendente({ trilhaValue: trilha, tituloModal: `Elemento da Trilha`, descricaoModal: `Escolha:`, opcoes: opcoesElemento, tipoVinculo: 'trilhaElemento' });
                setIsSelecaoOpen(true);
                return; 
           }
       }
       atualizarFicha(secao, campo, valor);
  }, [atualizarFicha, personagem.trilhas_personalizadas]);

  const handleAddItem = useCallback((itemOriginal) => { 
      if (itemOriginal.tipoBonus === 'generico') { 
          setItemPendente({ ...itemOriginal, tituloModal: `Vincular: ${itemOriginal.nome}`, descricaoModal: 'Escolha uma perícia:', opcoes: opcoesPericiaFicha, tipoVinculo: 'pericia' }); setIsSelecaoOpen(true); setIsLojaOpen(false); 
      } else if (itemOriginal.tipoBonus === 'escolhaElemento') { 
          setItemPendente({ ...itemOriginal, tituloModal: `Escolher Elemento`, descricaoModal: 'Escolha:', opcoes: opcoesElemento, tipoVinculo: 'elemento' }); setIsSelecaoOpen(true); setIsLojaOpen(false); 
      } else { 
          addItem(itemOriginal); 
      } 
  }, [addItem, opcoesPericiaFicha]);

  const handleVincularItem = useCallback((valorSelecionado) => { 
      if (!itemPendente) return; 
      if (itemPendente.tipoVinculo === 'poderElemento') { 
          const poderOriginal = allPoderesList.find(p => p.key === itemPendente.powerKey); 
          if (poderOriginal) { 
              const el = valorSelecionado.toLowerCase(); 
              const poderVinculado = { ...poderOriginal, nome: `${poderOriginal.nome} (${valorSelecionado})`, elemento: el, requiresChoice: null, key: `${poderOriginal.key}_${el}` }; 
              addPoder(poderVinculado); 
          } 
      } else if (itemPendente.tipoVinculo === 'trilhaElemento') { 
          const trilha = itemPendente.trilhaValue; 
          atualizarFicha('info', 'trilha', trilha); 
          atualizarFicha('info', `${trilha}_elemento`, valorSelecionado); 
      } else { 
          let itemVinculado = { ...itemPendente }; 
          if (itemPendente.tipoVinculo === 'pericia') itemVinculado.periciaVinculada = valorSelecionado; 
          else if (itemPendente.tipoVinculo === 'elemento') { itemVinculado.elemento = valorSelecionado; itemVinculado.nome = itemPendente.nome.replace("(Elemento)", `(${valorSelecionado})`); } 
          itemVinculado.tipoBonus = null; 
          addItem(itemVinculado); 
      } 
      setIsSelecaoOpen(false); setItemPendente(null); 
  }, [itemPendente, addPoder, addItem, atualizarFicha]);
  
  const handleTogglePoder = useCallback((poder) => { 
      const aprendidos = personagem.poderes_aprendidos || []; 
      const isAprendido = aprendidos.some(p => p.key === poder.key || p.key.startsWith(`${poder.key}_`)); 
      if (isAprendido) { 
          const keysToRemove = aprendidos.filter(p => p.key === poder.key || p.key.startsWith(`${poder.key}_`)).map(p => p.key); 
          keysToRemove.forEach(key => removePoder(key)); 
      } else { 
          if (poder.requiresChoice) { 
              setItemPendente({ powerKey: poder.key, nome: poder.nome, tituloModal: `Elemento para ${poder.nome}`, descricaoModal: 'Selecione:', opcoes: opcoesElemento, tipoVinculo: 'poderElemento' }); setIsSelecaoOpen(true); 
          } else { 
              addPoder(poder); 
          } 
      } 
  }, [personagem.poderes_aprendidos, removePoder, addPoder]);
  
  const handleSalvarItemEditado = useCallback((itemAtualizado) => { 
      if (itemParaEditar) { updateItem(itemParaEditar.inventarioId, itemAtualizado); setIsModalEditarItemOpen(false); } 
  }, [itemParaEditar, updateItem]);

  const handleSalvarNota = useCallback((dadosNota) => { 
      if (notaParaEditar) updateNota(notaParaEditar.id, dadosNota); else addNota(dadosNota); setIsDiarioModalOpen(false); 
  }, [notaParaEditar, updateNota, addNota]);

  const handleAddTrilhaCustom = useCallback(async (dadosTrilha) => {
      const resultado = addTrilhaCustom(dadosTrilha);
      if (resultado?.dados) {
          const salvamento = await saveToFirestore(resultado.dados);
          if (!salvamento.ok && !salvamento.semDestino) {
            showAlert(`A trilha foi criada na ficha aberta, mas não pôde ser sincronizada: ${salvamento.error?.message || 'erro desconhecido'}`, "Erro ao salvar");
            setIsTrilhaModalOpen(false);
            return;
          }
      }
      setIsTrilhaModalOpen(false);
      showAlert("Trilha personalizada salva.", "Trilha");
  }, [addTrilhaCustom, saveToFirestore, showAlert]);
  
  const handleAplicarInterludioHandler = useCallback((opcoes) => { 
      const resultado = aplicarInterludio(opcoes);
      const extras = resultado.extras?.length ? `\n\n${resultado.extras.join('\n')}` : '';
      showAlert(`Interlúdio finalizado!\nRecuperado: PV ${resultado.pv} | PE ${resultado.pe} | SAN ${resultado.san}${extras}`, "Interlúdio");
  }, [aplicarInterludio, showAlert]);

  const salvarFichaLocal = useCallback(async () => {
      if (isDeletingRef.current) return { ok: false, cancelado: true };
      debouncedSave.cancel();
      const destinoAtual = docRef.current;
      const revision = localRevisionRef.current + 1;
      localRevisionRef.current = revision;
      const salvamento = saveToFirestore(personagem, destinoAtual);
      inFlightSaveRef.current = salvamento;
      inFlightSavesRef.current.add(salvamento);
      const resultado = await salvamento;
      inFlightSavesRef.current.delete(salvamento);
      if (inFlightSaveRef.current === salvamento) inFlightSaveRef.current = null;
      if (resultado.ok && docRef.current === destinoAtual) {
          savedRevisionRef.current = Math.max(savedRevisionRef.current, revision);
      }
      return resultado;
  }, [saveToFirestore, personagem, debouncedSave]);

  const voltarDaFicha = useCallback(async () => {
      const salvamento = debouncedSave.flush() || inFlightSaveRef.current;
      if (salvamento) {
          const resultado = await aguardarComLimite(salvamento);
          if (resultado.timeout) {
              const sairMesmoAssim = await showConfirm(
                  "A sincronização está demorando mais que o esperado. Deseja voltar mesmo assim? As alterações ainda podem estar pendentes neste dispositivo.",
                  "Sincronização demorada",
                  "Voltar mesmo assim",
                  "Continuar na ficha",
              );
              if (!sairMesmoAssim) return;
              if (onBack) onBack();
              else navigate('/');
              return;
          }
          if (!resultado.ok && !resultado.semDestino) {
              showAlert(`Não foi possível salvar a última alteração: ${resultado.error?.message || 'erro desconhecido'}`, "Erro ao salvar");
              return;
          }
      }

      if (localRevisionRef.current > savedRevisionRef.current && docRef.current) {
          const destinoAtual = docRef.current;
          const revision = localRevisionRef.current;
          const resultado = await aguardarComLimite(saveToFirestore(personagem, destinoAtual));
          if (resultado.timeout) {
              const sairMesmoAssim = await showConfirm(
                  "Não foi possível confirmar o salvamento agora. Deseja voltar mesmo assim?",
                  "Sincronização demorada",
                  "Voltar mesmo assim",
                  "Continuar na ficha",
              );
              if (!sairMesmoAssim) return;
              if (onBack) onBack();
              else navigate('/');
              return;
          }
          if (!resultado.ok) {
              showAlert(`Não foi possível salvar a última alteração: ${resultado.error?.message || 'erro desconhecido'}`, "Erro ao salvar");
              return;
          }
          savedRevisionRef.current = revision;
      }

      if (onBack) onBack();
      else navigate('/');
  }, [debouncedSave, navigate, onBack, personagem, saveToFirestore, showAlert, showConfirm]);
  
  const excluirFicha = useCallback(async () => {
      if (!podeExcluirFicha) {
          showAlert("Somente o dono pode excluir esta ficha da mesa.", "Ação não permitida");
          return { ok: false, naoPermitido: true };
      }

      const destinoExcluido = docRef.current;
      if (!destinoExcluido) {
          showAlert("Esta ficha não possui um destino de sincronização disponível para exclusão.", "Exclusão indisponível");
          return { ok: false, semDestino: true };
      }

      const confirmado = await showConfirm(
          "Esta ação exclui permanentemente a ficha. Gere um backup JSON antes de continuar.",
          "Excluir ficha",
          "Excluir permanentemente",
          "Cancelar",
      );
      if (!confirmado) return { ok: false, cancelado: true };

      if(confirmado) { 
          try {
            isDeletingRef.current = true;
            debouncedSave.cancel();
            const salvamentosEmAndamento = [...inFlightSavesRef.current];
            if (salvamentosEmAndamento.length > 0) {
              const esperaSalvamentos = await aguardarComLimite(
                Promise.allSettled(salvamentosEmAndamento).then(() => ({ ok: true })),
              );
              if (esperaSalvamentos.timeout) {
                docRef.current = destinoExcluido;
                isDeletingRef.current = false;
                showAlert("A exclusão foi cancelada porque uma sincronização anterior ainda não terminou. Aguarde alguns segundos e tente novamente.", "Sincronização pendente");
                return { ok: false, timeout: true };
              }
            }
            inFlightSaveRef.current = null;
            docRef.current = null;
            const exclusao = await aguardarComLimite(
              deleteDoc(destinoExcluido).then(() => ({ ok: true })),
            );
            if (exclusao.timeout) {
              showAlert("A exclusão foi enviada, mas a confirmação está demorando. A ficha permanecerá bloqueada para evitar que seja recriada.", "Exclusão pendente");
              if (onBack) onBack();
              else navigate('/');
              return { ok: false, timeout: true, pendente: true };
            }
            if (!exclusao.ok) throw exclusao.error || new Error('Falha ao excluir a ficha.');
            if (onBack) onBack();
            else navigate('/');
            return { ok: true };
          } catch (error) {
            docRef.current = destinoExcluido;
            isDeletingRef.current = false;
            showAlert(`Não foi possível confirmar a exclusão: ${error.message}. Recarregue a ficha antes de continuar editando.`, "Erro");
            return { ok: false, error };
          }
      }
      return { ok: false, cancelado: true };
  }, [podeExcluirFicha, showConfirm, navigate, showAlert, debouncedSave, onBack]);

  // Funções de Abrir Modais Memoizadas
  const openLoja = useCallback(() => setIsLojaOpen(true), []);
  const openRituais = useCallback(() => setIsRitualModalOpen(true), []);
  const openPoderes = useCallback(() => setIsPoderesModalOpen(true), []);
  const openTrilha = useCallback(() => setIsTrilhaModalOpen(true), []);
  const openInterludio = useCallback(() => setIsInterludioModalOpen(true), []);
  
  const openEditItem = useCallback((id) => { 
      setItemParaEditar(personagem.inventario.find(i => i.inventarioId === id)); setIsModalEditarItemOpen(true); 
  }, [personagem.inventario]);
  
  const openEditNota = useCallback((nota) => { 
      setNotaParaEditar(nota); setIsDiarioModalOpen(true); 
  }, []);

  if (loading) {
      return (
          <div className="ficha-loading" role="status" aria-live="polite">
              <img src="/assets/images/optimized/SimboloSemafinidade-320.webp" alt="Carregando" />
              <h1>Sincronizando Ficha...</h1>
              <button type="button" className="ficha-loading-back" onClick={voltarDaFicha}>
                  <AppIcon name="back" size={17} />
                  {isModoMesa ? 'Voltar à mesa' : 'Voltar ao painel'}
              </button>
          </div>
      );
  }

  if (loadError) {
      return (
          <div className="ficha-load-error" role="alert">
              <img src="/assets/images/optimized/SimboloSemafinidade-320.webp" alt="" aria-hidden="true" />
              <h1>Falha de sincronização</h1>
              <p>{loadError}</p>
              <div>
                  <button type="button" onClick={() => setReloadToken(token => token + 1)}>Tentar novamente</button>
                  <button type="button" onClick={voltarDaFicha}>Voltar</button>
              </div>
          </div>
      );
  }
  
  const LoadingComponent = () => <div className="item-placeholder ficha-view-loading">Carregando aba...</div>;

  return (
    <div
      className={`ficha-convergence-shell ${nexAffinity.unlocked ? 'ficha-convergence-shell--affinity-unlocked' : 'ficha-convergence-shell--awakening'}`}
      data-affinity-stage={nexAffinity.stage}
      style={{ '--nex-awakening-progress': nexAffinity.progress }}
    >
      <div id="transition-overlay"></div>
      {!nexAffinity.unlocked && (
        <div className="nex-awakening-atmosphere" aria-hidden="true">
          <span className="nex-awakening-atmosphere__halo" />
          <span className="nex-awakening-atmosphere__orbit" />
          <span className="nex-awakening-atmosphere__signal" />
        </div>
      )}
      {showAffinityAwakening && (
        <AffinityAwakening onComplete={() => setShowAffinityAwakening(false)} />
      )}

      <ElementRail
        variante="ficha"
        temaAtual={temaVisual}
        onThemeChange={handleThemeChange}
        canChangeTheme={nexAffinity.unlocked}
        nexAtual={nexAffinity.nex}
      />

      <div className="ficha-convergence-workspace">
        <div className="ficha-sticky-stack">
          <Recursos
            dados={personagem.recursos}
            dadosPerseguicao={personagem.perseguicao}
            dadosVisibilidade={personagem.visibilidade}
            info={personagem.info}
            onFichaChange={handleFichaChange}
            buffsTemporarios={personagem.buffsTemporarios}
            onConsumirBuff={consumirBuffTemporario}
            onBack={voltarDaFicha}
            onOpenTracker={onOpenTracker}
          />

          <nav className="ficha-abas" aria-label="Seções da ficha">
            {ABAS_FICHA.map(aba => (
                <button
                  key={aba.id}
                  type="button"
                  className={`ficha-aba-link ${abaAtiva === aba.id ? 'active' : ''}`}
                  onClick={() => setAbaAtiva(aba.id)}
                  aria-current={abaAtiva === aba.id ? 'page' : undefined}
                  data-aba={aba.id}
                >
                    <AppIcon name={aba.icon} size={19} />
                    <span>{aba.label}</span>
                    {aba.id === 'diario' && evidenceCount > 0 && (
                      <span
                        className="ficha-aba-evidence-count"
                        aria-label={`${evidenceCount} ${evidenceCount === 1 ? 'evidência recebida' : 'evidências recebidas'}`}
                      >
                        {evidenceCount > 99 ? '99+' : evidenceCount}
                      </span>
                    )}
                </button>
            ))}
            <button type="button" className="ficha-aba-link ficha-aba-link--interludio" onClick={openInterludio}>
                <AppIcon name="rest" size={19} />
                <span>Interlúdio</span>
            </button>
          </nav>
        </div>

        <NexAwakeningMeter state={nexAffinity} />

        <div className="ficha-content-surface" data-aba-ativa={abaAtiva}>
          <Suspense fallback={<LoadingComponent />}>
        {abaAtiva === 'principal' && (
          <FichaPrincipal
            personagem={personagem} calculados={calculados} fichaInstance={fichaInstance} handleFichaChange={handleFichaChange}
            temaAtual={temaVisual} trilhasPorClasse={trilhasPorClasse} periciasDeOrigem={periciasDeOrigem} onToggleCondicao={toggleCondicao}
            onReaplicarCondicao={reaplicarCondicao}
            onAddPericiaCustom={addPericiaCustom} onRemovePericiaCustom={removePericiaCustom}
          />
        )}
        {abaAtiva === 'inventario' && (
          <Inventario inventario={personagem.inventario} calculados={calculados} onAbrirLoja={openLoja} onRemoveItem={removeItem} onToggleItem={toggleItem} onEditItem={openEditItem} />
        )}
        {abaAtiva === 'rituais' && (
          <Rituais rituais={personagem.rituais} onAbrirModal={openRituais} onRemoveRitual={removeRitual} />
        )}
        {abaAtiva === 'poderes' && (
          <PoderesAprendidos poderesAprendidos={personagem.poderes_aprendidos} info={personagem.info} progressaoClasses={progressaoClasses} progressaoTrilhas={trilhasUnificadas} onAbrirModal={openPoderes} />
        )}
        {abaAtiva === 'progressao' && (
          <ProgressaoHabilidades classe={personagem.info.classe} trilha={personagem.info.trilha} nexString={personagem.info.nex} progressaoClasses={progressaoClasses} progressaoTrilhas={trilhasUnificadas} info={personagem.info} onCriarTrilha={openTrilha} />
        )}
        {abaAtiva === 'diario' && (
          <Diario
            diarioData={personagem.diario || []}
            handoutSession={handoutSession}
            onAbrirModal={openEditNota}
            onRemoveNota={removeNota}
          />
        )}

        {abaAtiva === 'configuracoes' && (
          <ConfiguracoesFicha
            personagem={personagem}
            calculados={calculados}
            onSync={!devVisualMode && usuario && idAlvo ? salvarFichaLocal : undefined}
            onDelete={!devVisualMode && usuario && idAlvo && podeExcluirFicha ? excluirFicha : undefined}
            syncEnabled={!devVisualMode && Boolean(usuario && idAlvo)}
            isModoMesa={isModoMesa}
          />
        )}
        
        {isLojaOpen && <ModalLoja isOpen={isLojaOpen} onClose={() => setIsLojaOpen(false)} onAddItem={handleAddItem} pericias={periciasParaLoja} />}
        {isSelecaoOpen && itemPendente && <ModalSelecao isOpen={isSelecaoOpen} onClose={() => { setIsSelecaoOpen(false); setItemPendente(null); }} item={itemPendente} onSelect={handleVincularItem} />}
        {isRitualModalOpen && <ModalRituais isOpen={isRitualModalOpen} onClose={() => setIsRitualModalOpen(false)} onAddRitual={addRitual} />}
        {isTrilhaModalOpen && <ModalTrilhaCustom isOpen={isTrilhaModalOpen} onClose={() => setIsTrilhaModalOpen(false)} onAddTrilha={handleAddTrilhaCustom} classesList={OpcoesClasse} />}
        {isPoderesModalOpen && <ModalPoderes isOpen={isPoderesModalOpen} onClose={() => setIsPoderesModalOpen(false)} classe={personagem.info.classe} poderesDisponiveis={null} poderesAprendidos={personagem.poderes_aprendidos} onTogglePoder={handleTogglePoder} onAbrirSelecaoPoder={(p) => { setIsPoderesModalOpen(false); setItemPendente({ powerKey: p.key, nome: p.nome, tituloModal: `Elemento`, descricaoModal: 'Escolha:', opcoes: opcoesElemento, tipoVinculo: 'poderElemento' }); setIsSelecaoOpen(true); }} poderesGerais={poderesGerais} poderesParanormais={poderesParanormais} />}
        {isModalEditarItemOpen && <ModalEditarItem isOpen={isModalEditarItemOpen} onClose={() => setIsModalEditarItemOpen(false)} onSave={handleSalvarItemEditado} item={itemParaEditar} pericias={periciasParaLoja} />}
        {isDiarioModalOpen && <ModalNota isOpen={isDiarioModalOpen} onClose={() => setIsDiarioModalOpen(false)} onSave={handleSalvarNota} notaAtual={notaParaEditar} />}
        {isInterludioModalOpen && <ModalInterludio isOpen={isInterludioModalOpen} onClose={() => setIsInterludioModalOpen(false)} onAplicar={handleAplicarInterludioHandler} limitePE={calculados.limite_pe || 1} origem={personagem.info.origem} inventario={personagem.inventario} />}
          </Suspense>
        </div>
      </div>
    </div>
  )
}
