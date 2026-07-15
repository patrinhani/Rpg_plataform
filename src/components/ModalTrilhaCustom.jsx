// /src/components/ModalTrilhaCustom.jsx

import React, { useState } from 'react';
import ModalBase from './ModalBase.jsx';

// Níveis fixos de progressão para as habilidades de trilha
const NIVEIS_TRILHA = [10, 40, 65, 99];
const ESTAGIOS_SOBREVIVENTE = [2, 4];

const criarHabilidadesVazias = (classe) => (
  classe === 'sobrevivente' ? ESTAGIOS_SOBREVIVENTE : NIVEIS_TRILHA
).map(nex => ({ nex, descricao: '' }));

/**
 * Modal para criar e salvar uma Trilha Personalizada.
 * * Props:
 * - isOpen: boolean para controlar a visibilidade.
 * - onClose: função para fechar o modal.
 * - onAddTrilha: função do App.jsx para salvar a trilha no personagem.js.
 * - classesList: lista das classes disponíveis (OpcoesClasse do database.js).
 */
function ModalTrilhaCustom({ isOpen, onClose, onAddTrilha, classesList }) {
  // Inicialização segura dos estados
  const [nome, setNome] = useState('');
  const [classeAssociada, setClasseAssociada] = useState('combatente');
  const [requerElemento, setRequerElemento] = useState(false);
  const [habilidades, setHabilidades] = useState(() => criarHabilidadesVazias('combatente'));

  const handleHabilidadeChange = (index, value) => {
    const newHabilidades = [...habilidades];
    newHabilidades[index].descricao = value;
    setHabilidades(newHabilidades);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Filtra habilidades vazias e normaliza o objeto para o formato esperado pelo backend
    const habilidadesValidas = habilidades
      .filter(h => h.descricao.trim() !== '')
      .map(h => ({ nex: h.nex, descricao: h.descricao.trim() })); 

    const novaTrilha = {
      nome: nome.trim() || `Trilha Custom de ${classesList[classeAssociada]}`,
      classe: classeAssociada,
      escala: classeAssociada === 'sobrevivente' ? 'Estágio' : 'NEX',
      habilidades: habilidadesValidas,
      requiresChoice: requerElemento ? 'elemento' : null,
    };

    onAddTrilha(novaTrilha);

    // Reseta o formulário
    setNome('');
    setClasseAssociada('combatente');
    setRequerElemento(false);
    setHabilidades(criarHabilidadesVazias('combatente'));
  };

  if (!isOpen) {
    return null;
  }

  // Converte classesList de objeto para array de objetos para mapeamento no select
  // Garante que classesList não seja undefined (safety check)
  const classesArray = classesList ? Object.entries(classesList).map(([key, value]) => ({ key, nome: value })) : [];


  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Criar Trilha Personalizada"
      size="wide"
      closeLabel="Fechar criação de trilha"
      footer={(
        <>
          <button
            type="button"
            className="caos-modal__button caos-modal__button--secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="form-trilha-custom"
            className="caos-modal__button caos-modal__button--primary"
          >
            Salvar Trilha Personalizada
          </button>
        </>
      )}
    >
          <form id="form-trilha-custom" className="form-custom-item" onSubmit={handleSubmit}>
            
            {/* --- Detalhes Básicos --- */}
            <h4>Detalhes da Trilha</h4>
            <div className="campo-horizontal">
              <label htmlFor="trilha-custom-nome">Nome da Trilha (Ex: Arauto do Caos)</label>
              <input 
                id="trilha-custom-nome"
                type="text" 
                required 
                value={nome} 
                onChange={(e) => setNome(e.target.value)} 
              />
            </div>

            <div className="form-custom-grid">
              <div className="campo-horizontal">
                <label htmlFor="trilha-custom-classe">Classe Associada</label>
                <select 
                  id="trilha-custom-classe"
                  value={classeAssociada} 
                  onChange={(e) => {
                    const novaClasse = e.target.value;
                    setClasseAssociada(novaClasse);
                    setHabilidades(criarHabilidadesVazias(novaClasse));
                  }}
                  required
                >
                  {/* Mapeia classesList para opções */}
                  {classesArray.map(classe => (
                    <option key={classe.key} value={classe.key.toLowerCase()}>{classe.nome}</option>
                  ))}
                </select>
              </div>
              <div className="campo-horizontal">
                <label htmlFor="trilha-custom-elemento">Requer Escolha de Elemento?</label>
                <select 
                  id="trilha-custom-elemento"
                  value={requerElemento} 
                  onChange={(e) => setRequerElemento(e.target.value === 'true')}
                >
                  <option value={false}>Não</option>
                  <option value={true}>Sim (Monstruoso, Possuído)</option>
                </select>
                {requerElemento && (
                    <p className='item-placeholder' style={{color: 'var(--cor-trans-sangue)', fontSize: '0.8em', marginTop: '5px'}}>A trilha precisará de uma escolha manual na ficha.</p>
                )}
              </div>
            </div>

            {/* --- Progressão de Habilidades --- */}
            <h4>{classeAssociada === 'sobrevivente' ? 'Progressão (Estágios 2 e 4)' : 'Progressão (NEX 10%, 40%, 65%, 99%)'}</h4>
            <div className="form-custom-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}>
              {habilidades.map((hab, index) => (
                <div key={hab.nex} className="campo-horizontal">
                  <label htmlFor={`trilha-custom-habilidade-${hab.nex}`}>
                    {classeAssociada === 'sobrevivente' ? `Estágio ${hab.nex}` : `NEX ${hab.nex}%`}
                  </label>
                  <textarea
                    id={`trilha-custom-habilidade-${hab.nex}`}
                    rows="3"
                    placeholder={classeAssociada === 'sobrevivente' ? `Habilidade do Estágio ${hab.nex}` : `Habilidade de NEX ${hab.nex}%`}
                    value={hab.descricao}
                    onChange={(e) => handleHabilidadeChange(index, e.target.value)}
                  ></textarea>
                </div>
              ))}
            </div>
            
          </form>
    </ModalBase>
  );
}

export default ModalTrilhaCustom;
