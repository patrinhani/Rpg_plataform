// /src/components/PoderesAprendidos.jsx

import React from 'react';

/**
 * Componente que lista os poderes aprendidos pelo personagem.
 * @param {object[]} poderesAprendidos - Array de poderes que o personagem possui.
 * @param {function} onAbrirModal - Função para abrir o modal de seleção de poderes (ModalPoderes).
 */
function PoderesAprendidos({ poderesAprendidos, onAbrirModal }) {
    
    return (
        <main className="ficha-container-inventario">
            <section className="box box-inventario" id="grid-poderes-aprendidos">
                
                <div className="inventario-header">
                    <h2>PODERES DE CLASSE</h2>
                    {/* Botão '+' para abrir o modal de seleção/adição */}
                    <button 
                        className="btn-add-item" 
                        onClick={onAbrirModal} // Chama a função do App.jsx
                        style={{ padding: '0 12px' }}
                    >
                        +
                    </button>
                </div>
                
                <ul id="lista-poderes-pessoais" className="loja-lista-itens" style={{ gridTemplateColumns: '1fr' }}>
                    {poderesAprendidos && poderesAprendidos.length > 0 ? (
                        // Mapeia e exibe os poderes (usando um layout de lista simples)
                        poderesAprendidos.map((poder) => (
                            <li 
                                key={poder.key} 
                                className="item-card"
                                style={{
                                    borderLeft: '4px solid var(--cor-destaque)',
                                    marginBottom: '10px'
                                }}
                            >
                                <div className="item-header" style={{ borderBottom: 'none' }}>
                                    <h3 style={{ fontSize: '1.2em' }}>{poder.nome}</h3>
                                    <div className="item-header-info">
                                        {poder.tipo && <div><strong>Tipo:</strong> {poder.tipo}</div>}
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
                        ))
                    ) : (
                        // Mensagem de fallback
                        <li className="item-placeholder">Nenhum poder de classe selecionado. Clique no '+' para adicionar.</li>
                    )}
                </ul>

            </section>
        </main>
    );
}

export default PoderesAprendidos;