// src/components/ficha/atributos.jsx
import React from 'react';
import { useFicha } from '../../contexts/FichaContext';

function Atributos({ onFichaChange }) {
  // Consome os dados calculados do contexto (que incluem as penalidades de condições)
  const { personagem, calculados } = useFicha();
  
  const dadosBase = personagem.atributos;
  
  // Se por algum motivo os cálculos ainda não existirem (inicialização), usa a base como fallback
  const dadosFinais = calculados.atributosDetalhados || {
      for: { valorFinal: dadosBase.for, modificadores: [] },
      agi: { valorFinal: dadosBase.agi, modificadores: [] },
      int: { valorFinal: dadosBase.int, modificadores: [] },
      pre: { valorFinal: dadosBase.pre, modificadores: [] },
      vig: { valorFinal: dadosBase.vig, modificadores: [] }
  };

  const renderInputInteligente = (chave, idCss) => {
      const detalhe = dadosFinais[chave];
      const valorFinal = detalhe.valorFinal;
      const valorBase = dadosBase[chave];
      
      // Calcula a diferença para saber se há penalidade ativa
      const diferenca = valorFinal - valorBase;
      const temPenalidade = diferenca < 0;
      const temBonus = diferenca > 0; // Caso futuro para buffs
      
      // Monta o tooltip explicativo
      let tooltip = `Base: ${valorBase}`;
      if (temPenalidade || temBonus) {
          detalhe.modificadores?.forEach(m => {
              tooltip += `\n${m.nome}: ${m.valor}`;
          });
          tooltip += `\nFinal: ${valorFinal}`;
      }

      // Define a cor do texto
      let corTexto = 'var(--cor-texto-principal)'; // Padrão
      if (temPenalidade) corTexto = '#ff4444'; // Vermelho se reduzido
      else if (temBonus) corTexto = '#00ff00'; // Verde se aumentado (futuro)

      return (
          <input 
            type="number" 
            id={idCss}
            className="input-hex"
            
            // Mostra o valor FINAL (já com penalidades)
            value={valorFinal} 
            
            onChange={(e) => {
                const novoValorInput = parseInt(e.target.value) || 0;
                
                // Lógica Reversa:
                // Se o valor exibido é 1 (mas é Base 3 - 2), e eu mudo pra 2...
                // Eu quero que o resultado final seja 2.
                // Então a Nova Base tem que ser: 2 (novo final) - (-2 diferença) = 4.
                // 4 - 2 = 2.
                const novaBase = novoValorInput - diferenca; 
                
                // A validação de 0 a 10 da BASE acontece lá no personagem.js
                onFichaChange('atributos', chave, novaBase);
            }}

            style={{ 
                color: corTexto,
                // Adiciona um leve brilho vermelho se tiver penalidade para destacar bem
                textShadow: temPenalidade ? '0 0 5px rgba(255, 0, 0, 0.5)' : 'none',
                borderColor: temPenalidade ? '#ff4444' : 'transparent'
            }}
            
            // Tooltip nativo do navegador ao passar o mouse
            title={tooltip}
          />
      );
  }

  return (
    <section className="box-atributos" id="grid-atributos">
      {renderInputInteligente('for', 'forca')}
      {renderInputInteligente('agi', 'agilidade')}
      {renderInputInteligente('int', 'intelecto')}
      {renderInputInteligente('pre', 'presenca')}
      {renderInputInteligente('vig', 'vigor')}
    </section>
  );
}

export default Atributos;