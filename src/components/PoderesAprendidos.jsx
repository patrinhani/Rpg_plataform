import React, { useMemo } from 'react';
import {
  database,
  OpcoesOrigem,
  poderesGerais,
  poderesParanormais,
} from '../lib/database.js';
import FichaSectionFrame from './ficha/FichaSectionFrame.jsx';
import { AppIcon } from './icons/NavigationIcons.jsx';

const generalKeys = new Set(poderesGerais.map(poder => poder.key));
const paranormalKeys = new Set(poderesParanormais.map(poder => poder.key));

const getBasePowerKey = (key = '') => key.replace(/_(sangue|morte|conhecimento|energia)$/i, '');

function aplicarElementoNaDescricao(texto, trilhaKey, info, progressaoTrilhas) {
  if (!texto || !trilhaKey) return texto;

  const dadosTrilha = progressaoTrilhas?.[trilhaKey];
  if (!dadosTrilha || dadosTrilha.requiresChoice !== 'elemento') return texto;

  const elemento = info?.[`${trilhaKey}_elemento`] || '[ESCOLHA ELEMENTO]';
  return texto
    .replace(/Elemento/g, elemento)
    .replace(/\[ESCOLHA ELEMENTO\]/g, `(${elemento})`);
}

function getPoderOrigem(info) {
  const origemKey = info?.origem;
  const dadosOrigem = database.periciasPorOrigem?.[origemKey];
  if (!origemKey || !dadosOrigem?.poder) return null;

  return {
    key: `origem_${origemKey}`,
    nome: dadosOrigem.poder.nome,
    descricao: dadosOrigem.poder.descricao,
    tipo: 'Origem',
    fonte: OpcoesOrigem?.[origemKey] || origemKey,
    isOrigemPower: true,
  };
}

function getPoderesProgressao(info, progressaoClasses, progressaoTrilhas) {
  const classeKey = String(info?.classe || '').toLowerCase();
  const nexAtual = classeKey === 'sobrevivente'
    ? Math.min(5, Math.max(1, parseInt(info?.estagio_sobrevivente, 10) || 1))
    : (parseInt(String(info?.nex || '0').replace(/[^0-9]/g, ''), 10) || 0);
  const trilhaKey = String(info?.trilha || '').toLowerCase();
  const poderes = [];

  const adicionarProgressao = (dados, origem, keyBase, isTrilha = false) => {
    if (!dados?.habilidades) return;
    Object.entries(dados.habilidades)
      .map(([nivel, descricao]) => ({ nivel: Number(nivel), descricao }))
      .sort((a, b) => a.nivel - b.nivel)
      .forEach(({ nivel, descricao }) => {
        const descricaoFinal = isTrilha
          ? aplicarElementoNaDescricao(descricao, keyBase, info, progressaoTrilhas)
          : descricao;

        poderes.push({
          key: `progressao_${keyBase}_${nivel}`,
          nome: `${dados.nome} · ${nivel}${dados.escala === 'NEX' ? '%' : 'º estágio'}`,
          descricao: descricaoFinal,
          tipo: 'Progressão',
          fonte: origem,
          nivel,
          escala: dados.escala || 'NEX',
          adquirido: nivel <= nexAtual,
        });
      });
  };

  adicionarProgressao(progressaoClasses?.[classeKey], 'Classe', classeKey);

  if (trilhaKey && trilhaKey !== 'nenhuma') {
    adicionarProgressao(progressaoTrilhas?.[trilhaKey], 'Trilha', trilhaKey, true);
  }

  return poderes;
}

