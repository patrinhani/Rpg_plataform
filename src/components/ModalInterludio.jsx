// src/components/ModalInterludio.jsx
import React, { useState } from 'react';
import { database } from '../lib/database.js';

function ModalInterludio({ isOpen, onClose, onAplicar, limitePE }) {
  const [acoesSelecionadas, setAcoesSelecionadas] = useState([]);
  const [conforto, setConforto] = useState('normal');
  const [prato, setPrato] = useState('simples');
  const [emGrupo, setEmGrupo] = useState(false);

  if (!isOpen) return null;

  const toggleAcao = (acao) => {
    if (acoesSelecionadas.includes(acao)) {
      setAcoesSelecionadas(acoesSelecionadas.filter(a => a !== acao));
    } else {
      if (acoesSelecionadas.length < 2) {
        setAcoesSelecionadas([...acoesSelecionadas, acao]);
      } else {
        alert("Você só pode realizar até 2 ações por Interlúdio.");
      }
    }
  };

  const handleAplicar = () => {
    onAplicar({
        acoes: acoesSelecionadas,
        conforto,
        prato,
        emGrupo
    });
    onClose();
  };

  // Lista completa de ações baseada no seu arquivo interludio.txt
  const listaAcoes = [
      { id: 'dormir', icone: '💤', nome: 'Dormir', desc: 'Recupera PV e PE (baseado no conforto).' },
      { id: 'relaxar', icone: '🧘', nome: 'Relaxar', desc: 'Recupera Sanidade (como Dormir).' },
      { id: 'alimentar', icone: '🍖', nome: 'Alimentar-se', desc: 'Bônus especiais de prato.' },
      { id: 'exercitar', icone: '🏋️', nome: 'Exercitar-se', desc: '+1d6 em teste Físico futuro.' },
      { id: 'ler', icone: '📚', nome: 'Ler', desc: '+1d6 em teste Mental futuro.' },
      { id: 'manutencao', icone: '🔧', nome: 'Manutenção', desc: 'Repara itens quebrados.' },
      { id: 'revisar', icone: '🔍', nome: 'Revisar Caso', desc: 'Teste para achar pistas perdidas.' },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '700px', width: '95%' }}>
        <div className="modal-header">
            <h2>Cena de Interlúdio</h2>
            <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
            <p style={{ color: '#aaa', fontSize: '0.9em', marginBottom: '15px' }}>
                Escolha até <strong>2 ações</strong>. Recuperação base: <strong>{limitePE}</strong> (Limite de PE).
            </p>

            <div className="interludio-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                gap: '10px', 
                marginBottom: '20px' 
            }}>
                {listaAcoes.map((acao) => (
                    <div 
                        key={acao.id}
                        className={`item-card ${acoesSelecionadas.includes(acao.id) ? 'selecionado' : ''}`}
                        onClick={() => toggleAcao(acao.id)}
                        style={{ 
                            cursor: 'pointer', 
                            border: acoesSelecionadas.includes(acao.id) ? '2px solid var(--cor-destaque)' : '1px solid var(--cor-borda)', 
                            padding: '10px',
                            backgroundColor: acoesSelecionadas.includes(acao.id) ? 'rgba(255, 255, 255, 0.1)' : 'transparent'
                        }}
                    >
                        <h3 style={{margin: '0 0 5px 0', fontSize: '1.1em'}}>{acao.icone} {acao.nome}</h3>
                        <small style={{lineHeight: '1.2', display: 'block', color: '#ccc'}}>{acao.desc}</small>
                    </div>
                ))}
            </div>

            {/* ÁREA DE CONFIGURAÇÃO DAS AÇÕES ESCOLHIDAS */}
            {(acoesSelecionadas.length > 0) && (
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid var(--cor-borda)' }}>
                    <h4 style={{marginTop: 0, marginBottom: '10px', color: 'var(--cor-destaque)'}}>Detalhes das Ações</h4>
                    
                    {/* Opções de Conforto (Aparece se Dormir ou Relaxar estiverem selecionados) */}
                    {(acoesSelecionadas.includes('dormir') || acoesSelecionadas.includes('relaxar')) && (
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{display: 'block', marginBottom: '5px'}}>Nível de Conforto:</label>
                            <select className="modal-input" value={conforto} onChange={(e) => setConforto(e.target.value)} style={{width: '100%'}}>
                                {database.interludio.conforto.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                ))}
                            </select>
                            <small style={{ color: '#888', display: 'block', marginTop: '3px' }}>
                                {database.interludio.conforto.find(c => c.id === conforto)?.descricao}
                            </small>
                        </div>
                    )}

                    {/* Opção de Grupo (Aparece se Relaxar estiver selecionado) */}
                    {acoesSelecionadas.includes('relaxar') && (
                        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="checkbox" id="chkGrupo" checked={emGrupo} onChange={(e) => setEmGrupo(e.target.checked)} style={{width: '20px', height: '20px'}} />
                            <label htmlFor="chkGrupo" style={{cursor: 'pointer'}}>Relaxar com o grupo? (+1 SAN)</label>
                        </div>
                    )}

                    {/* Opção de Prato (Aparece se Alimentar-se estiver selecionado) */}
                    {acoesSelecionadas.includes('alimentar') && (
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{display: 'block', marginBottom: '5px'}}>Prato Escolhido:</label>
                            <select className="modal-input" value={prato} onChange={(e) => setPrato(e.target.value)} style={{width: '100%'}}>
                                {database.interludio.pratos.map(p => (
                                    <option key={p.id} value={p.id}>{p.nome}</option>
                                ))}
                            </select>
                            <small style={{ color: '#888', display: 'block', marginTop: '3px' }}>
                                {database.interludio.pratos.find(p => p.id === prato)?.descricao}
                            </small>
                        </div>
                    )}

                    {/* Mensagens Informativas para outras ações */}
                    {acoesSelecionadas.includes('exercitar') && (
                        <p style={{fontSize: '0.9em', color: '#aaa'}}>💪 <strong>Exercitar-se:</strong> Anote que você tem +1d6 para um teste de AGI, FOR ou VIG.</p>
                    )}
                    {acoesSelecionadas.includes('ler') && (
                        <p style={{fontSize: '0.9em', color: '#aaa'}}>📚 <strong>Ler:</strong> Anote que você tem +1d6 para um teste de INT ou PRE.</p>
                    )}
                     {acoesSelecionadas.includes('revisar') && (
                        <p style={{fontSize: '0.9em', color: '#aaa'}}>🔍 <strong>Revisar Caso:</strong> Faça um teste de perícia com o Mestre para achar pistas.</p>
                    )}
                </div>
            )}
        </div>

        <div className="modal-actions" style={{ marginTop: '10px', padding: '0 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button className="btn-confirm" onClick={handleAplicar} disabled={acoesSelecionadas.length === 0}>
                Concluir Interlúdio
            </button>
        </div>
      </div>
    </div>
  );
}

export default ModalInterludio;