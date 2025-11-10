// /src/components/Ficha/Identidade.jsx

import React from 'react';

function Identidade({ dados, onFichaChange, trilhasPorClasse }) {

  const handleChange = (e) => {
    const campo = e.target.id;     
    const valor = e.target.value;  
    
    // Simplificado, já que os IDs correspondem às chaves do objeto info
    const nomeCampo = campo; 
    
    onFichaChange('info', nomeCampo, valor);
  };

  // Lógica para obter as trilhas filtradas
  const classeAtual = dados.classe.toLowerCase();
  const trilhasFiltradas = trilhasPorClasse[classeAtual] || [];


  return (
    <header className="box box-identidade" id="grid-identidade">
      
      <div className="campo-horizontal">
        <label>PERSONAGEM</label>
        <input 
          type="text" 
          id="nome" 
          value={dados.nome} 
          onChange={handleChange} 
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
          {/* ---------------------------------------------------------------------- */}
          {/* LISTA COMPLETA DE ORIGENS (Base + Sobrevivendo ao Horror) */}
          <option value="academico">Acadêmico</option>
          <option value="agente_saude">Agente de Saúde</option>
          <option value="amnesico">Amnésico</option>
          <option value="artista">Artista</option>
          <option value="atleta">Atleta</option>
          <option value="chef">Chef</option>
          <option value="criminoso">Criminoso</option>
          <option value="cultista_arrependido">Cultista Arrependido</option>
          <option value="desgarrado">Desgarrado</option>
          <option value="engenheiro">Engenheiro</option>
          <option value="executivo">Executivo</option>
          <option value="investigador">Investigador</option>
          <option value="lutador">Lutador</option>
          <option value="magnata">Magnata</option>
          <option value="militar">Militar</option>
          <option value="policial">Policial</option>
          <option value="religioso">Religioso</option>
          <option value="servidor_publico">Servidor Público</option>
          <option value="teorico_conspiracao">Teórico da Conspiração</option>
          <option value="ti">T.I.</option>
          <option value="trabalhador_rural">Trabalhador Rural</option>
          <option value="universitario">Universitário</option>
          <option value="vitima">Vítima</option>
          
          <option value="amigo_animais">Amigo dos Animais</option>
          <option value="astronauta">Astronauta</option>
          <option value="chef_outro_lado">Chef do Outro Lado</option>
          <option value="colegial">Colegial</option>
          <option value="cosplayer">Cosplayer</option>
          <option value="diplomata">Diplomata</option>
          <option value="explorador">Explorador</option>
          <option value="experimento">Experimento</option>
          <option value="fanatico_criaturas">Fanático por Criaturas</option>
          <option value="fotografo">Fotógrafo</option>
          <option value="inventor_paranormal">Inventor Paranormal</option>
          <option value="jovem_mistico">Jovem Místico</option>
          <option value="legista_noturno">Legista do Turno da Noite</option>
          <option value="mateiro">Mateiro</option>
          <option value="mergulhador">Mergulhador</option>
          <option value="motorista">Motorista</option>
          <option value="nerd_entusiasta">Nerd Entusiasta</option>
          <option value="profetizado">Profetizado</option>
          <option value="psicologo">Psicólogo</option>
          <option value="reporter_investigativo">Repórter Investigativo</option>
          {/* ---------------------------------------------------------------------- */}
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
        >
          {/* Opção padrão, sempre disponível */}
          <option value="nenhuma">Nenhuma (NEX 5%)</option>
          
          {/* Mapeia e renderiza APENAS as trilhas da classe selecionada */}
          {trilhasFiltradas.map(trilha => (
              <option key={trilha.value} value={trilha.value}>
                  {trilha.text}
              </option>
          ))}
        </select>
      </div>
    </header>
  );
}

export default Identidade;