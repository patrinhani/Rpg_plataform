// /src/components/ficha/recursos.jsx
// (ATUALIZADO: Nova estrutura HTML com inputs visíveis abaixo da barra)

import React from 'react';

function Recursos({ dados, onFichaChange }) {

  const handleChange = (e) => {
    const campo = e.target.id; // ex: "pv_atual"
    const valor = e.target.value;
    onFichaChange('recursos', campo, valor);
  };

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

    </section>
  );
}

export default Recursos;