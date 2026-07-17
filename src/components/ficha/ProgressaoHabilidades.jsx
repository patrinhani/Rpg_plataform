import React from 'react';
import FichaSectionFrame from './FichaSectionFrame.jsx';
import { AppIcon } from '../icons/NavigationIcons.jsx';

function formatarNome(valor, fallback) {
  if (!valor || valor === 'nenhuma') return fallback;
  return valor.charAt(0).toUpperCase() + valor.slice(1);
}

function ProgressaoHabilidades({
  classe,
  trilha,
  nexString,
  progressaoClasses,
  progressaoTrilhas,
  info,
  onCriarTrilha,
}) {
  const classeAtual = String(classe || '').toLowerCase();
  const nexAtual = classeAtual === 'sobrevivente'
    ? Math.min(5, Math.max(1, parseInt(info?.estagio_sobrevivente, 10) || 1))
    : (parseInt(String(nexString || '0').replace('%', ''), 10) || 0);
  const trilhaKey = String(trilha || '').toLowerCase();
  const isTrilhaAtiva = trilhaKey && trilhaKey !== 'nenhuma' && progressaoTrilhas?.[trilhaKey];
  const dadosClasse = progressaoClasses?.[classeAtual] || null;
  const dadosTrilha = isTrilhaAtiva ? progressaoTrilhas[trilhaKey] : null;
  const escalaAtual = classeAtual === 'sobrevivente' ? `Estágio ${nexAtual}` : `NEX ${nexAtual}%`;

  const getElementoParaExibir = key => {
    const elementoSalvo = info?.[`${key.toLowerCase()}_elemento`];
    if (elementoSalvo && elementoSalvo !== 'nenhuma') return elementoSalvo;
    return progressaoTrilhas?.[key.toLowerCase()]?.requiresChoice === 'elemento'
      ? '[ESCOLHA ELEMENTO]'
      : null;
  };

  const processarHabilidade = (habilidadeText, key = null) => {
    if (!habilidadeText) return '';
    const elemento = key ? getElementoParaExibir(key) : null;
    if (!elemento) return habilidadeText;
    return habilidadeText
      .replace(/Elemento/g, elemento)
      .replace(/\[ESCOLHA ELEMENTO\]/g, `(${elemento})`);
  };

  const gerarProgressao = (progressao, tipo, key) => {
    if (!progressao?.habilidades) {
      return (
        <section className="progression-column progression-column--empty">
          <span className="ficha-record-kicker">{tipo}</span>
          <h2>{tipo === 'TRILHA' ? 'Nenhuma trilha selecionada' : 'Classe indisponível'}</h2>
          <p>{tipo === 'TRILHA' ? 'Selecione uma trilha no Resumo ou crie uma personalizada.' : 'Selecione uma classe para visualizar a progressão.'}</p>
        </section>
      );
    }

    const niveis = Object.keys(progressao.habilidades).map(Number).sort((a, b) => a - b);
    if (niveis.length === 0) {
      return (
        <section className="progression-column progression-column--empty">
          <span className="ficha-record-kicker">{tipo}</span>
          <h2>{progressao.nome || (tipo === 'TRILHA' ? 'Trilha personalizada' : 'Classe')}</h2>
          <p>Esta progressão ainda não possui marcos cadastrados.</p>
        </section>
      );
    }

    const adquiridas = niveis
      .filter(nivel => nivel <= nexAtual)
      .map(nivel => ({ nivel, habilidade: processarHabilidade(progressao.habilidades[nivel], tipo === 'TRILHA' ? key : null) }));
    const proximoNivel = niveis.find(nivel => nivel > nexAtual);
    const concluida = proximoNivel === undefined && niveis.length > 0;
    const escalaLabel = progressao.escala || 'NEX';

    return (
      <section className="progression-column">
        <header className="progression-column__heading">
          <div>
            <span className="ficha-record-kicker">{tipo}</span>
            <h2>{progressao.nome}</h2>
          </div>
          <span className="progression-column__status">{adquiridas.length}/{niveis.length}</span>
        </header>

        <ol className="progression-timeline">
          {adquiridas.length > 0 ? adquiridas.map(({ nivel, habilidade }) => (
            <li key={`${key}-${nivel}`}>
              <span className="progression-level">{nivel}{escalaLabel === 'NEX' ? '%' : ''}</span>
              <p>{habilidade}</p>
            </li>
          )) : (
            <li className="progression-timeline__empty">Nenhuma habilidade adquirida ainda.</li>
          )}
        </ol>

        <div className={`progression-next ${concluida ? 'is-complete' : ''}`}>
          <span>{concluida ? 'PROGRESSÃO CONCLUÍDA' : 'PRÓXIMA AQUISIÇÃO'}</span>
          <strong>
            {concluida
              ? 'Fim da progressão'
              : `${escalaLabel} ${proximoNivel}${escalaLabel === 'NEX' ? '%' : ''}`}
          </strong>
          <p>
            {concluida
              ? `Todos os marcos de ${progressao.nome} foram alcançados.`
              : processarHabilidade(progressao.habilidades[proximoNivel], tipo === 'TRILHA' ? key : null)}
          </p>
        </div>
      </section>
    );
  };

  return (
    <FichaSectionFrame
      variant="progression"
      icon="progress"
      eyebrow="LINHA DE DESENVOLVIMENTO"
      title="Progressão"
      description="Marcos já conquistados e a próxima evolução de classe e trilha em uma linha temporal única."
      metrics={[
        { label: 'Estado atual', value: escalaAtual },
        { label: 'Classe', value: formatarNome(classe, '—') },
        { label: 'Trilha', value: formatarNome(trilha, 'Nenhuma') },
      ]}
      action={onCriarTrilha && (
        <button type="button" className="ficha-section-action" onClick={onCriarTrilha}>
          <AppIcon name="plus" size={18} />
          Criar trilha
        </button>
      )}
    >
      <div className="progression-board" id="grid-progressao">
        {gerarProgressao(dadosClasse, 'CLASSE', classeAtual || 'classe')}
        {gerarProgressao(dadosTrilha, 'TRILHA', trilhaKey || 'trilha')}
      </div>
    </FichaSectionFrame>
  );
}

export default ProgressaoHabilidades;
