// /src/components/ficha/identidade.jsx
// (ATUALIZADO: Adicionado campo de URL da Foto)
// (CORRIGIDO: Adicionado campo de NEX)

import React from 'react'; 
import { OpcoesOrigem } from '../../lib/database.js'; 

function otimizarFoto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.onload = () => {
      const imagem = new Image();
      imagem.onerror = () => reject(new Error('Formato de imagem inválido.'));
      imagem.onload = () => {
        const limite = 512;
        const escala = Math.min(1, limite / Math.max(imagem.width, imagem.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(imagem.width * escala));
        canvas.height = Math.max(1, Math.round(imagem.height * escala));
        const contexto = canvas.getContext('2d');
        if (!contexto) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.82));
      };
      imagem.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

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
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const fotoOtimizada = await otimizarFoto(file);
        onFichaChange('info', 'foto', fotoOtimizada);
      } catch (error) {
        console.error(error);
      }
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
        <label htmlFor="nome">PERSONAGEM</label>
        <input 
          type="text" 
          id="nome" 
          value={dados.nome || ''} 
          onChange={handleChange} 
        />
      </div>

      <div className="campo-horizontal">
        <label htmlFor="jogador">JOGADOR</label>
        <input 
          type="text" 
          id="jogador"
          value={dados.jogador || ''} 
          onChange={handleChange}
        />
      </div>

      <div className="campo-horizontal">
        <label htmlFor="origem">ORIGEM</label>
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
        <label htmlFor="classe">CLASSE</label>
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
        <label htmlFor="trilha">TRILHA</label>
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
      
      {classeAtual === 'sobrevivente' ? (
        <>
          <div className="campo-horizontal campo-readonly">
            <label>NEX</label>
            <span className="campo-valor">0%</span>
          </div>
          <div className="campo-horizontal">
            <label htmlFor="estagio_sobrevivente">ESTÁGIO</label>
            <input
              type="number"
              id="estagio_sobrevivente"
              min="1"
              max="5"
              value={dados.estagio_sobrevivente || 1}
              onChange={handleChange}
            />
          </div>
        </>
      ) : (
        <div className="campo-horizontal">
          <label htmlFor="nex">NEX (%)</label>
          <input
            type="number"
            id="nex"
            min="0"
            max="99"
            value={parseInt(dados.nex, 10) || 0}
            onChange={handleChange}
          />
        </div>
      )}

      {(dados.trilha === 'monstruoso' || dados.trilha === 'possuido') && (
        <div className="campo-horizontal">
          <label htmlFor={`${dados.trilha}_elemento`}>ELEMENTO TRILHA</label>
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
        <label htmlFor="prestigio">PRESTÍGIO (PP)</label>
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
        <label htmlFor="foto-upload">FOTO DO PERSONAGEM (Upload)</label>
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
