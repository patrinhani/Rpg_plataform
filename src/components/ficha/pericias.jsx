// src/components/ficha/pericias.jsx
import React from 'react';
import { useFicha } from '../../contexts/FichaContext'; // [NOVO] Importar hook

const ATRIBUTO_BASE = {
  acrobacia: { nome: 'Acrobacia', attr: 'agi' },
  crime: { nome: 'Crime', attr: 'agi' },
  furtividade: { nome: 'Furtividade', attr: 'agi' },
  iniciativa: { nome: 'Iniciativa', attr: 'agi' },
  pilotagem: { nome: 'Pilotagem', attr: 'agi' },
  pontaria: { nome: 'Pontaria', attr: 'agi' },
  reflexos: { nome: 'Reflexos', attr: 'agi' },
  atletismo: { nome: 'Atletismo', attr: 'for' },
  luta: { nome: 'Luta', attr: 'for' },
  atualidades: { nome: 'Atualidades', attr: 'int' },
  ciencias: { nome: 'Ciências', attr: 'int' },
  investigacao: { nome: 'Investigação', attr: 'int' },
  medicina: { nome: 'Medicina', attr: 'int' },
  ocultismo: { nome: 'Ocultismo', attr: 'int' },
  profissao: { nome: 'Profissão', attr: 'int' },
  sobrevivencia: { nome: 'Sobrevivência', attr: 'int' },
  tatica: { nome: 'Tática', attr: 'int' },
  tecnologia: { nome: 'Tecnologia', attr: 'int' },
  adestramento: { nome: 'Adestramento', attr: 'pre' },
  artes: { nome: 'Artes', attr: 'pre' },
  diplomacia: { nome: 'Diplomacia', attr: 'pre' },
  enganacao: { nome: 'Enganação', attr: 'pre' },
  intimidacao: { nome: 'Intimidação', attr: 'pre' },
  intuicao: { nome: 'Intuição', attr: 'pre' },
  percepcao: { nome: 'Percepção', attr: 'pre' },
  religiao: { nome: 'Religião', attr: 'pre' },
  vontade: { nome: 'Vontade', attr: 'pre' },
  fortitude: { nome: 'Fortitude', attr: 'vig' },
};

const periciasLista = Object.keys(ATRIBUTO_BASE);

function Pericias({ dadosPericias, dadosCalculados, onFichaChange, periciasDeOrigem, nex }) { // Recebe nex
  const { fichaInstance } = useFicha();

  // Converte "10%" para 10
  const nexAtual = parseInt((nex || "0").replace('%','')) || 0;

  const handleChange = (e) => {
    const campo = e.target.id;
    const valor = e.target.value;
    onFichaChange('pericias', campo, valor);
  };

  return (
    <section className="box box-pericias" id="grid-pericias">
      {/* ... (Header igual) ... */}
      <div className="pericias-header">
        <h2>PERÍCIAS</h2>
        <div className="pericias-contador">
          Treinadas: 
          <span style={{ color: dadosCalculados.periciasTreinadas > dadosCalculados.periciasTotal ? 'var(--cor-trans-sangue)' : 'var(--cor-destaque)'}}>
            {dadosCalculados.periciasTreinadas}
          </span> / 
          <span>{dadosCalculados.periciasTotal}</span>
        </div>
      </div>

      <ul id="lista-pericias" className="pericias-grid-container">
        {periciasLista.map((periciaKey) => {
          const periciaInfo = ATRIBUTO_BASE[periciaKey];
          const treinoValor = dadosPericias[periciaKey];
          const bonusInventario = dadosCalculados.bonusPericia[periciaKey] || 0;
          const infoDados = fichaInstance.getDadosPericia(periciaKey, periciaInfo.attr, bonusInventario);
          
          const isOrigem = periciasDeOrigem && periciasDeOrigem.includes(periciaKey);
          
          return (
            <li 
              key={periciaKey} 
              className={`pericia-item treino-${treinoValor} ${isOrigem ? 'pericia-origem' : ''}`}
              title={infoDados.msgCondicao || ""}
            >
              <span>
                {periciaInfo.nome} ({periciaInfo.attr.toUpperCase()})
                {isOrigem && <span style={{color: 'var(--cor-destaque)', marginLeft: '5px'}}>★</span>}
              </span>

              <div className="pericia-bonus-container">
                <div 
                    className="pericia-dado-shape"
                    style={{ 
                        backgroundColor: infoDados.temPenalidade ? '#d40000' : 'var(--cor-destaque)',
                        filter: infoDados.dados <= 0 ? 'grayscale(1)' : 'none'
                    }}
                >
                  <span className="pericia-dado-texto">{infoDados.dados}d</span>
                </div>
                <span className="pericia-bonus-texto">{infoDados.bonus >= 0 ? "+" : ""}{infoDados.bonus}</span>
              </div>

              <select 
                id={periciaKey}
                className="treino-pericia"
                value={treinoValor}
                onChange={handleChange}
              >
                <option value="0">+0 (Destreinado)</option>
                <option value="5">+5 (Treinado)</option>
                {/* [NOVO] Opções desabilitadas se NEX for baixo */}
                <option value="10" disabled={nexAtual < 35}>
                    +10 (Vet){nexAtual < 35 ? ' (NEX 35%)' : ''}
                </option>
                <option value="15" disabled={nexAtual < 70}>
                    +15 (Exp){nexAtual < 70 ? ' (NEX 70%)' : ''}
                </option>
              </select>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Pericias;