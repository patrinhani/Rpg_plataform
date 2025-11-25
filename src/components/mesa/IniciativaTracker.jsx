// src/components/mesa/IniciativaTracker.jsx
import React from 'react';
import { avancarTurno, removerDaIniciativa, atualizarNPCStatus } from '../../lib/mesas';

export default function IniciativaTracker({ 
    mesaId, 
    iniciativas, 
    turnoAtual, 
    rodada, 
    souMestre, 
    fichasDaMesa, 
    usuarioUid,
    onVerFichaCriatura // Função para abrir o modal do monstro
}) {

    const handleAvancar = async () => {
        await avancarTurno(mesaId, turnoAtual, iniciativas.length);
    };

    // Função para calcular porcentagem da barra
    const getPercent = (atual, max) => Math.max(0, Math.min(100, (atual / (max || 1)) * 100));

    return (
        <div className="box" style={{ border: '2px solid var(--cor-destaque)', background: 'rgba(10,10,10,0.9)', marginBottom: '20px', padding: '0' }}>
            
            {/* Header */}
            <div style={{ padding: '15px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.5)' }}>
                <h3 style={{ margin: 0, color: 'var(--cor-destaque)' }}>COMBATE <span style={{fontSize:'0.6em', color:'#aaa'}}>RODADA {rodada}</span></h3>
                {souMestre && (
                    <button onClick={handleAvancar} className="btn-login primary" style={{ margin:0, padding:'5px 20px', fontSize:'0.9em' }}>PRÓXIMO ➜</button>
                )}
            </div>

            {/* Lista */}
            <div className="lista-iniciativa" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {iniciativas.map((ini, index) => {
                    const isTurno = index === turnoAtual;
                    const fichaReal = !ini.isNPC ? fichasDaMesa.find(f => f.uid === ini.uid) : null;
                    
                    // Dados (Se for NPC, pega do objeto. Se for Player, pega da ficha real)
                    let pvAtual = fichaReal ? fichaReal.recursos.pv_atual : (ini.pv_atual || 0);
                    let pvMax = fichaReal ? fichaReal.recursos.pv_max : (ini.pv_max || 10);
                    
                    // --- LÓGICA DE PRIVACIDADE ---
                    // Ocultar se for NPC/Monstro e eu NÃO for o Mestre
                    const ocultarInfo = ini.isNPC && !souMestre;

                    const displayPV = ocultarInfo ? '???' : pvAtual;
                    const displayMax = ocultarInfo ? '???' : pvMax;
                    
                    // Barra cinza cheia se oculto (para não entregar dano), vermelha se visível
                    const barraCor = ocultarInfo ? '#444' : '#d40000';
                    const barraWidth = ocultarInfo ? '100%' : `${getPercent(pvAtual, pvMax)}%`;

                    return (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px 40px', gap: '10px', padding: '12px', alignItems: 'center', borderLeft: isTurno ? '5px solid gold' : '5px solid transparent', background: isTurno ? 'rgba(255, 215, 0, 0.1)' : (index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent') }}>
                            
                            {/* Valor Iniciativa */}
                            <div style={{ fontSize: '1.4em', fontWeight: 'bold', textAlign: 'center', color: isTurno ? 'gold' : '#666' }}>{ini.valor}</div>

                            {/* Info */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <strong style={{ fontSize: '1.1em', color: isTurno ? '#fff' : '#aaa' }}>{ini.nome}</strong>
                                    
                                    {/* Botão Ver Ficha (Só Mestre vê para monstros) */}
                                    {ini.isMonster && souMestre && (
                                        <button 
                                            onClick={() => onVerFichaCriatura(ini.fichaCompleta)}
                                            style={{fontSize:'0.7em', padding:'2px 6px', background:'#333', border:'1px solid #555', color:'#ddd', cursor:'pointer'}}
                                        >
                                            📄 Ficha
                                        </button>
                                    )}
                                </div>

                                {/* Barra de Vida */}
                                <div style={{ marginTop: '5px', height: '6px', width: '100%', background: '#222', borderRadius: '2px', overflow:'hidden' }}>
                                    <div style={{ width: barraWidth, height: '100%', background: barraCor, transition: 'width 0.3s' }}></div>
                                </div>

                                {/* Input de Dano (Só Mestre vê para NPCs) */}
                                {ini.isNPC && souMestre && (
                                    <div style={{marginTop: '5px', display: 'flex', alignItems: 'center', gap: '5px'}}>
                                        <small style={{color:'#666'}}>PV:</small>
                                        <input type="number" value={pvAtual} onChange={(e) => atualizarNPCStatus(mesaId, ini.uid, 'pv_atual', e.target.value)} style={{ width: '60px', padding: '2px', fontSize: '0.9em', background: 'transparent', border: '1px solid #444', color: '#fff' }} />
                                    </div>
                                )}
                            </div>

                            {/* Texto PV (Oculto para players) */}
                            <div style={{ textAlign: 'right', fontSize: '0.9em', color: '#aaa' }}>
                                <span style={{color: ocultarInfo ? '#aaa' : '#d40000'}}>{displayPV}</span> / {displayMax}
                            </div>

                            {/* Botão Remover (Só Mestre) */}
                            {souMestre && (
                                <button onClick={() => removerDaIniciativa(mesaId, ini.uid)} style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', fontSize: '1.5em', lineHeight:1 }}>&times;</button>
                            )}
                        </div>
                    );
                })}
                
                {iniciativas.length === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>Aguardando iniciativa...</div>
                )}
            </div>
        </div>
    );
}