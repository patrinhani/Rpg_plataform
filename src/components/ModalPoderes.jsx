// src/components/ModalPoderes.jsx

import React, { useState, useEffect } from 'react';
import { 
    poderesCombatente, 
    poderesEspecialista, 
    poderesOcultista,
    poderesGerais, 
    poderesParanormais // Importa a lista Paranormal
} from '../lib/database.js'; // Ajuste o caminho de importação conforme sua estrutura
import { trilhas } from '../lib/trilhas.js'; // Assumindo importação

// Cria conjuntos de chaves para lookup rápido para evitar confusão entre listas
const generalKeys = new Set(poderesGerais.map(p => p.key));
const paranormalKeys = new Set(poderesParanormais.map(p => p.key));

/**
 * Modal para seleção e gerenciamento de Poderes de Classe, Gerais e Paranormais.
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {function} props.onClose
 * @param {string} props.classe - Classe do personagem.
 * @param {object[]} props.poderesDisponiveis - Lista de poderes de classe disponíveis (pode ser ignorada dependendo de como você usa).
 * @param {object[]} props.poderesGerais - Lista de todos os poderes gerais.
 * @param {object[]} props.poderesParanormais - Lista de todos os poderes paranormais.
 * @param {object[]} props.poderesAprendidos - Lista de poderes que o personagem possui.
 * @param {function} props.onTogglePoder - Função para adicionar/remover um poder.
 * @param {function} props.onAbrirSelecaoPoder - Função para abrir a modal de seleção (para poderes com escolha).
 */
function ModalPoderes({ 
    isOpen, 
    onClose, 
    classe, 
    poderesDisponiveis, // Pode não ser usado se a filtragem for feita localmente
    poderesGerais,
    poderesParanormais,
    poderesAprendidos,
    onTogglePoder,
    onAbrirSelecaoPoder // NOVO: Recebe a nova prop
}) {
    const [activeTab, setActiveTab] = useState('classe'); // 'classe', 'geral', 'paranormal'
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
    }, [classe]);

    if (!isOpen) return null;

    // Função helper para renderizar uma lista de poderes (cards)
    const renderListaPoderes = (lista) => {
        return (
            <ul className="loja-lista-itens" style={{ gridTemplateColumns: '1fr' }}>
                {lista && lista.length > 0 ? (
                    lista.map((poder) => {
                        
                        // Determina a chave de pesquisa. Se o poder requer escolha,
                        // ele será salvo na ficha com _[elemento], então usamos a chave base.
                        const poderKeyOriginal = poder.key;
                        
                        // Verifica se o poder ou uma versão dele já foi aprendido
                        const isAprendido = poderesAprendidos.some(p => p.key === poderKeyOriginal || p.key.startsWith(`${poderKeyOriginal}_`));
                        
                        // Se o poder tem `requiresChoice` e já está aprendido, exibimos a versão base
                        // mas o botão deve remover todas as versões (tratado em App.jsx)
                        // Para o display, usamos a info do poder base.
                        
                        const isParanormalInList = paranormalKeys.has(poder.key);
                        const isGeneralInList = generalKeys.has(poder.key);
                        
                        // Determina a cor da borda (se for Paranormal, usa o elemento)
                        const borderColor = poder.elemento && isParanormalInList
                            ? `4px solid var(--cor-trans-${poder.elemento.toLowerCase()})`
                            : `4px solid var(--cor-destaque)`;
                        
                        const handleToggle = () => {
                            if (isAprendido) {
                                // Se já foi aprendido e é um poder com escolha, precisamos do key da versão aprendida.
                                // Se o poder for Resistir a Elemento, podemos ter 4 versões diferentes aprendidas.
                                // A remoção é tratada no App.jsx, aqui passamos a chave original ou a chave aprendida
                                // (se estivermos renderizando um item aprendido na lista de poderes aprendidos - não é o caso aqui).
                                
                                // Aqui, como estamos na modal de seleção, passamos o poder BASE para o toggle,
                                // e o toggle no App.jsx se encarregará de remover todas as versões que começam com essa key.
                                onTogglePoder(poder); 
                            } else {
                                // Se NÃO aprendido, verifica se precisa de seleção
                                if (poder.requiresChoice) {
                                    onAbrirSelecaoPoder(poder); // CHAMA A FUNÇÃO DE SELEÇÃO
                                } else {
                                    onTogglePoder(poder); // Adição padrão
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
                                        style={{ backgroundColor: isAprendido ? 'var(--cor-critico)' : 'var(--cor-destaque)' }}
                                        onClick={handleToggle}
                                    >
                                        {isAprendido ? 'Remover Poder' : (poder.requiresChoice ? 'Selecionar e Adicionar' : 'Adicionar Poder')}
                                    </button>
                                </div>
                            </li>
                        );
                    })
                ) : (
                    <li className="item-placeholder">Nenhum poder disponível nesta categoria.</li>
                )}
            </ul>
        );
    };

    return (
        <div className={`modal ${isOpen ? 'open' : ''}`}>
            <div className="modal-content-grande">
                <div className="modal-header">
                    <h2>SELECIONAR PODERES</h2>
                    <button className="btn-fechar" onClick={onClose}>&times;</button>
                </div>

                <div className="modal-body">
                    <div className="modal-tabs">
                        <button onClick={() => setActiveTab('classe')} className={activeTab === 'classe' ? 'active' : ''}>
                            PODERES DE CLASSE
                        </button>
                        <button onClick={() => setActiveTab('geral')} className={activeTab === 'geral' ? 'active' : ''}>
                            PODERES GERAIS
                        </button>
                        <button onClick={() => setActiveTab('paranormal')} className={activeTab === 'paranormal' ? 'active' : ''}>
                            PODERES PARANORMAIS
                        </button>
                    </div>

                    <div className="modal-tab-content">
                        {activeTab === 'classe' && renderListaPoderes(poderesDeClasse)}
                        {activeTab === 'geral' && renderListaPoderes(poderesGerais)}
                        {activeTab === 'paranormal' && renderListaPoderes(poderesParanormais)}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ModalPoderes;