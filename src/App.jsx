// src/App.jsx
// (OTIMIZADO: Code Splitting, Performance de Runtime, Assets WebP, Correções de Memo)

import React, { useState, useEffect, Suspense, lazy } from 'react';
// Importações de estilos e bibliotecas de animação
import './App.css'; 
import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from './lib/animacoes.js'; 
// Importa a classe principal do personagem e as listas de poderes/dados
import { ficha as FichaClass } from './lib/personagem.js'; 
import { 
    database, 
    OpcoesClasse, 
    poderesCombatente, 
    poderesEspecialista, 
    poderesOcultista,
    poderesGerais,
    poderesParanormais,
} from './lib/database.js';
import { progressaoClasses, getMergedTrilhas, groupTrilhasByClass } from './lib/progressao.js'; 

// --- Carregamento de Componentes ---
// Componentes principais carregados imediatamente
import FichaPrincipal from './components/FichaPrincipal.jsx'; 
import Recursos from './components/ficha/recursos.jsx';
// Otimização: Animação de Sangue só é carregada se o tema for Sangue
const AnimacaoSangue = lazy(() => import('./components/AnimacaoSangue.jsx')); 

// Otimização: Abas e Modais carregados "sob demanda" (lazy)
const Inventario = lazy(() => import('./components/Inventario.jsx'));
const PoderesAprendidos = lazy(() => import('./components/PoderesAprendidos.jsx'));
const Rituais = lazy(() => import('./components/Rituais.jsx'));
const Diario = lazy(() => import('./components/Diario.jsx'));
const ProgressaoHabilidades = lazy(() => import('./components/ficha/ProgressaoHabilidades.jsx'));

const ModalLoja = lazy(() => import('./components/ModalLoja.jsx'));
const ModalEditarItem = lazy(() => import('./components/ModalEditarItem.jsx'));
const ModalSelecao = lazy(() => import('./components/ModalSelecao.jsx'));
const ModalPoderes = lazy(() => import('./components/ModalPoderes.jsx'));
const ModalRituais = lazy(() => import('./components/ModalRituais.jsx'));
const ModalTrilhaCustom = lazy(() => import('./components/ModalTrilhaCustom.jsx'));
const ModalNota = lazy(() => import('./components/ModalNota.jsx'));

// --- Listas Constantes ---
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


