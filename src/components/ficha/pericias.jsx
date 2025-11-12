// /src/components/ficha/pericias.jsx
// (ATUALIZADO com layout de "dado" CSS)
// (CORRIGIDO: Removido o "(pior)" para caber no layout)

import React from 'react';

// O helper de atributos não muda
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

function Pericias({ dadosPericias, dadosAtributos, dadosCalculados, onFichaChange }) {
  
  const handleChange = (e) => {
    const campo = e.target.id;
    const valor = e.target.value;
    onFichaChange('pericias', campo, valor);
  };

  // --- LÓGICA DE CÁLCULO ATUALIZADA ---
  // Agora retorna um objeto com partes separadas
  const calcularBonusSeparado = (periciaKey) => {
    const treino = dadosPericias[periciaKey] || 0;
    const attrChave = ATRIBUTO_BASE[periciaKey].attr;
    const valorAttr = dadosAtributos[attrChave] || 0;
    const bonusInventario = dadosCalculados.bonusPericia[periciaKey] || 0; 
    
    const bonusTotal = Number(treino) + bonusInventario;
    
    let diceText = "";
    if (valorAttr === 0) {
      diceText = "2d"; // <-- CORREÇÃO AQUI
    } else {
      diceText = `${valorAttr}d`; // Apenas o dado, ex: "5d"
    }
    
    // O bônus, ex: "+15" ou "+0"
    const bonusText = `${bonusTotal >= 0 ? "+" : ""}${bonusTotal}`;
    
    return {
      dice: diceText,
      bonus: bonusText
    };
  };
  // --- FIM DA LÓGICA ATUALIZADA ---

  return (
    <section className="box box-pericias" id="grid-pericias">
      <div className="pericias-header">
        <h2>PERÍCIAS</h2>
        <div className="pericias-contador">
          Treinadas: 
          <span 
            id="pericias-escolhidas"
            style={{ 
              color: dadosCalculados.periciasTreinadas > dadosCalculados.periciasTotal ? 
                     'var(--cor-trans-sangue)' : 
                     'var(--cor-destaque)'
            }}
          >
            {dadosCalculados.periciasTreinadas}
          </span> / 
          <span id="pericias-total">{dadosCalculados.periciasTotal}</span>
        </div>
      </div>

      <ul id="lista-pericias" className="pericias-grid-container">
        {periciasLista.map((periciaKey) => {
          const periciaInfo = ATRIBUTO_BASE[periciaKey];
          const treinoValor = dadosPericias[periciaKey];
          
          // Pega o objeto de bônus
          const bonus = calcularBonusSeparado(periciaKey);
          
          return (
            <li 
              key={periciaKey} 
              className={`pericia-item treino-${treinoValor}`}
            >
              <span>{periciaInfo.nome} ({periciaInfo.attr.toUpperCase()})</span>

              {/* --- ESTRUTURA HTML ATUALIZADA --- */}
              <div className="pericia-bonus-container">
                <div className="pericia-dado-shape">
                  <span className="pericia-dado-texto">{bonus.dice}</span>
                </div>
                <span className="pericia-bonus-texto">{bonus.bonus}</span>
              </div>
              {/* --- FIM DA ESTRUTURA --- */}

              <select 
                id={periciaKey}
                className="treino-pericia"
                value={treinoValor}
                onChange={handleChange}
              >
                <option value="0">+0 (Destreinado)</option>
                <option value="5">+5 (Treinado)</option>
                <option value="10">+10 (Veterano)</option>
                <option value="15">+15 (Expert)</option>
              </select>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Pericias;