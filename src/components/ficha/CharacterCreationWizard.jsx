import React, { useMemo, useState } from 'react';
import {
  ATRIBUTOS_CRIACAO,
  CLASSES_CRIACAO,
  ETAPAS_CRIACAO,
  PERICIAS_CRIACAO,
  criarRascunhoCriacao,
  montarDadosCriacao,
  obterDadosOrigem,
  obterOrigens,
  obterPericiasClasse,
  obterPericiasOrigem,
  obterQuantidadePericiasLivres,
  validarEtapaCriacao,
} from '../../lib/character-creation.js';
import { AppIcon } from '../icons/NavigationIcons.jsx';
import './character-creation-wizard.css';

const ATRIBUTOS_RECOMENDADOS = {
  combatente: { for: 3, agi: 1, int: 1, pre: 1, vig: 3 },
  especialista: { for: 1, agi: 2, int: 3, pre: 2, vig: 1 },
  ocultista: { for: 1, agi: 1, int: 2, pre: 3, vig: 2 },
  sobrevivente: { for: 1, agi: 2, int: 2, pre: 1, vig: 2 },
};

function nomePericia(key) {
  return PERICIAS_CRIACAO.find(pericia => pericia.key === key)?.nome || key;
}

function CharacterCreationWizard({ dados, jogadorPadrao, onSalvar, onSair }) {
  const [rascunho, setRascunho] = useState(() => criarRascunhoCriacao(dados, jogadorPadrao));
  const [etapaAtual, setEtapaAtual] = useState(() => rascunho.etapa);
  const [etapaMaxima, setEtapaMaxima] = useState(() => rascunho.etapa);
  const [buscaOrigem, setBuscaOrigem] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const origens = useMemo(() => obterOrigens(), []);
  const dadosOrigem = useMemo(() => obterDadosOrigem(rascunho.origem), [rascunho.origem]);
  const periciasOrigem = useMemo(() => obterPericiasOrigem(rascunho), [rascunho]);
  const periciasClasse = useMemo(() => obterPericiasClasse(rascunho), [rascunho]);
  const quantidadePericiasLivres = obterQuantidadePericiasLivres(rascunho);
  const limiteAtributos = rascunho.classe === 'sobrevivente' ? 8 : 9;
  const totalAtributos = ATRIBUTOS_CRIACAO.reduce(
    (total, atributo) => total + (Number.parseInt(rascunho.atributos[atributo.key], 10) || 0),
    0,
  );
  const pontosRestantes = limiteAtributos - totalAtributos;

  const dadosPrevistos = useMemo(
    () => montarDadosCriacao(dados, rascunho, { etapa: etapaAtual }),
    [dados, etapaAtual, rascunho],
  );
  const defesaPrevista = 10
    + (Number.parseInt(rascunho.atributos.agi, 10) || 0)
    + (rascunho.origem === 'policial' ? 2 : 0);

  const origensFiltradas = useMemo(() => {
    const termo = buscaOrigem.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return origens;
    return origens.filter(origem => {
      const texto = [origem.nome, origem.poder?.nome, origem.poder?.descricao]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return texto.includes(termo);
    });
  }, [buscaOrigem, origens]);

  const atualizarRascunho = (campo, valor) => {
    setErro('');
    setRascunho(atual => ({ ...atual, [campo]: valor }));
  };

  const selecionarPericiaObrigatoria = (campo, pericia) => {
    setErro('');
    setRascunho(atual => ({
      ...atual,
      [campo]: pericia,
      periciasClasseLivres: (atual.periciasClasseLivres || []).filter(item => item !== pericia),
    }));
  };

  const selecionarOrigem = (origem) => {
    setErro('');
    setRascunho(atual => ({
      ...atual,
      origem,
      periciasOrigemEscolhidas: [],
      periciaCombate: '',
      periciaResistencia: '',
      periciasClasseLivres: [],
    }));
  };

  const selecionarClasse = (classe) => {
    setErro('');
    setRascunho(atual => ({
      ...atual,
      classe,
      atributos: { ...ATRIBUTOS_RECOMENDADOS[classe] },
      periciaCombate: '',
      periciaResistencia: '',
      periciasClasseLivres: [],
    }));
  };

  const alterarAtributo = (key, delta) => {
    setErro('');
    setRascunho(atual => {
      const valorAtual = Number.parseInt(atual.atributos[key], 10) || 0;
      const novoValor = Math.min(3, Math.max(0, valorAtual + delta));
      if (novoValor === valorAtual) return atual;
      if (novoValor === 0 && Object.entries(atual.atributos).some(([atributo, valor]) => atributo !== key && valor === 0)) {
        return atual;
      }
      const totalSemAtual = Object.entries(atual.atributos)
        .filter(([atributo]) => atributo !== key)
        .reduce((total, [, valor]) => total + (Number.parseInt(valor, 10) || 0), 0);
      if (totalSemAtual + novoValor > (atual.classe === 'sobrevivente' ? 8 : 9)) return atual;
      return { ...atual, atributos: { ...atual.atributos, [key]: novoValor } };
    });
  };

  const alternarPericiaOrigem = (pericia, quantidade) => {
    setErro('');
    setRascunho(atual => {
      const selecionadas = atual.periciasOrigemEscolhidas || [];
      const existe = selecionadas.includes(pericia);
      if (!existe && selecionadas.length >= quantidade) return atual;
      return {
        ...atual,
        periciasOrigemEscolhidas: existe
          ? selecionadas.filter(item => item !== pericia)
          : [...selecionadas, pericia],
        periciasClasseLivres: (atual.periciasClasseLivres || []).filter(item => item !== pericia),
      };
    });
  };

  const alternarPericiaLivre = (pericia) => {
    setErro('');
    setRascunho(atual => {
      const selecionadas = atual.periciasClasseLivres || [];
      const existe = selecionadas.includes(pericia);
      if (!existe && selecionadas.length >= obterQuantidadePericiasLivres(atual)) return atual;
      return {
        ...atual,
        periciasClasseLivres: existe
          ? selecionadas.filter(item => item !== pericia)
          : [...selecionadas, pericia],
      };
    });
  };

  const persistir = async (proximoRascunho, opcoes = {}) => {
    setSalvando(true);
    setErro('');
    const dadosCriacao = montarDadosCriacao(dados, proximoRascunho, opcoes);
    const resultado = await onSalvar(dadosCriacao);
    setSalvando(false);
    if (!resultado?.ok) {
      setErro(resultado?.error?.message || 'Não foi possível salvar o rascunho. Tente novamente.');
      return false;
    }
    return true;
  };

  const avancar = async () => {
    const mensagem = validarEtapaCriacao(etapaAtual, rascunho);
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    const proximaEtapa = Math.min(ETAPAS_CRIACAO.length - 1, etapaAtual + 1);
    const proximoRascunho = { ...rascunho, etapa: proximaEtapa };
    if (!(await persistir(proximoRascunho, { etapa: proximaEtapa }))) return;
    setRascunho(proximoRascunho);
    setEtapaAtual(proximaEtapa);
    setEtapaMaxima(maxima => Math.max(maxima, proximaEtapa));
  };

  const voltar = () => {
    setErro('');
    setEtapaAtual(atual => Math.max(0, atual - 1));
  };

  const salvarESair = async () => {
    const proximoRascunho = { ...rascunho, etapa: etapaAtual };
    if (await persistir(proximoRascunho, { etapa: etapaAtual })) onSair();
  };

  const concluir = async () => {
    for (let etapa = 0; etapa < ETAPAS_CRIACAO.length - 1; etapa += 1) {
      const mensagem = validarEtapaCriacao(etapa, rascunho);
      if (mensagem) {
        setEtapaAtual(etapa);
        setErro(mensagem);
        return;
      }
    }
    await persistir({ ...rascunho, etapa: ETAPAS_CRIACAO.length - 1 }, {
      concluida: true,
      etapa: ETAPAS_CRIACAO.length - 1,
    });
  };

  const etapa = ETAPAS_CRIACAO[etapaAtual];

  return (
    <main className="character-builder">
      <aside className="character-builder__rail">
        <div className="character-builder__brand">
          <img src="/assets/images/optimized/SimboloSemafinidade-320.webp" alt="" aria-hidden="true" />
          <div>
            <span>C.A.O.S.</span>
            <strong>Novo agente</strong>
          </div>
        </div>

        <ol className="character-builder__steps" aria-label="Etapas da criação">
          {ETAPAS_CRIACAO.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className={index === etapaAtual ? 'is-active' : index < etapaAtual ? 'is-complete' : ''}
                onClick={() => {
                  if (index <= etapaMaxima) {
                    setErro('');
                    setEtapaAtual(index);
                  }
                }}
                disabled={index > etapaMaxima || salvando}
                aria-current={index === etapaAtual ? 'step' : undefined}
              >
                <span className="character-builder__step-index">{index < etapaAtual ? '✓' : index + 1}</span>
                <span><strong>{item.nome}</strong><small>{item.resumo}</small></span>
              </button>
            </li>
          ))}
        </ol>

        <button type="button" className="character-builder__save-exit" onClick={salvarESair} disabled={salvando}>
          <AppIcon name="back" size={16} />
          Salvar e continuar depois
        </button>
      </aside>

      <section className="character-builder__workspace">
        <header className="character-builder__header">
          <div>
            <span className="character-builder__eyebrow">ETAPA {etapaAtual + 1} DE {ETAPAS_CRIACAO.length}</span>
            <h1>{etapa.nome}</h1>
          </div>
          <div className="character-builder__autosave">
            <span className={salvando ? 'is-saving' : ''} />
            {salvando ? 'Salvando...' : 'Rascunho sincronizado'}
          </div>
        </header>

        <div className="character-builder__content">
          {etapaAtual === 0 && (
            <section className="character-builder__panel character-builder__panel--narrow">
              <p className="character-builder__lead">Comece pela ideia, não pelos números. Pense em quem essa pessoa era antes de encarar o paranormal.</p>
              <label className="character-builder__field">
                <span>Nome do personagem *</span>
                <input
                  autoFocus
                  type="text"
                  value={rascunho.nome}
                  maxLength={80}
                  onChange={event => atualizarRascunho('nome', event.target.value)}
                  placeholder="Como o agente é chamado?"
                />
              </label>
              <label className="character-builder__field">
                <span>Jogador</span>
                <input
                  type="text"
                  value={rascunho.jogador}
                  maxLength={80}
                  onChange={event => atualizarRascunho('jogador', event.target.value)}
                  placeholder="Seu nome"
                />
              </label>
              <label className="character-builder__field">
                <span>Conceito em uma frase <small>opcional</small></span>
                <textarea
                  value={rascunho.conceito}
                  maxLength={240}
                  onChange={event => atualizarRascunho('conceito', event.target.value)}
                  placeholder="Ex.: paramédica cética que procura o irmão desaparecido."
                />
                <small>{rascunho.conceito.length}/240</small>
              </label>
              <div className="character-builder__tip">
                <AppIcon name="overview" size={20} />
                <div><strong>Dica para um bom conceito</strong><p>Una profissão, personalidade e uma motivação. Você poderá desenvolver a história completa no diário da ficha.</p></div>
              </div>
            </section>
          )}

          {etapaAtual === 1 && (
            <section className="character-builder__panel">
              <p className="character-builder__lead">A origem representa sua vida antes da Ordem. Ela concede duas perícias e um poder exclusivo.</p>
              <label className="character-builder__search">
                <AppIcon name="search" size={18} />
                <input value={buscaOrigem} onChange={event => setBuscaOrigem(event.target.value)} placeholder="Buscar por nome, poder ou efeito..." />
              </label>
              <div className="character-builder__origin-grid">
                {origensFiltradas.map(origem => (
                  <button
                    key={origem.key}
                    type="button"
                    className={`character-builder__choice-card ${rascunho.origem === origem.key ? 'is-selected' : ''}`}
                    onClick={() => selecionarOrigem(origem.key)}
                  >
                    <span className="character-builder__choice-mark" aria-hidden="true" />
                    <strong>{origem.nome}</strong>
                    <small>{(origem.fixas || []).map(nomePericia).join(' • ') || 'Perícias à sua escolha'}</small>
                    <span>{origem.poder?.nome || 'Poder de origem'}</span>
                    <p>{origem.poder?.descricao}</p>
                  </button>
                ))}
              </div>
              {origensFiltradas.length === 0 && <p className="character-builder__empty">Nenhuma origem corresponde à busca.</p>}
              {(dadosOrigem.escolhas || []).map((escolha, index) => {
                const quantidade = escolha.quantidade || 0;
                return (
                  <div className="character-builder__inline-choice" key={`${rascunho.origem}-${index}`}>
                    <div><strong>{escolha.titulo}</strong><p>{escolha.descricao}</p></div>
                    <span>{rascunho.periciasOrigemEscolhidas.length}/{quantidade}</span>
                    <div className="character-builder__skill-grid">
                      {PERICIAS_CRIACAO.map(pericia => {
                        const selecionada = rascunho.periciasOrigemEscolhidas.includes(pericia.key);
                        const concedida = (dadosOrigem.fixas || []).includes(pericia.key);
                        return (
                          <button
                            key={pericia.key}
                            type="button"
                            className={selecionada ? 'is-selected' : ''}
                            onClick={() => alternarPericiaOrigem(pericia.key, quantidade)}
                            disabled={concedida || (!selecionada && rascunho.periciasOrigemEscolhidas.length >= quantidade)}
                          >
                            <strong>{pericia.nome}</strong><small>{pericia.atributo}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {etapaAtual === 2 && (
            <section className="character-builder__panel">
              <p className="character-builder__lead">A classe define seu papel, recursos e progressão. A trilha será escolhida depois, quando o personagem alcançar o marco necessário.</p>
              <div className="character-builder__class-grid">
                {Object.entries(CLASSES_CRIACAO).map(([key, classe]) => (
                  <button
                    key={key}
                    type="button"
                    className={`character-builder__class-card character-builder__class-card--${key} ${rascunho.classe === key ? 'is-selected' : ''}`}
                    onClick={() => selecionarClasse(key)}
                  >
                    <span className="character-builder__choice-mark" aria-hidden="true" />
                    <small>{classe.chamada}</small>
                    <strong>{classe.nome}</strong>
                    <p>{classe.descricao}</p>
                    <span>{classe.recomendado}</span>
                    <footer><strong>Perícias</strong>{classe.pericias}</footer>
                  </button>
                ))}
              </div>
              {rascunho.classe === 'sobrevivente' && (
                <div className="character-builder__warning">
                  <strong>Campanha de sobrevivência</strong>
                  Esta classe é intencionalmente mais fraca, usa apenas 3 pontos de atributos e começa no estágio 1, NEX 0%.
                </div>
              )}
            </section>
          )}

          {etapaAtual === 3 && (
            <section className="character-builder__panel">
              <div className="character-builder__section-heading">
                <div><p className="character-builder__lead">Cada atributo começa em 1. Você pode reduzir apenas um deles para 0 e nunca ultrapassar 3 durante a criação.</p></div>
                <div className={`character-builder__points ${pontosRestantes === 0 ? 'is-complete' : pontosRestantes < 0 ? 'is-error' : ''}`}>
                  <strong>{Math.abs(pontosRestantes)}</strong>
                  <span>{pontosRestantes === 0 ? 'distribuição completa' : pontosRestantes > 0 ? 'pontos restantes' : 'pontos excedentes'}</span>
                </div>
              </div>
              <div className="character-builder__attributes">
                {ATRIBUTOS_CRIACAO.map(atributo => (
                  <article key={atributo.key}>
                    <span>{atributo.sigla}</span>
                    <strong>{atributo.nome}</strong>
                    <p>{atributo.descricao}</p>
                    <div>
                      <button type="button" onClick={() => alterarAtributo(atributo.key, -1)} disabled={rascunho.atributos[atributo.key] <= 0}>−</button>
                      <output aria-label={`${atributo.nome}: ${rascunho.atributos[atributo.key]}`}>{rascunho.atributos[atributo.key]}</output>
                      <button type="button" onClick={() => alterarAtributo(atributo.key, 1)} disabled={rascunho.atributos[atributo.key] >= 3 || pontosRestantes <= 0}>+</button>
                    </div>
                  </article>
                ))}
              </div>
              <button
                type="button"
                className="character-builder__secondary-action"
                onClick={() => atualizarRascunho('atributos', { ...ATRIBUTOS_RECOMENDADOS[rascunho.classe] })}
              >
                Usar distribuição recomendada para {CLASSES_CRIACAO[rascunho.classe].nome}
              </button>
            </section>
          )}

          {etapaAtual === 4 && (
            <section className="character-builder__panel">
              <div className="character-builder__section-heading">
                <p className="character-builder__lead">Perícias treinadas recebem +5. As concedidas pela origem e pela classe não consomem suas escolhas livres.</p>
                <div className={`character-builder__points ${rascunho.periciasClasseLivres.length === quantidadePericiasLivres ? 'is-complete' : ''}`}>
                  <strong>{rascunho.periciasClasseLivres.length}/{quantidadePericiasLivres}</strong><span>escolhas livres</span>
                </div>
              </div>

              <div className="character-builder__granted-skills">
                <div><span>Da origem</span><strong>{periciasOrigem.map(nomePericia).join(', ') || 'Nenhuma fixa'}</strong></div>
                {rascunho.classe === 'ocultista' && <div><span>Fixas da classe</span><strong>Ocultismo, Vontade</strong></div>}
              </div>

              {rascunho.classe === 'combatente' && (
                <div className="character-builder__required-skills">
                  <fieldset>
                    <legend>Treinamento de combate</legend>
                    {['luta', 'pontaria'].map(pericia => (
                      <label key={pericia} className={periciasOrigem.includes(pericia) ? 'is-disabled' : ''}>
                        <input
                          type="radio"
                          name="pericia-combate"
                          value={pericia}
                          checked={rascunho.periciaCombate === pericia}
                          disabled={periciasOrigem.includes(pericia)}
                          onChange={() => selecionarPericiaObrigatoria('periciaCombate', pericia)}
                        />
                        {nomePericia(pericia)}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset>
                    <legend>Resistência</legend>
                    {['fortitude', 'reflexos'].map(pericia => (
                      <label key={pericia} className={periciasOrigem.includes(pericia) ? 'is-disabled' : ''}>
                        <input
                          type="radio"
                          name="pericia-resistencia"
                          value={pericia}
                          checked={rascunho.periciaResistencia === pericia}
                          disabled={periciasOrigem.includes(pericia)}
                          onChange={() => selecionarPericiaObrigatoria('periciaResistencia', pericia)}
                        />
                        {nomePericia(pericia)}
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}

              <div className="character-builder__skill-grid character-builder__skill-grid--main">
                {PERICIAS_CRIACAO.map(pericia => {
                  const concedida = periciasOrigem.includes(pericia.key) || periciasClasse.includes(pericia.key) && !rascunho.periciasClasseLivres.includes(pericia.key);
                  const selecionada = rascunho.periciasClasseLivres.includes(pericia.key);
                  const limiteAtingido = rascunho.periciasClasseLivres.length >= quantidadePericiasLivres;
                  return (
                    <button
                      key={pericia.key}
                      type="button"
                      className={`${selecionada ? 'is-selected' : ''} ${concedida ? 'is-granted' : ''}`}
                      onClick={() => alternarPericiaLivre(pericia.key)}
                      disabled={concedida || (!selecionada && limiteAtingido)}
                    >
                      <span className="character-builder__skill-check">{concedida ? '✓' : selecionada ? '✓' : ''}</span>
                      <strong>{pericia.nome}</strong><small>{pericia.atributo}{concedida ? ' · concedida' : ''}</small>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {etapaAtual === 5 && (
            <section className="character-builder__panel">
              <p className="character-builder__lead">Confira o resultado. Depois de concluir, todos os campos continuam editáveis na ficha completa.</p>
              <div className="character-builder__review-hero">
                <div>
                  <span>{CLASSES_CRIACAO[rascunho.classe].nome} · {rascunho.classe === 'sobrevivente' ? 'Estágio 1' : 'NEX 5%'}</span>
                  <h2>{rascunho.nome}</h2>
                  <p>{rascunho.conceito || 'Conceito não informado.'}</p>
                </div>
                <div className="character-builder__review-stats">
                  <span><small>PV</small><strong>{dadosPrevistos.recursos.pv_max}</strong></span>
                  <span><small>PE</small><strong>{dadosPrevistos.recursos.pe_max}</strong></span>
                  <span><small>SAN</small><strong>{dadosPrevistos.recursos.san_max}</strong></span>
                  <span><small>DEF</small><strong>{defesaPrevista}</strong></span>
                </div>
              </div>
              <div className="character-builder__review-grid">
                <article>
                  <header><span>01</span><div><small>PASSADO</small><strong>{origens.find(origem => origem.key === rascunho.origem)?.nome}</strong></div><button type="button" onClick={() => setEtapaAtual(1)}>Editar</button></header>
                  <p><strong>{dadosOrigem.poder?.nome}</strong> — {dadosOrigem.poder?.descricao}</p>
                </article>
                <article>
                  <header><span>02</span><div><small>ATRIBUTOS</small><strong>{ATRIBUTOS_CRIACAO.map(attr => `${attr.sigla} ${rascunho.atributos[attr.key]}`).join(' · ')}</strong></div><button type="button" onClick={() => setEtapaAtual(3)}>Editar</button></header>
                </article>
                <article>
                  <header><span>03</span><div><small>PERÍCIAS TREINADAS</small><strong>{new Set([...periciasOrigem, ...periciasClasse]).size} treinamentos</strong></div><button type="button" onClick={() => setEtapaAtual(4)}>Editar</button></header>
                  <p>{[...new Set([...periciasOrigem, ...periciasClasse])].map(nomePericia).sort((a, b) => a.localeCompare(b, 'pt-BR')).join(', ')}</p>
                </article>
              </div>
              <div className="character-builder__finish-note">
                <AppIcon name="overview" size={20} />
                Ao concluir, o sistema calcula os recursos e abre a ficha completa. Inventário, poderes, rituais, retrato e detalhes avançados são configurados nela.
              </div>
            </section>
          )}
        </div>

        {erro && <div className="character-builder__error" role="alert">{erro}</div>}

        <footer className="character-builder__footer">
          <button type="button" className="character-builder__back" onClick={etapaAtual === 0 ? salvarESair : voltar} disabled={salvando}>
            <AppIcon name="back" size={16} />
            {etapaAtual === 0 ? 'Sair' : 'Voltar'}
          </button>
          {etapaAtual < ETAPAS_CRIACAO.length - 1 ? (
            <button type="button" className="character-builder__next" onClick={avancar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar e continuar'}
              <span aria-hidden="true">→</span>
            </button>
          ) : (
            <button type="button" className="character-builder__next character-builder__next--finish" onClick={concluir} disabled={salvando}>
              {salvando ? 'Criando agente...' : 'Concluir personagem'}
              <span aria-hidden="true">✓</span>
            </button>
          )}
        </footer>
      </section>
    </main>
  );
}

export default CharacterCreationWizard;
