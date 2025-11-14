// src/components/ModalPoderes.jsx
// (ARQUIVO COMPLETO CORRIGIDO)

import React, { useState, useEffect } from 'react';
import { 
    poderesCombatente, 
    poderesEspecialista, 
    poderesOcultista,
    poderesGerais, 
    poderesParanormais
} from '../lib/database.js';
// A linha 'import { trilhas }' foi removida

// Cria conjuntos de chaves para lookup rápido para evitar confusão entre listas
const generalKeys = new Set(poderesGerais.map(p => p.key));
const paranormalKeys = new Set(poderesParanormais.map(p => p.key));

/**
 * Modal para seleção e gerenciamento de Poderes de Classe, Gerais e Paranormais.
 * (Props permanecem as mesmas)
 */
function ModalPoderes({ 
    isOpen, 
    onClose, 
    classe, 
    poderesDisponiveis,
    poderesGerais,
    poderesParanormais,
    poderesAprendidos,
    onTogglePoder,
    onAbrirSelecaoPoder
}) {
    const [activeTab, setActiveTab] = useState('classe');
    const [poderesDeClasse, setPoderesDeClasse] = useState([]);
    
    // Função para obter os poderes de classe com base na classe do personagem
    useEffect(() => {
        let lista = [];
        switch (classe.toLowerCase()) {
            case 'combatente':
                lista = poderesCombatente;
                break;
            case 'especialista':
                lista = poderesEspecialista;
                break;
            case 'ocultista':
                lista = poderesOcultista;
                break;
            default:
                lista = [];
        }
        setPoderesDeClasse(lista);
    }, [classe, isOpen]); // Adicionado isOpen para reavaliar quando abrir

    if (!isOpen) return null;

    // Função helper para renderizar uma lista de poderes (cards)
    const renderListaPoderes = (lista) => {
        // CORREÇÃO: Verifica se a lista não é undefined antes de tentar usar .length
        if (!lista || lista.length === 0) {
            return <li className="item-placeholder">Nenhum poder disponível nesta categoria.</li>;
        }

        return (
            <ul className="loja-lista-itens" style={{ gridTemplateColumns: '1fr' }}>
                {lista.map((poder) => {
                    
                    const poderKeyOriginal = poder.key;
                    const isAprendido = poderesAprendidos.some(p => p.key === poderKeyOriginal || p.key.startsWith(`${poderKeyOriginal}_`));
                    const isParanormalInList = paranormalKeys.has(poder.key);
                    
                    const borderColor = poder.elemento && isParanormalInList
                        ? `4px solid var(--cor-trans-${poder.elemento.toLowerCase()})`
                        : `4px solid var(--cor-destaque)`;
                    
                    const handleToggle = () => {
                        if (isAprendido) {
                            onTogglePoder(poder); 
                        } else {
                            if (poder.requiresChoice) {
                                onAbrirSelecaoPoder(poder);
                            } else {
                                onTogglePoder(poder);
                            }
                        }
                    };
                    
                    return (
                        <li 
                            key={poder.key} 
                            className="item-card"
                            style={{
                                borderLeft: borderColor,
                                marginBottom: '10px',
                                opacity: isAprendido ? 1 : 0.8,
                            }}
                        >
                            <div className="item-header" style={{ borderBottom: 'none' }}>
                                <h3 style={{ fontSize: '1.2em' }}>{poder.nome}</h3>
                                <div className="item-header-info">
                                    {poder.tipo && <div><strong>Tipo:</strong> {poder.tipo}</div>}
                                    {poder.elemento && isParanormalInList && <div><strong>Elemento:</strong> {poder.elemento}</div>}
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
                            <div className="item-footer">
                                <button 
                                    className="loja-item-add"
                                    // --- INÍCIO DA CORREÇÃO DO BOTÃO ILEGÍVEL ---
                                    style={{ 
                                        backgroundColor: isAprendido ? 'var(--cor-trans-sangue)' : 'var(--cor-destaque)',
                                        color: isAprendido ? 'var(--cor-texto-principal)' : 'var(--cor-caixa-recurso)' 
                                    }}
                                    // --- FIM DA CORREÇÃO DO BOTÃO ILEGÍVEL ---
                                    onClick={handleToggle}
                                >
                                    {isAprendido ? 'Remover Poder' : (poder.requiresChoice ? 'Selecionar e Adicionar' : 'Adicionar Poder')}
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    // --- INÍCIO DAS CORREÇÕES DE LAYOUT ---

    // 1. Adiciona o handler de clique no overlay
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // 2. Corrige o JSX do 'return' para usar as classes corretas do style.css
    return (
        <div className="modal-overlay" onClick={handleOverlayClick}> {/* Classe CSS corrigida */}
            <div className="modal-conteudo modal-grande"> {/* Classe CSS corrigida */}
                <div className="modal-header">
                    <h2>SELECIONAR PODERES</h2>
                    <button className="btn-fechar-modal" onClick={onClose}>X</button> {/* Classe CSS corrigida */}
                </div>

                <div className="modal-body">
                    <div className="modal-abas"> {/* Classe CSS corrigida */}
                        <button onClick={() => setActiveTab('classe')} className={`aba-link ${activeTab === 'classe' ? 'active' : ''}`}>
                            PODERES DE CLASSE
                        </button>
                        <button onClick={() => setActiveTab('geral')} className={`aba-link ${activeTab === 'geral' ? 'active' : ''}`}>
                            PODERES GERAIS
                        </button>
                        <button onClick={() => setActiveTab('paranormal')} className={`aba-link ${activeTab === 'paranormal' ? 'active' : ''}`}>
                            PODERES PARANORMAIS
                        </button>
                    </div>

                    {/* Conteúdo das abas é renderizado dentro de um 'aba-conteudo' */}
                    <div className="aba-conteudo active"> {/* Classe CSS corrigida */}
                        {activeTab === 'classe' && renderListaPoderes(poderesDeClasse)}
                        {activeTab === 'geral' && renderListaPoderes(poderesGerais)}
                        {activeTab === 'paranormal' && renderListaPoderes(poderesParanormais)}
                    </div>
                </div>
            </div>
        </div>
    );
    // --- FIM DAS CORREÇÕES DE LAYOUT ---
}

export default ModalPoderes;