// /src/components/FichaPrincipal.jsx
// ATUALIZAÇÃO (Removendo extensões .jsx dos imports)

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
  controlesProps 
}) {
  return (
    <main className="ficha-container">
      
      <Identidade 
        dados={personagem.info} 
        onFichaChange={handleFichaChange} 
      />
      
      <Controles {...controlesProps} />

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