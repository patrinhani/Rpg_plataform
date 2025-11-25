// src/pages/Ficha/index.jsx
import React, { useState, useEffect, Suspense, lazy, useCallback, useRef } from 'react';

// Estilos e Libs
import '../../App.css'; 
import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from '../../lib/animacoes.js'; 
import { ficha as FichaClass } from '../../lib/personagem.js'; 
import { 
    database, 
    poderesCombatente, 
    poderesEspecialista, 
    poderesOcultista, 
    poderesGerais, 
    poderesParanormais,
    getPatenteInfo, 
    Patentes,       
    OpcoesClasse 
} from '../../lib/database.js';

// --- CORREÇÃO AQUI: Importação unificada e sem duplicatas ---
import { progressaoClasses, getMergedTrilhas, groupTrilhasByClass } from '../../lib/progressao.js'; 

// Contexto e Firebase
import { useAuth } from '../../contexts/AuthContext.jsx';
import { db } from '../../lib/firebase'; 
import { doc, setDoc, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore'; 

// Componentes (Lazy Loading)
const AnimacaoSangue = lazy(() => import('../../components/AnimacaoSangue.jsx')); 
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
import FichaPrincipal from '../../components/FichaPrincipal.jsx'; 
import Recursos from '../../components/ficha/recursos.jsx';
import ModalInterludio from '../../components/ModalInterludio.jsx';

// Constantes Auxiliares
const allPoderesList = [...poderesParanormais, ...poderesGerais, ...poderesCombatente, ...poderesEspecialista, ...poderesOcultista];
const opcoesElemento = [
    { nome: 'Sangue', valor: 'sangue' },
    { nome: 'Morte', valor: 'morte' },
    { nome: 'Conhecimento', valor: 'conhecimento' },
    { nome: 'Energia', valor: 'energia' },
];
const listaTodasPericias = Object.keys(FichaClass.getDados().pericias); 
const opcoesPericia = listaTodasPericias
  .filter(p => p !== 'luta' && p !== 'pontaria') 
  .map(p => ({ nome: p.charAt(0).toUpperCase() + p.slice(1), valor: p }));

// Helper Debounce
function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

export default function Ficha({ fichaId, mesaContexto }) {
  const { usuario } = useAuth(); 

  // --- ESTADOS ---
  const [personagem, setPersonagem] = useState(FichaClass.getDados());
  const [calculados, setCalculados] = useState({
    defesaTotal: 10, cargaAtual: 0, cargaMax: 2, periciasTreinadas: 0, periciasTotal: 0, 
    bonusPericia: {}, canChangeTheme: false, patente: Patentes[0], 
    bloqueio_rd: '—', esquiva_bonus: '—', tem_contra_ataque: false, 
  });
  const [tema, setTema] = useState(() => localStorage.getItem("temaFichaOrdem") || "tema-ordem");
  const [abaAtiva, setAbaAtiva] = useState('principal'); 
  const [trilhasPorClasse, setTrilhasPorClasse] = useState({});
  const [periciasDeOrigem, setPericiasDeOrigem] = useState([]);
  
  const [loading, setLoading] = useState(true); 
  const docRef = useRef(null); 
  const isInitializing = useRef(true); 
  
  // Modais
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
  const [isSangueAnimVisible, setIsSangueAnimVisible] = useState(false);
  const [isInterludioModalOpen, setIsInterludioModalOpen] = useState(false);

  // --- PERSISTÊNCIA ---
  const saveToFirestore = useCallback(async (dadosCompletos) => {
    if (docRef.current) {
        try {
            await updateDoc(docRef.current, dadosCompletos); 
        } catch (e) {
            console.error("Erro ao salvar no Firestore:", e);
        }
    }
  }, []);
  
  const debouncedSave = useRef(debounce(saveToFirestore, 1000)).current; 

  // --- CONEXÃO COM FIRESTORE ---
  useEffect(() => {
    if (!usuario || !usuario.uid) {
        setLoading(false);
        return;
    }
    
    if (mesaContexto) {
        docRef.current = doc(db, "mesas", mesaContexto, "personagens", fichaId || usuario.uid);
    } else {
        const idAlvo = fichaId || usuario.uid;
        docRef.current = doc(db, "users", usuario.uid, "personagens", idAlvo);
    }
    
    const unsubscribe = onSnapshot(docRef.current, async (docSnap) => {
        if (docSnap.exists()) {
            const dadosFirestore = docSnap.data();
            FichaClass.carregarDados(dadosFirestore);
            handleFichaChange(null, null, null, true); 
        } else if (isInitializing.current) {
            // Apenas cria se for o dono da ficha (evita que mestre crie ficha vazia ao clicar em jogador inexistente)
            if (!mesaContexto || fichaId === usuario.uid) {
                console.log("Criando ficha inicial...");
                const novosDados = FichaClass.getDados();
                novosDados.info.jogador = usuario.displayName || "Agente";
                novosDados.info.nome = "Novo Agente";
                await setDoc(docRef.current, novosDados);
            }
        }
        if (isInitializing.current) isInitializing.current = false;
        setLoading(false);
    }, (error) => { console.error("Erro Firestore:", error); setLoading(false); });

    return () => unsubscribe();
  }, [usuario, mesaContexto, fichaId]);

  // --- EFEITOS VISUAIS ---
  useEffect(() => {
     if (personagem.info.tema && personagem.info.tema !== tema) {
         setTema(personagem.info.tema);
     }
  }, [personagem.info.tema]);

  useEffect(() => {
    const temaAtual = document.documentElement.dataset.tema || "tema-ordem";
    if (tema === temaAtual) return; 
    if (tema === "tema-sangue") setIsSangueAnimVisible(true);
    else aplicarTemaComAnimacao(tema, temaAtual, () => {
        document.documentElement.dataset.tema = tema;
        localStorage.setItem("temaFichaOrdem", tema);
    });
  }, [tema]); 

  const handleThemeChange = (novoTema) => {
      setTema(novoTema); 
      handleFichaChange('info', 'tema', novoTema); 
  };

  useEffect(() => {
    if (loading) return;
    const parallaxContainer = document.getElementById("parallax-background");
    const parallaxSimbolos = parallaxContainer ? parallaxContainer.querySelectorAll(".simbolo-parallax") : null;
    if (!parallaxContainer || !parallaxSimbolos || parallaxSimbolos.length === 0) return;
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const moveX = (clientX - centerX) * -0.015;
      const moveY = (clientY - centerY) * -0.015;
      parallaxSimbolos.forEach((simbolo) => {
        simbolo.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [loading]);

  useEffect(() => {
    const customTrilhas = FichaClass.getTrilhasPersonalizadas(); 
    const trilhasUnificadas = getMergedTrilhas(customTrilhas); 
    const trilhasAgrupadas = groupTrilhasByClass(trilhasUnificadas);
    setTrilhasPorClasse(trilhasAgrupadas);
  }, [personagem.trilhas_personalizadas, personagem.info.classe]); 

  useEffect(() => {
      const origemAtual = personagem.info.origem;
      if (database.periciasPorOrigem && database.periciasPorOrigem[origemAtual]) {
          setPericiasDeOrigem(database.periciasPorOrigem[origemAtual].fixas || []);
      } else {
          setPericiasDeOrigem([]);
      }
  }, [personagem.info.origem]);

  useEffect(() => {
    const title = personagem.info.nome ? `${personagem.info.nome} - NEX ${personagem.info.nex || "0%"}` : "Ficha";
    document.title = title;
  }, [personagem.info.nome, personagem.info.nex]); 

  // --- HANDLER CENTRAL ---
  function handleFichaChange(secao, campo, valor, skipSave = false) {
    let skipUpdate = false;
    if (secao) {
        if (secao === 'info') {
            if (campo === 'nex') { let nex = parseInt(String(valor).replace(/[^0-9]/g, '')) || 0; if (nex > 100) nex = 100; valor = `${nex}%`; FichaClass.setInfo(campo, valor); } 
            else if (campo === 'origem') { const nova = valor; const antiga = FichaClass.getDados().info.origem; if (antiga && database.periciasPorOrigem?.[antiga]?.fixas) database.periciasPorOrigem[antiga].fixas.forEach(p => { if (FichaClass.getBonusTotalPericia(p) === 5) FichaClass.setTreinoPericia(p, 0); }); if (database.periciasPorOrigem?.[nova]?.fixas) database.periciasPorOrigem[nova].fixas.forEach(p => { if (FichaClass.getBonusTotalPericia(p) === 0) FichaClass.setTreinoPericia(p, 5); }); if (antiga) FichaClass.poderes_aprendidos = FichaClass.poderes_aprendidos.filter(p => !p.isOrigemPower); const dadosOrigem = database.periciasPorOrigem?.[nova]; if (dadosOrigem && dadosOrigem.poder) FichaClass.addPoder({ key: `origem_${nova}`, nome: dadosOrigem.poder.nome, descricao: dadosOrigem.poder.descricao, tipo: "Origem", isOrigemPower: true }); FichaClass.setInfo(campo, valor); } 
            else if (campo === 'trilha') { const trilha = valor; const dados = getMergedTrilhas(FichaClass.getTrilhasPersonalizadas())[trilha]; if (dados && dados.requiresChoice === 'elemento' && trilha !== 'nenhuma') { setItemPendente({ trilhaValue: trilha, tituloModal: `Elemento da Trilha`, descricaoModal: `Escolha:`, opcoes: opcoesElemento, tipoVinculo: 'trilhaElemento' }); setIsSelecaoOpen(true); skipUpdate = true; } else FichaClass.setInfo(campo, valor); } 
            else if (campo === 'classe') { const novaClasse = valor; const trilhasValidas = Object.values(trilhasPorClasse[novaClasse.toLowerCase()] || {}).map(t => t.key); const trilhaAtual = FichaClass.getDados().info.trilha; if (trilhaAtual !== 'nenhuma' && !trilhasValidas.includes(trilhaAtual)) { FichaClass.setInfo('trilha', 'nenhuma'); FichaClass.setInfo(`${trilhaAtual}_elemento`, ''); } FichaClass.setInfo(campo, valor); } 
            else FichaClass.setInfo(campo, valor);
        } 
        else if (secao === 'atributos') FichaClass.setAtributo(campo, valor); 
        else if (secao === 'recursos') FichaClass.setRecurso(campo, valor); 
        else if (secao === 'perseguicao') FichaClass.setPerseguicao(campo, valor); 
        else if (secao === 'visibilidade_mudar') FichaClass.setVisibilidade(campo, valor);
        else if (secao === 'defesa') FichaClass.setDefesa(campo, valor); 
        else if (secao === 'pericias') FichaClass.setTreinoPericia(campo, valor); 
        else if (secao === 'bonusManuais') FichaClass.setBonusManual(campo, valor);
        else if (secao === 'resistencias') FichaClass.setResistencia(campo, valor);
    }
    
    if (skipUpdate) return;
    FichaClass.calcularValoresMaximos(); 
    const novosDados = FichaClass.getDados(); 
    
    const agi = FichaClass.getAtributoFinal('agi'); const vig = FichaClass.getAtributoFinal('vig'); const int = FichaClass.getAtributoFinal('int');
    const equip = novosDados.defesa.equip || 0; const outros = parseInt(novosDados.defesa.outros) || 0;
    let bonusOrigemDefesa = (novosDados.info.origem === "policial") ? 2 : 0;
    let penalidadeDefesa = 0;
    if (novosDados.condicoesAtivas.includes('vulneravel')) penalidadeDefesa -= 5;
    if (novosDados.condicoesAtivas.includes('desprevenido') || novosDados.condicoesAtivas.includes('atordoado') || novosDados.condicoesAtivas.includes('cego')) penalidadeDefesa -= 5;
    if (novosDados.condicoesAtivas.includes('indefeso') || novosDados.condicoesAtivas.includes('inconsciente')) penalidadeDefesa -= 10; 
    if (novosDados.condicoesAtivas.includes('agarrado') || novosDados.condicoesAtivas.includes('caido')) penalidadeDefesa -= 5; 
    const defesaTotal = 10 + agi + equip + outros + bonusOrigemDefesa + penalidadeDefesa; 
    const treino_fortitude = parseInt(novosDados.pericias.fortitude) || 0; const treino_reflexos = parseInt(novosDados.pericias.reflexos) || 0; const treino_luta = parseInt(novosDados.pericias.luta) || 0;
    const bonus_fortitude = Math.floor(treino_fortitude / 5) + vig; const bonus_reflexos = Math.floor(treino_reflexos / 5) + agi;
    const nexNum = parseInt(String(novosDados.info.nex || '0%').replace(/[^0-9]/g, '')) || 0;
    const canChangeTheme = nexNum >= 50; 
    const bonusPericiaCalculado = {}; Object.keys(novosDados.pericias).forEach(key => { bonusPericiaCalculado[key] = FichaClass.getBonusPericiaInventario(key); });
    let bonusClassePericias = 0; switch (novosDados.info.classe) { case "combatente": bonusClassePericias = 1 + int; break; case "especialista": bonusClassePericias = 7 + int; break; case "ocultista": bonusClassePericias = 3 + int; break; case "sobrevivente": bonusClassePericias = 0; break; }
    let bonusOrigemPericias = 0; if (database?.periciasPorOrigem?.[novosDados.info.origem]) { const { fixas, escolhas } = database.periciasPorOrigem[novosDados.info.origem]; bonusOrigemPericias += fixas.length + (escolhas ? escolhas.reduce((acc, e) => acc + e.quantidade, 0) : 0); }
    const periciasTotal = Math.max(0, bonusClassePericias + bonusOrigemPericias); let periciasTreinadas = Object.values(novosDados.pericias).filter(v => parseInt(v) >= 5).length;
    const ppAtual = parseInt(novosDados.info.prestigio, 10) || 0; const patenteInfo = getPatenteInfo(ppAtual) || Patentes[0]; const cargaMax = FichaClass.getMaxPeso(); 
    setCalculados({ defesaTotal, cargaAtual: FichaClass.getPesoTotal(), cargaMax, periciasTreinadas, periciasTotal, bonusPericia: bonusPericiaCalculado, canChangeTheme, patente: patenteInfo, bloqueio_rd: (treino_fortitude >= 5) ? bonus_fortitude : '—', esquiva_bonus: (treino_reflexos >= 5) ? bonus_reflexos : '—', tem_contra_ataque: treino_luta >= 5, });
    setPersonagem(novosDados);
    if (!isInitializing.current && !skipSave) { debouncedSave(novosDados); }
  }

  // --- HANDLERS MODAIS ---
  const handleToggleCondicao = (condicaoId) => { FichaClass.toggleCondicao(condicaoId); handleFichaChange(null, null, null); };
  const handleAplicarInterludio = (opcoes) => { const resultado = FichaClass.aplicarInterludio(opcoes); handleFichaChange(null, null, null); alert(`Interlúdio Finalizado!\nRecuperado: PV: ${resultado.pv} | PE: ${resultado.pe} | SAN: ${resultado.san}`); };
  const handleAddItem = (itemOriginal) => { if (itemOriginal.tipoBonus === 'generico') { setItemPendente({ ...itemOriginal, tituloModal: `Vincular: ${itemOriginal.nome}`, descricaoModal: 'Escolha uma perícia:', opcoes: opcoesPericia, tipoVinculo: 'pericia' }); setIsSelecaoOpen(true); setIsLojaOpen(false); } else if (itemOriginal.tipoBonus === 'escolhaElemento') { setItemPendente({ ...itemOriginal, tituloModal: `Escolher Elemento`, descricaoModal: 'Escolha:', opcoes: opcoesElemento, tipoVinculo: 'elemento' }); setIsSelecaoOpen(true); setIsLojaOpen(false); } else { FichaClass.addItemInventario(itemOriginal); handleFichaChange(null, null, null); } };
  const handleRemoveItem = (inventarioId) => { FichaClass.removeItemInventario(inventarioId); handleFichaChange(null, null, null); };
  const handleToggleItem = (inventarioId) => { FichaClass.toggleIgnorarCalculos(inventarioId); handleFichaChange(null, null, null); };
  const handleSalvarItemEditado = (itemAtualizado) => { if (itemParaEditar) { FichaClass.updateItemInventario(itemParaEditar.inventarioId, itemAtualizado); setIsModalEditarItemOpen(false); handleFichaChange(null, null, null); } };
  const handleVincularItem = (valorSelecionado) => { if (!itemPendente) return; if (itemPendente.tipoVinculo === 'poderElemento') { const poderOriginal = allPoderesList.find(p => p.key === itemPendente.powerKey); if (poderOriginal) { const el = valorSelecionado.toLowerCase(); const poderVinculado = { ...poderOriginal, nome: `${poderOriginal.nome} (${valorSelecionado})`, elemento: el, requiresChoice: null, key: `${poderOriginal.key}_${el}` }; FichaClass.addPoder(poderVinculado); handleFichaChange(null, null, null); } } else if (itemPendente.tipoVinculo === 'trilhaElemento') { const trilha = itemPendente.trilhaValue; FichaClass.setInfo('trilha', trilha); FichaClass.setInfo(`${trilha}_elemento`, valorSelecionado); handleFichaChange(null, null, null); } else { let itemVinculado = { ...itemPendente }; if (itemPendente.tipoVinculo === 'pericia') itemVinculado.periciaVinculada = valorSelecionado; else if (itemPendente.tipoVinculo === 'elemento') { itemVinculado.elemento = valorSelecionado; itemVinculado.nome = itemPendente.nome.replace("(Elemento)", `(${valorSelecionado})`); } itemVinculado.tipoBonus = null; FichaClass.addItemInventario(itemVinculado); handleFichaChange(null, null, null); } setIsSelecaoOpen(false); setItemPendente(null); };
  const handleAddRitual = (ritual) => { FichaClass.addRitualInventario(ritual); handleFichaChange(null, null, null); };
  const handleRemoveRitual = (inventarioId) => { FichaClass.removeRitualInventario(inventarioId); handleFichaChange(null, null, null); };
  const handleAddTrilha = (trilhaData) => { FichaClass.addTrilhaPersonalizada(trilhaData); handleFichaChange(null, null, null); setIsTrilhaModalOpen(false); };
  const getPoderesDisponiveis = (classe) => { switch (classe.toLowerCase()) { case 'combatente': return poderesCombatente; case 'especialista': return poderesEspecialista; case 'ocultista': return poderesOcultista; default: return []; } };
  const handleTogglePoder = (poder) => { const aprendidos = FichaClass.getPoderesAprendidos(); const isAprendido = aprendidos.some(p => p.key === poder.key || p.key.startsWith(`${poder.key}_`)); if (isAprendido) { const keysToRemove = aprendidos.filter(p => p.key === poder.key || p.key.startsWith(`${poder.key}_`)).map(p => p.key); keysToRemove.forEach(key => FichaClass.removePoder(key)); } else { if (poder.requiresChoice) { setItemPendente({ powerKey: poder.key, nome: poder.nome, tituloModal: `Elemento para ${poder.nome}`, descricaoModal: 'Selecione:', opcoes: opcoesElemento, tipoVinculo: 'poderElemento' }); setIsSelecaoOpen(true); } else FichaClass.addPoder(poder); } handleFichaChange(null, null, null); };
  const handleSalvarNota = (dadosNota) => { if (notaParaEditar) FichaClass.updateNotaDiario(notaParaEditar.id, dadosNota); else FichaClass.addNotaDiario(dadosNota); handleFichaChange(null, null, null); setIsDiarioModalOpen(false); };
  const handleRemoverNota = (id) => { if(confirm("Apagar anotação?")) { FichaClass.removeNotaDiario(id); handleFichaChange(null,null,null); }};
  
  const salvarFicha = () => { debouncedSave(FichaClass.getDados()); alert("Ficha salva!"); };
  const limparFicha = () => { if(window.confirm("Apagar ficha permanentemente?")) { if(docRef.current) deleteDoc(docRef.current); window.location.reload(); } };
  const exportarFicha = () => { const dados = FichaClass.getDados(); const blob = new Blob([JSON.stringify(dados, null, 2)], {type: "application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `ficha_${dados.info.nome || "agente"}.json`; a.click(); };
  const importarFicha = (arquivo) => { const reader = new FileReader(); reader.onload = (e) => { try { const json = JSON.parse(e.target.result); FichaClass.carregarDados(json); saveToFirestore(FichaClass.getDados()); handleFichaChange(null, null, null, true); alert("Ficha importada!"); } catch(err) { alert("Erro ao ler arquivo JSON."); } }; reader.readAsText(arquivo); };

  if (loading) {
      return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', color: 'var(--cor-destaque)', backgroundColor: '#050a10' }}>
              <img src="/assets/images/SimboloSemafinidade.webp" style={{ width: '100px', filter: 'drop-shadow(0 0 10px var(--cor-destaque))' }} alt="Carregando" />
              <h1>Sincronizando Ficha...</h1>
          </div>
      );
  }
  
  const controlesProps = {
    temaAtual: tema, onSave: salvarFicha, onClear: limparFicha, onExport: exportarFicha, onImport: importarFicha,
    onThemeChange: handleThemeChange,
    canChangeTheme: calculados.canChangeTheme
  };

  const LoadingComponent = () => <div className="item-placeholder" style={{padding: '50px', textAlign: 'center'}}>Carregando Aba...</div>;

  return (
    <>
      <div id="parallax-background">
        <img src="/assets/images/SimboloSemafinidade.webp" id="simbolo-ordem" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloSangue.webp" id="simbolo-sangue" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloMorte.webp" id="simbolo-morte" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloConhecimento.webp" id="simbolo-conhecimento" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloEnergia.webp" id="simbolo-energia" className="simbolo-parallax" alt=""/>
      </div>
      
      <div id="transition-overlay"></div>

      <Suspense fallback={null}>
        {isSangueAnimVisible && <AnimacaoSangue isVisible={isSangueAnimVisible} onComplete={() => { setIsSangueAnimVisible(false); aplicarTemaSemAnimacao('tema-sangue'); }} />}
      </Suspense>

      <Recursos dados={personagem.recursos} dadosPerseguicao={personagem.perseguicao} dadosVisibilidade={personagem.visibilidade} info={personagem.info} onFichaChange={handleFichaChange} />

      <nav className="ficha-abas">
        {['principal', 'inventario', 'rituais', 'poderes', 'progressao', 'diario'].map(aba => (
            <button key={aba} className={`ficha-aba-link ${abaAtiva === aba ? 'active' : ''}`} onClick={() => setAbaAtiva(aba)}>
                {aba.charAt(0).toUpperCase() + aba.slice(1)}
            </button>
        ))}
        <button className="ficha-aba-link" style={{ color: 'var(--cor-destaque)', fontWeight: 'bold', marginLeft: 'auto' }} onClick={() => setIsInterludioModalOpen(true)}>
            💤 Interlúdio
        </button>
      </nav>
      
      <Suspense fallback={<LoadingComponent />}>
        {abaAtiva === 'principal' && (
          <FichaPrincipal
            personagem={personagem} calculados={calculados} fichaInstance={FichaClass} handleFichaChange={handleFichaChange}
            controlesProps={controlesProps} trilhasPorClasse={trilhasPorClasse} periciasDeOrigem={periciasDeOrigem} onToggleCondicao={handleToggleCondicao} 
          />
        )}
        {abaAtiva === 'inventario' && (
          <Inventario inventario={personagem.inventario} onAbrirLoja={() => setIsLojaOpen(true)} onRemoveItem={handleRemoveItem} onToggleItem={handleToggleItem} onEditItem={(id) => { setItemParaEditar(personagem.inventario.find(i => i.inventarioId === id)); setIsModalEditarItemOpen(true); }} />
        )}
        {abaAtiva === 'rituais' && (
          <Rituais rituais={personagem.rituais} onAbrirModal={() => setIsRitualModalOpen(true)} onRemoveRitual={(id) => { FichaClass.removeRitualInventario(id); handleFichaChange(null,null,null); }} />
        )}
        {abaAtiva === 'poderes' && (
          <PoderesAprendidos poderesAprendidos={personagem.poderes_aprendidos} onAbrirModal={() => setIsPoderesModalOpen(true)} />
        )}
        {abaAtiva === 'progressao' && (
          <div className="ficha-aba-conteudo active" style={{maxWidth: '1400px', margin: '0 auto'}}>
            <button className="btn-add-item btn-criar-trilha" onClick={() => setIsTrilhaModalOpen(true)}>+ Criar Trilha</button>
            <ProgressaoHabilidades classe={personagem.info.classe} trilha={personagem.info.trilha} nexString={personagem.info.nex} progressaoClasses={progressaoClasses} progressaoTrilhas={getMergedTrilhas(personagem.trilhas_personalizadas)} info={personagem.info} />
          </div>
        )}
        {abaAtiva === 'diario' && (
          <Diario diarioData={FichaClass.diario || []} onAbrirModal={(nota) => { setNotaParaEditar(nota); setIsDiarioModalOpen(true); }} onRemoveNota={handleRemoverNota} />
        )}

        <footer><p></p></footer>
        
        {/* Modais */}
        {isLojaOpen && <ModalLoja isOpen={isLojaOpen} onClose={() => setIsLojaOpen(false)} onAddItem={handleAddItem} pericias={listaTodasPericias} />}
        {isSelecaoOpen && itemPendente && <ModalSelecao isOpen={isSelecaoOpen} onClose={() => { setIsSelecaoOpen(false); setItemPendente(null); }} item={itemPendente} onSelect={handleVincularItem} />}
        {isRitualModalOpen && <ModalRituais isOpen={isRitualModalOpen} onClose={() => setIsRitualModalOpen(false)} onAddRitual={handleAddRitual} />}
        {isTrilhaModalOpen && <ModalTrilhaCustom isOpen={isTrilhaModalOpen} onClose={() => setIsTrilhaModalOpen(false)} onAddTrilha={handleAddTrilha} classesList={OpcoesClasse} />}
        {isPoderesModalOpen && <ModalPoderes isOpen={isPoderesModalOpen} onClose={() => setIsPoderesModalOpen(false)} classe={personagem.info.classe} poderesDisponiveis={getPoderesDisponiveis(personagem.info.classe)} poderesAprendidos={personagem.poderes_aprendidos} onTogglePoder={handleTogglePoder} onAbrirSelecaoPoder={(p) => { setItemPendente({ powerKey: p.key, nome: p.nome, tituloModal: `Elemento`, descricaoModal: 'Escolha:', opcoes: opcoesElemento, tipoVinculo: 'poderElemento' }); setIsSelecaoOpen(true); }} poderesGerais={poderesGerais} poderesParanormais={poderesParanormais} />}
        {isModalEditarItemOpen && <ModalEditarItem isOpen={isModalEditarItemOpen} onClose={() => setIsModalEditarItemOpen(false)} onSave={handleSalvarItemEditado} item={itemParaEditar} pericias={listaTodasPericias} />}
        {isDiarioModalOpen && <ModalNota isOpen={isDiarioModalOpen} onClose={() => setIsDiarioModalOpen(false)} onSave={handleSalvarNota} notaAtual={notaParaEditar} />}
        {isInterludioModalOpen && <ModalInterludio isOpen={isInterludioModalOpen} onClose={() => setIsInterludioModalOpen(false)} onAplicar={handleAplicarInterludio} limitePE={FichaClass.calculosDetalhados.limite_pe} />}
      </Suspense> 
    </>
  )
}