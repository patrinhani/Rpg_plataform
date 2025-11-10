// /src/components/ficha/defesa-status.jsx

import React from 'react';

// Recebe os 'dados' (várias seções) e a função 'onFichaChange'
function DefesaStatus({ dadosInfo, dadosDefesa, dadosCalculados, onFichaChange }) {

  // Handler para campos de INFO (NEX, Deslocamento)
  const handleInfoChange = (e) => {
    onFichaChange('info', e.target.id, e.target.value);
  };

  // Handler para campos de DEFESA (Outros)
  const handleDefesaChange = (e) => {
    onFichaChange('defesa', e.target.id, e.target.value);
  };

  return (
    <section className="box box-defesa-status" id="grid-defesa-status">
      
      {/* --- NEX --- */}
      <div className="campo-horizontal">
        <label>NEX</label>
        <input 
          type="text" 
          id="nex" 
          value={dadosInfo.nex}
          onChange={handleInfoChange}
        />
      </div>
      
      {/* --- DESLOCAMENTO --- */}
      <div className="campo-horizontal">
        <label>DESL.</label>
        <input 
          type="number" 
          id="deslocamento" 
          value={dadosInfo.deslocamento}
          onChange={handleInfoChange}
        />
      </div>
      
      {/* --- DEFESA --- */}
      <div className="campo-horizontal">
        <label>DEFESA</label>
        {/* Este 'span' é controlado por dados calculados no app.jsx */}
        <span id="defesa-total" className="valor-calculado">
          {dadosCalculados.defesaTotal}
        </span>
        
        {/* Este input é 'readonly' pois é calculado a partir do inventário */}
        <input 
          type="number" 
          id="defesa-equip" 
          placeholder="Equip." 
          value={dadosDefesa.equip}
          readOnly 
        />
        <input 
          type="number" 
          id="outros" // O ID é 'outros' para bater com a classe personagem
          placeholder="Outros"
          value={dadosDefesa.outros}
          onChange={handleDefesaChange}
        />
      </div>
      
      {/* --- CARGA --- */}
      <div className="campo-horizontal">
        <label>CARGA</label>
        {/* Este 'span' é controlado por dados calculados no app.jsx */}
        <span 
          id="carga-atual" 
          className="valor-calculado"
          // Adiciona o estilo de "sobrecarga" (vermelho)
          style={{ 
            color: dadosCalculados.cargaAtual > dadosCalculados.cargaMax ? 
                   'var(--cor-trans-sangue)' : 
                   'var(--cor-destaque)'
          }}
        >
          {dadosCalculados.cargaAtual}
        </span>
        <span className="carga-max">
          / <span id="carga-max">{dadosCalculados.cargaMax}</span>
        </span>
      </div>
    </section>
  );
}

export default DefesaStatus;