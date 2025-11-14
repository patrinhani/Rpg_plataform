// /src/components/ficha/recursos.jsx
// (ATUALIZADO: Nova estrutura HTML com inputs visíveis abaixo da barra)
// (ATUALIZADO: Adiciona tracker de Perseguição)

import React from 'react';

// 1. Atualizar props
function Recursos({ dados, dadosPerseguicao, onFichaChange }) {

  const handleChange = (e) => {
    const campo = e.target.id; // ex: "pv_atual"
    const valor = e.target.value;
    onFichaChange('recursos', campo, valor);
  };
  
  // --- (NOVOS HANDLERS PARA PERSEGUIÇÃO) ---
  /**
   * Clica em uma linha (sucesso ou falha) para adicionar um ponto.
   * Cicla de 0 -> 1 -> 2 -> 3 -> 0
   */
  const handleTrackerClick = (tipo, valorAtual) => {
    const novoValor = (valorAtual >= 3) ? 0 : valorAtual + 1;
    onFichaChange('perseguicao', tipo, novoValor);
  };

  /** Reseta ambos os contadores */
  const handleResetClick = (e) => {
    e.stopPropagation(); // Impede que o clique no botão ative a linha
    onFichaChange('perseguicao', 'reset', 0);
  };

  /** Renderiza os 3 boxes (vazios ou cheios) */
  const renderBoxes = (tipo, contagem) => {
    let boxes = [];
    for (let i = 1; i <= 3; i++) {
      boxes.push(
        <div 
          key={i} 
          className={`perseguicao-box ${i <= contagem ? 'checked' : ''}`}
        />
      );
    }
    return (
      <div className="perseguicao-boxes" onClick={() => handleTrackerClick(tipo, contagem)}>
        {boxes}
      </div>
    );
  };
  // --- (FIM DOS NOVOS HANDLERS) ---


  // Calcula as porcentagens para as barras
  const pvPerc = (dados.pv_atual / (dados.pv_max || 1)) * 100;
  const pePerc = (dados.pe_atual / (dados.pe_max || 1)) * 100;
  const sanPerc = (dados.san_atual / (dados.san_max || 1)) * 100;

  return (
    <section className="box box-recursos" id="grid-recursos">
      
      {/* --- PONTOS DE VIDA --- */}
      <div className="recurso-individual" id="bloco-pv">
        <label htmlFor="pv_atual">PV</label> {/* 1. Label no topo */}
        
        <div className="barra-recurso"> {/* 2. Barra no meio */}
          <div 
            className="barra-preenchimento" 
            id="barra-pv"
            style={{ width: `${pvPerc}%` }} 
          ></div>
        </div>
        
        <div className="recurso-numeros"> {/* 3. Inputs embaixo */}
          <input 
            type="number" 
            id="pv_atual" 
            className="recurso-atual" 
            value={dados.pv_atual}
            onChange={handleChange}
          />
          <span className="recurso-separador">/</span>
          <input 
            type="number" 
            id="pv_max" 
            className="recurso-max"
            value={dados.pv_max} 
            readOnly // O Máx é calculado, então é apenas leitura
          />
        </div>
      </div>

      {/* --- PONTOS DE ESFORÇO --- */}
      <div className="recurso-individual" id="bloco-pe">
        <label htmlFor="pe_atual">PE</label>
        <div className="barra-recurso">
          <div 
            className="barra-preenchimento" 
            id="barra-pe"
            style={{ width: `${pePerc}%` }}
          ></div>
        </div>
        <div className="recurso-numeros">
          <input 
            type="number" 
            id="pe_atual" 
            className="recurso-atual"
            value={dados.pe_atual}
            onChange={handleChange}
          />
          <span className="recurso-separador">/</span>
          <input 
            type="number" 
            id="pe_max" 
            className="recurso-max"
            value={dados.pe_max} 
            readOnly 
          />
        </div>
      </div>

      {/* --- SANIDADE --- */}
      <div className="recurso-individual" id="bloco-san">
        <label htmlFor="san_atual">SAN</label>
        <div className="barra-recurso">
          <div 
            className="barra-preenchimento" 
            id="barra-san"
            style={{ width: `${sanPerc}%` }}
          ></div>
        </div>
        <div className="recurso-numeros">
          <input 
            type="number" 
            id="san_atual" 
            className="recurso-atual"
            value={dados.san_atual}
            onChange={handleChange}
          />
          <span className="recurso-separador">/</span>
          <input 
            type="number" 
            id="san_max" 
            className="recurso-max"
            value={dados.san_max} 
            readOnly 
          />
        </div>
      </div>
      
      {/* --- (NOVO BLOCO DE PERSEGUIÇÃO) --- */}
      <div className="recurso-individual" id="bloco-perseguicao">
        <label>PERSEGUIÇÃO</label>
        
        {/* Adiciona a classe 'full' quando chega a 3 */}
        <div 
          className={`perseguicao-linha sucesso ${dadosPerseguicao.sucessos >= 3 ? 'full' : ''}`}
        >
          <span>Sucessos</span>
          {renderBoxes('sucessos', dadosPerseguicao.sucessos)}
        </div>

        <div 
          className={`perseguicao-linha falha ${dadosPerseguicao.falhas >= 3 ? 'full' : ''}`}
        >
          <span>Falhas</span>
          {renderBoxes('falhas', dadosPerseguicao.falhas)}
        </div>
        
        <button className="btn-reset-perseguicao" onClick={handleResetClick}>
          Resetar
        </button>
      </div>

    </section>
  );
}

export default Recursos;