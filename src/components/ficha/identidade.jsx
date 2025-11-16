// /src/components/ficha/identidade.jsx
// (ATUALIZADO: Adicionado fallback '|| {}' para evitar crash na desestruturação)

import React from 'react'; 
import { OpcoesOrigem } from '../../lib/database.js'; 

/**
 * Componente para a seção de Identidade do Personagem.
 * @param {object} props
 * @param {object} props.dados - Dados de info do personagem (personagem.info)
 * @param {function} props.onFichaChange - Função de callback para mudança.
 * @param {object} props.trilhasPorClasse - O objeto de trilhas agrupadas.
 * @param {object} props.patenteInfo - O objeto com os dados da patente (calculado no App.jsx)
 */
function Identidade({ dados, onFichaChange, trilhasPorClasse, patenteInfo }) {

  const handleChange = (e) => {
    const campo = e.target.id;     
    let valor = e.target.value;  
    
    if (campo === 'prestigio') {
      valor = parseInt(valor, 10);
      if (isNaN(valor)) {
        valor = 0;
      }
      if (valor < 0) {
        valor = 0;
      }
    }
    onFichaChange('info', campo, valor);
  };

  const classeAtual = (dados && dados.classe) ? dados.classe.toLowerCase() : 'combatente';
  const trilhasDaClasseObject = trilhasPorClasse[classeAtual] || { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } };
  const listaTrilhas = Object.values(trilhasDaClasseObject);
  
  const listaOrigens = Object.entries(OpcoesOrigem).map(([key, nome]) => ({
    key: key,
    nome: nome
  }));

  const isTrilhaDisabled = !classeAtual || classeAtual === 'nenhuma';
  
  const elementos = [
    { value: 'sangue', label: 'Sangue' },
    { value: 'morte', label: 'Morte' },
    { value: 'conhecimento', label: 'Conhecimento' },
    { value: 'energia', label: 'Energia' },
  ];

  // --- CORREÇÃO DE SEGURANÇA APLICADA AQUI ---
  // Adiciona '|| {}' para garantir que, se 'patenteInfo' for 'undefined',
  // o código não quebre e use valores padrão (undefined) para as variáveis.
  const { 
    nome: patenteNome, 
    credito: limiteCredito, 
    catI, 
    catII, 
    catIII, 
    catIV 
  } = patenteInfo || {}; // <-- Esta linha foi MODIFICADA
  
  // Formata a string de limite de itens
  const limiteItens = `Cat I: ${catI || '—'} | Cat II: ${catII || '—'} | Cat III: ${catIII || '—'} | Cat IV: ${catIV || '—'}`;
  // --- FIM DA CORREÇÃO ---


  return (
    <header className="box box-identidade" id="grid-identidade">
      
      {/* --- Campos de Identidade (Nome, Jogador, Origem, Classe, Trilha) --- */}
      <div className="campo-horizontal">
        <label>PERSONAGEM</label>
        <input 
          type="text" 
          id="nome" 
          value={dados.nome || ''} 
          onChange={handleChange} 
        />
      </div>

      <div className="campo-horizontal">
        <label>JOGADOR</label>
        <input 
          type="text" 
          id="jogador"
          value={dados.jogador || ''} 
          onChange={handleChange}
        />
      </div>

      <div className="campo-horizontal">
        <label>ORIGEM</label>
        <select 
          id="origem"
          value={dados.origem}
          onChange={handleChange}
        >
          {listaOrigens.map(origem => (
            <option key={origem.key} value={origem.key}>
              {origem.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="campo-horizontal">
        <label>CLASSE</label>
        <select 
          id="classe"
          value={dados.classe}
          onChange={handleChange}
        >
          <option value="combatente">Combatente</option>
          <option value="especialista">Especialista</option>
          <option value="ocultista">Ocultista</option>
          <option value="sobrevivente">Sobrevivente</option>
        </select>
      </div>

      <div className="campo-horizontal">
        <label>TRILHA</label>
        <select 
          id="trilha"
          value={dados.trilha}
          onChange={handleChange}
          disabled={isTrilhaDisabled} 
        >
          {listaTrilhas.map(trilha => (
              <option key={trilha.key} value={trilha.key}>
                  {trilha.nome}
                  {trilha.isCustom ? ' (Customizada)' : ''} 
              </option>
          ))}
        </select>
      </div>
      
      {(dados.trilha === 'monstruoso' || dados.trilha === 'possuido') && (
        <div className="campo-horizontal">
          <label>ELEMENTO TRILHA</label>
          <select 
            id={`${dados.trilha}_elemento`}
            value={dados[`${dados.trilha}_elemento`]}
            onChange={handleChange}
          >
            <option value="">Selecione</option>
            {elementos.map(el => (
              <option key={el.value} value={el.value}>{el.label}</option>
            ))}
          </select>
        </div>
      )}
      {/* --- Fim dos Campos de Identidade --- */}


      {/* --- CAMPOS DE PRESTÍGIO E PATENTE --- */}

      <div className="campo-horizontal">
        <label>PRESTÍGIO (PP)</label>
        <input 
          type="number"
          id="prestigio"
          className="short-input"
          value={dados.prestigio || 0}
          onChange={handleChange}
          min="0"
        />
      </div>
      
      <div className="campo-horizontal campo-readonly">
        <label>PATENTE</label>
        <span className="campo-valor">{patenteNome || 'Recruta'}</span>
      </div>
      
      <div className="campo-horizontal campo-readonly">
        <label>LIMITE CRÉDITO</label>
        <span className="campo-valor">{limiteCredito || 'Baixo'}</span>
      </div>

      <div className="campo-horizontal campo-readonly" style={{ gridColumn: 'span 2' }}>
        <label>LIMITE ITENS</label>
        <span className="campo-valor">{limiteItens}</span>
      </div>

      {/* (Seus campos de NEX e Deslocamento entram aqui) */}

    </header>
  );
}

export default Identidade;