// src/components/FichaPrincipal.jsx
// (ATUALIZADO: Correção de imports com extensão .jsx)

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
  onToggleCondicao // <--- Recebe o handler
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
      
      {/* --- ÁREA DE CONDIÇÕES (NOVO) --- */}
      {/* Renderiza logo abaixo dos controles para fácil acesso */}
      <div style={{ gridArea: 'controles', marginTop: '20px' }}>
        <Condicoes 
           ativas={personagem.condicoesAtivas || []} 
           onToggle={onToggleCondicao} 
        />
      </div>

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