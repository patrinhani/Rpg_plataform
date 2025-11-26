// src/pages/Ficha/index.jsx
import React, { useState, useEffect, Suspense, lazy, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// Estilos e Libs
import '../../App.css'; 
import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from '../../lib/animacoes.js'; 
import { 
    poderesCombatente, 
    poderesEspecialista, 
    poderesOcultista, 
    poderesGerais, 
    poderesParanormais,
    Patentes,       
    OpcoesClasse 
} from '../../lib/database.js';
import { progressaoClasses, getMergedTrilhas, groupTrilhasByClass } from '../../lib/progressao.js'; 

// Contexto e Firebase
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useFicha } from '../../contexts/FichaContext.jsx'; // [NOVO] Importa o Hook
import { db } from '../../lib/firebase'; 
import { doc, updateDoc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore'; 

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
const listaTodasPericias = ['acrobacia', 'adestramento', 'artes', 'atletismo', 'atualidades', 'ciencias', 'crime', 'diplomacia', 'enganacao', 'fortitude', 'furtividade', 'iniciativa', 'intimidacao', 'intuicao', 'investigacao', 'luta', 'medicina', 'ocultismo', 'percepcao', 'pilotagem', 'pontaria', 'profissao', 'reflexos', 'religiao', 'sobrevivencia', 'tatica', 'tecnologia', 'vontade'];
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

export default function Ficha({ fichaId: propFichaId, mesaContexto }) {
  const { fichaId: paramFichaId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth(); 
  
  // [NOVO] Consome tudo do Contexto
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

  // --- ESTADOS LOCAIS (Apenas UI) ---
  const [tema, setTema] = useState(() => localStorage.getItem("temaFichaOrdem") || "tema-ordem");
  const [abaAtiva, setAbaAtiva] = useState('principal'); 
  const [trilhasPorClasse, setTrilhasPorClasse] = useState({});
  const [periciasDeOrigem, setPericiasDeOrigem] = useState([]);
  
  const [loading, setLoading] = useState(true); 
  const docRef = useRef(null); 
  const isInitializing = useRef(true); 
  
  // Modais (Estados)
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
    if (!usuario || !idAlvo) {
        setLoading(false);
        return;
    }
    
    if (isModoMesa) {
        docRef.current = doc(db, "mesas", mesaContexto, "personagens", idAlvo);
    } else {
        docRef.current = doc(db, "users", usuario.uid, "personagens", idAlvo);
    }
    
    const unsubscribe = onSnapshot(docRef.current, async (docSnap) => {
        if (docSnap.exists()) {
            const dadosFirestore = docSnap.data();
            carregarFicha(dadosFirestore); // [NOVO] Usa função do Contexto
        } else if (isInitializing.current) {
             // Só cria se for ficha pessoal ou se o usuário for o dono na mesa
             // (Lógica simplificada: se não existe, cria um template)
             // Em um sistema real, você pode querer restringir quem cria fichas na mesa.
             if (!isModoMesa || propFichaId === usuario.uid) {
                console.log("Criando ficha inicial...");
                // Aqui precisamos pegar o template limpo. Como 'personagem' já vem do contexto inicializado,
                // podemos usar ele, mas cuidado com recursão. O ideal é ter um método estático ou helper.
                // Por simplicidade, vamos deixar o contexto inicializar e salvar isso.
                // Como o Contexto inicia com dados vazios, podemos salvar o estado atual do contexto no banco.
                await setDoc(docRef.current, personagem); // Salva o estado inicial do contexto
             }
        }
        if (isInitializing.current) isInitializing.current = false;
        setLoading(false);
    }, (error) => { console.error("Erro Firestore:", error); setLoading(false); });

    return () => unsubscribe();
  }, [usuario, mesaContexto, idAlvo]);

  // --- SALVAMENTO AUTOMÁTICO ---
  // Sempre que 'personagem' mudar (via Contexto), salvamos no banco.
  useEffect(() => {
      if (!loading && !isInitializing.current) {
          debouncedSave(personagem);
      }
  }, [personagem]);


  // --- EFEITOS VISUAIS E TRILHAS ---
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
      atualizarFicha('info', 'tema', novoTema); // [NOVO]
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
    const customTrilhas = personagem.trilhas_personalizadas || []; 
    const trilhasUnificadas = getMergedTrilhas(customTrilhas); 
    const trilhasAgrupadas = groupTrilhasByClass(trilhasUnificadas);
    setTrilhasPorClasse(trilhasAgrupadas);
  }, [personagem.trilhas_personalizadas, personagem.info.classe]); 

  useEffect(() => {
      const origemAtual = personagem.info.origem;
      // (Aqui usamos a lógica de exibição apenas, a lógica de dados está no Contexto)
  }, [personagem.info.origem]);

  useEffect(() => {
    const title = personagem.info.nome ? `${personagem.info.nome} - NEX ${personagem.info.nex || "0%"}` : "Ficha";
    document.title = title;
  }, [personagem.info.nome, personagem.info.nex]); 


  // --- HANDLERS DE INTERFACE (Adaptados para usar Contexto) ---
  // Wrapper para o handleFichaChange original, agora chamando atualizarFicha do contexto
  const handleFichaChange = (secao, campo, valor) => {
       // Intercepta lógica de UI que precisa de Modais (Ex: Trilha com Elemento)
       if (secao === 'info' && campo === 'trilha') {
           const trilha = valor;
           const customTrilhas = personagem.trilhas_personalizadas || [];
           const dados = getMergedTrilhas(customTrilhas)[trilha];
           if (dados && dados.requiresChoice === 'elemento' && trilha !== 'nenhuma') {
                setItemPendente({ trilhaValue: trilha, tituloModal: `Elemento da Trilha`, descricaoModal: `Escolha:`, opcoes: opcoesElemento, tipoVinculo: 'trilhaElemento' });
                setIsSelecaoOpen(true);
                return; // Não atualiza ainda
           }
       }
       atualizarFicha(secao, campo, valor);
  };

  const handleAddItem = (itemOriginal) => { 
      if (itemOriginal.tipoBonus === 'generico') { 
          setItemPendente({ ...itemOriginal, tituloModal: `Vincular: ${itemOriginal.nome}`, descricaoModal: 'Escolha uma perícia:', opcoes: opcoesPericia, tipoVinculo: 'pericia' }); setIsSelecaoOpen(true); setIsLojaOpen(false); 
      } else if (itemOriginal.tipoBonus === 'escolhaElemento') { 
          setItemPendente({ ...itemOriginal, tituloModal: `Escolher Elemento`, descricaoModal: 'Escolha:', opcoes: opcoesElemento, tipoVinculo: 'elemento' }); setIsSelecaoOpen(true); setIsLojaOpen(false); 
      } else { 
          addItem(itemOriginal); 
      } 
  };

  const handleVincularItem = (valorSelecionado) => { 
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
          atualizarFicha('info', 'trilha', trilha); // Atualiza trilha
          atualizarFicha('info', `${trilha}_elemento`, valorSelecionado); // Atualiza elemento
      } else { 
          let itemVinculado = { ...itemPendente }; 
          if (itemPendente.tipoVinculo === 'pericia') itemVinculado.periciaVinculada = valorSelecionado; 
          else if (itemPendente.tipoVinculo === 'elemento') { itemVinculado.elemento = valorSelecionado; itemVinculado.nome = itemPendente.nome.replace("(Elemento)", `(${valorSelecionado})`); } 
          itemVinculado.tipoBonus = null; 
          addItem(itemVinculado); 
      } 
      setIsSelecaoOpen(false); setItemPendente(null); 
  };
  
  const handleTogglePoder = (poder) => { 
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
  };
  
  const handleSalvarItemEditado = (itemAtualizado) => { if (itemParaEditar) { updateItem(itemParaEditar.inventarioId, itemAtualizado); setIsModalEditarItemOpen(false); } };
  const handleSalvarNota = (dadosNota) => { if (notaParaEditar) updateNota(notaParaEditar.id, dadosNota); else addNota(dadosNota); setIsDiarioModalOpen(false); };
  const handleAplicarInterludioHandler = (opcoes) => { const resultado = aplicarInterludio(opcoes); alert(`Interlúdio Finalizado!\nRecuperado: PV: ${resultado.pv} | PE: ${resultado.pe} | SAN: ${resultado.san}`); };

  const salvarFichaLocal = () => { debouncedSave(personagem); alert("Ficha salva!"); };
  const limparFicha = () => { if(window.confirm("Apagar ficha permanentemente?")) { if(docRef.current) deleteDoc(docRef.current); navigate('/'); } };
  const exportarFicha = () => { const blob = new Blob([JSON.stringify(personagem, null, 2)], {type: "application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `ficha_${personagem.info.nome || "agente"}.json`; a.click(); };
  const importarFicha = (arquivo) => { const reader = new FileReader(); reader.onload = (e) => { try { const json = JSON.parse(e.target.result); carregarFicha(json); alert("Ficha importada!"); } catch(err) { alert("Erro ao ler arquivo JSON."); } }; reader.readAsText(arquivo); };
  const VoltarBtn = !isModoMesa ? <button onClick={() => navigate('/')} className="btn-voltar-flutuante" style={{ top: '15px' }}>← DASHBOARD</button> : null;


  if (loading) {
      return (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', color: 'var(--cor-destaque)', backgroundColor: '#050a10' }}>
              <img src="/assets/images/SimboloSemafinidade.webp" style={{ width: '100px', filter: 'drop-shadow(0 0 10px var(--cor-destaque))' }} alt="Carregando" />
              <h1>Sincronizando Ficha...</h1>
          </div>
      );
  }
  
  const controlesProps = {
    temaAtual: tema, onSave: salvarFichaLocal, onClear: limparFicha, onExport: exportarFicha, onImport: importarFicha,
    onThemeChange: handleThemeChange, canChangeTheme: calculados.canChangeTheme
  };

  const LoadingComponent = () => <div className="item-placeholder" style={{padding: '50px', textAlign: 'center'}}>Carregando Aba...</div>;

  return (
    <>
      {VoltarBtn}
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
            personagem={personagem} calculados={calculados} fichaInstance={fichaInstance} handleFichaChange={handleFichaChange}
            controlesProps={controlesProps} trilhasPorClasse={trilhasPorClasse} periciasDeOrigem={periciasDeOrigem} onToggleCondicao={toggleCondicao} 
          />
        )}
        {abaAtiva === 'inventario' && (
          <Inventario inventario={personagem.inventario} onAbrirLoja={() => setIsLojaOpen(true)} onRemoveItem={removeItem} onToggleItem={toggleItem} onEditItem={(id) => { setItemParaEditar(personagem.inventario.find(i => i.inventarioId === id)); setIsModalEditarItemOpen(true); }} />
        )}
        {abaAtiva === 'rituais' && (
          <Rituais rituais={personagem.rituais} onAbrirModal={() => setIsRitualModalOpen(true)} onRemoveRitual={removeRitual} />
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
          <Diario diarioData={personagem.diario || []} onAbrirModal={(nota) => { setNotaParaEditar(nota); setIsDiarioModalOpen(true); }} onRemoveNota={removeNota} />
        )}

        <footer><p></p></footer>
        
        {/* Modais */}
        {isLojaOpen && <ModalLoja isOpen={isLojaOpen} onClose={() => setIsLojaOpen(false)} onAddItem={handleAddItem} pericias={listaTodasPericias} />}
        {isSelecaoOpen && itemPendente && <ModalSelecao isOpen={isSelecaoOpen} onClose={() => { setIsSelecaoOpen(false); setItemPendente(null); }} item={itemPendente} onSelect={handleVincularItem} />}
        {isRitualModalOpen && <ModalRituais isOpen={isRitualModalOpen} onClose={() => setIsRitualModalOpen(false)} onAddRitual={addRitual} />}
        {isTrilhaModalOpen && <ModalTrilhaCustom isOpen={isTrilhaModalOpen} onClose={() => setIsTrilhaModalOpen(false)} onAddTrilha={addTrilhaCustom} classesList={OpcoesClasse} />}
        {isPoderesModalOpen && <ModalPoderes isOpen={isPoderesModalOpen} onClose={() => setIsPoderesModalOpen(false)} classe={personagem.info.classe} poderesDisponiveis={getPoderesDisponiveis(personagem.info.classe)} poderesAprendidos={personagem.poderes_aprendidos} onTogglePoder={handleTogglePoder} onAbrirSelecaoPoder={(p) => { setItemPendente({ powerKey: p.key, nome: p.nome, tituloModal: `Elemento`, descricaoModal: 'Escolha:', opcoes: opcoesElemento, tipoVinculo: 'poderElemento' }); setIsSelecaoOpen(true); }} poderesGerais={poderesGerais} poderesParanormais={poderesParanormais} />}
        {isModalEditarItemOpen && <ModalEditarItem isOpen={isModalEditarItemOpen} onClose={() => setIsModalEditarItemOpen(false)} onSave={handleSalvarItemEditado} item={itemParaEditar} pericias={listaTodasPericias} />}
        {isDiarioModalOpen && <ModalNota isOpen={isDiarioModalOpen} onClose={() => setIsDiarioModalOpen(false)} onSave={handleSalvarNota} notaAtual={notaParaEditar} />}
        {isInterludioModalOpen && <ModalInterludio isOpen={isInterludioModalOpen} onClose={() => setIsInterludioModalOpen(false)} onAplicar={handleAplicarInterludioHandler} limitePE={FichaClass.calculosDetalhados.limite_pe} />}
      </Suspense> 
    </>
  )
}