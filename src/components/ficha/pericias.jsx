// /src/components/ficha/pericias.jsx

import React from 'react';

// Um objeto "helper" que mapeia cada perícia ao seu atributo base
// Isso substitui a lógica 'data-atributo' do HTML antigo
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

// Pega a lista de chaves (ex: ['acrobacia', 'crime', ...])
const periciasLista = Object.keys(ATRIBUTO_BASE);

function Pericias({ dadosPericias, dadosAtributos, dadosCalculados, onFichaChange }) {
  
  const handleChange = (e) => {
    const campo = e.target.id; // ex: "acrobacia"
    const valor = e.target.value;
    onFichaChange('pericias', campo, valor);
  };

  // Calcula o bônus total (ex: "1d20+5")
  const calcularBonusTotal = (periciaKey) => {
    const treino = dadosPericias[periciaKey] || 0;
    const attrChave = ATRIBUTO_BASE[periciaKey].attr;
    const valorAttr = dadosAtributos[attrChave] || 0;
    
    // Bônus de inventário (será 0 por enquanto)
    const bonusInventario = dadosCalculados.bonusPericia[periciaKey] || 0; 
    
    const bonusTotal = Number(treino) + bonusInventario;
    
    let textoDado = "";
    if (valorAttr === 0) {
      textoDado = "2d20 (pior)";
    } else {
      textoDado = `${valorAttr}d20`;
    }
    
    const bonusFormatado = `${bonusTotal >= 0 ? "+" : ""}${bonusTotal}`;
    return `${textoDado}${bonusFormatado}`;
  };

  return (
    <section className="box box-pericias" id="grid-pericias">
      <div className="pericias-header">
        <h2>PERÍCIAS</h2>
        <div className="pericias-contador">
          Treinadas: 
          <span 
            id="pericias-escolhidas"
            // Adiciona o estilo de "estouro" (vermelho)
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

      <ul id="lista-pericias">
        {/* Usamos .map() para criar um <li> para cada perícia na lista */}
        {periciasLista.map((periciaKey) => {
          const periciaInfo = ATRIBUTO_BASE[periciaKey];
          const treinoValor = dadosPericias[periciaKey];
          
          return (
            <li 
              key={periciaKey} 
              // Adiciona a classe de destaque (ex: 'treino-5')
              className={`pericia-item treino-${treinoValor}`}
            >
              <span>{periciaInfo.nome} ({periciaInfo.attr.toUpperCase()})</span>
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
              <span className="pericia-total-bonus" id={`bonus-${periciaKey}`}>
                {calcularBonusTotal(periciaKey)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Pericias;