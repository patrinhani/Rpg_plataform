// /src/components/ficha/identidade.jsx
// (ATUALIZADO: Adicionado campo de URL da Foto)
// (CORRIGIDO: Adicionado campo de NEX)

import React from 'react'; 
import { OpcoesOrigem } from '../../lib/database.js'; 

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
  
  // --- NOVO: Handler para o upload da foto ---
  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Salva a imagem como uma string Base64
        onFichaChange('info', 'foto', reader.result);
      };
      reader.readAsDataURL(file);
    }
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

  const { 
    nome: patenteNome, 
    credito: limiteCredito, 
    catI, 
    catII, 
    catIII, 
    catIV 
  } = patenteInfo || {}; 
  
  const limiteItens = `Cat I: ${catI || '—'} | Cat II: ${catII || '—'} | Cat III: ${catIII || '—'} | Cat IV: ${catIV || '—'}`;


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
      
      {/* --- CAMPO DE NEX ADICIONADO AQUI --- */}
      <div className="campo-horizontal">
        <label>NEX</label>
        <input 
          type="text" 
          id="nex"
          value={dados.nex || '0%'} 
          onChange={handleChange} 
        />
      </div>
      {/* --- FIM DA ADIÇÃO --- */}

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
      
      {/* --- NOVO CAMPO DE FOTO --- */}
      <div className="campo-horizontal" style={{ gridColumn: 'span 2' }}>
        <label>FOTO DO PERSONAGEM (Upload)</label>
        <input 
          type="file" 
          id="foto-upload" 
          accept="image/png, image/jpeg, image/webp"
          onChange={handlePhotoUpload}
          style={{ 
            fontFamily: '"Roboto Condensed", sans-serif',
            fontSize: '1em',
            color: 'var(--cor-texto-label)'
          }}
        />
        {/* Este é um input de upload, não um campo de URL. 
            O 'dados.foto' é um Base64, então não o exibimos aqui. */}
      </div>

    </header>
  );
}

export default Identidade;