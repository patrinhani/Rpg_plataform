// /src/app.jsx
// (COMPLETO: Correção do Parallax, Lógica de Afinidade (NEX 50+) e Inicialização)

import { useState, useEffect } from 'react';
import { ficha as fichaInstance } from './lib/personagem.js'; 
import { database } from './lib/database.js'; 

// Importa as Abas
import FichaPrincipal from './components/FichaPrincipal';
import Inventario from './components/Inventario';
import Rituais from './components/Rituais';
import ModalLoja from './components/ModalLoja';
import ModalSelecao from './components/ModalSelecao';
import ModalRituais from './components/ModalRituais'; 

// Importa as funções de animação
import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from './lib/animacoes.js';

// (CORREÇÃO PARALLAX) Importa os caminhos dos assets para garantir o carregamento correto
import SimboloOrdem from '/assets/images/SimboloSemafinidade.png';
import SimboloSangue from '/assets/images/SimboloSangue.png';
import SimboloMorte from '/assets/images/SimboloMorte.png';
import SimboloConhecimento from '/assets/images/SimboloConhecimento.png';
import SimboloEnergia from '/assets/images/SimboloEnergia.png';


// (Helper para perícias)
const listaTodasPericias = Object.keys(fichaInstance.pericias); 
const opcoesPericia = listaTodasPericias
  .filter(p => p !== 'luta' && p !== 'pontaria') 
  .map(p => ({ nome: p.charAt(0).toUpperCase() + p.slice(1), valor: p }));

// (Helper para elementos)
const opcoesElemento = [
  { nome: 'Sangue', valor: 'Sangue' },
  { nome: 'Morte', valor: 'Morte' },
  { nome: 'Conhecimento', valor: 'Conhecimento' },
  { nome: 'Energia', valor: 'Energia' },
];

// ----------------------------------------------------------------------
// Mapeamento de Trilhas por Classe - ATUALIZADO COM AS TRILHAS CORRETAS DE SOBREVIVENTE
const trilhasPorClasse = {
  combatente: [
    { value: "aniquilador", text: "Aniquilador" },
    { value: "comandante_campo", text: "Comandante de Campo" },
    { value: "guerreiro", text: "Guerreiro" },
    { value: "operacoes_especiais", text: "Operações Especiais" },
    { value: "tropa_choque", text: "Tropa de Choque" },
    
    // Novas trilhas de COMBATENTE
    { value: "agente_secreto", text: "Agente Secreto" },
    { value: "cacador", text: "Caçador" },
    { value: "monstruoso", text: "Monstruoso (Especial)" }, 
  ],
  especialista: [
    { value: "atirador_elite", text: "Atirador de Elite" },
    { value: "infiltrador", text: "Infiltrador" },
    { value: "medico_campo", text: "Médico de Campo" },
    { value: "negociador", text: "Negociador" },
    { value: "tecnico", text: "Técnico" },

    // Novas trilhas de ESPECIALISTA
    { value: "bibliotecario", text: "Bibliotecário" },
    { value: "perseverante", text: "Perseverante" },
    { value: "muambeiro", text: "Muambeiro" },
  ],
  ocultista: [
    { value: "conduite", text: "Conduíte" },
    { value: "flagelador", text: "Flagelador" },
    { value: "graduado", text: "Graduado" },
    { value: "intuitivo", text: "Intuitivo" },
    { value: "lamina_paranormal", text: "Lâmina Paranormal" },

    // Novas trilhas de OCULTISTA
    { value: "exorcista", text: "Exorcista" },
    { value: "possuido", text: "Possuído" },
    { value: "parapsicologo", text: "Parapsicólogo" },
  ],
  sobrevivente: [
    // TRILHAS CORRETAS DA CLASSE SOBREVIVENTE (por Estágios)
    { value: "durao", text: "Durão" },
    { value: "esperto", text: "Esperto" },
    { value: "esoterico", text: "Esotérico" },
  ],
};
// ----------------------------------------------------------------------


