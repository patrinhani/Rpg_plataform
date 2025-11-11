// /src/components/ModalTrilhaCustom.jsx

import React, { useState } from 'react';

// Níveis fixos de progressão para as habilidades de trilha
const NIVEIS_TRILHA = [10, 40, 65, 99];

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
  const [habilidades, setHabilidades] = useState(
    NIVEIS_TRILHA.map(nex => ({ nex, descricao: '' }))
  );

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
      habilidades: habilidadesValidas,
      requiresChoice: requerElemento ? 'elemento' : null,
    };

    onAddTrilha(novaTrilha);

    // Reseta o formulário
    setNome('');
    setClasseAssociada('combatente');
    setRequerElemento(false);
    setHabilidades(NIVEIS_TRILHA.map(nex => ({ nex, descricao: '' })));
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  // Converte classesList de objeto para array de objetos para mapeamento no select
  // Garante que classesList não seja undefined (safety check)
  const classesArray = classesList ? Object.entries(classesList).map(([key, value]) => ({ key, nome: value })) : [];


  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-conteudo modal-grande">
        
        <div className="modal-header">
          <h3>Criar Trilha Personalizada</h3>
          <button className="btn-fechar-modal" onClick={onClose}>
            X
          </button>
        </div>

        <div className="modal-body">
          <form className="form-custom-item" onSubmit={handleSubmit}>
            
            {/* --- Detalhes Básicos --- */}
            <h4>Detalhes da Trilha</h4>
            <div className="campo-horizontal">
              <label>Nome da Trilha (Ex: Arauto do Caos)</label>
              <input 
                type="text" 
                required 
                value={nome} 
                onChange={(e) => setNome(e.target.value)} 
              />
            </div>

            <div className="form-custom-grid">
              <div className="campo-horizontal">
                <label>Classe Associada</label>
                <select 
                  value={classeAssociada} 
                  onChange={(e) => setClasseAssociada(e.target.value)}
                  required
                >
                  {/* Mapeia classesList para opções */}
                  {classesArray.map(classe => (
                    <option key={classe.key} value={classe.key.toLowerCase()}>{classe.nome}</option>
                  ))}
                </select>
              </div>
              <div className="campo-horizontal">
                <label>Requer Escolha de Elemento?</label>
                <select 
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
            <h4>Progressão (NEX 10%, 40%, 65%, 99%)</h4>
            <div className="form-custom-grid" style={{gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))'}}>
              {habilidades.map((hab, index) => (
                <div key={hab.nex} className="campo-horizontal">
                  <label>NEX {hab.nex}%</label>
                  <textarea
                    rows="3"
                    placeholder={`Habilidade de NEX ${hab.nex}%`}
                    value={hab.descricao}
                    onChange={(e) => handleHabilidadeChange(index, e.target.value)}
                  ></textarea>
                </div>
              ))}
            </div>
            
            <button type="submit" style={{marginTop: '20px'}}>
              Salvar Trilha Personalizada
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default ModalTrilhaCustom;