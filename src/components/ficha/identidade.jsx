import React from 'react';
import { OpcoesOrigem } from '../../lib/database.js';
import { getTemaConfig } from '../../lib/temas.js';

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
  const handleChange = (event) => {
    const campo = event.target.id;
    let valor = event.target.value;

    if (campo === 'prestigio') {
      valor = parseInt(valor, 10);
      if (Number.isNaN(valor) || valor < 0) valor = 0;
    }

    onFichaChange('info', campo, valor);
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const fotoOtimizada = await otimizarFoto(file);
      onFichaChange('info', 'foto', fotoOtimizada);
    } catch (error) {
      console.error(error);
    }
  };

  const classeAtual = dados?.classe ? dados.classe.toLowerCase() : 'combatente';
  const trilhasDaClasseObject = trilhasPorClasse[classeAtual] || {
    nenhuma: { nome: 'Nenhuma', key: 'nenhuma' },
  };
  const listaTrilhas = Object.values(trilhasDaClasseObject);
  const listaOrigens = Object.entries(OpcoesOrigem).map(([key, nome]) => ({ key, nome }));
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
    catIV,
  } = patenteInfo || {};
  const limiteItens = `Cat I: ${catI || '—'} · Cat II: ${catII || '—'} · Cat III: ${catIII || '—'} · Cat IV: ${catIV || '—'}`;
  const retratoTematico = getTemaConfig(dados.tema).character;

  return (
    <header className="box box-identidade" id="grid-identidade">
      <div className="identity-portrait-column">
        <label className="identity-portrait" htmlFor="foto-upload" title="Alterar retrato do agente">
          <img
            src={dados.foto || retratoTematico}
            alt={dados.foto ? `Retrato de ${dados.nome || 'agente'}` : ''}
          />
          <span className="identity-portrait-scan" aria-hidden="true" />
          <span className="identity-portrait-action">ALTERAR RETRATO</span>
        </label>
        <input
          className="identity-portrait-input"
          type="file"
          id="foto-upload"
          accept="image/png, image/jpeg, image/webp"
          onChange={handlePhotoUpload}
        />
        <div className="identity-clearance-seal">
          <span>NÍVEL DE ACESSO</span>
          <strong>{patenteNome || 'Recruta'}</strong>
        </div>
      </div>

      <div className="identity-form-column">
        <div className="identity-fields identity-fields--primary">
          <div className="campo-horizontal identity-field--name">
            <label htmlFor="nome">PERSONAGEM</label>
            <input type="text" id="nome" value={dados.nome || ''} onChange={handleChange} />
          </div>

          <div className="campo-horizontal">
            <label htmlFor="jogador">JOGADOR</label>
            <input type="text" id="jogador" value={dados.jogador || ''} onChange={handleChange} />
          </div>
        </div>

        <div className="identity-fields identity-fields--classification">
          <div className="campo-horizontal">
            <label htmlFor="origem">ORIGEM</label>
            <select id="origem" value={dados.origem} onChange={handleChange}>
              {listaOrigens.map((origem) => (
                <option key={origem.key} value={origem.key}>{origem.nome}</option>
              ))}
            </select>
          </div>

          <div className="campo-horizontal">
            <label htmlFor="classe">CLASSE</label>
            <select id="classe" value={dados.classe} onChange={handleChange}>
              <option value="combatente">Combatente</option>
              <option value="especialista">Especialista</option>
              <option value="ocultista">Ocultista</option>
              <option value="sobrevivente">Sobrevivente</option>
            </select>
          </div>

          <div className="campo-horizontal">
            <label htmlFor="trilha">TRILHA</label>
            <select id="trilha" value={dados.trilha} onChange={handleChange} disabled={isTrilhaDisabled}>
              {listaTrilhas.map((trilha) => (
                <option key={trilha.key} value={trilha.key}>
                  {trilha.nome}{trilha.isCustom ? ' (Customizada)' : ''}
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
                {elementos.map((elemento) => (
                  <option key={elemento.value} value={elemento.value}>{elemento.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="identity-clearance-grid">
          <div className="campo-horizontal">
            <label htmlFor="prestigio">PRESTÍGIO</label>
            <input
              type="number"
              id="prestigio"
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
            <label>LIMITE DE CRÉDITO</label>
            <span className="campo-valor">{limiteCredito || 'Baixo'}</span>
          </div>
          <div className="campo-horizontal campo-readonly identity-field--items">
            <label>LIMITE DE ITENS</label>
            <span className="campo-valor">{limiteItens}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Identidade;
