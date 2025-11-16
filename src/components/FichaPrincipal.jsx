// /src/components/FichaPrincipal.jsx
// (ATUALIZADO: Adicionada a prop 'patenteInfo' na chamada do Identidade)

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
  calculados, // 'calculados' contém 'calculados.patente'
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
      
      {/* --- CORREÇÃO APLICADA AQUI --- */}
      <Identidade 
        dados={personagem.info} 
        onFichaChange={handleFichaChange} 
        trilhasPorClasse={trilhasPorClasse}
        patenteInfo={calculados.patente} // <-- Esta linha foi ADICIONADA
      />
      {/* --- FIM DA CORREÇÃO --- */}
      
      <Controles {...controlesComNEX} /> 

      <Atributos 
        dados={personagem.atributos} 
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