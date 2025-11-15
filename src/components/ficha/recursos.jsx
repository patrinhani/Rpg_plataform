// /src/components/ficha/recursos.jsx
// (CORRIGIDO: As chamadas para renderBoxes foram ajustadas)

import React from 'react';

// 1. Atualizar props
function Recursos({ dados, dadosPerseguicao, dadosVisibilidade, onFichaChange }) {

  const handleChange = (e) => {
    const campo = e.target.id; // ex: "pv_atual"
    const valor = e.target.value;
    onFichaChange('recursos', campo, valor);
  };
  
  // --- (HANDLERS ATUALIZADOS) ---
  
  /** Clica nos boxes de Sucesso/Falha para adicionar um ponto. */
  const handleTrackerClick = (tipo, valorAtual) => {
    const novoValor = (valorAtual >= 3) ? 0 : valorAtual + 1;
    // Agora 'tipo' será 'sucessos' ou 'falhas', o que é correto
    onFichaChange('perseguicao', tipo, novoValor);
  };

  /** Clica nos botões +/- da Visibilidade */
  const handleVisibilidadeChange = (delta) => {
    // A 'seção' é 'visibilidade_mudar' para o App.jsx
    onFichaChange('visibilidade_mudar', 'visibilidade', delta);
  };

  /** Reseta a Perseguição (e a Visibilidade, via personagem.js) */
  const handleResetClick = (e) => {
    e.stopPropagation(); 
    onFichaChange('perseguicao', 'reset', 0);
  };

  /** Renderiza os 3 boxes (vazios ou cheios) para Perseguição */
  // Esta definição está correta
  const renderBoxes = (tipo, contagem) => {
    let boxes = [];
    for (let i = 1; i <= 3; i++) {
      boxes.push(
        <div 
          key={i} 
          className={`tracker-box ${i <= contagem ? 'checked' : ''}`}
        />
      );
    }
    return (
      <div className="tracker-boxes" onClick={() => handleTrackerClick(tipo, contagem)}>
        {boxes}
      </div>
    );
  };
  // --- (FIM DOS HANDLERS) ---


  // Calcula as porcentagens para as barras
  const pvPerc = (dados.pv_atual / (dados.pv_max || 1)) * 100;
  const pePerc = (dados.pe_atual / (dados.pe_max || 1)) * 100;
  const sanPerc = (dados.san_atual / (dados.san_max || 1)) * 100;
  
  const visibilidadeAtual = dadosVisibilidade || 0;

  return (
    <section className="box box-recursos" id="grid-recursos">
      
      {/* --- PONTOS DE VIDA --- */}
      <div className="recurso-individual" id="bloco-pv">
        <label htmlFor="pv_atual">PV</label>
        <div className="barra-recurso">
          <div 
            className="barra-preenchimento" 
            id="barra-pv"
            style={{ width: `${pvPerc}%` }} 
          ></div>
        </div>
        <div className="recurso-numeros">
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
            readOnly 
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
      
      {/* --- (BLOCO ATUALIZADO) --- */}
      <div className="recurso-individual" id="bloco-furtividade">
        <label>FURTIVIDADE</label>
        
        {/* Tracker de Visibilidade (Sempre visível) */}
        <div 
          className={`tracker-linha visibilidade ${visibilidadeAtual >= 3 ? 'full' : ''}`}
        >
          <span>Visibilidade</span>
          <div className="vis-tracker-container">
            <button className="vis-btn" onClick={() => handleVisibilidadeChange(-1)}>-</button>
            <span className="vis-numero">{visibilidadeAtual}</span>
            <button className="vis-btn" onClick={() => handleVisibilidadeChange(1)}>+</button>
          </div>
        </div>

        {/* Tracker de Perseguição (Condicional) */}
        {visibilidadeAtual >= 3 && (
          <div className="perseguicao-container">
            <label>PERSEGUIÇÃO</label>
            <div 
              className={`tracker-linha sucesso ${dadosPerseguicao.sucessos >= 3 ? 'full' : ''}`}
            >
              <span>Sucessos</span>
              {/* --- CORREÇÃO AQUI ---
                A chamada da função estava errada, passando 3 argumentos.
                O correto é passar o TIPO ('sucessos') e o VALOR (dadosPerseguicao.sucessos)
              */}
              {renderBoxes('sucessos', dadosPerseguicao.sucessos)}
            </div>

            <div 
              className={`tracker-linha falha ${dadosPerseguicao.falhas >= 3 ? 'full' : ''}`}
            >
              <span>Falhas</span>
              {/* --- CORREÇÃO AQUI ---
                A chamada da função estava errada, passando 3 argumentos.
                O correto é passar o TIPO ('falhas') e o VALOR (dadosPerseguicao.falhas)
              */}
              {renderBoxes('falhas', dadosPerseguicao.falhas)}
            </div>
            
            <button className="btn-reset-perseguicao" onClick={handleResetClick}>
              Resetar
            </button>
          </div>
        )}

      </div>

    </section>
  );
}

export default Recursos;