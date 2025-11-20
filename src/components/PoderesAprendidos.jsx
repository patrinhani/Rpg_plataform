// src/components/PoderesAprendidos.jsx
// (ATUALIZADO: Seção separada para Poderes de Origem)

import React from 'react';
import { 
    poderesGerais, 
    poderesParanormais,
} from '../lib/poderes.js'; 

const generalKeys = new Set(poderesGerais.map(p => p.key));
const paranormalKeys = new Set(poderesParanormais.map(p => p.key));

function PoderesAprendidos({ poderesAprendidos, onAbrirModal }) {
    
    const poderesAgrupados = {
        origem: [], // <--- NOVO GRUPO
        classe: [],
        geral: [],
        paranormal: [],
    };

    if (poderesAprendidos && poderesAprendidos.length > 0) {
        poderesAprendidos.forEach(poder => {
            if (poder.tipo === 'Origem' || poder.isOrigemPower) {
                poderesAgrupados.origem.push(poder);
            }
            else if (paranormalKeys.has(poder.key)) {
                poderesAgrupados.paranormal.push(poder);
            } 
            else if (generalKeys.has(poder.key)) {
                poderesAgrupados.geral.push(poder);
            } 
            else {
                poderesAgrupados.classe.push(poder);
            }
        });
    }

    const renderPoderesLista = (lista, corBorda = 'var(--cor-destaque)') => (
        <ul className="loja-lista-itens" style={{ gridTemplateColumns: '1fr' }}>
            {lista.length > 0 ? (
                lista.map((poder) => {
                    const isParanormalInGroup = paranormalKeys.has(poder.key);
                    const borderColor = poder.elemento && isParanormalInGroup
                        ? `4px solid var(--cor-trans-${poder.elemento.toLowerCase()})`
                        : `4px solid ${corBorda}`;
                    
                    return (
                        <li 
                            key={poder.key} 
                            className="item-card"
                            style={{
                                borderLeft: borderColor,
                                marginBottom: '10px',
                                opacity: 1,
                            }}
                        >
                            <div className="item-header" style={{ borderBottom: 'none' }}>
                                <h3 style={{ fontSize: '1.2em' }}>{poder.nome}</h3>
                                <div className="item-header-info">
                                    {poder.tipo && <div><strong>Tipo:</strong> {poder.tipo}</div>}
                                    {poder.elemento && isParanormalInGroup && <div><strong>Elemento:</strong> {poder.elemento}</div>}
                                </div>
                            </div>
                            <div className="item-body" style={{ paddingTop: '5px' }}>
                                <div className="item-descricao" style={{ borderTop: 'none', fontStyle: 'normal', color: 'var(--cor-texto-principal)' }}>
                                    {poder.descricao}
                                </div>
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
        <main className="ficha-container-inventario">
            <section className="box box-inventario" id="grid-poderes-aprendidos">
                
                <div className="inventario-header">
                    <h2>PODERES APRENDIDOS</h2>
                    <button 
                        className="btn-add-item" 
                        onClick={onAbrirModal}
                        style={{ padding: '0 12px' }}
                    >
                        +
                    </button>
                </div>
                
                {/* --- PODER DE ORIGEM (NOVO) --- */}
                <h3 style={{ color: 'var(--cor-destaque-conhecimento)', borderBottom: '1px solid var(--cor-destaque-conhecimento)', marginBottom: '10px', marginTop: '0px', paddingBottom: '5px' }}>
                    ORIGEM
                </h3>
                {renderPoderesLista(poderesAgrupados.origem, 'var(--cor-destaque-conhecimento)')}

                <h3 style={{ color: 'var(--cor-destaque)', borderBottom: '1px solid var(--cor-destaque)', marginBottom: '10px', marginTop: '20px', paddingBottom: '5px' }}>
                    PODERES DE CLASSE
                </h3>
                {renderPoderesLista(poderesAgrupados.classe)}
                
                <h3 style={{ color: 'var(--cor-destaque)', borderBottom: '1px solid var(--cor-destaque)', marginBottom: '10px', marginTop: '20px', paddingBottom: '5px' }}>
                    PODERES GERAIS
                </h3>
                {renderPoderesLista(poderesAgrupados.geral)}

                <h3 style={{ color: 'var(--cor-destaque)', borderBottom: '1px solid var(--cor-destaque)', marginBottom: '10px', marginTop: '20px', paddingBottom: '5px' }}>
                    PODERES PARANORMAIS
                </h3>
                {renderPoderesLista(poderesAgrupados.paranormal)}

                {poderesAprendidos.length === 0 && (
                    <p className="item-placeholder">Nenhum poder adicionado. Clique no '+' para adicionar.</p>
                )}

            </section>
        </main>
    );
}

export default PoderesAprendidos;