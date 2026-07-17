// src/components/ModalInterludio.jsx
import React, { useId, useState } from 'react';
import { database } from '../lib/database.js';
import ModalBase from './ModalBase.jsx';

function ModalInterludio({ isOpen, onClose, onAplicar, limitePE, origem, inventario = [] }) {
  const [acoesSelecionadas, setAcoesSelecionadas] = useState([]);
  const [conforto, setConforto] = useState('normal');
  const [prato, setPrato] = useState('simples');
  const [participantesRelaxando, setParticipantesRelaxando] = useState(1);
  const [itemManutencaoId, setItemManutencaoId] = useState('');
  const descricaoId = useId();
  const confortoId = useId();
  const pratoId = useId();
  
  if (!isOpen) return null;

  const toggleAcao = (acao) => {
    setAcoesSelecionadas((atuais) => {
      const quantidade = atuais.filter((item) => item === acao).length;
      if (acao === 'revisar') {
        return quantidade >= 2 ? atuais.filter((item) => item !== acao) : [...atuais, acao];
      }
      return quantidade > 0 ? atuais.filter((item) => item !== acao) : [...atuais, acao];
    });
  };

  const handleAplicar = () => {
    onAplicar({
        acoes: acoesSelecionadas,
        conforto,
        prato,
        participantesRelaxando,
        itemManutencaoId,
    });
    onClose();
  };

  const listaAcoes = [
      { id: 'dormir', icone: '💤', nome: 'Dormir', desc: 'Recupera PV e PE (baseado no conforto).' },
      { id: 'relaxar', icone: '🧘', nome: 'Relaxar', desc: 'Recupera Sanidade (como Dormir).' },
      { id: 'alimentar', icone: '🍖', nome: 'Alimentar-se', desc: 'Bônus especiais de prato.' },
      { id: 'exercitar', icone: '🏋️', nome: 'Exercitar-se', desc: '+1d6 em teste Físico futuro.' },
      { id: 'ler', icone: '📚', nome: 'Ler', desc: '+1d6 em teste Mental futuro.' },
      { id: 'manutencao', icone: '🔧', nome: 'Manutenção', desc: 'Repara um item quebrado.' },
      { id: 'revisar', icone: '🔍', nome: 'Revisar Caso', desc: 'Teste para achar pistas perdidas.' },
  ];
  const itensQuebrados = inventario.filter(item => item.quebrado);
  const sonoPrecarioNormal = ['explorador', 'mateiro'].includes(origem);
  const bonusLeitura = origem === 'nerd_entusiasta' ? '+2d6' : '+1d6';

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title="Cena de Interlúdio"
      size="large"
      closeLabel="Fechar interlúdio"
      closeOnOverlay={false}
      describedBy={descricaoId}
      footer={(
        <>
          <button
            type="button"
            className="caos-modal__button caos-modal__button--secondary"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="caos-modal__button caos-modal__button--primary"
            onClick={handleAplicar}
            disabled={acoesSelecionadas.length === 0}
          >
            Concluir Interlúdio
          </button>
        </>
      )}
    >
            <p id={descricaoId} style={{ color: '#aaa', fontSize: '0.9em', marginBottom: '15px' }}>
                Referência do livro: até <strong>2 ações</strong>, ajustáveis pela mesa. Revisar Caso pode ser escolhido duas vezes. Recuperação base: <strong>{limitePE}</strong> (Limite de PE).
            </p>

            <div className="interludio-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
                gap: '10px', 
                marginBottom: '20px' 
            }}>
                {listaAcoes.map((acao) => {
                  const quantidadeSelecionada = acoesSelecionadas.filter((item) => item === acao.id).length;
                  return (
                    <button
                        type="button"
                        key={acao.id}
                        className={`item-card ${quantidadeSelecionada > 0 ? 'selecionado' : ''}`}
                        onClick={() => toggleAcao(acao.id)}
                        aria-pressed={quantidadeSelecionada > 0}
                        aria-label={`${acao.nome}${acao.id === 'revisar' ? `, selecionado ${quantidadeSelecionada} de 2 vezes` : ''}`}
                        style={{ 
                            cursor: 'pointer', 
                            border: acoesSelecionadas.includes(acao.id) ? '2px solid var(--cor-destaque)' : '1px solid var(--cor-borda)', 
                            padding: '10px',
                            backgroundColor: acoesSelecionadas.includes(acao.id) ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                            color: 'inherit',
                            margin: 0,
                            textAlign: 'left',
                            textTransform: 'none',
                            width: '100%'
                        }}
                    >
                        <span style={{display: 'block', margin: '0 0 5px 0', fontSize: '1.1em', fontWeight: 700}}>{acao.icone} {acao.nome}</span>
                        {acao.id === 'revisar' && quantidadeSelecionada > 0 && (
                          <span className="interludio-action-count">×{quantidadeSelecionada}</span>
                        )}
                        <small style={{lineHeight: '1.2', display: 'block', color: '#ccc'}}>{acao.desc}</small>
                    </button>
                  );
                })}
            </div>

            {(acoesSelecionadas.length > 0) && (
                <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', border: '1px solid var(--cor-borda)' }}>
                    <h4 style={{marginTop: 0, marginBottom: '10px', color: 'var(--cor-destaque)'}}>Detalhes das Ações</h4>
                    
                    {(acoesSelecionadas.includes('dormir') || acoesSelecionadas.includes('relaxar')) && (
                        <div style={{ marginBottom: '15px' }}>
                            <label htmlFor={confortoId} style={{display: 'block', marginBottom: '5px'}}>Nível de Conforto:</label>
                            <select id={confortoId} className="modal-input" value={conforto} onChange={(e) => setConforto(e.target.value)} style={{width: '100%'}}>
                                {database.interludio.conforto.map(c => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                ))}
                            </select>
                            <small style={{ color: '#888', display: 'block', marginTop: '3px' }}>
                                {database.interludio.conforto.find(c => c.id === conforto)?.descricao}
                            </small>
                            {acoesSelecionadas.includes('dormir') && conforto === 'precario' && sonoPrecarioNormal && (
                              <small style={{ color: 'var(--cor-destaque)', display: 'block', marginTop: '3px' }}>
                                Sua origem considera esta condição de sono como normal.
                              </small>
                            )}
                        </div>
                    )}

                    {acoesSelecionadas.includes('relaxar') && (
                        <div style={{ marginBottom: '15px' }}>
                            <label htmlFor="participantes-relaxando" style={{display: 'block', marginBottom: '5px'}}>
                              Personagens relaxando (incluindo você)
                            </label>
                            <input
                              className="modal-input"
                              type="number"
                              id="participantes-relaxando"
                              min="1"
                              value={participantesRelaxando}
                              onChange={(e) => setParticipantesRelaxando(Math.max(1, parseInt(e.target.value) || 1))}
                            />
                            <small style={{ color: '#888', display: 'block', marginTop: '3px' }}>
                              Cada participante recupera +1 SAN para cada personagem realizando a ação.
                            </small>
                        </div>
                    )}

                    {acoesSelecionadas.includes('alimentar') && (
                        <div style={{ marginBottom: '15px' }}>
                            <label htmlFor={pratoId} style={{display: 'block', marginBottom: '5px'}}>Prato Escolhido:</label>
                            <select id={pratoId} className="modal-input" value={prato} onChange={(e) => setPrato(e.target.value)} style={{width: '100%'}}>
                                {database.interludio.pratos.map(p => (
                                    <option key={p.id} value={p.id}>{p.nome}</option>
                                ))}
                            </select>
                            <small style={{ color: '#888', display: 'block', marginTop: '3px' }}>
                                {database.interludio.pratos.find(p => p.id === prato)?.descricao}
                            </small>
                        </div>
                    )}

                    {acoesSelecionadas.includes('exercitar') && (
                        <p style={{fontSize: '0.9em', color: '#aaa'}}>💪 <strong>Exercitar-se:</strong> Anote que você tem +1d6 para um teste de AGI, FOR ou VIG.</p>
                    )}
                    {acoesSelecionadas.includes('ler') && (
                        <p style={{fontSize: '0.9em', color: '#aaa'}}>📚 <strong>Ler:</strong> anote {bonusLeitura} para um teste de INT ou PRE.</p>
                    )}
                    {acoesSelecionadas.includes('manutencao') && (
                      <div style={{ marginBottom: '15px' }}>
                        <label htmlFor="item-manutencao" style={{display: 'block', marginBottom: '5px'}}>Item quebrado</label>
                        <select
                          className="modal-input"
                          id="item-manutencao"
                          value={itemManutencaoId}
                          onChange={(e) => setItemManutencaoId(e.target.value)}
                          style={{width: '100%'}}
                        >
                          <option value="">Selecione um item</option>
                          {itensQuebrados.map(item => (
                            <option key={item.inventarioId} value={item.inventarioId}>{item.nome}</option>
                          ))}
                        </select>
                        {itensQuebrados.length === 0 && (
                          <small style={{ color: '#888', display: 'block', marginTop: '3px' }}>Não há itens marcados como quebrados.</small>
                        )}
                      </div>
                    )}
                     {acoesSelecionadas.includes('revisar') && (
                        <p style={{fontSize: '0.9em', color: '#aaa'}}>🔍 <strong>Revisar Caso:</strong> Faça um teste de perícia com o Mestre para achar pistas.</p>
                    )}
                </div>
            )}
    </ModalBase>
  );
}

export default ModalInterludio;
