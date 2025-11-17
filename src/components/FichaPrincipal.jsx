// /src/components/FichaPrincipal.jsx
// (ATUALIZADO: Adicionada a prop 'dadosResistencias' na chamada do DefesaStatus)

import React from 'react';

// Caminhos corretos para a pasta ./ficha/ (sem .jsx)
import Identidade from './ficha/identidade';
import Atributos from './ficha/atributos';
// import Recursos from './ficha/recursos'; // <-- REMOVIDO
import DefesaStatus from './ficha/defesa-status';
import Pericias from './ficha/pericias';
import Controles from './ficha/controles';
import CalculoDetalhado from './ficha/calculo-detalhado';

function FichaPrincipal({
  personagem,
  calculados, // 'calculados' agora contém 'patente' e as ações de defesa
  fichaInstance,
  handleFichaChange,
  controlesProps,
  trilhasPorClasse,
  progressaoData 
}) {
    const { canChangeTheme } = calculados; 

    const controlesComNEX = {
        ...controlesProps,
        canChangeTheme: canChangeTheme 
    };

  return (
    <main className="ficha-container">
      
      <Identidade 
        dados={personagem.info} 
        onFichaChange={handleFichaChange} 
        trilhasPorClasse={trilhasPorClasse}
        patenteInfo={calculados.patente} // Passa a patente calculada
      />
      
      <Controles {...controlesComNEX} /> 

      <Atributos 
        dados={personagem.atributos} 
        onFichaChange={handleFichaChange} 
      />

      {/* <Recursos ... /> <-- REMOVIDO DAQUI */}
      
      {/* --- BLOCO ATUALIZADO --- */}
      <DefesaStatus
        dadosInfo={personagem.info}
        dadosDefesa={personagem.defesa}
        dadosResistencias={personagem.resistencias} // <-- ESTA LINHA FOI ADICIONADA
        dadosCalculados={calculados} // Passa TODOS os cálculos (incluindo ações)
        onFichaChange={handleFichaChange}
      />
      {/* --- FIM DA ATUALIZAÇÃO --- */}
      
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