// src/components/PoderesAprendidos.jsx
import React, { useMemo } from 'react';
import {
    database,
    OpcoesOrigem,
    poderesGerais,
    poderesParanormais,
} from '../lib/database.js';

const generalKeys = new Set(poderesGerais.map(p => p.key));
const paranormalKeys = new Set(poderesParanormais.map(p => p.key));

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
    const nexAtual = parseInt(String(info?.nex || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const classeKey = String(info?.classe || '').toLowerCase();
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
                    nome: `${dados.nome} - ${nivel}%`,
                    descricao: descricaoFinal,
                    tipo: 'Progressao',
                    fonte: origem,
                    nivel,
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
    onAbrirModal
}) {
    const poderOrigem = useMemo(() => getPoderOrigem(info), [info]);
    const poderesProgressao = useMemo(
        () => getPoderesProgressao(info, progressaoClasses, progressaoTrilhas),
        [info, progressaoClasses, progressaoTrilhas]
    );

    const poderesAgrupados = {
        origem: [],
        progressao: poderesProgressao,
        classe: [],
        geral: [],
        paranormal: [],
    };

    if (poderOrigem) {
        poderesAgrupados.origem.push(poderOrigem);
    }

    poderesAprendidos.forEach(poder => {
        if ((poder.tipo === 'Origem' || poder.isOrigemPower) && !poderesAgrupados.origem.some(p => p.key === poder.key)) {
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

    const renderPoderesLista = (lista, corBorda = 'var(--cor-destaque)', options = {}) => (
        <ul className="loja-lista-itens poderes-lista">
            {lista.length > 0 ? (
                lista.map((poder) => {
                    const baseKey = getBasePowerKey(poder.key);
                    const isParanormalInGroup = paranormalKeys.has(baseKey);
                    const borderColor = poder.elemento && isParanormalInGroup
                        ? `4px solid var(--cor-trans-${poder.elemento.toLowerCase()})`
                        : `4px solid ${corBorda}`;

                    return (
                        <li
                            key={poder.key}
                            className={`item-card poder-card ${options.progressao ? 'poder-progressao-card' : ''} ${poder.adquirido === false ? 'poder-futuro' : ''}`}
                            style={{
                                borderLeft: borderColor,
                                marginBottom: '10px',
                                opacity: poder.adquirido === false ? 0.65 : 1,
                            }}
                        >
                            <div className="item-header poder-card-header">
                                <h3>{poder.nome}</h3>
                                <div className="item-header-info">
                                    {poder.tipo && <div><strong>Tipo:</strong> {poder.tipo}</div>}
                                    {poder.fonte && <div><strong>Fonte:</strong> {poder.fonte}</div>}
                                    {poder.nivel && <div><strong>NEX:</strong> {poder.nivel}% {poder.adquirido ? '(obtido)' : '(futuro)'}</div>}
                                    {poder.elemento && isParanormalInGroup && <div><strong>Elemento:</strong> {poder.elemento}</div>}
                                </div>
                            </div>
                            <div className="item-body poder-card-body">
                                <div className="item-descricao poder-descricao">
                                    {poder.descricao}
                                </div>
                                {poder.prerequisito &&
                                    <div className="item-detalhe poder-prerequisito">
                                        <strong>Pre-requisito:</strong> {poder.prerequisito}
                                    </div>
                                }
                            </div>
                        </li>
                    );
                })
            ) : (
                <li className="item-placeholder">Nenhum poder nesta categoria.</li>
            )}
        </ul>
    );

    return (
        <main className="ficha-container-inventario poderes-aprendidos-view">
            <section className="box box-inventario poderes-aprendidos-box" id="grid-poderes-aprendidos">
                <div className="inventario-header">
                    <h2>PODERES</h2>
                    <button
                        className="btn-add-item"
                        onClick={onAbrirModal}
                        style={{ padding: '0 12px' }}
                    >
                        +
                    </button>
                </div>

                <h3 className="poderes-section-title poderes-section-origem">
                    ORIGEM
                </h3>
                {renderPoderesLista(poderesAgrupados.origem, 'var(--cor-destaque-conhecimento)')}

                <h3 className="poderes-section-title">
                    PROGRESSAO
                </h3>
                {renderPoderesLista(poderesAgrupados.progressao, 'var(--cor-destaque)', { progressao: true })}

                <h3 className="poderes-section-title">
                    PODERES DE CLASSE
                </h3>
                {renderPoderesLista(poderesAgrupados.classe)}

                <h3 className="poderes-section-title">
                    PODERES GERAIS
                </h3>
                {renderPoderesLista(poderesAgrupados.geral)}

                <h3 className="poderes-section-title">
                    PODERES PARANORMAIS
                </h3>
                {renderPoderesLista(poderesAgrupados.paranormal)}
            </section>
        </main>
    );
}

export default PoderesAprendidos;
