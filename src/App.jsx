// /src/app.jsx
// (COMPLETO: Inclui a lógica de animação E o efeito Parallax)

import { useState, useEffect } from 'react';
import { ficha as fichaInstance } from './lib/personagem.js'; 
import { database } from './lib/database.js'; 

// Importa as Abas
import FichaPrincipal from './components/FichaPrincipal';
import Inventario from './components/Inventario';
import Rituais from './components/Rituais';
import ModalLoja from './components/ModalLoja';
import ModalSelecao from './components/ModalSelecao';

// Importa as funções de animação (o .js corrigido)
import { aplicarTemaComAnimacao, aplicarTemaSemAnimacao } from './lib/animacoes.js';

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


function App() {
  
  // --- ESTADOS ---
  const [personagem, setPersonagem] = useState(fichaInstance.getDados());
  
  const [calculados, setCalculados] = useState({
    defesaTotal: 10,
    cargaAtual: 0,
    cargaMax: 2,
    periciasTreinadas: 0,
    periciasTotal: 0,
    bonusPericia: {}
  });

  const [tema, setTema] = useState(() => localStorage.getItem("temaFichaOrdem") || "tema-ordem");
  const [abaAtiva, setAbaAtiva] = useState('principal');

  // (Estados dos Modais)
  const [isLojaOpen, setIsLojaOpen] = useState(false);
  const [isSelecaoOpen, setIsSelecaoOpen] = useState(false);
  const [itemPendente, setItemPendente] = useState(null); 

  
  // --- Lógica de Tema com Animação ---
  
  // Roda QUANDO o estado 'tema' muda (quando o usuário clica no select)
  useEffect(() => {
    // Pega o tema que está *visível* no momento
    const temaAtual = document.documentElement.dataset.tema || "tema-ordem";
    
    // Roda a animação. O 3º argumento é a função "callback"
    // que vai rodar no meio da transição.
    aplicarTemaComAnimacao(tema, temaAtual, () => {
      // Esta é a função de callback:
      // Ela atualiza o tema real e salva no localStorage
      document.documentElement.dataset.tema = tema;
      localStorage.setItem("temaFichaOrdem", tema);
    });

  }, [tema]); // Dispara toda vez que 'setTema' é chamado


  // Roda SÓ UMA VEZ, no carregamento inicial da página
  useEffect(() => {
    // Carrega o tema salvo SEM animação
    const temaSalvo = localStorage.getItem("temaFichaOrdem") || "tema-ordem";
    aplicarTemaSemAnimacao(temaSalvo);
    
    // Carrega a ficha
    carregarFicha();
  }, []); 

  // (O useEffect de 'document.title' continua igual)
  useEffect(() => {
    document.title = `${personagem.info.nome || "Ficha"} - NEX ${personagem.info.nex || "0%"}`;
  }, [personagem.info.nome, personagem.info.nex]); // (Corrigido: dependências mais específicas)

  
  // --- (ADIÇÃO) Efeito Parallax do Mouse ---
  useEffect(() => {
    const parallaxContainer = document.getElementById("parallax-background");
    // (Corrigido: checa se container existe antes de query)
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
        // (Garante que o translate -50% não seja perdido)
        simbolo.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Função de limpeza do React
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []); // O array vazio [] garante que isso rode só uma vez
  // --- FIM DO BLOCO PARALLAX ---

  
  // --- FUNÇÕES DE CONTROLE (Salvar, Carregar, etc.) ---
  const carregarFicha = () => {
    const dadosSalvos = localStorage.getItem("fichaOrdemParanormal");
    if (dadosSalvos) {
      try {
        const dadosFicha = JSON.parse(dadosSalvos);
        fichaInstance.carregarDados(dadosFicha);
        // (CORRIGIDO) Chama o handleFichaChange sem argumentos para 
        // forçar um recálculo total e atualização de estado no React
        handleFichaChange(null, null, null); 
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
    // (CORRIGIDO) Garante que a fichaInstance está atualizada antes de exportar
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
  
  // Funções de Controle dos Modais
  const handleAbrirLoja = () => setIsLojaOpen(true);
  const handleFecharLoja = () => setIsLojaOpen(false);
  const handleFecharSelecao = () => {
    setIsSelecaoOpen(false);
    setItemPendente(null); 
  };

  // Funções de Controle do Inventário
  const handleAddItem = (itemOriginal) => {
    if (itemOriginal.tipoBonus === 'generico') {
      setItemPendente({
        ...itemOriginal,
        tituloModal: `Vincular: ${itemOriginal.nome}`,
        descricaoModal: 'Escolha uma perícia para vincular ao item. (Não pode Luta ou Pontaria)',
        opcoes: opcoesPericia, 
        tipoVinculo: 'pericia' 
      });
      setIsSelecaoOpen(true); 
      handleFecharLoja(); 
      
    } else if (itemOriginal.tipoBonus === 'escolhaElemento') {
      setItemPendente({
        ...itemOriginal,
        tituloModal: `Escolher Elemento: ${itemOriginal.nome}`,
        descricaoModal: 'Este item pode ser de diferentes elementos. Escolha um:',
        opcoes: opcoesElemento, 
        tipoVinculo: 'elemento' 
      });
      setIsSelecaoOpen(true);
      handleFecharLoja();

    } else {
      fichaInstance.addItemInventario(itemOriginal);
      handleFichaChange(null, null, null); 
    }
  };

  const handleVincularItem = (valorSelecionado) => {
    if (!itemPendente) return;
    let itemVinculado = { ...itemPendente };
    if (itemPendente.tipoVinculo === 'pericia') {
      itemVinculado.periciaVinculada = valorSelecionado;
    } else if (itemPendente.tipoVinculo === 'elemento') {
      itemVinculado.elemento = valorSelecionado;
      itemVinculado.nome = itemPendente.nome.replace("(Elemento)", `(${valorSelecionado})`);
    }
    // Limpa os campos do modal
    itemVinculado.tipoBonus = null; 
    itemVinculado.tituloModal = undefined;
    itemVinculado.descricaoModal = undefined;
    itemVinculado.opcoes = undefined;
    itemVinculado.tipoVinculo = undefined;

    fichaInstance.addItemInventario(itemVinculado);
    handleFecharSelecao(); 
    handleFichaChange(null, null, null); 
  };

  const handleRemoveItem = (inventarioId) => {
    fichaInstance.removeItemInventario(inventarioId);
    handleFichaChange(null, null, null);
  };

  const handleToggleItem = (inventarioId) => {
    fichaInstance.toggleIgnorarCalculos(inventarioId);
    handleFichaChange(null, null, null);
  };
  

  // --- FUNÇÃO CÉREBRO (handleFichaChange) ---
  function handleFichaChange(secao, campo, valor) {
    
    if (secao) {
      if (secao === 'info') {
        fichaInstance.setInfo(campo, valor);
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
    // (Corrigido: Defesa da origem Policial)
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
    
    // (Corrigido: Checa se database e a origem existem)
    if (database && database.periciasPorOrigem && database.periciasPorOrigem[origem]) {
      const { fixas, escolhas } = database.periciasPorOrigem[origem];
      bonusOrigemPericias += fixas.length;
      // (Corrigido: Soma as perícias de escolha também)
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

    // Atualiza o estado dos valores calculados
    setCalculados({
      defesaTotal: defesaTotal,
      cargaAtual: cargaAtual,
      cargaMax: cargaMax,
      periciasTreinadas: periciasTreinadas,
      periciasTotal: periciasTotal,
      bonusPericia: bonusPericiaCalculado 
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
        <img src="/assets/images/SimboloSemafinidade.png" id="simbolo-ordem" className="simbolo-parallax" />
        <img src="/assets/images/SimboloSangue.png" id="simbolo-sangue" className="simbolo-parallax" />
        <img src="/assets/images/SimboloMorte.png" id="simbolo-morte" className="simbolo-parallax" />
        <img src="/assets/images/SimboloConhecimento.png" id="simbolo-conhecimento" className="simbolo-parallax" />
        <img src="/assets/images/SimboloEnergia.png" id="simbolo-energia" className="simbolo-parallax" />
      </div>
      
      {/* O <div> abaixo é o alvo do animacoes.js */}
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
        <Rituais />
      )}

      <footer>
        <p>Este é um projeto de fã. Baseado no sistema Ordem Paranormal RPG.</p>
      </footer>

      <ModalLoja 
        isOpen={isLojaOpen}
        onClose={handleFecharLoja}
        onAddItem={handleAddItem}
        pericias={listaTodasPericias} 
      />
      
      <ModalSelecao 
        isOpen={isSelecaoOpen}
        onClose={handleFecharSelecao}
        item={itemPendente} 
        onSelect={handleVincularItem} 
      />
    </>
  )
}

export default App