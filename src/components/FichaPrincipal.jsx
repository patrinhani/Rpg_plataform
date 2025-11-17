// /src/components/FichaPrincipal.jsx
// (CORRIGIDO: Chamada para o componente <Recursos /> foi REMOVIDA)

import React from 'react';

// Caminhos corretos para a pasta ./ficha/
import Identidade from './ficha/identidade';
import Atributos from './ficha/atributos';
// A linha 'import Recursos' foi removida daqui
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
  progressaoData 
}) {
    const { canChangeTheme } = calculados; 

    // Esta variável agora é criada aqui, pois 'controlesProps' vem do App.jsx
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
      
      {/* A prop 'controlesComNEX' é usada aqui. 
        O erro 'controlesComNEX is not defined' no App.jsx foi corrigido na resposta anterior.
      */}
      <Controles {...controlesComNEX} /> 

      <Atributos 
        dados={personagem.atributos} 
        onFichaChange={handleFichaChange} 
      />

      {/* O COMPONENTE <Recursos /> FOI REMOVIDO DESTE ARQUIVO.
        Ele agora vive apenas no App.jsx como a HUD fixa.
      */}
      
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