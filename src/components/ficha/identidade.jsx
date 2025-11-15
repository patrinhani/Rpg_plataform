// /src/components/Ficha/Identidade.jsx
// (OTIMIZADO COM React.memo)

import React, { memo } from 'react'; // 1. Importar o 'memo'
// <-- NOVO: Importar a lista de origens do database
import { OpcoesOrigem } from '../../lib/database.js';

/**
 * Componente para a seção de Identidade do Personagem.
 * @param {object} props
 * @param {object} props.dados - Dados de info do personagem.
 * @param {function} props.onFichaChange - Função de callback para mudança.
 * @param {object} props.trilhasPorClasse - O objeto de trilhas agrupadas (padrão + customizadas).
 */
// 2. A função do componente permanece idêntica
function Identidade({ dados, onFichaChange, trilhasPorClasse }) {

  const handleChange = (e) => {
    const campo = e.target.id;     
    const valor = e.target.value;  
    
    const nomeCampo = campo; 
    
    onFichaChange('info', nomeCampo, valor);
  };

  // --- CORREÇÃO DO ERRO: Adicionar fallback para 'dados' e 'dados.classe' ---
  
  // 1. Obtém a classe atual com um fallback seguro ('combatente' é o default)
  const classeAtual = (dados && dados.classe) ? dados.classe.toLowerCase() : 'combatente';
  
  // 2. Obtém o objeto de trilhas da classe atual, garantindo um fallback
  const trilhasDaClasseObject = trilhasPorClasse[classeAtual] || { nenhuma: { nome: 'Nenhuma', key: 'nenhuma' } };

  // Converte o objeto de trilhas para um array de objetos para mapeamento no JSX
  const listaTrilhas = Object.values(trilhasDaClasseObject);
  
  // <-- NOVO: Converte o objeto OpcoesOrigem para um array [key, nome]
  const listaOrigens = Object.entries(OpcoesOrigem).map(([key, nome]) => ({
    key: key,
    nome: nome
  }));

  // Lógica para desabilitar o seletor de trilha se não houver classe selecionada
  const isTrilhaDisabled = !classeAtual || classeAtual === 'nenhuma';
  
  // Opções para o seletor dinâmico de Elemento
  const elementos = [
    { value: 'sangue', label: 'Sangue' },
    { value: 'morte', label: 'Morte' },
    { value: 'conhecimento', label: 'Conhecimento' },
    { value: 'energia', label: 'Energia' },
  ];


  return (
    <header className="box box-identidade" id="grid-identidade">
      
      <div className="campo-horizontal">
        <label>PERSONAGEM</label>
        <input 
          type="text" 
          id="nome" 
          value={dados.nome || ''} // Adiciona fallback para valor
          onChange={handleChange} 
        />
      </div>

      <div className="campo-horizontal">
        <label>JOGADOR</label>
        <input 
          type="text" 
          id="jogador"
          value={dados.jogador || ''} // Adiciona fallback para valor
          onChange={handleChange}
        />
      </div>

      {/* --- BLOCO CORRIGIDO --- */}
      <div className="campo-horizontal">
        <label>ORIGEM</label>
        <select 
          id="origem"
          value={dados.origem}
          onChange={handleChange}
        >
          {/* <-- ALTERADO: Mapeia a lista de origens dinamicamente */}
          {listaOrigens.map(origem => (
            <option key={origem.key} value={origem.key}>
              {origem.nome}
            </option>
          ))}
          {/* Fim da alteração */}
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
          disabled={isTrilhaDisabled} // Desabilita se não houver classe
        >
          
          {/* Mapeia e renderiza todas as trilhas da classe, incluindo a opção "Nenhuma" e customizadas */}
          {listaTrilhas.map(trilha => (
              <option key={trilha.key} value={trilha.key}>
                  {trilha.nome}
                  {trilha.isCustom ? ' (Customizada)' : ''} 
              </option>
          ))}
        </select>
      </div>
      
      {/* Elemento de Trilha Especial (para Monstruoso/Possuído) */}
      {(dados.trilha === 'monstruoso' || dados.trilha === 'possuido') && (
        <div className="campo-horizontal">
          <label>ELEMENTO TRILHA</label>
          <select 
            // O ID/Name é dinâmico (monstruoso_elemento ou possuido_elemento)
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

      {/* Campos de NEX e Deslocamento omitidos aqui, mas devem existir no arquivo completo. */}

    </header>
  );
}

// 3. Exportar a versão "memorizada"
export default memo(Identidade);