// /src/components/ModalRituais.jsx
// (ATUALIZADO: Com Filtro por Círculo)

import React, { useId, useState } from 'react';
import { database } from '../lib/database.js';
import ModalBase from './ModalBase.jsx';
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
  const tabsId = useId();
  const fieldsId = useId();

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
                    type="button"
                    onClick={() => setFiltroCirculo('todos')} 
                    className={`btn-filtro ${filtroCirculo === 'todos' ? 'ativo' : ''}`}
                    aria-pressed={filtroCirculo === 'todos'}
                    aria-label="Exibir rituais de todos os círculos"
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
                        type="button"
                        onClick={() => setFiltroCirculo(c)}
                        aria-pressed={filtroCirculo === c}
                        aria-label={`Exibir rituais de ${c}º círculo`}
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

  const tabs = [
    { id: 'sangue', label: 'Sangue' },
    { id: 'morte', label: 'Morte' },
    { id: 'conhecimento', label: 'Conhecimento' },
    { id: 'energia', label: 'Energia' },
    { id: 'medo', label: 'Medo' },
    { id: 'personalizado', label: 'Personalizado' },
  ];
  const handleTabKeyDown = (event, currentIndex) => {
    let nextIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setAbaAtiva(nextTab.id);
    window.requestAnimationFrame(() => document.getElementById(`${tabsId}-tab-${nextTab.id}`)?.focus());
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Biblioteca de rituais"
      size="large"
      closeLabel="Fechar biblioteca de rituais"
    >
      <div className="modal-abas" role="tablist" aria-label="Elementos dos rituais">
        {tabs.map((tab, index) => {
          const isActive = abaAtiva === tab.id;
          return (
            <button
              key={tab.id}
              id={`${tabsId}-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tabsId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`aba-link ${isActive ? 'active' : ''}`}
              onClick={() => setAbaAtiva(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => {
        const isActive = abaAtiva === tab.id;
        return (
          <div
            key={tab.id}
            id={`${tabsId}-panel-${tab.id}`}
            className={`aba-conteudo ${isActive ? 'active' : ''}`}
            role="tabpanel"
            aria-labelledby={`${tabsId}-tab-${tab.id}`}
            hidden={!isActive}
          >
            {isActive && (tab.id === 'personalizado' ? (
             <form className="form-custom-item" onSubmit={handleSubmitCustomRitual}>
              <h3>Criar Ritual Personalizado</h3>
              <div className="campo-horizontal">
                <label htmlFor={`${fieldsId}-nome`}>Nome do Ritual</label>
                <input id={`${fieldsId}-nome`} type="text" required value={customNome} onChange={(e) => setCustomNome(e.target.value)} />
              </div>
              
              <h4>Detalhes Básicos</h4>
              <div className="form-custom-grid">
                <div className="campo-horizontal">
                  <label htmlFor={`${fieldsId}-circulo`}>Círculo</label>
                  <input id={`${fieldsId}-circulo`} type="number" required value={customCirculo} onChange={(e) => setCustomCirculo(e.target.value)} min="1" max="4" />
                </div>
                <div className="campo-horizontal">
                  <label htmlFor={`${fieldsId}-elemento`}>Elemento</label>
                  <select id={`${fieldsId}-elemento`} value={customElemento} onChange={(e) => setCustomElemento(e.target.value)}>
                    <option value="Sangue">Sangue</option>
                    <option value="Morte">Morte</option>
                    <option value="Conhecimento">Conhecimento</option>
                    <option value="Energia">Energia</option>
                    <option value="Medo">Medo</option>
                  </select>
                </div>
                <div className="campo-horizontal">
                  <label htmlFor={`${fieldsId}-execucao`}>Execução</label>
                  <input id={`${fieldsId}-execucao`} type="text" value={customExecucao} onChange={(e) => setCustomExecucao(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label htmlFor={`${fieldsId}-alcance`}>Alcance</label>
                  <input id={`${fieldsId}-alcance`} type="text" value={customAlcance} onChange={(e) => setCustomAlcance(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label htmlFor={`${fieldsId}-alvo-area`}>Alvo/Área</label>
                  <input id={`${fieldsId}-alvo-area`} type="text" value={customAlvoArea} onChange={(e) => setCustomAlvoArea(e.target.value)} />
                </div>
                <div className="campo-horizontal">
                  <label htmlFor={`${fieldsId}-duracao`}>Duração</label>
                  <input id={`${fieldsId}-duracao`} type="text" value={customDuracao} onChange={(e) => setCustomDuracao(e.target.value)} />
                </div>
              </div>

              <div className="campo-horizontal">
                <label htmlFor={`${fieldsId}-descricao`}>Descrição Completa</label>
                <textarea id={`${fieldsId}-descricao`} rows="4" value={customDescricao} onChange={(e) => setCustomDescricao(e.target.value)}></textarea>
              </div>
              
              <button type="submit">Adicionar Ritual Personalizado</button>
            </form>
            ) : (
              renderListaRituais(tab.id)
            ))}
          </div>
        );
      })}
    </ModalBase>
  );
}

export default ModalRituais;
