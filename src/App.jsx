// /src/app.jsx
// VERSÃO CORRIGIDA (Remove o comentário de sintaxe inválida)

import { useState, useEffect } from 'react';
import { ficha as fichaInstance } from './lib/personagem.js'; 
import { database } from './lib/database.js'; 

import Identidade from './components/ficha/identidade.jsx';
import Atributos from './components/ficha/atributos.jsx';
import Recursos from './components/ficha/recursos.jsx';
import DefesaStatus from './components/ficha/defesa-status.jsx';
import Pericias from './components/ficha/pericias.jsx';
import Controles from './components/ficha/controles.jsx';
import CalculoDetalhado from './components/ficha/calculo-detalhado.jsx'; 

// (função aplicarTema)
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  localStorage.setItem("temaFichaOrdem", tema);
}


function App() {
  
  const [personagem, setPersonagem] = useState(fichaInstance.getDados());
  
  const [calculados, setCalculados] = useState({
    defesaTotal: 10,
    cargaAtual: 0,
    cargaMax: 2,
    periciasTreinadas: 0,
    periciasTotal: 0,
    bonusPericia: {}
  });

  const [tema, setTema] = useState(() => {
    return localStorage.getItem("temaFichaOrdem") || "tema-ordem";
  });

  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);

  
  const carregarFicha = () => {
    const dadosSalvos = localStorage.getItem("fichaOrdemParanormal");
    if (dadosSalvos) {
      const dadosFicha = JSON.parse(dadosSalvos);
      fichaInstance.carregarDados(dadosFicha);
      handleFichaChange(null, null, null); 
    }
  };

  useEffect(() => {
    carregarFicha();
  }, []); 

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
    const leitor = new FileReader();
    leitor.onload = (e) => {
      try {
        const dadosFicha = JSON.parse(e.target.result);
        fichaInstance.carregarDados(dadosFicha);
        handleFichaChange(null, null, null);
        alert("Ficha importada com sucesso!");
      } catch (erro) {
        alert("Erro ao ler o arquivo JSON.");
      }
    };
    leitor.readAsText(arquivo);
  };
  
  
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
    const outros = fichaInstance.defesa.outros || 0;
    const defesaTotal = 10 + agi + equip + outros; 

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
    // Verificação de segurança (caso o database ainda não tenha sido carregado)
    if (database && database.periciasPorOrigem && database.periciasPorOrigem[origem]) {
      bonusOrigemPericias = database.periciasPorOrigem[origem].fixas.length;
    }
    const periciasTotal = bonusClassePericias + bonusOrigemPericias;

    let periciasTreinadas = 0;
    Object.values(fichaInstance.pericias).forEach((treino) => {
      if (parseInt(treino) >= 5) {
        periciasTreinadas++;
      }
    });

    setCalculados({
      defesaTotal: defesaTotal,
      cargaAtual: cargaAtual,
      cargaMax: cargaMax,
      periciasTreinadas: periciasTreinadas,
      periciasTotal: periciasTotal,
      bonusPericia: bonusPericiaCalculado
    });

    const novosDados = fichaInstance.getDados();
    setPersonagem({ ...novosDados });
  }

  useEffect(() => {
    const nome = personagem.info.nome || "Ficha sem nome";
    const nex = personagem.info.nex || "0%";
    document.title = `${nome} - NEX ${nex}`;
  }, [personagem]);

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

      <nav className="ficha-abas">
        <button className="ficha-aba-link active" data-aba="aba-principal">
          Principal
        </button>
        <button className="ficha-aba-link" data-aba="aba-inventario">
          Inventário
        </button>
        <button className="ficha-aba-link" data-aba="aba-rituais">Rituais</button>
      </nav>

      <div id="aba-principal" className="ficha-aba-conteudo active">
        <main className="ficha-container">
          
          <Identidade 
            dados={personagem.info} 
            onFichaChange={handleFichaChange} 
          />
          
          <Controles
            temaAtual={tema}
            onSave={salvarFicha}
            onClear={limparFicha}
            onExport={exportarFicha}
            onImport={importarFicha}
            onThemeChange={setTema} 
          />

          <Atributos 
            dados={personagem.atributos} 
            onFichaChange={handleFichaChange} 
          />

          <Recursos 
            dados={personagem.recursos}
            onFichaChange={handleFichaChange}
          />
          
          <DefesaStatus
            dadosInfo={personagem.info}
            dadosDefesa={personagem.defesa}
            dadosCalculados={calculados}
            onFichaChange={handleFichaChange}
          />
          
          <Pericias
            dadosPericias={personagem.pericias}
            dadosAtributos={personagem.atributos}
            dadosCalculados={calculados}
            onFichaChange={handleFichaChange}
          />

          {/* --- A CORREÇÃO ESTÁ AQUI --- */}
          {/* O comentário inválido foi removido */}
          <CalculoDetalhado
            dados={personagem.bonusManuais}
            calculos={fichaInstance.calculosDetalhados}
            onFichaChange={handleFichaChange}
          />

        </main>
      </div>
      
      <div id="aba-inventario" className="ficha-aba-conteudo"></div>
      <div id="aba-rituais" className="ficha-aba-conteudo"></div>
      <footer>
        <p>Este é um projeto de fã. Baseado no sistema Ordem Paranormal RPG.</p>
      </footer>
    </>
  )
}

export default App