function PoderesAprendidos({
  poderesAprendidos = [],
  info,
  progressaoClasses,
  progressaoTrilhas,
  onAbrirModal,
}) {
  const poderOrigem = useMemo(() => getPoderOrigem(info), [info]);
  const poderesProgressao = useMemo(
    () => getPoderesProgressao(info, progressaoClasses, progressaoTrilhas),
    [info, progressaoClasses, progressaoTrilhas],
  );

  const poderesAgrupados = {
    origem: poderOrigem ? [poderOrigem] : [],
    progressao: poderesProgressao,
    classe: [],
    geral: [],
    paranormal: [],
  };

  poderesAprendidos.forEach(poder => {
    if ((poder.tipo === 'Origem' || poder.isOrigemPower) && !poderesAgrupados.origem.some(item => item.key === poder.key)) {
      poderesAgrupados.origem.push(poder);
      return;
    }

    const baseKey = getBasePowerKey(poder.key);
    if (paranormalKeys.has(baseKey)) {
      poderesAgrupados.paranormal.push(poder);
    } else if (generalKeys.has(baseKey)) {
      poderesAgrupados.geral.push(poder);
    } else if (poder.tipo !== 'Origem' && !poder.isOrigemPower) {
      poderesAgrupados.classe.push(poder);
    }
  });

  const poderesAdquiridosProgressao = poderesProgressao.filter(poder => poder.adquirido !== false);
  const poderesFuturos = poderesProgressao.filter(poder => poder.adquirido === false);
  const chavesPoderesAtivos = new Set([
    ...poderesAprendidos
      .filter(poder => poder.tipo !== 'Origem' && !poder.isOrigemPower)
      .map(poder => poder.key),
    ...poderesAgrupados.origem.map(poder => `origem:${poder.nome}`),
    ...poderesAdquiridosProgressao.map(poder => poder.key),
  ]);
  const totalAtivo = chavesPoderesAtivos.size;

  const renderPoderesLista = (lista, corBorda = 'var(--conv-accent)', options = {}) => (
    <ul className="loja-lista-itens poderes-lista">
      {lista.length > 0 ? (
        lista.map(poder => {
          const baseKey = getBasePowerKey(poder.key);
          const isParanormalInGroup = paranormalKeys.has(baseKey);
          const accent = poder.elemento && isParanormalInGroup
            ? `var(--cor-trans-${poder.elemento.toLowerCase()})`
            : corBorda;

          return (
            <li
              key={poder.key}
              className={`item-card item-card--power poder-card ${options.progressao ? 'poder-progressao-card' : ''} ${poder.adquirido === false ? 'poder-futuro' : ''}`}
              style={{ '--power-accent': accent }}
            >
              <div className="item-header poder-card-header">
                <div className="item-title-stack">
                  <h3>{poder.nome}</h3>
                  <div className="item-status-list">
                    {poder.adquirido === false && <span className="item-status">Futuro</span>}
                    {poder.elemento && isParanormalInGroup && (
                      <span className="item-status">{poder.elemento}</span>
                    )}
                  </div>
                </div>
                <div className="item-header-info">
                  {poder.fonte && <div><strong>{poder.fonte}</strong></div>}
                  {poder.nivel && (
                    <div>
                      <strong>{poder.escala === 'NEX' ? 'NEX' : 'Estágio'}:</strong>{' '}
                      {poder.nivel}{poder.escala === 'NEX' ? '%' : ''}
                    </div>
                  )}
                </div>
              </div>
              <div className="item-body poder-card-body">
                <div className="item-descricao poder-descricao">{poder.descricao}</div>
                {poder.prerequisito && (
                  <div className="item-detalhe poder-prerequisito">
                    <strong>Pré-requisito:</strong> {poder.prerequisito}
                  </div>
                )}
              </div>
            </li>
          );
        })
      ) : (
        <li className="item-placeholder power-group-empty">Nenhum registro nesta categoria.</li>
      )}
    </ul>
  );

  const grupos = [
    { id: 'origem', title: 'Origem', kicker: 'FORMAÇÃO', items: poderesAgrupados.origem, accent: 'var(--cor-destaque-conhecimento)' },
    { id: 'progressao', title: 'Progressão', kicker: 'CLASSE E TRILHA', items: poderesAgrupados.progressao, accent: 'var(--conv-accent)', progressao: true, wide: true },
    { id: 'classe', title: 'Poderes de classe', kicker: 'ESPECIALIZAÇÃO', items: poderesAgrupados.classe },
    { id: 'geral', title: 'Poderes gerais', kicker: 'REPERTÓRIO', items: poderesAgrupados.geral },
    { id: 'paranormal', title: 'Poderes paranormais', kicker: 'EXPOSIÇÃO', items: poderesAgrupados.paranormal, wide: true },
  ];

  return (
    <FichaSectionFrame
      variant="powers"
      icon="powers"
      eyebrow="MATRIZ DE CAPACIDADES"
      title="Poderes"
      description="Origem, classe, trilha e manifestações paranormais organizadas por procedência."
      metrics={[
        { label: 'Ativos', value: totalAtivo },
        { label: 'Paranormais', value: poderesAgrupados.paranormal.length },
        { label: 'Próximos', value: poderesFuturos.length },
      ]}
      action={(
        <button type="button" className="ficha-section-action" onClick={onAbrirModal}>
          <AppIcon name="plus" size={18} />
          Gerenciar poderes
        </button>
      )}
      className="poderes-aprendidos-view"
    >
      <div className="powers-groups-grid" id="grid-poderes-aprendidos">
        {grupos.map(grupo => (
          <section key={grupo.id} className={`power-group-panel ${grupo.wide ? 'power-group-panel--wide' : ''}`}>
            <header className="ficha-record-heading">
              <div>
                <span className="ficha-record-kicker">{grupo.kicker}</span>
                <h2>{grupo.title}</h2>
              </div>
              <span className="ficha-record-count">{grupo.items.length.toString().padStart(2, '0')}</span>
            </header>
            {renderPoderesLista(grupo.items, grupo.accent, { progressao: grupo.progressao })}
          </section>
        ))}
      </div>
    </FichaSectionFrame>
  );
}

export default PoderesAprendidos;
