// src/App.jsx
// (ATUALIZADO: Sistema de Condições Integrado e Cálculos com Penalidades)

import React, { useState, useEffect, Suspense, lazy } from 'react';
import './App.css'; 
import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from './lib/animacoes.js'; 
import { ficha as FichaClass } from './lib/personagem.js'; 
import { 
    database, 
    OpcoesClasse, 
    poderesCombatente, 
    poderesEspecialista, 
    poderesOcultista, 
    poderesGerais, 
    poderesParanormais,
    getPatenteInfo, 
    Patentes,       
} from './lib/database.js';
import { progressaoClasses, getMergedTrilhas, groupTrilhasByClass } from './lib/progressao.js'; 

// --- Carregamento de Componentes ---
import FichaPrincipal from './components/FichaPrincipal.jsx'; 
import Recursos from './components/ficha/recursos.jsx';

// (Não precisa importar Condicoes aqui se ele for renderizado dentro do FichaPrincipal, 
// mas importaremos para garantir que o bundle saiba dele, embora a renderização seja no filho)
// Melhor: Vamos passar a responsabilidade de renderizar para o FichaPrincipal, 
// então não importamos aqui para evitar duplicidade, apenas passamos o handler.

const AnimacaoSangue = lazy(() => import('./components/AnimacaoSangue.jsx')); 

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
    patente: Patentes[0], 
    bloqueio_rd: '—',      
    esquiva_bonus: '—',    
    tem_contra_ataque: false, 
  });
  
  const [tema, setTema] = useState(() => localStorage.getItem("temaFichaOrdem") || "tema-ordem");
  const [abaAtiva, setAbaAtiva] = useState('principal'); 
  const [trilhasPorClasse, setTrilhasPorClasse] = useState({});
  const [periciasDeOrigem, setPericiasDeOrigem] = useState([]);
  
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
  

  // --- LÓGICA DE ATUALIZAÇÃO E CÁLCULO (UseEffect) ---
  
  useEffect(() => {
    const temaSalvo = localStorage.getItem("temaFichaOrdem") || "tema-ordem";
    aplicarTemaSemAnimacao(temaSalvo);
    carregarFicha();
    handleFichaChange(null, null, null); 
  }, []); 

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
  
  useEffect(() => {
    document.title = `${personagem.info.nome || "Ficha"} - NEX ${personagem.info.nex || "0%"}`;
  }, [personagem.info.nome, personagem.info.nex]); 

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

  useEffect(() => {
    const rootElement = document.documentElement; 
    const visibilidade = personagem.visibilidade || 0;
    const falhas = personagem.perseguicao.falhas || 0;
    const sucessos = personagem.perseguicao.sucessos || 0;

    if (falhas >= 3) {
      rootElement.classList.add('modo-morte');
      rootElement.classList.remove('modo-tensao');
      rootElement.classList.remove('modo-sucesso');
    } 
    else if (sucessos >= 3) {
      rootElement.classList.add('modo-sucesso');
      rootElement.classList.remove('modo-tensao');
      rootElement.classList.remove('modo-morte');
    } 
    else if (visibilidade >= 3) {
      rootElement.classList.add('modo-tensao');
      rootElement.classList.remove('modo-sucesso');
      rootElement.classList.remove('modo-morte');
    }
    else {
      rootElement.classList.remove('modo-tensao');
      rootElement.classList.remove('modo-sucesso');
      rootElement.classList.remove('modo-morte');
    }
    
    return () => {
      rootElement.classList.remove('modo-tensao');
      rootElement.classList.remove('modo-sucesso');
      rootElement.classList.remove('modo-morte');
    };
  }, [personagem.visibilidade, personagem.perseguicao.sucessos, personagem.perseguicao.falhas]); 

  // --- HANDLER PARA TOGGLE DE CONDIÇÕES ---
  const handleToggleCondicao = (condicaoId) => {
      FichaClass.toggleCondicao(condicaoId);
      handleFichaChange(null, null, null); // Recalcula tudo
  };

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
    URL.revokeObjectURL(link.href); 
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
  
  if (!FichaClass.addNotaDiario) {
    FichaClass.diario = FichaClass.diario || []; 
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

  const handleSalvarNota = (dadosNota) => {
    if (notaParaEditar) { FichaClass.updateNotaDiario(notaParaEditar.id, dadosNota); } 
    else { FichaClass.addNotaDiario(dadosNota); }
    handleFichaChange(null, null, null); 
    handleFecharDiarioModal(); 
  };
  const handleRemoverNota = (notaId) => { 
    if (window.confirm("Tem certeza que deseja apagar esta anotação?")) { 
      FichaClass.removeNotaDiario(notaId); 
      handleFichaChange(null, null, null); 
    } 
  };
  
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
      const isAprendido = aprendidos.some(p => p.key === poder.key || p.key.startsWith(`${poder.key}_`));

      if (isAprendido) {
          const keysToRemove = aprendidos.filter(p => p.key === poder.key || p.key.startsWith(`${poder.key}_`)).map(p => p.key);
          keysToRemove.forEach(key => FichaClass.removePoder(key));
          handleFichaChange(null, null, null);
      } else {
          if (poder.requiresChoice) {
              handleAbrirSelecaoPoder(poder);
          } else {
              FichaClass.addPoder(poder); 
              handleFichaChange(null, null, null);
          }
      }
  };

  const handleVincularItem = (valorSelecionado) => {
    if (!itemPendente) return;
    
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


  // --- FUNÇÃO DE MUDANÇA DE FICHA (ATUALIZADA COM ATRIBUTOS FINAIS E PENALIDADES) ---
  
  function handleFichaChange(secao, campo, valor) {
    
    let skipUpdate = false;
    
    // Parte 1: Setters (Dados Brutos)
    if (secao) {
        if (secao === 'info') {
            const trilhasUnificadas = getMergedTrilhas(FichaClass.getTrilhasPersonalizadas());
            
            if (campo === 'nex') {
                 let nexValue = String(valor).replace(/[^0-9]/g, '');
                 let nexNumber = parseInt(nexValue) || 0;
                 if (nexNumber > 100) nexNumber = 100;
                 valor = `${nexNumber}%`;
                 FichaClass.setInfo(campo, valor);
            }
            else if (campo === 'origem') {
                const novaOrigem = valor;
                const origemAntiga = FichaClass.getDados().info.origem;
                // Remove antigas
                if (origemAntiga && database.periciasPorOrigem?.[origemAntiga]?.fixas) {
                    database.periciasPorOrigem[origemAntiga].fixas.forEach(p => {
                        const valorAtual = FichaClass.getBonusTotalPericia(p);
                        if (valorAtual === 5) FichaClass.setTreinoPericia(p, 0);
                    });
                }
                // Adiciona novas
                if (database.periciasPorOrigem?.[novaOrigem]?.fixas) {
                    database.periciasPorOrigem[novaOrigem].fixas.forEach(p => {
                        const valorAtual = FichaClass.getBonusTotalPericia(p);
                        if (valorAtual === 0) FichaClass.setTreinoPericia(p, 5);
                    });
                }
                // Poderes
                if (origemAntiga) {
                    FichaClass.poderes_aprendidos = FichaClass.poderes_aprendidos.filter(p => !p.isOrigemPower);
                }
                const dadosOrigem = database.periciasPorOrigem?.[novaOrigem];
                if (dadosOrigem && dadosOrigem.poder) {
                    const novoPoderObj = {
                        key: `origem_${novaOrigem}`,
                        nome: dadosOrigem.poder.nome,
                        descricao: dadosOrigem.poder.descricao,
                        tipo: "Origem",
                        isOrigemPower: true
                    };
                    FichaClass.addPoder(novoPoderObj);
                }
                FichaClass.setInfo(campo, valor);
            }
            else if (campo === 'trilha') {
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
            else {
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
        else if (secao === 'resistencias') { FichaClass.setResistencia(campo, valor); }
    }
    
    if (skipUpdate) { return; }

    // --- PARTE 2: Recalcula TUDO (AGORA COM PENALIDADES) ---
    
    const novosDados = FichaClass.getDados();
    
    // Recalcula PV/PE/SAN (internamente usa atributos finais)
    FichaClass.calcularValoresMaximos();
    
    const bonusDefesaInventario = FichaClass.getBonusDefesaInventario();
    FichaClass.setDefesa('equip', bonusDefesaInventario);

    // AQUI ESTÁ O PULO DO GATO: Usa os atributos COM penalidades
    const agi = FichaClass.getAtributoFinal('agi');
    const vig = FichaClass.getAtributoFinal('vig');
    const int = FichaClass.getAtributoFinal('int');
    // const forca = FichaClass.getAtributoFinal('for'); // Usado no peso

    const equip = novosDados.defesa.equip || 0;
    const outros = parseInt(novosDados.defesa.outros) || 0;
    let bonusOrigemDefesa = (novosDados.info.origem === "policial") ? 2 : 0;
    
    // Penalidades de Defesa por Condições
    let penalidadeDefesa = 0;
    if (novosDados.condicoesAtivas.includes('vulneravel')) penalidadeDefesa -= 5;
    if (novosDados.condicoesAtivas.includes('desprevenido') || novosDados.condicoesAtivas.includes('atordoado') || novosDados.condicoesAtivas.includes('cego')) penalidadeDefesa -= 5;
    if (novosDados.condicoesAtivas.includes('indefeso') || novosDados.condicoesAtivas.includes('inconsciente')) penalidadeDefesa -= 10; 
    if (novosDados.condicoesAtivas.includes('agarrado')) penalidadeDefesa -= 5;
    if (novosDados.condicoesAtivas.includes('caido')) penalidadeDefesa -= 5; 

    const defesaTotal = 10 + agi + equip + outros + bonusOrigemDefesa + penalidadeDefesa; 
    
    const treino_fortitude = parseInt(novosDados.pericias.fortitude) || 0;
    const treino_reflexos = parseInt(novosDados.pericias.reflexos) || 0;
    const treino_luta = parseInt(novosDados.pericias.luta) || 0;

    // Bônus de defesa com atributos finais
    const bonus_fortitude = Math.floor(treino_fortitude / 5) + vig;
    const bonus_reflexos = Math.floor(treino_reflexos / 5) + agi;

    const tem_treino_fortitude = treino_fortitude >= 5;
    const tem_treino_reflexos = treino_reflexos >= 5;
    const tem_treino_luta = treino_luta >= 5;

    const nexString = novosDados.info.nex || '0%';
    const nexNumeric = parseInt(nexString.replace('%', '')) || 0;
    const canChangeTheme = nexNumeric >= 50;

    const bonusPericiaCalculado = {};
    Object.keys(novosDados.pericias).forEach(periciaKey => {
      bonusPericiaCalculado[periciaKey] = FichaClass.getBonusPericiaInventario(periciaKey);
    });
    
    // Limite de Perícias com INT final
    const classe = novosDados.info.classe;
    let bonusClassePericias = 0;
    switch (classe) {
      case "combatente": bonusClassePericias = 1 + int; break;
      case "especialista": bonusClassePericias = 7 + int; break;
      case "ocultista": bonusClassePericias = 3 + int; break;
      case "sobrevivente": bonusClassePericias = 0; break; 
      default: bonusClassePericias = 0;
    }
    const origem = novosDados.info.origem;
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
    const periciasTotal = Math.max(0, bonusClassePericias + bonusOrigemPericias);
    
    let periciasTreinadas = 0;
    Object.values(novosDados.pericias).forEach((treino) => {
      if (parseInt(treino) >= 5) {
        periciasTreinadas++;
      }
    });

    const ppAtual = parseInt(novosDados.info.prestigio, 10) || 0;
    const patenteInfo = getPatenteInfo(ppAtual) || Patentes[0];
    
    const cargaMax = FichaClass.getMaxPeso(); 

    setCalculados(prevCalculados => ({
      ...prevCalculados,
      defesaTotal: defesaTotal,
      cargaAtual: FichaClass.getPesoTotal(),
      cargaMax: cargaMax,
      periciasTreinadas: periciasTreinadas,
      periciasTotal: periciasTotal,
      bonusPericia: bonusPericiaCalculado,
      canChangeTheme: canChangeTheme, 
      patente: patenteInfo,
      bloqueio_rd: tem_treino_fortitude ? bonus_fortitude : '—',
      esquiva_bonus: tem_treino_reflexos ? bonus_reflexos : '—',
      tem_contra_ataque: tem_treino_luta,
    }));
    
    setPersonagem(novosDados);
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
        <img src="/assets/images/SimboloSemafinidade.webp" id="simbolo-ordem" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloSangue.webp" id="simbolo-sangue" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloMorte.webp" id="simbolo-morte" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloConhecimento.webp" id="simbolo-conhecimento" className="simbolo-parallax" alt=""/>
        <img src="/assets/images/SimboloEnergia.webp" id="simbolo-energia" className="simbolo-parallax" alt=""/>
      </div>
      
      <div id="transition-overlay"></div>

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

      <Recursos 
        dados={personagem.recursos}
        dadosPerseguicao={personagem.perseguicao}
        dadosVisibilidade={personagem.visibilidade} 
        info={personagem.info} 
        onFichaChange={handleFichaChange}
      />

      <nav className="ficha-abas">
        <button className={`ficha-aba-link ${abaAtiva === 'principal' ? 'active' : ''}`} onClick={() => setAbaAtiva('principal')}>Principal</button>
        <button className={`ficha-aba-link ${abaAtiva === 'inventario' ? 'active' : ''}`} onClick={() => setAbaAtiva('inventario')}>Inventário</button>
        <button className={`ficha-aba-link ${abaAtiva === 'rituais' ? 'active' : ''}`} onClick={() => setAbaAtiva('rituais')}>Rituais</button>
        <button className={`ficha-aba-link ${abaAtiva === 'poderes' ? 'active' : ''}`} onClick={() => setAbaAtiva('poderes')}>Poderes</button>
        <button className={`ficha-aba-link ${abaAtiva === 'progressao' ? 'active' : ''}`} onClick={() => setAbaAtiva('progressao')}>Progressão</button>
        <button className={`ficha-aba-link ${abaAtiva === 'diario' ? 'active' : ''}`} onClick={() => setAbaAtiva('diario')}>Diário</button>
      </nav>
      
      <Suspense fallback={<LoadingComponent />}>
        {abaAtiva === 'principal' && (
          <FichaPrincipal
            personagem={personagem}
            calculados={calculados} 
            fichaInstance={FichaClass} 
            handleFichaChange={handleFichaChange}
            controlesProps={controlesProps} 
            trilhasPorClasse={trilhasPorClasse}
            periciasDeOrigem={periciasDeOrigem}
            onToggleCondicao={handleToggleCondicao} // Handler passado para o filho
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
            diarioData={FichaClass.diario || []} 
            onAbrirModal={handleAbrirDiarioModal}
            onRemoveNota={handleRemoverNota}
          />
        )}

        <footer>
          <p></p>
        </footer>
        
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