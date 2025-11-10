// /src/components/Ficha/Identidade.jsx

// 1. Não precisamos mais do 'useState' aqui!
import React from 'react';

// 2. Recebemos 'dados' (personagem.info) e 'onFichaChange' (a função) como "props"
function Identidade({ dados, onFichaChange }) {

  // 3. Criamos uma função 'handler' local para simplificar
  // Ela vai chamar a função principal (onFichaChange)
  // passando a seção ('info') e o campo corretos.
  const handleChange = (e) => {
    const campo = e.target.id;     // ex: "nome-personagem"
    const valor = e.target.value;  
    
    // Converte o ID do HTML para a chave do objeto (ex: "nome-personagem" -> "nome")
    const nomeCampo = campo.replace('-personagem', '').replace('-jogador', ''); // Simplificação
    
    onFichaChange('info', nomeCampo, valor);
  };

  return (
    <header className="box box-identidade" id="grid-identidade">
      
      <div className="campo-horizontal">
        <label>PERSONAGEM</label>
        <input 
          type="text" 
          id="nome" // Usamos a chave do objeto como ID
          value={dados.nome} // 4. O valor vem dos 'dados'
          onChange={handleChange} // 5. O 'onChange' chama nossa função 'handler'
        />
      </div>

      <div className="campo-horizontal">
        <label>JOGADOR</label>
        <input 
          type="text" 
          id="jogador"
          value={dados.jogador}
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
          {/* Copie e cole todas as suas <option> de Origem aqui */}
          <option value="academico">Acadêmico</option>
          <option value="desgarrado" selected>Desgarrado</option>
          <option value="policial">Policial</option>
          {/* ...etc... */}
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
          <option value="especialista" selected>Especialista</option>
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
        >
          {/* Copie e cole todas as suas <option> e <optgroup> de Trilha aqui */}
          <option value="nenhuma">Nenhuma (NEX 5%)</option>
          <optgroup label="Especialista" id="trilhas-especialista">
            <option value="tecnico">Técnico</option>
          </optgroup>
          {/* ...etc... */}
        </select>
      </div>
    </header>
  );
}

export default Identidade;