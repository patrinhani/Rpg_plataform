import React, { useEffect, useId, useState } from 'react';
import {
  ATRIBUTOS_CRIATURA,
  ELEMENTOS_CRIATURA,
  MAX_FOTO_LENGTH,
  criarRascunhoCriatura,
  validarCriaturaPersonalizada,
} from '../../lib/custom-creatures.js';
import ModalBase from '../ModalBase.jsx';
import { AppIcon } from '../icons/NavigationIcons.jsx';
import '../../styles/mesa.css';

const NOMES_ATRIBUTOS = { agi: 'AGI', for: 'FOR', int: 'INT', pre: 'PRE', vig: 'VIG' };

function carregarImagem(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const imagem = new Image();
    imagem.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagem);
    };
    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem selecionada.'));
    };
    imagem.src = url;
  });
}

async function compactarImagem(file) {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem válido.');
  if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MiB.');

  const imagem = await carregarImagem(file);
  const escala = Math.min(1, 512 / Math.max(imagem.naturalWidth, imagem.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
  canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
  const contexto = canvas.getContext('2d');
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = 'high';
  contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);

  for (const qualidade of [0.82, 0.72, 0.62, 0.52]) {
    const resultado = canvas.toDataURL('image/webp', qualidade);
    if (resultado.length <= MAX_FOTO_LENGTH) return resultado;
  }
  throw new Error('A imagem ainda ficou grande demais. Tente uma arte menor ou mais simples.');
}

function CustomCreatureForm({ isOpen, criatura, onClose, onSave }) {
  const [rascunho, setRascunho] = useState(() => criarRascunhoCriatura(criatura));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const fieldsId = useId();

  useEffect(() => {
    if (!isOpen) return;
    setRascunho(criarRascunhoCriatura(criatura));
    setErro('');
  }, [criatura, isOpen]);

  const atualizar = (campo, valor) => {
    setErro('');
    setRascunho(atual => ({ ...atual, [campo]: valor }));
  };

  const atualizarAtributo = (atributo, valor) => {
    setErro('');
    setRascunho(atual => ({
      ...atual,
      atributos: { ...atual.atributos, [atributo]: valor },
    }));
  };

  const atualizarHabilidade = (index, valor) => {
    setRascunho(atual => ({
      ...atual,
      habilidades: atual.habilidades.map((item, itemIndex) => itemIndex === index ? valor : item),
    }));
  };

  const atualizarAcao = (index, campo, valor) => {
    setRascunho(atual => ({
      ...atual,
      acoes: atual.acoes.map((acao, itemIndex) => itemIndex === index ? { ...acao, [campo]: valor } : acao),
    }));
  };

  const handleImagem = async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    setErro('');
    try {
      atualizar('foto', await compactarImagem(file));
    } catch (error) {
      setErro(error.message);
    } finally {
      event.target.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const mensagem = validarCriaturaPersonalizada(rascunho);
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      await onSave(rascunho);
      onClose();
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar a criatura.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={salvando ? undefined : onClose}
      title={criatura?.id ? 'Editar criatura' : 'Nova criatura'}
      size="wide"
      className="custom-creature-modal"
      bodyClassName="custom-creature-modal__body"
      closeLabel="Fechar editor de criatura"
      footer={(
        <>
          <button type="button" className="caos-modal__button caos-modal__button--secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" form={`${fieldsId}-form`} className="caos-modal__button caos-modal__button--primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar criatura'}
          </button>
        </>
      )}
    >
      <form id={`${fieldsId}-form`} className="custom-creature-form" onSubmit={handleSubmit}>
        {erro && <div className="mesa-action-error" role="alert">{erro}</div>}

        <section className="custom-creature-form__section">
          <header><span>01</span><div><strong>Identidade</strong><small>Nome, natureza e imagem da ficha.</small></div></header>
          <div className="custom-creature-form__grid">
            <label className="is-wide"><span>Nome</span><input required maxLength="80" value={rascunho.nome} onChange={event => atualizar('nome', event.target.value)} /></label>
            <label><span>Elemento principal</span><input list={`${fieldsId}-elementos`} maxLength="50" value={rascunho.elemento} onChange={event => atualizar('elemento', event.target.value)} /></label>
            <datalist id={`${fieldsId}-elementos`}>{ELEMENTOS_CRIATURA.map(elemento => <option key={elemento} value={elemento} />)}</datalist>
            <label><span>VD</span><input type="number" min="0" max="999" value={rascunho.vd} onChange={event => atualizar('vd', event.target.value)} /></label>
            <label className="is-wide"><span>Tipo e tamanho</span><input maxLength="100" value={rascunho.tipo} onChange={event => atualizar('tipo', event.target.value)} placeholder="Criatura - Média" /></label>
            <label className="is-wide"><span>URL HTTPS da imagem</span><input value={rascunho.foto.startsWith('data:') ? '' : rascunho.foto} onChange={event => atualizar('foto', event.target.value)} placeholder="https://..." /></label>
            <label className="custom-creature-form__upload">
              <span>Ou enviar arquivo</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImagem} />
              <em><AppIcon name="upload" size={17} /> PNG, JPG ou WebP; otimizado automaticamente.</em>
            </label>
            {rascunho.foto && (
              <div className="custom-creature-form__preview">
                <img src={rascunho.foto} alt="Prévia da criatura" />
                <button type="button" onClick={() => atualizar('foto', '')}>Remover imagem</button>
              </div>
            )}
          </div>
        </section>

        <section className="custom-creature-form__section">
          <header><span>02</span><div><strong>Defesas e recursos</strong><small>Números usados na ficha e na iniciativa.</small></div></header>
          <div className="custom-creature-form__grid custom-creature-form__grid--stats">
            <label><span>PV máximo</span><input required type="number" min="1" max="9999" value={rascunho.pv_max} onChange={event => atualizar('pv_max', event.target.value)} /></label>
            <label><span>Machucado</span><input type="number" min="0" max="9999" value={rascunho.machucado} onChange={event => atualizar('machucado', event.target.value)} /></label>
            <label><span>Defesa</span><input type="number" min="0" max="999" value={rascunho.defesa} onChange={event => atualizar('defesa', event.target.value)} /></label>
            <label><span>Iniciativa</span><input required maxLength="100" value={rascunho.iniciativa} onChange={event => atualizar('iniciativa', event.target.value)} placeholder="3d20+10" /></label>
            <label><span>Fortitude</span><input maxLength="100" value={rascunho.fortitude} onChange={event => atualizar('fortitude', event.target.value)} /></label>
            <label><span>Reflexos</span><input maxLength="100" value={rascunho.reflexos} onChange={event => atualizar('reflexos', event.target.value)} /></label>
            <label><span>Vontade</span><input maxLength="100" value={rascunho.vontade} onChange={event => atualizar('vontade', event.target.value)} /></label>
            <label><span>Deslocamento</span><input maxLength="150" value={rascunho.deslocamento} onChange={event => atualizar('deslocamento', event.target.value)} /></label>
            <label className="is-wide"><span>Presença perturbadora</span><input maxLength="500" value={rascunho.presenca} onChange={event => atualizar('presenca', event.target.value)} /></label>
            <label className="is-wide"><span>Sentidos</span><input maxLength="300" value={rascunho.sentidos} onChange={event => atualizar('sentidos', event.target.value)} /></label>
            <label className="is-wide"><span>Resistências</span><input maxLength="400" value={rascunho.resistencias} onChange={event => atualizar('resistencias', event.target.value)} /></label>
            <label className="is-wide"><span>Vulnerabilidades</span><input maxLength="300" value={rascunho.vulnerabilidades} onChange={event => atualizar('vulnerabilidades', event.target.value)} /></label>
          </div>
          <div className="custom-creature-form__attributes">
            {ATRIBUTOS_CRIATURA.map(atributo => (
              <label key={atributo}><span>{NOMES_ATRIBUTOS[atributo]}</span><input type="number" min="0" max="10" value={rascunho.atributos[atributo]} onChange={event => atualizarAtributo(atributo, event.target.value)} /></label>
            ))}
          </div>
        </section>

        <section className="custom-creature-form__section">
          <header><span>03</span><div><strong>Habilidades</strong><small>Traços passivos, reações, enigmas e comportamentos especiais.</small></div></header>
          <div className="custom-creature-form__repeaters">
            {rascunho.habilidades.map((habilidade, index) => (
              <div key={`habilidade-${index}`}>
                <textarea rows="3" maxLength="1200" value={habilidade} onChange={event => atualizarHabilidade(index, event.target.value)} placeholder="NOME: descrição e efeito da habilidade." />
                <button type="button" onClick={() => atualizar('habilidades', rascunho.habilidades.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover habilidade ${index + 1}`}>×</button>
              </div>
            ))}
            <button type="button" className="custom-creature-form__add" onClick={() => atualizar('habilidades', [...rascunho.habilidades, ''])} disabled={rascunho.habilidades.length >= 20}>
              <AppIcon name="plus" size={16} /> Adicionar habilidade
            </button>
          </div>
        </section>

        <section className="custom-creature-form__section">
          <header><span>04</span><div><strong>Ações</strong><small>Ataques, manobras e ações especiais da criatura.</small></div></header>
          <div className="custom-creature-form__actions">
            {rascunho.acoes.map((acao, index) => (
              <article key={`acao-${index}`}>
                <label><span>Nome da ação</span><input maxLength="100" value={acao.nome} onChange={event => atualizarAcao(index, 'nome', event.target.value)} /></label>
                <label><span>Descrição</span><textarea rows="3" maxLength="1500" value={acao.descricao} onChange={event => atualizarAcao(index, 'descricao', event.target.value)} /></label>
                <button type="button" onClick={() => atualizar('acoes', rascunho.acoes.filter((_, itemIndex) => itemIndex !== index))}>Remover ação</button>
              </article>
            ))}
            <button type="button" className="custom-creature-form__add" onClick={() => atualizar('acoes', [...rascunho.acoes, { nome: '', descricao: '' }])} disabled={rascunho.acoes.length >= 20}>
              <AppIcon name="plus" size={16} /> Adicionar ação
            </button>
          </div>
        </section>
      </form>
    </ModalBase>
  );
}

export default CustomCreatureForm;
