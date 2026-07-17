// /src/components/ficha/calculo-detalhado.jsx

import React from 'react';

// Este componente recebe os 'dados' (personagem.bonusManuais)
// e os 'calculos' (personagem.calculosDetalhados)
// e a função 'onFichaChange'
function CalculoDetalhado({ dados, calculos, onFichaChange, classe }) {
  const sobrevivente = classe === 'sobrevivente';
  const escala = sobrevivente ? 'Estágio' : 'NEX';

  // Handler local para os inputs de bônus manuais
  const handleChange = (e) => {
    const campo = e.target.id; // ex: "bonus-pv-nex"
    const valor = e.target.value;
    
    // Converte o ID do HTML para a chave do objeto
    // ex: "bonus-pv-nex" -> "pv_nex"
    const nomeCampo = campo.replace('bonus-', '').replace('-', '_');
    
    onFichaChange('bonusManuais', nomeCampo, valor);
  };

  return (
    <section className="box box-calculo" id="grid-calculo">
      
      {/* --- CÁLCULO PV --- */}
      <div className="calc-bloco">
        <h3>CÁLCULO DE PONTOS DE VIDA (PV)</h3>
        <div className="calc-linha">
          <label>PV Base (Classe)</label>
          <span id="calc-pv-base">{calculos.pv_base}</span>
        </div>
        <div className="calc-linha">
          <label>{sobrevivente ? 'PV por Estágio (Classe)' : 'PV por Nível (Classe + VIG)'}</label>
          <span id="calc-pv-nivel">{calculos.pv_nivel}</span>
        </div>
        <div className="calc-linha origem-bonus">
          <label>Bônus de Origem (Auto)</label>
          <span id="calc-pv-origem">{calculos.pv_origem}</span>
        </div>
        <div className="calc-linha">
          <label htmlFor="bonus-pv-nex">Bônus Manual (+PV p/ {escala})</label>
          <input 
            type="number" 
            id="bonus-pv-nex" 
            value={dados.pv_nex}
            onChange={handleChange}
          />
        </div>
        <div className="calc-linha">
          <label>Bônus Manual (Outros)</label>
          <input 
            type="number" 
            id="bonus-pv-outros"
            aria-label="Bônus manual de PV — outros"
            value={dados.pv_outros}
            onChange={handleChange}
          />
        </div>
        <div className="calc-linha total">
          <label>Total de PV Máximo</label>
          <span id="calc-pv-total">{calculos.pv_total}</span>
        </div>
      </div>

      {/* --- CÁLCULO PE --- */}
      <div className="calc-bloco">
        <h3>CÁLCULO DE PONTOS DE ESFORÇO (PE)</h3>
        <div className="calc-linha">
          <label>PE Base (Classe)</label>
          <span id="calc-pe-base">{calculos.pe_base}</span>
        </div>
        <div className="calc-linha">
          <label>{sobrevivente ? 'PE por Estágio (Classe)' : 'PE por Nível (Classe + PRE)'}</label>
          <span id="calc-pe-nivel">{calculos.pe_nivel}</span>
        </div>
        <div className="calc-linha origem-bonus">
          <label>Bônus de Origem (Auto)</label>
          <span id="calc-pe-origem">{calculos.pe_origem}</span>
        </div>
        <div className="calc-linha">
          <label>Bônus Manual (+PE p/ {escala})</label>
          <input 
            type="number" 
            id="bonus-pe-nex"
            aria-label={`Bônus manual de PE por ${escala}`}
            value={dados.pe_nex}
            onChange={handleChange}
          />
        </div>
        <div className="calc-linha">
          <label>Bônus Manual (Outros)</label>
          <input 
            type="number" 
            id="bonus-pe-outros"
            aria-label="Bônus manual de PE — outros"
            value={dados.pe_outros}
            onChange={handleChange}
          />
        </div>
        <div className="calc-linha">
          <label>Ajuste Manual (Limite PE/Turno)</label>
          <input 
            type="number" 
            id="bonus-limite-pe"
            aria-label="Ajuste manual do limite de PE por turno"
            value={dados.limite_pe || 0}
            onChange={handleChange}
          />
        </div>
        <div className="calc-linha total">
          <label>Total de PE Máximo</label>
          <span id="calc-pe-total">{calculos.pe_total}</span>
        </div>
      </div>

      {/* --- CÁLCULO SAN --- */}
      <div className="calc-bloco">
        <h3>CÁLCULO DE SANIDADE (SAN)</h3>
        <div className="calc-linha">
          <label>SAN Base (Classe)</label>
          <span id="calc-san-base">{calculos.san_base}</span>
        </div>
        <div className="calc-linha">
          <label>{sobrevivente ? 'SAN por Estágio (Classe)' : 'SAN por Nível (Classe)'}</label>
          <span id="calc-san-nivel">{calculos.san_nivel}</span>
        </div>
        <div className="calc-linha origem-bonus">
          <label>Bônus de Origem (Auto)</label>
          <span id="calc-san-origem">{calculos.san_origem}</span>
        </div>
        <div className="calc-linha">
          <label>Bônus Manual (+SAN p/ {escala})</label>
          <input 
            type="number" 
            id="bonus-san-nex"
            aria-label={`Bônus manual de Sanidade por ${escala}`}
            value={dados.san_nex}
            onChange={handleChange}
          />
        </div>
        <div className="calc-linha">
          <label>Bônus Manual (Outros)</label>
          <input 
            type="number" 
            id="bonus-san-outros"
            aria-label="Bônus manual de Sanidade — outros"
            value={dados.san_outros}
            onChange={handleChange}
          />
        </div>
        <div className="calc-linha total">
          <label>Total de SAN Máxima</label>
          <span id="calc-san-total">{calculos.san_total}</span>
        </div>
      </div>

    </section>
  );
}

export default CalculoDetalhado;
