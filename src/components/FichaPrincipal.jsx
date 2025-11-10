// /src/components/FichaPrincipal.jsx

import React from 'react';

// Caminhos corretos para a pasta ./ficha/ (sem .jsx)
import Identidade from './ficha/identidade';
import Atributos from './ficha/atributos';
import Recursos from './ficha/recursos';
import DefesaStatus from './ficha/defesa-status';
import Pericias from './ficha/pericias';
import Controles from './ficha/controles';
import CalculoDetalhado from './ficha/calculo-detalhado';

function FichaPrincipal({
  personagem,
  calculados,
  fichaInstance,
  handleFichaChange,
  controlesProps,
  trilhasPorClasse // Recebe a prop
}) {
    // 1. Extrai canChangeTheme do objeto calculados
    const { canChangeTheme } = calculados; 

    // 2. Cria um novo objeto de props para Controles, incluindo o status do NEX
    const controlesComNEX = {
        ...controlesProps,
        canChangeTheme: canChangeTheme // Repassa o novo status
    };

  return (
    <main className="ficha-container">
      
      <Identidade 
        dados={personagem.info} 
        onFichaChange={handleFichaChange} 
        trilhasPorClasse={trilhasPorClasse} // Repassa a prop para Identidade
      />
      
      <Controles {...controlesComNEX} /> {/* Usa as novas props aqui */}

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

      <CalculoDetalhado
        dados={personagem.bonusManuais}
        calculos={fichaInstance.calculosDetalhados}
        onFichaChange={handleFichaChange}
      />

    </main>
  );
}

export default FichaPrincipal;