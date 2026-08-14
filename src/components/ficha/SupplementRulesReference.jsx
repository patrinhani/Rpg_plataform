import React, { useMemo, useState } from 'react';
import { OPTIONAL_RULES, SUPPLEMENT_BOOKS } from '../../lib/supplements.js';
import FichaSectionFrame from './FichaSectionFrame.jsx';
import { AppIcon } from '../icons/NavigationIcons.jsx';
import './supplement-rules-reference.css';

const STATUS = {
  integrada: { label: 'Integrada', descricao: 'Já possui apoio no sistema.' },
  opcional: { label: 'Opcional', descricao: 'Só entra em jogo por decisão da mesa.' },
  referencia: { label: 'Referência', descricao: 'Orientação para aplicação manual.' },
};

function SupplementRulesReference() {
  const [busca, setBusca] = useState('');
  const [livro, setLivro] = useState('todos');
  const [status, setStatus] = useState('todos');

  const regras = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return OPTIONAL_RULES.filter(regra => {
      if (livro !== 'todos' && regra.fonte?.livro !== livro) return false;
      if (status !== 'todos' && regra.status !== status) return false;
      if (!termo) return true;
      return [regra.titulo, regra.categoria, regra.resumo, regra.fonte?.nome]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(termo);
    });
  }, [busca, livro, status]);

  return (
    <FichaSectionFrame
      variant="rules"
      icon="journal"
      eyebrow="ARQUIVO DE PROCEDIMENTOS"
      title="Regras complementares"
      description="Módulos reutilizáveis de Sobrevivendo ao Horror e Arquivos Secretos, separados do conteúdo de qualquer campanha."
      metrics={[
        { label: 'Catalogadas', value: OPTIONAL_RULES.length },
        { label: 'Integradas', value: OPTIONAL_RULES.filter(regra => regra.status === 'integrada').length },
        { label: 'Exibidas', value: regras.length },
      ]}
    >
      <section className="supplement-rules-notice">
        <AppIcon name="overview" size={20} />
        <div>
          <strong>Nenhuma regra opcional é ativada automaticamente.</strong>
          <p>Esta área organiza a referência para mestre e jogadores; campanhas, NPCs e acontecimentos dos livros não são incorporados ao site.</p>
        </div>
      </section>

      <div className="supplement-rules-filters" aria-label="Filtros de regras complementares">
        <label>
          <span>Buscar</span>
          <input
            type="search"
            value={busca}
            onChange={event => setBusca(event.target.value)}
            placeholder="Regra, categoria ou efeito..."
          />
        </label>
        <label>
          <span>Livro</span>
          <select value={livro} onChange={event => setLivro(event.target.value)}>
            <option value="todos">Todos os livros</option>
            {Object.values(SUPPLEMENT_BOOKS).map(item => (
              <option key={item.id} value={item.id}>{item.nome}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Aplicação</span>
          <select value={status} onChange={event => setStatus(event.target.value)}>
            <option value="todos">Todos os estados</option>
            {Object.entries(STATUS).map(([key, item]) => (
              <option key={key} value={key}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="supplement-rules-grid">
        {regras.map(regra => {
          const estado = STATUS[regra.status] || STATUS.referencia;
          return (
            <article className="supplement-rule-card" data-status={regra.status} key={regra.id}>
              <header>
                <div>
                  <span className="supplement-rule-card__category">{regra.categoria}</span>
                  <h2>{regra.titulo}</h2>
                </div>
                <span className="supplement-rule-card__status">{estado.label}</span>
              </header>
              <p>{regra.resumo}</p>
              <footer>
                <span>{regra.fonte?.sigla}{regra.fonte?.pagina ? ` · p. ${regra.fonte.pagina}` : ''}</span>
                <small>{estado.descricao}</small>
              </footer>
            </article>
          );
        })}
        {regras.length === 0 && (
          <p className="supplement-rules-empty">Nenhuma regra corresponde aos filtros escolhidos.</p>
        )}
      </div>
    </FichaSectionFrame>
  );
}

export default SupplementRulesReference;
