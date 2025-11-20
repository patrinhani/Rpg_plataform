// src/components/FichaPrincipal.jsx
// (ATUALIZADO: Recebe e repassa 'periciasDeOrigem')

import React from 'react';

import Identidade from './ficha/identidade';
import Atributos from './ficha/atributos';
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
  trilhasPorClasse,
  periciasDeOrigem // <--- NOVA PROP
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
        patenteInfo={calculados.patente} 
      />
      
      <Controles {...controlesComNEX} /> 

      <Atributos 
        dados={personagem.atributos} 
        onFichaChange={handleFichaChange} 
      />
      
      <DefesaStatus
        dadosInfo={personagem.info}
        dadosDefesa={personagem.defesa}
        dadosResistencias={personagem.resistencias}
        dadosCalculados={calculados} 
        onFichaChange={handleFichaChange}
      />
      
      <Pericias
        dadosPericias={personagem.pericias}
        dadosAtributos={personagem.atributos}
        dadosCalculados={calculados}
        onFichaChange={handleFichaChange}
        periciasDeOrigem={periciasDeOrigem} // <--- PASSA PARA O COMPONENTE
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