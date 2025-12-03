// /src/components/ModalRituais.jsx
// (ATUALIZADO: Com Filtro por Círculo)

import React, { useState } from 'react';
import { database } from '../lib/database.js';
import RitualCard from './RitualCard.jsx';

// --- Lógica de Filtragem ---
const todosOsRituais = database.rituais || [];
const rituaisPorElemento = {
  sangue: todosOsRituais.filter(r => r.elemento === 'Sangue'),
  morte: todosOsRituais.filter(r => r.elemento === 'Morte'),
  conhecimento: todosOsRituais.filter(r => r.elemento === 'Conhecimento'),
  energia: todosOsRituais.filter(r => r.elemento === 'Energia'),
  medo: todosOsRituais.filter(r => r.elemento === 'Medo'),
};

function ModalRituais({ isOpen, onClose, onAddRitual }) {
  
  const [abaAtiva, setAbaAtiva] = useState('sangue');
  // [NOVO] Estado para o filtro de círculo
  const [filtroCirculo, setFiltroCirculo] = useState('todos'); // 'todos', 1, 2, 3, 4

  // --- Estados do Formulário Customizado ---
  const [customNome, setCustomNome] = useState('');
  const [customCirculo, setCustomCirculo] = useState(1);
  const [customElemento, setCustomElemento] = useState('Sangue');
  const [customExecucao, setCustomExecucao] = useState('Padrão');
  const [customAlcance, setCustomAlcance] = useState('Pessoal');
  const [customAlvoArea, setCustomAlvoArea] = useState('Você');
  const [customDuracao, setCustomDuracao] = useState('Cena');
  const [customDescricao, setCustomDescricao] = useState('');

  const handleSubmitCustomRitual = (e) => {
    e.preventDefault();
    const ritualCustom = {
      id: `custom_${Date.now()}`,
      nome: customNome || "Ritual Personalizado",
      circulo: parseInt(customCirculo) || 1,
      elemento: customElemento,
      execucao: customExecucao,
      alcance: customAlcance,
      alvo: customAlvoArea,
      duracao: customDuracao,
      descricao: customDescricao || "Ritual criado pelo jogador.",
    };
    onAddRitual(ritualCustom);
    
    setCustomNome('');
    setCustomCirculo(1);
    setCustomElemento('Sangue');
    setCustomExecucao('Padrão');
    setCustomAlcance('Pessoal');
    setCustomAlvoArea('Você');
    setCustomDuracao('Cena');
    setCustomDescricao('');
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  // [ATUALIZADO] Helper de renderização com filtro
  const renderListaRituais = (elemento) => {
    const listaBase = rituaisPorElemento[elemento];
    
    // Aplica o filtro de círculo
    const listaFiltrada = listaBase.filter(r => 
        filtroCirculo === 'todos' ? true : r.circulo === parseInt(filtroCirculo)
    );

    return (
        <>
            {/* Botões de Filtro de Círculo */}
            <div className="filtros-circulo" style={{display:'flex', gap:'10px', marginBottom:'15px', flexWrap: 'wrap'}}>
                <button 
                    onClick={() => setFiltroCirculo('todos')} 
                    className={`btn-filtro ${filtroCirculo === 'todos' ? 'ativo' : ''}`}
                    style={{
                        background: filtroCirculo === 'todos' ? 'var(--cor-destaque)' : 'transparent',
                        border: '1px solid var(--cor-destaque)',
                        color: filtroCirculo === 'todos' ? '#000' : 'var(--cor-destaque)',
                        padding: '5px 10px',
                        fontSize: '0.8em'
                    }}
                >
                    Todos
                </button>
                {[1, 2, 3, 4].map(c => (
                    <button 
                        key={c} 
                        onClick={() => setFiltroCirculo(c)}
                        style={{
                            background: filtroCirculo === c ? 'var(--cor-destaque)' : 'transparent',
                            border: '1px solid var(--cor-destaque)',
                            color: filtroCirculo === c ? '#000' : 'var(--cor-destaque)',
                            padding: '5px 10px',
                            fontSize: '0.8em'
                        }}
                    >
                        {c}º Círculo
                    </button>
                ))}
            </div>

            <ul className="loja-lista-itens">
            {listaFiltrada.length > 0 ? (
                listaFiltrada.map(ritual => (
                <RitualCard 
                    key={ritual.id} 
                    ritual={ritual} 
                    tipo="loja"      
                    onAdd={onAddRitual} 
                />
                ))
            ) : (
                <li className="item-placeholder">Nenhum ritual encontrado para este filtro.</li>
            )}
            </ul>
        </>
    );
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-conteudo">
        
        <div className="modal-header">
          <h3>Biblioteca de Rituais</h3>
          <button className="btn-fechar-modal" onClick={onClose}>X</button>
        </div>

        <div className="modal-body">
          <div className="modal-abas">
            <button className={`aba-link ${abaAtiva === 'sangue' ? 'active' : ''}`} onClick={() => setAbaAtiva('sangue')}>Sangue</button>
            <button className={`aba-link ${abaAtiva === 'morte' ? 'active' : ''}`} onClick={() => setAbaAtiva('morte')}>Morte</button>
            <button className={`aba-link ${abaAtiva === 'conhecimento' ? 'active' : ''}`} onClick={() => setAbaAtiva('conhecimento')}>Conhecimento</button>
            <button className={`aba-link ${abaAtiva === 'energia' ? 'active' : ''}`} onClick={() => setAbaAtiva('energia')}>Energia</button>
            <button className={`aba-link ${abaAtiva === 'medo' ? 'active' : ''}`} onClick={() => setAbaAtiva('medo')}>Medo</button>
            <button className={`aba-link ${abaAtiva === 'personalizado' ? 'active' : ''}`} onClick={() => setAbaAtiva('personalizado')}>Personalizado</button>
          </div>

          <div className={`aba-conteudo ${abaAtiva === 'sangue' ? 'active' : ''}`}>{renderListaRituais('sangue')}</div>
          <div className={`aba-conteudo ${abaAtiva === 'morte' ? 'active' : ''}`}>{renderListaRituais('morte')}</div>
          <div className={`aba-conteudo ${abaAtiva === 'conhecimento' ? 'active' : ''}`}>{renderListaRituais('conhecimento')}</div>
          <div className={`aba-conteudo ${abaAtiva === 'energia' ? 'active' : ''}`}>{renderListaRituais('energia')}</div>
          <div className={`aba-conteudo ${abaAtiva === 'medo' ? 'active' : ''}`}>{renderListaRituais('medo')}</div>

          <div className={`aba-conteudo ${abaAtiva === 'personalizado' ? 'active' : ''}`}>
             <form className="form-custom-item" onSubmit={handleSubmitCustomRitual}>
              <h3>Criar Ritual Personalizado</h3>
              <div className="campo-horizontal">
                <label>Nome do Ritual</label>
                <input type="text" required value={customNome} onChange={(e) => setCustomNome(e.target.value)} />
              </div>
              
              <h4>Detalhes Básicos</h4>
              <div className="form-custom-grid">
                <div className="campo-horizontal">
                  <label>Círculo</label>
                  <input type="number" required value={customCirculo} onChange={(e) => setCustomCirculo(e.target.value)} min="1" max="4" />
                </div>
                <div className="campo-horizontal">
                  <label>Elemento</label>
                  <select value={customElemento} onChange={(e) => setCustomElemento(e.target.value)}>
                    <option value="Sangue">Sangue</option>
                    <option value="Morte">Morte</option>
                    <option value="Conhecimento">Conhecimento</option>
                    <option value="Energia">Energia</option>
                    <option value="Medo">Medo</option>
                  </select>
                </div>
                <div className="campo-horizontal">
                  <label>Execução</label>
                  <input type="text" value={customExecucao} onChange={(e) => setCustomExecucao(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label>Alcance</label>
                  <input type="text" value={customAlcance} onChange={(e) => setCustomAlcance(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label>Alvo/Área</label>
                  <input type="text" value={customAlvoArea} onChange={(e) => setCustomAlvoArea(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label>Duração</label>
                  <input type="text" value={customDuracao} onChange={(e) => setCustomDuracao(e.target.value)} />
                </div>
              </div>

              <div className="campo-horizontal">
                <label>Descrição Completa</label>
                <textarea rows="4" value={customDescricao} onChange={(e) => setCustomDescricao(e.target.value)}></textarea>
              </div>
              
              <button type="submit">Adicionar Ritual Personalizado</button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

export default ModalRituais;