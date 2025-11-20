import React, { useState } from 'react';
import { database } from '../lib/database.js'; // Caminho corrigido: volta uma pasta, entra em lib
import { getIconePorCondicao } from './icons/Icones.jsx';

function Condicoes({ ativas, onToggle }) {
  const [expandido, setExpandido] = useState(false);

  // Pega a lista do database. Se não existir, usa array vazio.
  // Ordena colocando as ativas primeiro para facilitar a visualização.
  const listaOrdenada = database.condicoes ? [...database.condicoes].sort((a, b) => {
    const aAtiva = ativas.includes(a.id);
    const bAtiva = ativas.includes(b.id);
    if (aAtiva && !bAtiva) return -1;
    if (!aAtiva && bAtiva) return 1;
    return a.nome.localeCompare(b.nome);
  }) : [];

  return (
    <section className="box box-condicoes" id="grid-condicoes" style={{ marginTop: '20px', padding: '15px' }}>
      <div className="inventario-header" style={{ marginBottom: '10px', borderBottom: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.2em', color: 'var(--cor-destaque)' }}>CONDIÇÕES E ESTADOS</h2>
        <button 
          className="btn-add-item" 
          onClick={() => setExpandido(!expandido)}
          style={{ fontSize: '0.9em', padding: '5px 10px' }}
        >
          {expandido ? '▲ Recolher' : '▼ Expandir'}
        </button>
      </div>

      <div className={`condicoes-grid ${expandido ? 'expandido' : 'recolhido'}`}>
        {listaOrdenada.map((cond) => {
          const isAtiva = ativas.includes(cond.id);
          return (
            <div 
              key={cond.id} 
              className={`condicao-card ${isAtiva ? 'ativa' : ''} ${cond.tipo}`}
              onClick={() => onToggle(cond.id)}
              title={cond.descricao}
            >
              <div className="condicao-icone">
                {/* Usa o ícone específico baseado no ID */}
                {getIconePorCondicao(cond.id)}
              </div>
              <div className="condicao-info">
                <span className="condicao-nome">{cond.nome}</span>
                {/* Mostra a descrição curta apenas se estiver ativa ou expandido */}
                {(isAtiva || expandido) && (
                    <span className="condicao-desc-curta">
                        {cond.descricao.length > 50 && !isAtiva ? cond.descricao.substring(0, 50) + '...' : cond.descricao}
                    </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default Condicoes;