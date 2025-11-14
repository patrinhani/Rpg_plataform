// /src/components/PoderesAprendidos.jsx

import React from 'react';
// 1. Importa todas as listas para fazer a checagem de origem
import { 
    poderesGerais, 
    poderesParanormais,
} from '../lib/poderes.js'; 

// Cria conjuntos de chaves para lookup rápido fora do componente
const generalKeys = new Set(poderesGerais.map(p => p.key));
const paranormalKeys = new Set(poderesParanormais.map(p => p.key));

/**
 * Componente que lista os poderes aprendidos pelo personagem.
 * @param {object[]} poderesAprendidos - Array de poderes que o personagem possui.
 * @param {function} onAbrirModal - Função para abrir o modal de seleção de poderes (ModalPoderes).
 */
function PoderesAprendidos({ poderesAprendidos, onAbrirModal }) {
    
    // --- Lógica de Agrupamento Corrigida ---
    const poderesAgrupados = {
        classe: [],
        geral: [],
        paranormal: [],
    };

    if (poderesAprendidos && poderesAprendidos.length > 0) {
        poderesAprendidos.forEach(poder => {
            // Prioridade 1: Paranormal (se a chave estiver na lista explícita de Poderes Paranormais)
            if (paranormalKeys.has(poder.key)) {
                poderesAgrupados.paranormal.push(poder);
            } 
            // Prioridade 2: Geral (se a chave estiver na lista de Poderes Gerais)
            else if (generalKeys.has(poder.key)) {
                poderesAgrupados.geral.push(poder);
            } 
            // Prioridade 3: Classe (o que sobrar, são poderes de Classe)
            else {
                poderesAgrupados.classe.push(poder);
            }
        });
    }

    // Função para renderizar um grupo de poderes
    const renderPoderesLista = (lista) => (
        <ul className="loja-lista-itens" style={{ gridTemplateColumns: '1fr' }}>
            {lista.length > 0 ? (
                lista.map((poder) => {
                    
                    // 2. CORREÇÃO: Variáveis definidas fora do objeto style
                    const isParanormalInGroup = paranormalKeys.has(poder.key);
                    const borderColor = poder.elemento && isParanormalInGroup
                        ? `4px solid var(--cor-trans-${poder.elemento.toLowerCase()})`
                        : `4px solid var(--cor-destaque)`;
                    
                    return (
                        <li 
                            key={poder.key} 
                            className="item-card"
                            style={{
                                // 3. Uso das variáveis corrigidas:
                                borderLeft: borderColor,
                                marginBottom: '10px',
                                opacity: 1,
                            }}
                        >
                            <div className="item-header" style={{ borderBottom: 'none' }}>
                                <h3 style={{ fontSize: '1.2em' }}>{poder.nome}</h3>
                                <div className="item-header-info">
                                    {poder.tipo && <div><strong>Tipo:</strong> {poder.tipo}</div>}
                                    {/* Exibe o elemento se for um poder Paranormal */}
                                    {poder.elemento && isParanormalInGroup && <div><strong>Elemento:</strong> {poder.elemento}</div>}
                                </div>
                            </div>
                            <div className="item-body" style={{ paddingTop: '5px' }}>
                                <div className="item-descricao" style={{ borderTop: 'none', fontStyle: 'normal', color: 'var(--cor-texto-principal)' }}>
                                    {poder.descricao}
                                </div>
                                {poder.prerequisito && 
                                    <div className="item-detalhe" style={{fontSize: '0.9em', color: 'var(--cor-texto-label)', marginTop: '5px'}}>
                                        <strong>Pré-Requisito:</strong> {poder.prerequisito}
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
                
                {/* --- PODERES DE CLASSE --- */}
                <h3 style={{ color: 'var(--cor-destaque)', borderBottom: '1px solid var(--cor-destaque)', marginBottom: '10px', marginTop: '20px', paddingBottom: '5px' }}>
                    PODERES DE CLASSE
                </h3>
                {renderPoderesLista(poderesAgrupados.classe)}
                
                {/* --- PODERES GERAIS --- */}
                <h3 style={{ color: 'var(--cor-destaque)', borderBottom: '1px solid var(--cor-destaque)', marginBottom: '10px', marginTop: '20px', paddingBottom: '5px' }}>
                    PODERES GERAIS
                </h3>
                {renderPoderesLista(poderesAgrupados.geral)}

                {/* --- PODERES PARANORMAIS --- */}
                <h3 style={{ color: 'var(--cor-destaque)', borderBottom: '1px solid var(--cor-destaque)', marginBottom: '10px', marginTop: '20px', paddingBottom: '5px' }}>
                    PODERES PARANORMAIS
                </h3>
                {renderPoderesLista(poderesAgrupados.paranormal)}

                {/* Mensagem de fallback geral se não houver NENHUM poder */}
                {poderesAprendidos.length === 0 && (
                    <p className="item-placeholder">Nenhum poder adicionado. Clique no '+' para adicionar.</p>
                )}

            </section>
        </main>
    );
}

export default PoderesAprendidos;