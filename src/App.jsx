// /src/app.jsx
// (CORRIGIDO: Ordem do <nav> e <Recursos> trocada)

import { useState, useEffect } from 'react';
import { ficha as fichaInstance } from './lib/personagem.js'; 
import { 
    database, 
    OpcoesClasse, 
    poderesCombatente, 
    poderesEspecialista, 
    poderesOcultista,
    poderesGerais,
    poderesParanormais // <-- CORREÇÃO 1: Importar poderesParanormais (você já tinha, mas confirmando)
} from './lib/database.js'; 
// <-- CORREÇÃO 2: 'progressaoTrilhas' removido pois não é usado diretamente
import { progressaoClasses, getMergedTrilhas, groupTrilhasByClass } from './lib/progressao.js'; 

// Importa as Abas e Componentes
import FichaPrincipal from './components/FichaPrincipal';
import Inventario from './components/Inventario';
import Rituais from './components/Rituais';
import Recursos from './components/ficha/recursos'; // <-- Importado aqui
import ModalLoja from './components/ModalLoja';
import ModalSelecao from './components/ModalSelecao';
import ModalRituais from './components/ModalRituais'; 
import ProgressaoHabilidades from './components/ficha/ProgressaoHabilidades'; 
import ModalTrilhaCustom from './components/ModalTrilhaCustom'; 
import ModalPoderes from './components/ModalPoderes';
import PoderesAprendidos from './components/PoderesAprendidos'; 
// <-- CORREÇÃO 3: 'Identidade' removido pois não é usado diretamente aqui
import ModalEditarItem from './components/ModalEditarItem';
import Diario from './components/Diario'; 
import ModalNota from './components/ModalNota'; 

// Importa as funções de animação
import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from './lib/animacoes.js';

// (Helpers... nenhuma mudança aqui)
const listaTodasPericias = Object.keys(fichaInstance.pericias); 
const opcoesPericia = listaTodasPericias
  .filter(p => p !== 'luta' && p !== 'pontaria') 
  .map(p => ({ nome: p.charAt(0).toUpperCase() + p.slice(1), valor: p }));

const opcoesElemento = [
  { nome: 'Sangue', valor: 'sangue' },
  { nome: 'Morte', valor: 'morte' },
  { nome: 'Conhecimento', valor: 'conhecimento' },
  { nome: 'Energia', valor: 'energia' },
];

const MapeamentoTrilhaClasse = {
    aniquilador: 'combatente', comandante_campo: 'combatente', guerreiro: 'combatente',
    operacoes_especiais: 'combatente', tropa_choque: 'combatente', agente_secreto: 'combatente',
    cacador: 'combatente', monstruoso: 'combatente',
    atirador_elite: 'especialista', infiltrador: 'especialista', medico_campo: 'especialista',
    negociador: 'especialista', tecnico: 'especialista', bibliotecario: 'especialista',
    perseverante: 'especialista', muambeiro: 'especialista',
    conduite: 'ocultista', flagelador: 'ocultista', graduado: 'ocultista',
    intuitivo: 'ocultista', lamina_paranormal: 'ocultista', exorcista: 'ocultista',
    possuido: 'ocultista', parapsicologo: 'ocultista',
    durao: 'sobrevivente', esperto: 'sobrevivente', esoterico: 'sobrevivente',
};


