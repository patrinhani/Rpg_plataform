// src/pages/Ficha/index.jsx
import React, { useState, useEffect, Suspense, lazy, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import '../../App.css'; 
import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from '../../lib/animacoes.js'; 
import { 
    poderesCombatente, poderesEspecialista, poderesOcultista, 
    poderesGerais, poderesParanormais, OpcoesClasse 
} from '../../lib/database.js';
import { progressaoClasses, getMergedTrilhas, groupTrilhasByClass } from '../../lib/progressao.js'; 

import { useAuth } from '../../contexts/AuthContext.jsx';
import { useFicha } from '../../contexts/FichaContext.jsx';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { db } from '../../lib/firebase'; 
import { doc, updateDoc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'; 

// Lazy Loading de Componentes
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
const ModalInterludio = lazy(() => import('../../components/ModalInterludio.jsx'));
const ExportFicha = lazy(() => import('../../components/ExportFicha.jsx'));
import FichaPrincipal from '../../components/FichaPrincipal.jsx'; 
import Recursos from '../../components/ficha/recursos.jsx';

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

function debounce(func, delay) {
    let timeoutId;
    return function(...args) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

export default function Ficha({ fichaId: propFichaId, mesaContexto }) {
  const { fichaId: paramFichaId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth(); 
  const { showAlert, showConfirm } = useDialog(); 
  
  const { 
      personagem, calculados, carregarFicha, atualizarFicha, fichaInstance,
      addItem, removeItem, updateItem, toggleItem,
      addRitual, removeRitual,
      addPoder, removePoder,
      addTrilhaCustom, 
      addNota, updateNota, removeNota,
      toggleCondicao, aplicarInterludio
  } = useFicha();
  
  const idAlvo = propFichaId || paramFichaId || usuario?.uid;
  const isModoMesa = !!mesaContexto;

  const [tema, setTema] = useState(() => localStorage.getItem("temaFichaOrdem") || "tema-ordem");
  const [abaAtiva, setAbaAtiva] = useState('principal'); 
  const [trilhasPorClasse, setTrilhasPorClasse] = useState({});
  const [periciasDeOrigem, setPericiasDeOrigem] = useState([]);
  
  const [loading, setLoading] = useState(true); 
  const docRef = useRef(null); 
  const isInitializing = useRef(true); 
  
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
  const [isSangueAnimVisible, setIsSangueAnimVisible] = useState(false);
  const [isInterludioModalOpen, setIsInterludioModalOpen] = useState(false);

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

  // --- 1. SINCRONIZAÇÃO EM TEMPO REAL ---
  useEffect(() => {
    if (!usuario || !idAlvo) {
        setLoading(false);
        return;
    }
    
    if (isModoMesa) {
        docRef.current = doc(db, "mesas", mesaContexto, "personagens", idAlvo);
    } else {
        // CORREÇÃO DE CAMINHO: Agora busca na subcoleção correta
        docRef.current = doc(db, "users", usuario.uid, "personagens", idAlvo);
    }
    
    const unsubscribe = onSnapshot(docRef.current, async (docSnap) => {
        if (docSnap.exists()) {
            const dadosFirestore = docSnap.data();
            isRemoteUpdate.current = true; // Marca que veio do banco
            carregarFicha(dadosFirestore); 
        } else if (isInitializing.current) {
             if (!isModoMesa || propFichaId === usuario.uid) {
                console.log("Criando ficha inicial...");
                await setDoc(docRef.current, personagem); 
             }
        }
        if (isInitializing.current) isInitializing.current = false;
        setLoading(false);
    }, (error) => { console.error("Erro Firestore:", error); setLoading(false); });

    return () => unsubscribe();
  }, [usuario, mesaContexto, idAlvo, carregarFicha]);

  // --- 2. SALVAMENTO OTIMIZADO ---
  useEffect(() => {
      if (!loading && !isInitializing.current) {
          // Se for update remoto, ignora o salvamento
          if (isRemoteUpdate.current) {
              isRemoteUpdate.current = false;
              return;
          }
          debouncedSave(personagem);
      }
  }, [personagem, loading]);

  // --- 3. SINCRONIZAÇÃO DO TEMA ---
  useEffect(() => {
     if (personagem.info.tema && personagem.info.tema !== tema) {
         setTema(personagem.info.tema);
     }
  }, [personagem.info.tema, tema]);

  useEffect(() => {
    const temaNoDOM = document.documentElement.dataset.tema;
    if (tema !== temaNoDOM) {
        if (!temaNoDOM) {
            aplicarTemaSemAnimacao(tema);
        } else {
            if (tema === "tema-sangue") setIsSangueAnimVisible(true);
            else aplicarTemaComAnimacao(tema, temaNoDOM, () => {
                document.documentElement.dataset.tema = tema;
                localStorage.setItem("temaFichaOrdem", tema);
            });
        }
    }
  }, [tema]); 

  useEffect(() => {
    return () => {
        aplicarTemaSemAnimacao('tema-ordem');
        document.documentElement.dataset.tema = 'tema-ordem';
    };
  }, []);

  // --- 4. MEMOIZAÇÃO DE DADOS COMPLEXOS ---
  useEffect(() => {
    if (loading) return;
    const customTrilhas = personagem.trilhas_personalizadas || []; 
    const trilhasUnificadas = getMergedTrilhas(customTrilhas); 
    const trilhasAgrupadas = groupTrilhasByClass(trilhasUnificadas);
    setTrilhasPorClasse(trilhasAgrupadas);
  }, [personagem.trilhas_personalizadas, personagem.info.classe, loading]); 

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
          setItemPendente({ ...itemOriginal, tituloModal: `Vincular: ${itemOriginal.nome}`, descricaoModal: 'Escolha uma perícia:', opcoes: opcoesPericia, tipoVinculo: 'pericia' }); setIsSelecaoOpen(true); setIsLojaOpen(false); 
      } else if (itemOriginal.tipoBonus === 'escolhaElemento') { 
          setItemPendente({ ...itemOriginal, tituloModal: `Escolher Elemento`, descricaoModal: 'Escolha:', opcoes: opcoesElemento, tipoVinculo: 'elemento' }); setIsSelecaoOpen(true); setIsLojaOpen(false); 
      } else { 
          addItem(itemOriginal); 
      } 
  }, [addItem]);

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
  
  const handleAplicarInterludioHandler = useCallback((opcoes) => { 
      const resultado = aplicarInterludio(opcoes); 
      showAlert(`Interlúdio Finalizado!\nRecuperado: PV: ${resultado.pv} | PE: ${resultado.pe} | SAN: ${resultado.san}`, "Interlúdio"); 
  }, [aplicarInterludio, showAlert]);

  const salvarFichaLocal = useCallback(() => { 
      debouncedSave(personagem); 
      showAlert("Ficha sincronizada com sucesso.", "Salvo"); 
  }, [debouncedSave, personagem, showAlert]);
  
  const limparFicha = useCallback(async () => { 
      const confirmado = await showConfirm("Apagar ficha permanentemente?", "Limpar");
      if(confirmado) { 
          if(docRef.current) deleteDoc(docRef.current); 
          navigate('/'); 
      } 
  }, [showConfirm, navigate]);
  
  const exportarFicha = useCallback(() => { 
      const blob = new Blob([JSON.stringify(personagem, null, 2)], {type: "application/json"}); 
      const url = URL.createObjectURL(blob); 
      const a = document.createElement("a"); 
      a.href = url; a.download = `ficha_${personagem.info.nome || "agente"}.json`; a.click(); 
  }, [personagem]);
  
  // REMOVI A FUNÇÃO 'importarFicha' PARA USAR APENAS O DASHBOARD

  // Props de Controles Memoizadas
  const controlesProps = useMemo(() => ({
    temaAtual: tema, 
    onSave: salvarFichaLocal, 
    onClear: limparFicha, 
    onExport: exportarFicha, 
    // onImport removido para evitar conflitos com o Dashboard
    onThemeChange: handleThemeChange, 
    canChangeTheme: calculados.canChangeTheme
  }), [tema, salvarFichaLocal, limparFicha, exportarFicha, handleThemeChange, calculados.canChangeTheme]);

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

  const VoltarBtn = !isModoMesa ? <button onClick={() => navigate('/')} className="btn-voltar-flutuante" style={{ top: '15px' }}>← DASHBOARD</button> : null;

  if (loading) {
      return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', color: 'var(--cor-destaque)', backgroundColor: '#050a10' }}>
              <img src="/assets/images/SimboloSemafinidade.webp" style={{ width: '100px', filter: 'drop-shadow(0 0 10px var(--cor-destaque))' }} alt="Carregando" />
              <h1>Sincronizando Ficha...</h1>
          </div>
      );
  }
  
  const LoadingComponent = () => <div className="item-placeholder" style={{padding: '50px', textAlign: 'center'}}>Carregando Aba...</div>;

  return (
    <>
      {VoltarBtn}
      
      <div id="transition-overlay"></div>

      <Suspense fallback={null}>
        {isSangueAnimVisible && <AnimacaoSangue isVisible={isSangueAnimVisible} onComplete={() => { setIsSangueAnimVisible(false); aplicarTemaSemAnimacao('tema-sangue'); }} />}
      </Suspense>

      <Recursos dados={personagem.recursos} dadosPerseguicao={personagem.perseguicao} dadosVisibilidade={personagem.visibilidade} info={personagem.info} onFichaChange={handleFichaChange} />

      <nav className="ficha-abas">
        {['principal', 'inventario', 'rituais', 'poderes', 'progressao', 'diario', 'exportar'].map(aba => (
            <button key={aba} className={`ficha-aba-link ${abaAtiva === aba ? 'active' : ''}`} onClick={() => setAbaAtiva(aba)}>
                {aba.charAt(0).toUpperCase() + aba.slice(1)}
            </button>
        ))}
        <button className="ficha-aba-link" style={{ color: 'var(--cor-destaque)', fontWeight: 'bold', marginLeft: 'auto' }} onClick={openInterludio}>
            💤 Interlúdio
        </button>
      </nav>
      
      <Suspense fallback={<LoadingComponent />}>
        {abaAtiva === 'principal' && (
          <FichaPrincipal
            personagem={personagem} calculados={calculados} fichaInstance={fichaInstance} handleFichaChange={handleFichaChange}
            controlesProps={controlesProps} trilhasPorClasse={trilhasPorClasse} periciasDeOrigem={periciasDeOrigem} onToggleCondicao={toggleCondicao} 
          />
        )}
        {abaAtiva === 'inventario' && (
          <Inventario inventario={personagem.inventario} onAbrirLoja={openLoja} onRemoveItem={removeItem} onToggleItem={toggleItem} onEditItem={openEditItem} />
        )}
        {abaAtiva === 'rituais' && (
          <Rituais rituais={personagem.rituais} onAbrirModal={openRituais} onRemoveRitual={removeRitual} />
        )}
        {abaAtiva === 'poderes' && (
          <PoderesAprendidos poderesAprendidos={personagem.poderes_aprendidos} onAbrirModal={openPoderes} />
        )}
        {abaAtiva === 'progressao' && (
          <div className="ficha-aba-conteudo active" style={{maxWidth: '1400px', margin: '0 auto'}}>
            <button className="btn-add-item btn-criar-trilha" onClick={openTrilha}>+ Criar Trilha</button>
            <ProgressaoHabilidades classe={personagem.info.classe} trilha={personagem.info.trilha} nexString={personagem.info.nex} progressaoClasses={progressaoClasses} progressaoTrilhas={getMergedTrilhas(personagem.trilhas_personalizadas)} info={personagem.info} />
          </div>
        )}
        {abaAtiva === 'diario' && (
          <Diario diarioData={personagem.diario || []} onAbrirModal={openEditNota} onRemoveNota={removeNota} />
        )}

        {abaAtiva === 'exportar' && (
          <div className="ficha-aba-conteudo active" style={{ maxWidth: '700px', margin: '20px auto', padding: '0 10px' }}>
            <ExportFicha personagem={personagem} calculados={calculados} />
          </div>
        )}

        <footer><p></p></footer>
        
        {isLojaOpen && <ModalLoja isOpen={isLojaOpen} onClose={() => setIsLojaOpen(false)} onAddItem={handleAddItem} pericias={listaTodasPericias} />}
        {isSelecaoOpen && itemPendente && <ModalSelecao isOpen={isSelecaoOpen} onClose={() => { setIsSelecaoOpen(false); setItemPendente(null); }} item={itemPendente} onSelect={handleVincularItem} />}
        {isRitualModalOpen && <ModalRituais isOpen={isRitualModalOpen} onClose={() => setIsRitualModalOpen(false)} onAddRitual={addRitual} />}
        {isTrilhaModalOpen && <ModalTrilhaCustom isOpen={isTrilhaModalOpen} onClose={() => setIsTrilhaModalOpen(false)} onAddTrilha={addTrilhaCustom} classesList={OpcoesClasse} />}
        {isPoderesModalOpen && <ModalPoderes isOpen={isPoderesModalOpen} onClose={() => setIsPoderesModalOpen(false)} classe={personagem.info.classe} poderesDisponiveis={null} poderesAprendidos={personagem.poderes_aprendidos} onTogglePoder={handleTogglePoder} onAbrirSelecaoPoder={(p) => { setItemPendente({ powerKey: p.key, nome: p.nome, tituloModal: `Elemento`, descricaoModal: 'Escolha:', opcoes: opcoesElemento, tipoVinculo: 'poderElemento' }); setIsSelecaoOpen(true); }} poderesGerais={poderesGerais} poderesParanormais={poderesParanormais} />}
        {isModalEditarItemOpen && <ModalEditarItem isOpen={isModalEditarItemOpen} onClose={() => setIsModalEditarItemOpen(false)} onSave={handleSalvarItemEditado} item={itemParaEditar} pericias={listaTodasPericias} />}
        {isDiarioModalOpen && <ModalNota isOpen={isDiarioModalOpen} onClose={() => setIsDiarioModalOpen(false)} onSave={handleSalvarNota} notaAtual={notaParaEditar} />}
        {isInterludioModalOpen && <ModalInterludio isOpen={isInterludioModalOpen} onClose={() => setIsInterludioModalOpen(false)} onAplicar={handleAplicarInterludioHandler} limitePE={calculados.limite_pe || 1} />}
      </Suspense> 
    </>
  )
}