function App() {
  
  // --- ESTADOS PRINCIPAIS ---
  const [personagem, setPersonagem] = useState(FichaClass.getDados());
  const [calculados, setCalculados] = useState({
    defesaTotal: 10, cargaAtual: 0, cargaMax: 2, periciasTreinadas: 0, periciasTotal: 0, bonusPericia: {}, canChangeTheme: false, 
  });
  const [tema, setTema] = useState(() => localStorage.getItem("temaFichaOrdem") || "tema-ordem");
  const [abaAtiva, setAbaAtiva] = useState('principal'); 
  const [trilhasPorClasse, setTrilhasPorClasse] = useState({});
  
  // --- ESTADOS DE MODAL ---
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
  

  // --- LÓGICA DE ATUALIZAÇÃO E CÁLCULO ---
  
  // Carrega e inicializa a ficha (sempre na montagem)
  useEffect(() => {
    const temaSalvo = localStorage.getItem("temaFichaOrdem") || "tema-ordem";
    aplicarTemaSemAnimacao(temaSalvo);
    carregarFicha();
    handleFichaChange(null, null, null); 
  }, []); 

  // Efeito de Progressão de Trilhas (depende de NEX e Trilhas Custom)
  useEffect(() => {
    const customTrilhas = FichaClass.getTrilhasPersonalizadas(); 
    const trilhasUnificadas = getMergedTrilhas(customTrilhas); 
    const trilhasAgrupadas = groupTrilhasByClass(trilhasUnificadas);
    setTrilhasPorClasse(trilhasAgrupadas);
  }, [personagem.trilhas_personalizadas, personagem.info.classe]); 

  // Efeito de Animação de Tema (GSAP ou Three.js para Sangue)
  useEffect(() => {
    const temaAtual = document.documentElement.dataset.tema || "tema-ordem";
    if (tema === temaAtual) return; 

    if (tema === "tema-sangue") {
      setIsSangueAnimVisible(true);
    } else {
      aplicarTemaComAnimacao(tema, temaAtual, () => {
        document.documentElement.dataset.tema = tema;
        localStorage.setItem("temaFichaOrdem", tema);
      });
    }
  }, [tema]); 
  
  // Salva o nome da ficha no título da página
  useEffect(() => {
    document.title = `${personagem.info.nome || "Ficha"} - NEX ${personagem.info.nex || "0%"}`;
  }, [personagem.info.nome, personagem.info.nex]); 

  // Efeito Parallax
  useEffect(() => {
    const parallaxContainer = document.getElementById("parallax-background");
    const parallaxSimbolos = parallaxContainer 
      ? parallaxContainer.querySelectorAll(".simbolo-parallax")
      : null;
    if (!parallaxContainer || !parallaxSimbolos || parallaxSimbolos.length === 0) return;
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const moveX = (clientX - centerX) * -0.01;
      const moveY = (clientY - centerY) * -0.01;
      parallaxSimbolos.forEach((simbolo) => {
        simbolo.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []); 

  // Efeito de Status Global (Tensão, Sucesso, Morte)
  useEffect(() => {
    const rootElement = document.documentElement; // <html> tag
    const visibilidade = personagem.visibilidade || 0;
    const falhas = personagem.perseguicao.falhas || 0;
    const sucessos = personagem.perseguicao.sucessos || 0;

    // Prioridade 1: Morte (3 Falhas)
    if (falhas >= 3) {
      rootElement.classList.add('modo-morte');
      rootElement.classList.remove('modo-tensao');
      rootElement.classList.remove('modo-sucesso');
    } 
    // Prioridade 2: Sucesso (3 Sucessos)
    else if (sucessos >= 3) {
      rootElement.classList.add('modo-sucesso');
      rootElement.classList.remove('modo-tensao');
      rootElement.classList.remove('modo-morte');
    } 
    // Prioridade 3: Tensão (3 Visibilidade)
    else if (visibilidade >= 3) {
      rootElement.classList.add('modo-tensao');
      rootElement.classList.remove('modo-sucesso');
      rootElement.classList.remove('modo-morte');
    }
    // Prioridade 4: Normal
    else {
      rootElement.classList.remove('modo-tensao');
      rootElement.classList.remove('modo-sucesso');
      rootElement.classList.remove('modo-morte');
    }
    
    // Cleanup function
    return () => {
      rootElement.classList.remove('modo-tensao');
      rootElement.classList.remove('modo-sucesso');
      rootElement.classList.remove('modo-morte');
    };
  }, [personagem.visibilidade, personagem.perseguicao.sucessos, personagem.perseguicao.falhas]); 
  // --- (FIM DA ATUALIZAÇÃO) ---


  // --- FUNÇÕES DE PERSISTÊNCIA ---
  
  const carregarFicha = () => {
    const dadosSalvos = localStorage.getItem("fichaOrdemParanormal");
    if (dadosSalvos) {
      try {
        const dadosFicha = JSON.parse(dadosSalvos);
        FichaClass.carregarDados(dadosFicha);
      } catch (e) {
        console.error("Erro ao carregar dados salvos:", e);
        localStorage.removeItem("fichaOrdemParanormal");
      }
    }
  };
  const salvarFicha = () => {
    const dadosFicha = FichaClass.getDados();
    localStorage.setItem("fichaOrdemParanormal", JSON.stringify(dadosFicha));
    alert("Ficha salva com sucesso no navegador!");
  };
  const limparFicha = () => {
    if (window.confirm("Isso apagará a ficha salva. Deseja continuar?")) {
      localStorage.removeItem("fichaOrdemParanormal");
      window.location.reload(); 
    }
  };
  const exportarFicha = () => {
    handleFichaChange(null, null, null); 
    const dadosFicha = FichaClass.getDados();
    const nomeArquivo = `${(personagem.info.nome || "ficha-ordem").replace(/[^a-z0-9]/gi, '_')}.json`;
    const dadosString = JSON.stringify(dadosFicha, null, 2);
    
    const blob = new Blob([dadosString], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href); // Limpa a referência do objeto
  };
  const importarFicha = (arquivo) => {
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = (e) => {
      try {
        const dadosFicha = JSON.parse(e.target.result);
        FichaClass.carregarDados(dadosFicha);
        handleFichaChange(null, null, null);
        alert("Ficha importada com sucesso!");
      } catch (erro) { alert("Erro ao ler o arquivo JSON."); }
    };
    leitor.readAsText(arquivo);
  };


  // --- FUNÇÕES DE MODAL/ITEM ---

  const handleAbrirTrilhaModal = () => setIsTrilhaModalOpen(true);
  const handleFecharTrilhaModal = () => setIsTrilhaModalOpen(false);
  const handleAddTrilha = (trilhaData) => { FichaClass.addTrilhaPersonalizada(trilhaData); handleFichaChange(null, null, null); handleFecharTrilhaModal(); };

  const handleAbrirPoderesModal = () => setIsPoderesModalOpen(true);
  const handleFecharPoderesModal = () => setIsPoderesModalOpen(false);
  
  const getPoderesDisponiveis = (classe) => {
      switch (classe.toLowerCase()) {
          case 'combatente': return poderesCombatente;
          case 'especialista': return poderesEspecialista;
          case 'ocultista': return poderesOcultista;
          default: return [];
      }
  };

  const handleAbrirRitualModal = () => setIsRitualModalOpen(true);
  const handleFecharRitualModal = () => setIsRitualModalOpen(false);
  const handleAddRitual = (ritual) => { 
    FichaClass.addRitualInventario(ritual); 
    handleFichaChange(null, null, null); 
  };
  const handleRemoveRitual = (inventarioId) => { 
    FichaClass.removeRitualInventario(inventarioId); 
    handleFichaChange(null, null, null); 
  };

  const handleAbrirLoja = () => setIsLojaOpen(true);
  const handleFecharLoja = () => setIsLojaOpen(false);
  const handleFecharSelecao = () => { setIsSelecaoOpen(false); setItemPendente(null); };

  const handleAbrirModalEdicao = (inventarioId) => {
    const item = personagem.inventario.find(i => i.inventarioId === inventarioId);
    if (item) { setItemParaEditar(item); setIsModalEditarItemOpen(true); }
  };
  const handleFecharModalEdicao = () => { setIsModalEditarItemOpen(false); setItemParaEditar(null); };
  const handleSalvarItemEditado = (itemAtualizado) => {
    if (itemParaEditar) { FichaClass.updateItemInventario(itemParaEditar.inventarioId, itemAtualizado); handleFecharModalEdicao(); handleFichaChange(null, null, null); }
  };
  const handleAddItem = (itemOriginal) => {
    if (itemOriginal.tipoBonus === 'generico') {
      setItemPendente({ ...itemOriginal, tituloModal: `Vincular: ${itemOriginal.nome}`, descricaoModal: 'Escolha uma perícia para vincular ao item. (Não pode Luta ou Pontaria)', opcoes: opcoesPericia, tipoVinculo: 'pericia' });
      setIsSelecaoOpen(true); handleFecharLoja(); 
    } else if (itemOriginal.tipoBonus === 'escolhaElemento') {
      setItemPendente({ ...itemOriginal, tituloModal: `Escolher Elemento: ${itemOriginal.nome}`, descricaoModal: 'Este item pode ser de diferentes elementos. Escolha um:', opcoes: opcoesElemento, tipoVinculo: 'elemento' });
      setIsSelecaoOpen(true); handleFecharLoja();
    } else {
      FichaClass.addItemInventario(itemOriginal); handleFichaChange(null, null, null); 
    }
  };
  const handleRemoveItem = (inventarioId) => { FichaClass.removeItemInventario(inventarioId); handleFichaChange(null, null, null); };
  const handleToggleItem = (inventarioId) => { FichaClass.toggleIgnorarCalculos(inventarioId); handleFichaChange(null, null, null); };
  
  const handleAbrirDiarioModal = (nota) => { setNotaParaEditar(nota); setIsDiarioModalOpen(true); };
  const handleFecharDiarioModal = () => { setIsDiarioModalOpen(false); setNotaParaEditar(null); };
  
  // CORREÇÃO/GARANTIA: Assegura que os métodos do Diário existam na instância da FichaClass
  if (!FichaClass.addNotaDiario) {
    FichaClass.diario = FichaClass.diario || []; // Garante que a propriedade exista
    FichaClass.addNotaDiario = (dadosNota) => {
      const novaNota = { ...dadosNota, id: `nota_${Date.now()}` };
      FichaClass.diario.push(novaNota);
    };
    FichaClass.updateNotaDiario = (notaId, dadosNota) => {
      const index = FichaClass.diario.findIndex(n => n.id === notaId);
      if (index !== -1) {
        FichaClass.diario[index] = { ...FichaClass.diario[index], ...dadosNota };
      }
    };
    FichaClass.removeNotaDiario = (notaId) => {
      FichaClass.diario = FichaClass.diario.filter(n => n.id !== notaId);
    };
  }
  // --- Fim da correção do Diário ---

  const handleSalvarNota = (dadosNota) => {
    if (notaParaEditar) { FichaClass.updateNotaDiario(notaParaEditar.id, dadosNota); } 
    else { FichaClass.addNotaDiario(dadosNota); }
    handleFichaChange(null, null, null); // Força atualização leve para refletir a mudança
    handleFecharDiarioModal(); // Fecha o modal após salvar
  };
  const handleRemoverNota = (notaId) => { 
    if (window.confirm("Tem certeza que deseja apagar esta anotação?")) { 
      FichaClass.removeNotaDiario(notaId); 
      handleFichaChange(null, null, null); // Força atualização leve
    } 
  };
  
  // Lógica de Seleção de Poder (PARA "RESISTIR A ELEMENTO")
  const handleAbrirSelecaoPoder = (poder) => {
      if (poder.requiresChoice === 'elemento') {
          setItemPendente({ 
              powerKey: poder.key, 
              nome: poder.nome,
              tituloModal: `Escolher Elemento para ${poder.nome}`, 
              descricaoModal: 'Selecione o elemento ao qual este poder concede resistência:', 
              opcoes: opcoesElemento,
              tipoVinculo: 'poderElemento' 
          });
          setIsSelecaoOpen(true);
      }
  }

  const handleTogglePoder = (poder) => {
      const aprendidos = FichaClass.getPoderesAprendidos();
      // Encontra qualquer versão do poder (base ou com_elemento)
      const isAprendido = aprendidos.some(p => p.key === poder.key || p.key.startsWith(`${poder.key}_`));

      if (isAprendido) {
          // Se aprendido, remove todas as versões que começam com a chave base.
          const keysToRemove = aprendidos.filter(p => p.key === poder.key || p.key.startsWith(`${poder.key}_`)).map(p => p.key);
          keysToRemove.forEach(key => FichaClass.removePoder(key));
          handleFichaChange(null, null, null);
      } else {
          // Adicionar: Verifica se precisa de seleção
          if (poder.requiresChoice) {
              handleAbrirSelecaoPoder(poder);
          } else {
              // Adição simples
              FichaClass.addPoder(poder); 
              handleFichaChange(null, null, null);
          }
      }
  };

  const handleVincularItem = (valorSelecionado) => {
    if (!itemPendente) return;
    
    // --- LÓGICA DE VINCULAÇÃO DE PODER ---
    if (itemPendente.tipoVinculo === 'poderElemento') { 
        const poderOriginal = allPoderesList.find(p => p.key === itemPendente.powerKey);
        
        if (poderOriginal) {
            const elementoMinusculo = valorSelecionado.toLowerCase();
            const poderVinculado = {
                ...poderOriginal,
                nome: `${poderOriginal.nome} (${valorSelecionado.charAt(0).toUpperCase() + valorSelecionado.slice(1)})`,
                elemento: elementoMinusculo, 
                requiresChoice: null,
                key: `${poderOriginal.key}_${elementoMinusculo}`, 
            };
            
            FichaClass.addPoder(poderVinculado);
            handleFichaChange(null, null, null); 
        }
        
        handleFecharSelecao(); 
        return; 
    }
    
    // --- LÓGICA DE VINCULAÇÃO DE TRILHA/ITEM (Existente) ---
    const trilhasUnificadas = getMergedTrilhas(FichaClass.getTrilhasPersonalizadas());

    if (itemPendente.tipoVinculo === 'trilhaElemento') {
      const trilhaSelecionada = itemPendente.trilhaValue;
      FichaClass.setInfo('trilha', trilhaSelecionada);
      FichaClass.setInfo(`${trilhaSelecionada}_elemento`, valorSelecionado); 
      handleFecharSelecao(); 
      handleFichaChange(null, null, null); 
      return; 
    }
    
    let itemVinculado = { ...itemPendente };
    if (itemPendente.tipoVinculo === 'pericia') { itemVinculado.periciaVinculada = valorSelecionado; } 
    else if (itemPendente.tipoVinculo === 'elemento') { itemVinculado.elemento = valorSelecionado; itemVinculado.nome = itemPendente.nome.replace("(Elemento)", `(${valorSelecionado})`); }
    
    itemVinculado.tipoBonus = null; 
    itemVinculado.tituloModal = undefined; 
    itemVinculado.descricaoModal = undefined; 
    itemVinculado.opcoes = undefined; 
    itemVinculado.tipoVinculo = undefined;

    FichaClass.addItemInventario(itemVinculado); handleFecharSelecao(); handleFichaChange(null, null, null); 
  };
  // --- FIM DA LÓGICA DE SELEÇÃO DE PODER ---


  // --- FUNÇÃO DE MUDANÇA DE FICHA/CÁLCULO (OTIMIZADA) ---

  function handleFichaChange(secao, campo, valor) {
    let skipUpdate = false;
    
    // --- 1. Lógica Rápida de SET (Aplica a mudança na classe) ---
    if (secao) {
        if (secao === 'info') {
            const trilhasUnificadas = getMergedTrilhas(FichaClass.getTrilhasPersonalizadas());
            if (campo === 'nex') {
                let nexValue = String(valor).replace(/[^0-9]/g, '');
                let nexNumber = parseInt(nexValue) || 0;
                if (nexNumber > 100) nexNumber = 100;
                valor = `${nexNumber}%`;
            }
            if (campo === 'trilha') {
                const trilhaSelecionada = valor;
                const dadosTrilha = trilhasUnificadas[trilhaSelecionada]; 
                if (dadosTrilha && dadosTrilha.requiresChoice === 'elemento' && trilhaSelecionada !== 'nenhuma') {
                    setItemPendente({ 
                        trilhaValue: trilhaSelecionada,
                        tituloModal: `Escolher Elemento da Trilha`, 
                        descricaoModal: `Escolha o Elemento Paranormal para a trilha ${dadosTrilha.nome}:`, 
                        opcoes: opcoesElemento, 
                        tipoVinculo: 'trilhaElemento' 
                    });
                    setIsSelecaoOpen(true);
                    skipUpdate = true;
                } else {
                    FichaClass.setInfo(campo, valor);
                }
            } 
            else if (campo === 'classe') {
                const novaClasse = valor;
                // Garante que trilhasPorClasse[novaClasse.toLowerCase()] não seja undefined
                const trilhasDaClasse = trilhasPorClasse[novaClasse.toLowerCase()] || {};
                const trilhasValidas = Object.values(trilhasDaClasse).map(t => t.key); 
                
                const trilhaAtual = FichaClass.getDados().info.trilha; 
                const trilhaInvalida = trilhaAtual !== 'nenhuma' && !trilhasValidas.includes(trilhaAtual);
                
                if (trilhaInvalida) {
                    FichaClass.setInfo('trilha', 'nenhuma');
                    FichaClass.setInfo(`${trilhaAtual}_elemento`, '');
                }
                FichaClass.setInfo(campo, valor);
            }
            else if (!skipUpdate) {
                FichaClass.setInfo(campo, valor);
            }
        } 
        else if (secao === 'atributos') { FichaClass.setAtributo(campo, valor); } 
        else if (secao === 'recursos') { FichaClass.setRecurso(campo, valor); } 
        else if (secao === 'perseguicao') { FichaClass.setPerseguicao(campo, valor); } 
        else if (secao === 'visibilidade_mudar') { FichaClass.setVisibilidade(campo, valor); }
        else if (secao === 'defesa') { FichaClass.setDefesa(campo, valor); } 
        else if (secao === 'pericias') { FichaClass.setTreinoPericia(campo, valor); } 
        else if (secao === 'bonusManuais') { FichaClass.setBonusManual(campo, valor); } 
    }
    
    if (skipUpdate) { return; }

    // --- 2. Lógica de Otimização ---
    // Verifica se a mudança foi "leve" (só afeta os recursos atuais ou trackers)
    const isLightUpdate = secao === 'recursos' || secao === 'perseguicao' || secao === 'visibilidade_mudar';

    if (isLightUpdate && secao !== null) { // secao === null força recalcular tudo (usado no load)
      // ATUALIZAÇÃO LEVE:
      // Apenas atualiza o estado 'personagem'. Não recalcula 'calculados'.
      setPersonagem(FichaClass.getDados());
    
    } else {
      // ATUALIZAÇÃO PESADA: (Mudou atributos, nex, pericias, inventário, etc.)
      
      const novosDados = FichaClass.getDados();
      
      FichaClass.calcularValoresMaximos();
      
      const bonusDefesaInventario = FichaClass.getBonusDefesaInventario();
      FichaClass.setDefesa('equip', bonusDefesaInventario);

      const agi = parseInt(FichaClass.getDados().atributos.agi) || 0;
      const equip = FichaClass.getDados().defesa.equip || 0;
      const outros = parseInt(FichaClass.getDados().defesa.outros) || 0;
      let bonusOrigemDefesa = (novosDados.info.origem === "policial") ? 2 : 0;
      const defesaTotal = 10 + agi + equip + outros + bonusOrigemDefesa; 
      
      const nexString = novosDados.info.nex || '0%';
      const nexNumeric = parseInt(nexString.replace('%', '')) || 0;
      const canChangeTheme = nexNumeric >= 50;

      const bonusPericiaCalculado = {};
      Object.keys(novosDados.pericias).forEach(periciaKey => {
        bonusPericiaCalculado[periciaKey] = FichaClass.getBonusPericiaInventario(periciaKey);
      });

      // Cálculo de Perícias Treinadas
      const int = parseInt(FichaClass.atributos.int) || 0;
      const classe = FichaClass.info.classe;
      let bonusClassePericias = 0;
      switch (classe) {
        case "combatente": bonusClassePericias = 1 + int; break;
        case "especialista": bonusClassePericias = 7 + int; break;
        case "ocultista": bonusClassePericias = 3 + int; break;
        case "sobrevivente": bonusClassePericias = 0; break; // Sobrevivente não ganha perícia por Int
        default: bonusClassePericias = 0;
      }
      const origem = FichaClass.info.origem;
      let bonusOrigemPericias = 0;
      if (database && database.periciasPorOrigem && database.periciasPorOrigem[origem]) {
        const { fixas, escolhas } = database.periciasPorOrigem[origem];
        bonusOrigemPericias += fixas.length;
        if (escolhas) {
          escolhas.forEach((e) => {
            bonusOrigemPericias += e.quantidade;
          });
        }
      }
      const periciasTotal = bonusClassePericias + bonusOrigemPericias;
      let periciasTreinadas = 0;
      Object.values(FichaClass.pericias).forEach((treino) => {
        if (parseInt(treino) >= 5) {
          periciasTreinadas++;
        }
      });
      
      // Atualiza os dois estados
      setCalculados(prev => ({
        ...prev,
        defesaTotal: defesaTotal,
        cargaAtual: FichaClass.getPesoTotal(),
        cargaMax: FichaClass.getMaxPeso(),
        periciasTreinadas: periciasTreinadas,
        periciasTotal: periciasTotal,
        bonusPericia: bonusPericiaCalculado,
        canChangeTheme: canChangeTheme, 
      }));
      
      setPersonagem({ ...novosDados });
    }
  }


  // --- PROPS PARA CONTROLES ---
  const controlesProps = {
    temaAtual: tema, 
    onSave: salvarFicha,
    onClear: limparFicha,
    onExport: exportarFicha,
    onImport: importarFicha,
    onThemeChange: setTema,
    canChangeTheme: calculados.canChangeTheme
  };
  
  // Componente de Fallback (Carregamento)
  const LoadingComponent = () => (
    <div 
      className="item-placeholder" 
      style={{
        padding: '50px', 
        maxWidth: '1400px', 
        margin: '20px auto', 
        backgroundColor: 'var(--cor-caixa)', 
        border: '2px solid var(--cor-borda)', 
        borderRadius: '4px',
        textAlign: 'center'
      }}>
      Carregando...
    </div>
  );

  // --- RENDERIZAÇÃO ---
  return (
    <>
      <div id="parallax-background">
        {/* OTIMIZAÇÃO: Alterado .png para .webp e adicionado alt="" */}
        <img src="/assets/images/SimboloSemafinidade.webp" id="simbolo-ordem" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloSangue.webp" id="simbolo-sangue" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloMorte.webp" id="simbolo-morte" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloConhecimento.webp" id="simbolo-conhecimento" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloEnergia.webp" id="simbolo-energia" className="simbolo-parallax" alt=""/>
      </div>
      
      <div id="transition-overlay"></div>

      {/* Bloco da animação de sangue (Three.js) */}
      <Suspense fallback={null}>
        {isSangueAnimVisible && (
            <AnimacaoSangue 
              isVisible={isSangueAnimVisible} 
              onComplete={() => {
                setIsSangueAnimVisible(false); 
                aplicarTemaSemAnimacao('tema-sangue'); 
              }} 
            />
        )}
      </Suspense>

      {/* Container Fixo de Recursos (Carrega Imediatamente) */}
      <div className="recursos-container-fixo">
        <Recursos 
          dados={personagem.recursos}
          dadosPerseguicao={personagem.perseguicao}
          dadosVisibilidade={personagem.visibilidade} 
          onFichaChange={handleFichaChange}
        />
      </div>

      <nav className="ficha-abas">
        <button className={`ficha-aba-link ${abaAtiva === 'principal' ? 'active' : ''}`} onClick={() => setAbaAtiva('principal')}>Principal</button>
        <button className={`ficha-aba-link ${abaAtiva === 'inventario' ? 'active' : ''}`} onClick={() => setAbaAtiva('inventario')}>Inventário</button>
        <button className={`ficha-aba-link ${abaAtiva === 'rituais' ? 'active' : ''}`} onClick={() => setAbaAtiva('rituais')}>Rituais</button>
        <button className={`ficha-aba-link ${abaAtiva === 'poderes' ? 'active' : ''}`} onClick={() => setAbaAtiva('poderes')}>Poderes</button>
        <button className={`ficha-aba-link ${abaAtiva === 'progressao' ? 'active' : ''}`} onClick={() => setAbaAtiva('progressao')}>Progressão</button>
        <button className={`ficha-aba-link ${abaAtiva === 'diario' ? 'active' : ''}`} onClick={() => setAbaAtiva('diario')}>Diário</button>
      </nav>
      
      {/* OTIMIZAÇÃO: Suspense envolve todas as abas e modais */}
      <Suspense fallback={<LoadingComponent />}>
        {abaAtiva === 'principal' && (
          <FichaPrincipal
            personagem={personagem}
            calculados={calculados} 
            fichaInstance={FichaClass} 
            handleFichaChange={handleFichaChange}
            controlesProps={controlesProps}
            trilhasPorClasse={trilhasPorClasse} 
          />
        )}
        
        {abaAtiva === 'inventario' && (
          <Inventario 
            inventario={personagem.inventario} 
            onAbrirLoja={handleAbrirLoja}
            onRemoveItem={handleRemoveItem}
            onToggleItem={handleToggleItem}
            onEditItem={handleAbrirModalEdicao} 
          />
        )}

        {abaAtiva === 'rituais' && (
          <Rituais 
            rituais={personagem.rituais} 
            onAbrirModal={handleAbrirRitualModal} 
            onRemoveRitual={handleRemoveRitual} 
          />
        )}
        
        {abaAtiva === 'poderes' && (
          <PoderesAprendidos 
              poderesAprendidos={personagem.poderes_aprendidos}
              onAbrirModal={handleAbrirPoderesModal} 
          />
        )}
        
        {abaAtiva === 'progressao' && (
          // Layout corrigido para centralizar a progressão
          <div className="ficha-aba-conteudo active" style={{maxWidth: '1400px', margin: '0 auto'}}>
            <button 
              className="btn-add-item" 
              onClick={handleAbrirTrilhaModal}
              style={{ float: 'right', margin: '10px 0', padding: '5px 15px', fontSize: '1.2em' }}
            >
              + Criar Trilha
            </button>
            <ProgressaoHabilidades
              classe={personagem.info.classe}
              trilha={personagem.info.trilha}
              nexString={personagem.info.nex}
              progressaoClasses={progressaoClasses}
              progressaoTrilhas={getMergedTrilhas(personagem.trilhas_personalizadas)} 
              info={personagem.info}
            />
          </div>
        )}

        {abaAtiva === 'diario' && (
          <Diario
            diarioData={FichaClass.diario} // CORREÇÃO: Passa a referência estável da classe
            onAbrirModal={handleAbrirDiarioModal}
            onRemoveNota={handleRemoverNota}
          />
        )}

        <footer>
          <p>Este é um projeto de fã. Baseado no sistema Ordem Paranormal RPG.</p>
        </footer>

        {/* OTIMIZAÇÃO: Modais só renderizam quando abertos */}
        
        {isLojaOpen && (
          <ModalLoja 
            isOpen={isLojaOpen}
            onClose={handleFecharLoja}
            onAddItem={handleAddItem}
            pericias={listaTodasPericias} 
          />
        )}
        
        {isSelecaoOpen && !!itemPendente && (
          <ModalSelecao 
            isOpen={isSelecaoOpen && !!itemPendente}
            onClose={handleFecharSelecao}
            item={itemPendente} 
            onSelect={handleVincularItem} 
          />
        )}

        {isRitualModalOpen && (
          <ModalRituais 
            isOpen={isRitualModalOpen}
            onClose={handleFecharRitualModal}
            onAddRitual={handleAddRitual} 
          />
        )}

        {isTrilhaModalOpen && (
          <ModalTrilhaCustom
            isOpen={isTrilhaModalOpen}
            onClose={handleFecharTrilhaModal}
            onAddTrilha={handleAddTrilha}
            classesList={OpcoesClasse} 
          />
        )}
        
        {isPoderesModalOpen && (
          <ModalPoderes
            isOpen={isPoderesModalOpen}
            onClose={handleFecharPoderesModal}
            classe={personagem.info.classe}
            poderesDisponiveis={getPoderesDisponiveis(personagem.info.classe)}
            poderesAprendidos={personagem.poderes_aprendidos}
            onTogglePoder={handleTogglePoder}
            onAbrirSelecaoPoder={handleAbrirSelecaoPoder} 
            poderesGerais={poderesGerais} 
            poderesParanormais={poderesParanormais} 
          />
        )}

        {isModalEditarItemOpen && (
          <ModalEditarItem
            isOpen={isModalEditarItemOpen}
            onClose={handleFecharModalEdicao}
            onSave={handleSalvarItemEditado}
            item={itemParaEditar}
            pericias={listaTodasPericias}
          />
        )}

        {isDiarioModalOpen && (
          <ModalNota
            isOpen={isDiarioModalOpen}
            onClose={handleFecharDiarioModal}
            onSave={handleSalvarNota}
            notaAtual={notaParaEditar}
          />
        )}
      </Suspense> 
    </>
  )
}

export default App