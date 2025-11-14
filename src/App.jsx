// src/App.jsx
// (VERSÃO COMPLETA CORRIGIDA - 'fichaInstance' trocado por 'FichaClass' na contagem de perícias)

import React, { useState, useEffect } from 'react';
// Importações de estilos e bibliotecas de animação
import './App.css'; 
import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from './lib/animacoes.js'; 
import AnimacaoSangue from './components/AnimacaoSangue.jsx'; 

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

// Importa os componentes das abas e modais (COM .jsx)
import FichaPrincipal from './components/FichaPrincipal.jsx';
import Inventario from './components/Inventario.jsx';
import PoderesAprendidos from './components/PoderesAprendidos.jsx';
import Rituais from './components/Rituais.jsx';
import Recursos from './components/ficha/recursos.jsx';
import ModalLoja from './components/ModalLoja.jsx';
import ModalEditarItem from './components/ModalEditarItem.jsx';
import ModalSelecao from './components/ModalSelecao.jsx';
import ModalPoderes from './components/ModalPoderes.jsx';
import ModalRituais from './components/ModalRituais.jsx';
import ModalTrilhaCustom from './components/ModalTrilhaCustom.jsx';
import ModalNota from './components/ModalNota.jsx';
import Diario from './components/Diario.jsx';
import ProgressaoHabilidades from './components/ficha/ProgressaoHabilidades.jsx';

// Lista consolidada de todos os poderes para pesquisa rápida (para vinculação)
const allPoderesList = [...poderesParanormais, ...poderesGerais, ...poderesCombatente, ...poderesEspecialista, ...poderesOcultista];

// Opções de Elemento (Hardcoded para ModalSelecao)
const opcoesElemento = [
    { nome: 'Sangue', valor: 'sangue' },
    { nome: 'Morte', valor: 'morte' },
    { nome: 'Conhecimento', valor: 'conhecimento' },
    { nome: 'Energia', valor: 'energia' },
];