function App() {
  
  // --- ESTADOS ---
  // (Nenhuma mudança nos estados)
  const [personagem, setPersonagem] = useState(fichaInstance.getDados());
  const [calculados, setCalculados] = useState({
    defesaTotal: 10,
    cargaAtual: 0,
    cargaMax: 2,
    periciasTreinadas: 0,
    periciasTotal: 0,
    bonusPericia: {},
    canChangeTheme: false, 
  });
  const [tema, setTema] = useState(() => localStorage.getItem("temaFichaOrdem") || "tema-ordem");
  const [abaAtiva, setAbaAtiva] = useState('principal'); 
  const [trilhasPorClasse, setTrilhasPorClasse] = useState({
      combatente: { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } },
      especialista: { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } },
      ocultista: { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } },
      sobrevivente: { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } },
  });
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
  
  // --- FUNÇÕES DE LÓGICA / CÁLCULO ---
  // (Nenhuma mudança nas funções de useEffect ou Handlers)
  
  useEffect(() => {
    const customTrilhas = fichaInstance.getTrilhasPersonalizadas(); 
    const trilhasUnificadas = getMergedTrilhas(customTrilhas); 
    const trilhasAgrupadas = groupTrilhasByClass(trilhasUnificadas);
    setTrilhasPorClasse(trilhasAgrupadas);
  }, [personagem.trilhas_personalizadas, personagem.info.classe]); 
  
  useEffect(() => {
    const temaAtual = document.documentElement.dataset.tema || "tema-ordem";
    aplicarTemaComAnimacao(tema, temaAtual, () => {
      document.documentElement.dataset.tema = tema;
      localStorage.setItem("temaFichaOrdem", tema);
    });
  }, [tema]); 

  useEffect(() => {
    const temaSalvo = localStorage.getItem("temaFichaOrdem") || "tema-ordem";
    aplicarTemaSemAnimacao(temaSalvo);
    carregarFicha();
    handleFichaChange(null, null, null); 
  }, []); 

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

  const handleAbrirTrilhaModal = () => setIsTrilhaModalOpen(true);
  const handleFecharTrilhaModal = () => setIsTrilhaModalOpen(false);
  const handleAddTrilha = (trilhaData) => {
    fichaInstance.addTrilhaPersonalizada(trilhaData); 
    handleFichaChange(null, null, null); 
    handleFecharTrilhaModal();
  };

  const handleAbrirPoderesModal = () => setIsPoderesModalOpen(true);
  const handleFecharPoderesModal = () => setIsPoderesModalOpen(false);
  const handleTogglePoder = (poder) => {
      const aprendidos = fichaInstance.getPoderesAprendidos();
      const isAprendido = aprendidos.some(p => p.key === poder.key);
      if (isAprendido) { fichaInstance.removePoder(poder.key); } 
      else { fichaInstance.addPoder(poder); }
      handleFichaChange(null, null, null);
  };
  const getPoderesDisponiveis = (classe) => {
      switch (classe.toLowerCase()) {
          case 'combatente': return poderesCombatente;
          case 'especialista': return poderesEspecialista;
          case 'ocultista': return poderesOcultista;
          default: return [];
      }
  };

  const carregarFicha = () => {
    const dadosSalvos = localStorage.getItem("fichaOrdemParanormal");
    if (dadosSalvos) {
      try {
        const dadosFicha = JSON.parse(dadosSalvos);
        fichaInstance.carregarDados(dadosFicha);
      } catch (e) {
        console.error("Erro ao carregar dados salvos:", e);
        localStorage.removeItem("fichaOrdemParanormal");
      }
    }
  };
  const salvarFicha = () => {
    const dadosFicha = fichaInstance.getDados();
    localStorage.setItem("fichaOrdemParanormal", JSON.stringify(dadosFicha));
    alert("Ficha salva com sucesso no navegador!");
  };
  const limparFicha = () => {
    if (window.confirm("Isso apagará a ficha salva. Deseja continuar?")) {
      localStorage.removeItem("fichaOrdemParanormal");
      alert("Ficha apagada.");
      window.location.reload(); 
    }
  };
  const exportarFicha = () => {
    handleFichaChange(null, null, null); 
    const dadosFicha = fichaInstance.getDados();
    const nomeArquivo = "ficha-ordem.json";
    const dadosString = JSON.stringify(dadosFicha, null, 2);
    const link = document.createElement("a");
    link.href = "data:text/json;charset=utf-8," + encodeURIComponent(dadosString);
    link.download = nomeArquivo;
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
        fichaInstance.carregarDados(dadosFicha);
        handleFichaChange(null, null, null);
        alert("Ficha importada com sucesso!");
      } catch (erro) { alert("Erro ao ler o arquivo JSON."); }
    };
    leitor.readAsText(arquivo);
  };
  
  const handleAbrirRitualModal = () => setIsRitualModalOpen(true);
  const handleFecharRitualModal = () => setIsRitualModalOpen(false);
  const handleAddRitual = (ritual) => { 
    fichaInstance.addRitualInventario(ritual); 
    handleFichaChange(null, null, null); 
  };
  const handleRemoveRitual = (inventarioId) => { 
    fichaInstance.removeRitualInventario(inventarioId); 
    handleFichaChange(null, null, null); 
  };

  const handleAbrirLoja = () => setIsLojaOpen(true);
  const handleFecharLoja = () => setIsLojaOpen(false);
  const handleFecharSelecao = () => { setIsSelecaoOpen(false); setItemPendente(null); };
  const handleAbrirModalEdicao = (inventarioId) => {
    const item = personagem.inventario.find(i => i.inventarioId === inventarioId);
    if (item) {
      setItemParaEditar(item);
      setIsModalEditarItemOpen(true);
    }
  };
  const handleFecharModalEdicao = () => {
    setIsModalEditarItemOpen(false);
    setItemParaEditar(null);
  };
  const handleSalvarItemEditado = (itemAtualizado) => {
    if (itemParaEditar) {
      fichaInstance.updateItemInventario(itemParaEditar.inventarioId, itemAtualizado);
      handleFecharModalEdicao();
      handleFichaChange(null, null, null); 
    }
  };
  const handleAddItem = (itemOriginal) => {
    if (itemOriginal.tipoBonus === 'generico') {
      setItemPendente({ ...itemOriginal, tituloModal: `Vincular: ${itemOriginal.nome}`, descricaoModal: 'Escolha uma perícia para vincular ao item. (Não pode Luta ou Pontaria)', opcoes: opcoesPericia, tipoVinculo: 'pericia' });
      setIsSelecaoOpen(true); handleFecharLoja(); 
    } else if (itemOriginal.tipoBonus === 'escolhaElemento') {
      setItemPendente({ ...itemOriginal, tituloModal: `Escolher Elemento: ${itemOriginal.nome}`, descricaoModal: 'Este item pode ser de diferentes elementos. Escolha um:', opcoes: opcoesElemento, tipoVinculo: 'elemento' });
      setIsSelecaoOpen(true); handleFecharLoja();
    } else {
      fichaInstance.addItemInventario(itemOriginal); handleFichaChange(null, null, null); 
    }
  };
  const handleVincularItem = (valorSelecionado) => {
    if (!itemPendente) return;
    const trilhasUnificadas = getMergedTrilhas(fichaInstance.getTrilhasPersonalizadas());
    if (itemPendente.tipoVinculo === 'trilhaElemento') {
      const trilhaSelecionada = itemPendente.trilhaValue;
      fichaInstance.setInfo('trilha', trilhaSelecionada);
      fichaInstance.setInfo(`${trilhaSelecionada}_elemento`, valorSelecionado); 
      handleFecharSelecao(); 
      handleFichaChange(null, null, null); 
      return; 
    }
    let itemVinculado = { ...itemPendente };
    if (itemPendente.tipoVinculo === 'pericia') { itemVinculado.periciaVinculada = valorSelecionado; } 
    else if (itemPendente.tipoVinculo === 'elemento') { itemVinculado.elemento = valorSelecionado; itemVinculado.nome = itemPendente.nome.replace("(Elemento)", `(${valorSelecionado})`); }
    itemVinculado.tipoBonus = null; itemVinculado.tituloModal = undefined; itemVinculado.descricaoModal = undefined; itemVinculado.opcoes = undefined; itemVinculado.tipoVinculo = undefined;
    fichaInstance.addItemInventario(itemVinculado); handleFecharSelecao(); handleFichaChange(null, null, null); 
  };
  const handleRemoveItem = (inventarioId) => { fichaInstance.removeItemInventario(inventarioId); handleFichaChange(null, null, null); };
  const handleToggleItem = (inventarioId) => { fichaInstance.toggleIgnorarCalculos(inventarioId); handleFichaChange(null, null, null); };
  
  const handleAbrirDiarioModal = (nota) => {
    setNotaParaEditar(nota); 
    setIsDiarioModalOpen(true);
  };
  const handleFecharDiarioModal = () => {
    setIsDiarioModalOpen(false);
    setNotaParaEditar(null); 
  };
  const handleSalvarNota = (dadosNota) => {
    if (notaParaEditar) {
      fichaInstance.updateNotaDiario(notaParaEditar.id, dadosNota);
    } else {
      fichaInstance.addNotaDiario(dadosNota);
    }
    handleFichaChange(null, null, null); 
  };
  const handleRemoverNota = (notaId) => {
    if (window.confirm("Tem certeza que deseja apagar esta anotação?")) {
      fichaInstance.removeNotaDiario(notaId);
      handleFichaChange(null, null, null); 
    }
  };

  function handleFichaChange(secao, campo, valor) {
    // (Nenhuma mudança na função handleFichaChange)
    let skipUpdate = false;
    const trilhasUnificadas = getMergedTrilhas(fichaInstance.getTrilhasPersonalizadas());
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
                fichaInstance.setInfo(campo, valor);
            }
        } 
        else if (campo === 'classe') {
            const novaClasse = valor;
            const trilhasValidas = Object.values(trilhasPorClasse[novaClasse.toLowerCase()] || {}).map(t => t.key); 
            const trilhaAtual = fichaInstance.info.trilha; 
            const trilhaInvalida = trilhaAtual !== 'nenhuma' && !trilhasValidas.includes(trilhaAtual);
            if (trilhaInvalida) {
                fichaInstance.setInfo('trilha', 'nenhuma');
                fichaInstance.setInfo(`${trilhaAtual}_elemento`, '');
            }
            fichaInstance.setInfo(campo, valor);
        }
        else if (!skipUpdate) {
            fichaInstance.setInfo(campo, valor);
        }
      } else if (secao === 'atributos') {
        fichaInstance.setAtributo(campo, valor); 
      } else if (secao === 'recursos') {
        fichaInstance.setRecurso(campo, valor);
      } else if (secao === 'defesa') {
        fichaInstance.setDefesa(campo, valor);
      } else if (secao === 'pericias') {
        fichaInstance.setTreinoPericia(campo, valor);
      } else if (secao === 'bonusManuais') {
        fichaInstance.setBonusManual(campo, valor);
      } 
    }
    if (skipUpdate) { return; }
    const bonusDefesaInventario = fichaInstance.getBonusDefesaInventario();
    fichaInstance.setDefesa('equip', bonusDefesaInventario);
    const bonusPericiaCalculado = {};
    const periciasAtuais = fichaInstance.pericias || {};
    Object.keys(periciasAtuais).forEach(periciaKey => {
      bonusPericiaCalculado[periciaKey] = fichaInstance.getBonusPericiaInventario(periciaKey);
    });
    fichaInstance.calcularValoresMaximos(); 
    const agi = parseInt(fichaInstance.atributos.agi) || 0;
    const equip = fichaInstance.defesa.equip || 0;
    const outros = parseInt(fichaInstance.defesa.outros) || 0;
    let bonusOrigemDefesa = 0;
    if (fichaInstance.info.origem === "policial") {
      bonusOrigemDefesa = 2;
    }
    const defesaTotal = 10 + agi + equip + outros + bonusOrigemDefesa; 
    const cargaAtual = fichaInstance.getPesoTotal();
    const cargaMax = fichaInstance.getMaxPeso();
    const int = parseInt(fichaInstance.atributos.int) || 0;
    const classe = fichaInstance.info.classe;
    let bonusClassePericias = 0;
    switch (classe) {
      case "combatente": bonusClassePericias = 1 + int; break;
      case "especialista": bonusClassePericias = 7 + int; break;
      case "ocultista": bonusClassePericias = 3 + int; break;
      default: bonusClassePericias = 0;
    }
    const origem = fichaInstance.info.origem;
    let bonusOrigemPericias = 0;
    if (database && database.periciasPorOrigem && database.periciasPorOrigem[origem]) {
      const { fixas, escolhas } = database.periciasPorOrigem[origem];
      bonusOrigemPericias += fixas.length;
      escolhas.forEach((e) => {
        bonusOrigemPericias += e.quantidade;
      });
    }
    const periciasTotal = bonusClassePericias + bonusOrigemPericias;
    let periciasTreinadas = 0;
    Object.values(fichaInstance.pericias).forEach((treino) => {
      if (parseInt(treino) >= 5) {
        periciasTreinadas++;
      }
    });
    const novosDados = fichaInstance.getDados();
    const nexString = novosDados.info.nex || '0%';
    const nexNumeric = parseInt(nexString.replace('%', '')) || 0;
    const canChangeTheme = nexNumeric >= 50;
    setCalculados({
      defesaTotal: defesaTotal,
      cargaAtual: cargaAtual,
      cargaMax: cargaMax,
      periciasTreinadas: periciasTreinadas,
      periciasTotal: periciasTotal,
      bonusPericia: bonusPericiaCalculado,
      canChangeTheme: canChangeTheme, 
    });
    setPersonagem({ ...novosDados });
  }

  const controlesProps = {
    temaAtual: tema, 
    onSave: salvarFicha,
    onClear: limparFicha,
    onExport: exportarFicha,
    onImport: importarFicha,
    onThemeChange: setTema 
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

      {/* <-- MUDANÇA: ORDEM TROCADA --> */}
      <div className="recursos-container-fixo">
        <Recursos 
          dados={personagem.recursos}
          onFichaChange={handleFichaChange}
        />
      </div>

      <nav className="ficha-abas">
        <button 
          className={`ficha-aba-link ${abaAtiva === 'principal' ? 'active' : ''}`} 
          onClick={() => setAbaAtiva('principal')}
        >
          Principal
        </button>
        <button 
          className={`ficha-aba-link ${abaAtiva === 'inventario' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('inventario')}
        >
          Inventário
        </button>
        <button 
          className={`ficha-aba-link ${abaAtiva === 'rituais' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('rituais')}
        >
          Rituais
        </button>
        <button 
          className={`ficha-aba-link ${abaAtiva === 'poderes' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('poderes')}
        >
          Poderes
        </button>
        <button 
          className={`ficha-aba-link ${abaAtiva === 'progressao' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('progressao')}
        >
          Progressão
        </button>
        <button 
          className={`ficha-aba-link ${abaAtiva === 'diario' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('diario')}
        >
          Diário
        </button>
      </nav>
      {/* <-- FIM DA MUDANÇA --> */}
      
      {abaAtiva === 'principal' && (
        <FichaPrincipal
          personagem={personagem}
          calculados={calculados} 
          fichaInstance={fichaInstance} 
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
            poderesAprendidos={personagem.poderes_aprendidos} 
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
      
      {/* --- INÍCIO DA CORREÇÃO 4 --- */}
      <ModalPoderes
        isOpen={isPoderesModalOpen}
        onClose={handleFecharPoderesModal}
        classe={personagem.info.classe}
        poderesDisponiveis={getPoderesDisponiveis(personagem.info.classe)}
        poderesAprendidos={personagem.poderes_aprendidos}
        onTogglePoder={handleTogglePoder}
        poderesGerais={poderesGerais} 
        poderesParanormais={poderesParanormais} // <-- PROP ADICIONADA
      />
      {/* --- FIM DA CORREÇÃO 4 --- */}

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