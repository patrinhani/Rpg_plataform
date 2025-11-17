// /src/components/ficha/defesa-status.jsx
// (ATUALIZADO: Adiciona classes de tema às resistências)

import React, { memo } from 'react';

// (NOVO) Objeto para mapear chaves para classes CSS
const TEMA_CLASSES = {
  sangue: 'res-sangue',
  morte: 'res-morte',
  conhecimento: 'res-conhecimento',
  energia: 'res-energia',
};

function DefesaStatus({ dadosInfo, dadosDefesa, dadosResistencias, dadosCalculados, onFichaChange }) {
  
  // Handler para os inputs de DEFESA (Outros)
  const handleDefesaChange = (e) => {
    onFichaChange('defesa', e.target.id, e.target.value);
  };

  // Handler para os inputs de RESISTÊNCIA
  const handleResistenciaChange = (e) => {
    const campo = e.target.id.replace('res_', ''); // Remove o prefixo 'res_'
    onFichaChange('resistencias', campo, e.target.value);
  };

  // Pega os valores de SDA calculados no App.jsx
  const { defesaTotal, bloqueio_rd, esquiva_bonus, tem_contra_ataque } = dadosCalculados;

  const agiBonus = parseInt(dadosCalculados.bonusPericia.agi) || 0;

  return (
    <>
      {/* Bloco de Defesa (Corrigido) */}
      <div className="box box-defesa" id="grid-defesa">
        <div className="titulo-bloco">
          <span className="circulo-bloco"></span>
          DEFESA
        </div>

        <div className="valor-total-bloco">
          <span>TOTAL</span>
          <div className="valor-grande">{defesaTotal || 10}</div>
        </div>

        <div className="campos-linha-defesa">
          <div className="campo-valor-simples">
            <label>AGILIDADE</label>
            <div className="valor">{agiBonus}</div>
          </div>
          <div className="campo-valor-simples">
            <label>EQUIPAMENTO</label>
            <div className="valor">{dadosDefesa.equip || 0}</div>
          </div>
          <div className="campo-valor-simples editavel">
            <label htmlFor="outros">OUTROS</label>
            <input
              id="outros"
              type="number"
              className="valor"
              value={dadosDefesa.outros || 0}
              onChange={handleDefesaChange}
            />
          </div>
        </div>
      </div>

      {/* BLOCO: AÇÕES DE DEFESA */}
      <div className="box box-acoes-defesa" id="grid-acoes-defesa">
        <div className="titulo-bloco">
          AÇÕES DE DEFESA
        </div>
        <div className="acoes-grid">
          <div className="acao-defesa" title="Treinado em Fortitude">
            <label>BLOQUEIO</label>
            <div className="valor-acao">
              {bloqueio_rd !== '—' ? <span>RD {bloqueio_rd}</span> : '—'}
            </div>
          </div>
          <div className="acao-defesa" title="Treinado em Reflexos">
            <label>ESQUIVA</label>
            <div className="valor-acao">
              {esquiva_bonus !== '—' ? <span>+ {esquiva_bonus}</span> : '—'}
            </div>
          </div>
          <div className="acao-defesa" title="Treinado em Luta">
            <label>CONTRA-ATAQUE</label>
            <div className="valor-acao">
              {tem_contra_ataque ? 'SIM' : 'NÃO'}
            </div>
          </div>
        </div>
      </div>

      {/* BLOCO: RESISTÊNCIAS */}
      <div className="box box-resistencias" id="grid-resistencias">
        <div className="titulo-bloco">
          RESISTÊNCIAS A DANO
        </div>
        <div className="resistencias-grid">
          {/* Garante que dadosResistencias exista antes de mapear */}
          {dadosResistencias && Object.keys(dadosResistencias).map((key) => {
            // (NOVO) Pega a classe de tema correspondente
            const temaClasse = TEMA_CLASSES[key] || '';
            
            return (
              <div 
                // (NOVO) Adiciona a classe de tema (ex: "res-sangue")
                className={`campo-valor-simples editavel ${temaClasse}`} 
                key={key}
              >
                <label htmlFor={`res_${key}`}>{key}</label>
                <input
                  id={`res_${key}`}
                  type="number"
                  className="valor"
                  value={dadosResistencias[key] || 0}
                  onChange={handleResistenciaChange}
                  min="0"
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default memo(DefesaStatus);