// Lista de todas as perícias (para seleção em itens)
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
    const nomeArquivo = "ficha-ordem.json";
    const dadosString = JSON.stringify(dadosFicha, null, 2);
    const link = document.createElement("a");
    link.href = "data:text/json;charset=utf-8," + encodeURIComponent(dadosString);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
  const handleSalvarNota = (dadosNota) => {
    if (notaParaEditar) { FichaClass.updateNotaDiario(notaParaEditar.id, dadosNota); } 
    else { FichaClass.addNotaDiario(dadosNota); }
    handleFichaChange(null, null, null); 
  };
  const handleRemoverNota = (notaId) => { if (window.confirm("Tem certeza que deseja apagar esta anotação?")) { FichaClass.removeNotaDiario(notaId); handleFichaChange(null, null, null); } };
  
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


  // --- FUNÇÃO DE MUDANÇA DE FICHA/CÁLCULO ---

  function handleFichaChange(secao, campo, valor) {
    let skipUpdate = false;
    const trilhasUnificadas = getMergedTrilhas(FichaClass.getTrilhasPersonalizadas());
    
    if (secao) {
        if (secao === 'info') {
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
                const trilhasValidas = Object.values(trilhasPorClasse[novaClasse.toLowerCase()] || {}).map(t => t.key); 
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
        } else if (secao === 'atributos') { FichaClass.setAtributo(campo, valor); } 
          else if (secao === 'recursos') { FichaClass.setRecurso(campo, valor); } 
          else if (secao === 'defesa') { FichaClass.setDefesa(campo, valor); } 
          else if (secao === 'pericias') { FichaClass.setTreinoPericia(campo, valor); } 
          else if (secao === 'bonusManuais') { FichaClass.setBonusManual(campo, valor); } 
    }
    if (skipUpdate) { return; }
    
    // Recalcula e atualiza o estado
    const novosDados = FichaClass.getDados();
    
    FichaClass.calcularValoresMaximos();
    
    const bonusDefesaInventario = FichaClass.getBonusDefesaInventario();
    FichaClass.setDefesa('equip', bonusDefesaInventario);

    const agi = parseInt(FichaClass.getDados().atributos.agi) || 0;
    const equip = FichaClass.getDados().defesa.equip || 0;
    const outros = parseInt(FichaClass.getDados().defesa.outros) || 0;
    let bonusOrigemDefesa = novosDados.info.origem === "policial" ? 2 : 0;
    const defesaTotal = 10 + agi + equip + outros + bonusOrigemDefesa; 
    
    const nexString = novosDados.info.nex || '0%';
    const nexNumeric = parseInt(nexString.replace('%', '')) || 0;
    const canChangeTheme = nexNumeric >= 50;

    const bonusPericiaCalculado = {};
    Object.keys(novosDados.pericias).forEach(periciaKey => {
      bonusPericiaCalculado[periciaKey] = FichaClass.getBonusPericiaInventario(periciaKey);
    });

    // --- INÍCIO DA CORREÇÃO (fichaInstance -> FichaClass) ---
    const int = parseInt(FichaClass.atributos.int) || 0;
    const classe = FichaClass.info.classe;
    let bonusClassePericias = 0;
    switch (classe) {
      case "combatente": bonusClassePericias = 1 + int; break;
      case "especialista": bonusClassePericias = 7 + int; break;
      case "ocultista": bonusClassePericias = 3 + int; break;
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
    // --- FIM DA CORREÇÃO ---

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

  // --- RENDERIZAÇÃO ---
  return (
    <>
      <div id="parallax-background">
        <img src="/assets/images/SimboloSemafinidade.png" id="simbolo-ordem" className="simbolo-parallax" />
        <img src="/assets/images/SimboloSangue.png" id="simbolo-sangue" className="simbolo-parallax" />
        <img src="/assets/images/SimboloMorte.png" id="simbolo-morte" className="simbolo-parallax" />
        <img src="/assets/images/SimboloConhecimento.png" id="simbolo-conhecimento" className="simbolo-parallax" />
        <img src="/assets/images/SimboloEnergia.png" id="simbolo-energia" className="simbolo-parallax" />
      </div>
      
      <div id="transition-overlay"></div>

      {/* Bloco da animação de sangue (Three.js) */}
      {isSangueAnimVisible && (
          <AnimacaoSangue 
            isVisible={isSangueAnimVisible} 
            onComplete={() => {
              setIsSangueAnimVisible(false); 
              aplicarTemaSemAnimacao('tema-sangue'); 
            }} 
          />
      )}

      <div className="recursos-container-fixo">
        <Recursos 
          dados={personagem.recursos}
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
      
      {abaAtiva === 'principal' && (
        <FichaPrincipal
          personagem={personagem}
          calculados={calculados} 
          fichaInstance={FichaClass} // Passando FichaClass
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
        <div className="ficha-aba-conteudo active">
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
          diarioData={personagem.diario}
          onAbrirModal={handleAbrirDiarioModal}
          onRemoveNota={handleRemoverNota}
        />
      )}

      <footer>
        <p>Este é um projeto de fã. Baseado no sistema Ordem Paranormal RPG.</p>
      </footer>

      {/* --- Modais --- */}
      <ModalLoja 
        isOpen={isLojaOpen}
        onClose={handleFecharLoja}
        onAddItem={handleAddItem}
        pericias={listaTodasPericias} 
      />
      
      <ModalSelecao 
        isOpen={isSelecaoOpen && !!itemPendente}
        onClose={handleFecharSelecao}
        item={itemPendente} 
        onSelect={handleVincularItem} 
      />

      <ModalRituais 
        isOpen={isRitualModalOpen}
        onClose={handleFecharRitualModal}
        onAddRitual={handleAddRitual} 
      />

      <ModalTrilhaCustom
        isOpen={isTrilhaModalOpen}
        onClose={handleFecharTrilhaModal}
        onAddTrilha={handleAddTrilha}
        classesList={OpcoesClasse} 
      />
      
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

      <ModalEditarItem
        isOpen={isModalEditarItemOpen}
        onClose={handleFecharModalEdicao}
        onSave={handleSalvarItemEditado}
        item={itemParaEditar}
        pericias={listaTodasPericias}
      />

      <ModalNota
        isOpen={isDiarioModalOpen}
        onClose={handleFecharDiarioModal}
        onSave={handleSalvarNota}
        notaAtual={notaParaEditar}
      />
    </>
  )
}

export default App