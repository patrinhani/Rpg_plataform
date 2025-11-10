// /src/components/ficha/recursos.jsx

import React from 'react';

// Recebe os dados (personagem.recursos) e a função principal
function Recursos({ dados, onFichaChange }) {

  // Handler local para simplificar
  const handleChange = (e) => {
    const campo = e.target.id; // ex: "pv_atual"
    const valor = e.target.value;
    
    // Chama a função principal no App.jsx, avisando a seção 'recursos'
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
        <input 
          type="number" 
          id="pv_atual" 
          className="recurso-atual" 
          value={dados.pv_atual}
          onChange={handleChange}
        />
        <label>PV</label>
        <div className="barra-recurso">
          {/* O estilo da barra é controlado pelo React agora */}
          <div 
            className="barra-preenchimento" 
            id="barra-pv"
            style={{ width: `${pvPerc}%` }} 
          ></div>
        </div>
        <span className="recurso-max">
          / <input 
              type="number" 
              id="pv_max" 
              value={dados.pv_max} 
              readOnly // O React vai calcular isso, então o usuário não deve editar
            />
        </span>
        <span>PONTOS DE VIDA</span>
      </div>

      {/* --- PONTOS DE ESFORÇO --- */}
      <div className="recurso-individual" id="bloco-pe">
        <input 
          type="number" 
          id="pe_atual" 
          className="recurso-atual"
          value={dados.pe_atual}
          onChange={handleChange}
        />
        <label>PE</label>
        <div className="barra-recurso">
          <div 
            className="barra-preenchimento" 
            id="barra-pe"
            style={{ width: `${pePerc}%` }}
          ></div>
        </div>
        <span className="recurso-max">
          / <input 
              type="number" 
              id="pe_max" 
              value={dados.pe_max} 
              readOnly 
            />
        </span>
        <span>PONTOS DE ESFORÇO</span>
      </div>

      {/* --- SANIDADE --- */}
      <div className="recurso-individual" id="bloco-san">
        <input 
          type="number" 
          id="san_atual" 
          className="recurso-atual"
          value={dados.san_atual}
          onChange={handleChange}
        />
        <label>SAN</label>
        <div className="barra-recurso">
          <div 
            className="barra-preenchimento" 
            id="barra-san"
            style={{ width: `${sanPerc}%` }}
          ></div>
        </div>
        <span className="recurso-max">
          / <input 
              type="number" 
              id="san_max" 
              value={dados.san_max} 
              readOnly 
            />
        </span>
        <span>SANIDADE</span>
      </div>

    </section>
  );
}

export default Recursos;