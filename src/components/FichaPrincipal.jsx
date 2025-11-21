// src/components/FichaPrincipal.jsx
// (CORRIGIDO: Agrupamento de Controles e Condições para evitar sobreposição)

import React from 'react';

import Identidade from './ficha/identidade.jsx';
import Atributos from './ficha/atributos.jsx';
import DefesaStatus from './ficha/defesa-status.jsx';
import Pericias from './ficha/pericias.jsx';
import Controles from './ficha/controles.jsx';
import CalculoDetalhado from './ficha/calculo-detalhado.jsx';
import Condicoes from './Condicoes.jsx'; // Importa o componente de condições

function FichaPrincipal({
  personagem,
  calculados, 
  fichaInstance,
  handleFichaChange,
  controlesProps,
  trilhasPorClasse,
  periciasDeOrigem,
  onToggleCondicao 
}) {
    // Extrai a prop 'canChangeTheme' diretamente do objeto 'calculados'
    const { canChangeTheme } = calculados; 

    // Mescla a propriedade booleana nas props que vão para o componente Controles
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
      
      {/* --- AGRUPAMENTO PARA EVITAR SOBREPOSIÇÃO --- 
          Criamos um container flex que ocupa a área 'controles' 
          e empilha os dois componentes verticalmente. */}
      <div style={{ gridArea: 'controles', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Área de Controles (Botões de Salvar, Importar, Tema) */}
        <Controles {...controlesComNEX} /> 
        
        {/* Área de Condições (Fica logo abaixo dos controles) */}
        <Condicoes 
           ativas={personagem.condicoesAtivas || []} 
           onToggle={onToggleCondicao} 
        />
        
      </div>
      {/* --- FIM DO AGRUPAMENTO --- */}

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
        periciasDeOrigem={periciasDeOrigem} 
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