function App() {
  
  // --- ESTADOS ---
  const [personagem, setPersonagem] = useState(fichaInstance.getDados());
  
  const [calculados, setCalculados] = useState({
    defesaTotal: 10,
    cargaAtual: 0,
    cargaMax: 2,
    periciasTreinadas: 0,
    periciasTotal: 0,
    bonusPericia: {},
    canChangeTheme: false, // Controla se o NEX >= 50%
  });

  const [tema, setTema] = useState(() => localStorage.getItem("temaFichaOrdem") || "tema-ordem");
  const [abaAtiva, setAbaAtiva] = useState('principal');

  // (Estados dos Modais)
  const [isLojaOpen, setIsLojaOpen] = useState(false);
  const [isSelecaoOpen, setIsSelecaoOpen] = useState(false);
  const [itemPendente, setItemPendente] = useState(null); 
  const [isRitualModalOpen, setIsRitualModalOpen] = useState(false); 

  
  // --- Lógica de Tema e Efeitos ---
  
  useEffect(() => {
    const temaAtual = document.documentElement.dataset.tema || "tema-ordem";
    aplicarTemaComAnimacao(tema, temaAtual, () => {
      document.documentElement.dataset.tema = tema;
      localStorage.setItem("temaFichaOrdem", tema);
    });
  }, [tema]); 


  // Efeito de inicialização (roda uma vez)
  useEffect(() => {
    const temaSalvo = localStorage.getItem("temaFichaOrdem") || "tema-ordem";
    aplicarTemaSemAnimacao(temaSalvo);
    
    // Tenta carregar dados e executa o cálculo inicial
    carregarFicha();
    handleFichaChange(null, null, null); 
  }, []); 

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
  
  // --- FUNÇÕES DE CONTROLE (Salvar, Carregar, etc.) ---
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
  
  // --- Funções de Controle dos Rituais e Inventário (Omitidas para brevidade, mas intactas) ---
  const handleAbrirRitualModal = () => setIsRitualModalOpen(true);
  const handleFecharRitualModal = () => setIsRitualModalOpen(false);
  const handleAddRitual = (ritual) => { fichaInstance.addRitualInventario(ritual); handleFichaChange(null, null, null); };
  const handleRemoveRitual = (inventarioId) => { fichaInstance.removeRitualInventario(inventarioId); handleFichaChange(null, null, null); };
  const handleAbrirLoja = () => setIsLojaOpen(true);
  const handleFecharLoja = () => setIsLojaOpen(false);
  const handleFecharSelecao = () => { setIsSelecaoOpen(false); setItemPendente(null); };
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
    let itemVinculado = { ...itemPendente };
    if (itemPendente.tipoVinculo === 'pericia') { itemVinculado.periciaVinculada = valorSelecionado; } 
    else if (itemPendente.tipoVinculo === 'elemento') { itemVinculado.elemento = valorSelecionado; itemVinculado.nome = itemPendente.nome.replace("(Elemento)", `(${valorSelecionado})`); }
    itemVinculado.tipoBonus = null; itemVinculado.tituloModal = undefined; itemVinculado.descricaoModal = undefined; itemVinculado.opcoes = undefined; itemVinculado.tipoVinculo = undefined;
    fichaInstance.addItemInventario(itemVinculado); handleFecharSelecao(); handleFichaChange(null, null, null); 
  };
  const handleRemoveItem = (inventarioId) => { fichaInstance.removeItemInventario(inventarioId); handleFichaChange(null, null, null); };
  const handleToggleItem = (inventarioId) => { fichaInstance.toggleIgnorarCalculos(inventarioId); handleFichaChange(null, null, null); };
  

  // --- FUNÇÃO CÉREBRO (handleFichaChange) ---
  function handleFichaChange(secao, campo, valor) {
    
    if (secao) {
      if (secao === 'info') {
        
        // (LÓGICA NEX) Lógica de formatação de NEX
        if (campo === 'nex') {
            // Remove tudo que não for dígito
            let nexValue = String(valor).replace(/[^0-9]/g, '');
            let nexNumber = parseInt(nexValue) || 0;
            
            // Limita a 100%
            if (nexNumber > 100) nexNumber = 100;
            
            // Formata sempre com '%' para salvar no objeto
            valor = `${nexNumber}%`;
        }
        
        fichaInstance.setInfo(campo, valor);

        // ----------------------------------------------------------------------
        // Lógica de validação de trilha ao trocar a classe
        if (campo === 'classe') {
            const novaClasse = valor;
            const trilhasValidas = trilhasPorClasse[novaClasse.toLowerCase()] || [];
            
            // Pega a trilha que foi mantida no estado
            const trilhaAtual = fichaInstance.info.trilha; 
            
            // Verifica se a trilha atual não é 'nenhuma' E não está na lista de trilhas válidas
            const trilhaInvalida = trilhasValidas.length > 0 && 
                                   !trilhasValidas.some(t => t.value === trilhaAtual);
            
            if (trilhaAtual !== 'nenhuma' && trilhaInvalida) {
                // Se a trilha for inválida para a nova classe, reseta para "nenhuma"
                fichaInstance.setInfo('trilha', 'nenhuma');
            }
        }
        // ----------------------------------------------------------------------

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

    // --- Recalcula TUDO ---
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

    // (LÓGICA NEX) Cálculo de Afinidade
    const nexString = fichaInstance.info.nex || '0%';
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

    // Atualiza o estado do personagem
    const novosDados = fichaInstance.getDados();
    setPersonagem({ ...novosDados });
  }

  // Agrupa as props do <Controles />
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
        {/* CORREÇÃO PARALLAX: Uso de variáveis importadas */}
        <img src={SimboloOrdem} id="simbolo-ordem" className="simbolo-parallax" />
        <img src={SimboloSangue} id="simbolo-sangue" className="simbolo-parallax" />
        <img src={SimboloMorte} id="simbolo-morte" className="simbolo-parallax" />
        <img src={SimboloConhecimento} id="simbolo-conhecimento" className="simbolo-parallax" />
        <img src={SimboloEnergia} id="simbolo-energia" className="simbolo-parallax" />
      </div>
      
      <div id="transition-overlay"></div>

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
      </nav>
      
      {abaAtiva === 'principal' && (
        <FichaPrincipal
          personagem={personagem}
          calculados={calculados} 
          fichaInstance={fichaInstance} 
          handleFichaChange={handleFichaChange}
          controlesProps={controlesProps}
          // Passando o mapeamento de trilhas como prop
          trilhasPorClasse={trilhasPorClasse} 
        />
      )}
      
      {abaAtiva === 'inventario' && (
        <Inventario 
          inventario={personagem.inventario} 
          onAbrirLoja={handleAbrirLoja}
          onRemoveItem={handleRemoveItem}
          onToggleItem={handleToggleItem}
        />
      )}

      {abaAtiva === 'rituais' && (
        <Rituais 
          rituais={personagem.rituais} 
          onAbrirModal={handleAbrirRitualModal} 
          onRemoveRitual={handleRemoveRitual} 
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
    </>
  )
}

export default App