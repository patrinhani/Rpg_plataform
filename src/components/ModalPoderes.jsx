// src/components/ModalPoderes.jsx
// (ARQUIVO COMPLETO CORRIGIDO)

import React, { useEffect, useId, useState } from 'react';
import { 
    poderesCombatente, 
    poderesEspecialista, 
    poderesOcultista,
    poderesParanormais
} from '../lib/database.js';
import ModalBase from './ModalBase.jsx';
// A linha 'import { trilhas }' foi removida

// Cria conjuntos de chaves para lookup rápido para evitar confusão entre listas
const paranormalKeys = new Set(poderesParanormais.map(p => p.key));

/**
 * Modal para seleção e gerenciamento de Poderes de Classe, Gerais e Paranormais.
 * (Props permanecem as mesmas)
 */
function ModalPoderes({ 
    isOpen, 
    onClose, 
    classe, 
    poderesGerais,
    poderesParanormais,
    poderesAprendidos,
    onTogglePoder,
    onAbrirSelecaoPoder
}) {
    const [activeTab, setActiveTab] = useState('classe');
    const [poderesDeClasse, setPoderesDeClasse] = useState([]);
    const tabsId = useId();
    
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
            return (
                <ul className="loja-lista-itens" style={{ gridTemplateColumns: '1fr' }}>
                    <li className="item-placeholder">Nenhum poder disponível nesta categoria.</li>
                </ul>
            );
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
                                    type="button"
                                    className="loja-item-add"
                                    // --- INÍCIO DA CORREÇÃO DO BOTÃO ILEGÍVEL ---
                                    style={{ 
                                        backgroundColor: isAprendido ? 'var(--cor-trans-sangue)' : 'var(--cor-destaque)',
                                        color: isAprendido ? 'var(--cor-texto-principal)' : 'var(--cor-caixa-recurso)' 
                                    }}
                                    // --- FIM DA CORREÇÃO DO BOTÃO ILEGÍVEL ---
                                    onClick={handleToggle}
                                    aria-label={`${isAprendido ? 'Remover' : poder.requiresChoice ? 'Selecionar e adicionar' : 'Adicionar'} poder ${poder.nome}`}
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

    const tabs = [
        { id: 'classe', label: 'PODERES DE CLASSE', lista: poderesDeClasse },
        { id: 'geral', label: 'PODERES GERAIS', lista: poderesGerais },
        { id: 'paranormal', label: 'PODERES PARANORMAIS', lista: poderesParanormais },
    ];
    const handleTabKeyDown = (event, currentIndex) => {
        let nextIndex;

        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === undefined) return;

        event.preventDefault();
        const nextTab = tabs[nextIndex];
        setActiveTab(nextTab.id);
        window.requestAnimationFrame(() => document.getElementById(`${tabsId}-tab-${nextTab.id}`)?.focus());
    };

    return (
        <ModalBase
            isOpen={isOpen}
            onClose={onClose}
            title="Selecionar poderes"
            size="large"
            closeLabel="Fechar seleção de poderes"
        >
            <div className="modal-abas" role="tablist" aria-label="Categorias de poderes">
                {tabs.map((tab, index) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            id={`${tabsId}-tab-${tab.id}`}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`${tabsId}-panel-${tab.id}`}
                            tabIndex={isActive ? 0 : -1}
                            onClick={() => setActiveTab(tab.id)}
                            onKeyDown={(event) => handleTabKeyDown(event, index)}
                            className={`aba-link ${isActive ? 'active' : ''}`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <div
                        key={tab.id}
                        id={`${tabsId}-panel-${tab.id}`}
                        className={`aba-conteudo ${isActive ? 'active' : ''}`}
                        role="tabpanel"
                        aria-labelledby={`${tabsId}-tab-${tab.id}`}
                        hidden={!isActive}
                    >
                        {isActive && renderListaPoderes(tab.lista)}
                    </div>
                );
            })}
        </ModalBase>
    );
}

export default ModalPoderes;
