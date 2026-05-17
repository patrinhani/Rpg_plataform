// src/components/mesa/IniciativaTracker.jsx
import React, { useEffect, useRef } from 'react';
import { avancarTurno, removerDaIniciativa, atualizarNPCStatus } from '../../lib/mesas';

export default function IniciativaTracker({ 
    mesaId, iniciativas, turnoAtual, rodada, souMestre, fichasDaMesa, onVerFichaCriatura,
    compact = false 
}) {

    const scrollRef = useRef(null);

    const handleAvancar = async () => {
        await avancarTurno(mesaId, turnoAtual, iniciativas.length);
    };

    // Auto-scroll para o jogador da vez no modo compacto
    useEffect(() => {
        if (compact && scrollRef.current) {
            const activeItem = scrollRef.current.children[turnoAtual];
            if (activeItem) {
                activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }
    }, [turnoAtual, compact]);

    const getPercent = (atual, max) => Math.max(0, Math.min(100, (atual / (max || 1)) * 100));

    return (
        <div 
            className={`tracker-container ${compact ? 'compacto' : 'normal'}`}
            style={!compact ? { 
                border: '2px solid var(--cor-destaque)', 
                background: 'rgba(10,10,10,0.9)', 
                marginBottom: '20px',
                padding: '0' 
            } : {}}
        >
            {/* --- HEADER DO COMBATE --- */}
            <div className="header-combate">
                <h3 style={{ margin: 0, color: 'var(--cor-destaque)', fontSize: compact ? '1em' : '1.2em' }}>
                    {compact ? 'COMBATE' : 'COMBATE'} 
                    <span style={{fontSize:'0.8em', color:'#aaa', marginLeft: '5px'}}>R: {rodada}</span>
                </h3>
                
                {souMestre && (
                    <button 
                        onClick={handleAvancar} 
                        className="btn-login primary"
                        style={{ 
                            margin: compact ? '5px 0 0 0' : 0, 
                            padding: compact ? '2px 10px' : '5px 20px', 
                            fontSize: compact ? '0.7em' : '0.9em',
                            width: compact ? '100%' : 'auto'
                        }}
                    >
                        PRÓXIMO ➜
                    </button>
                )}
            </div>

            {/* --- LISTA DE INICIATIVAS --- */}
            <div className="lista-iniciativa" ref={scrollRef}>
                {iniciativas.map((ini, index) => {
                    const isTurno = index === turnoAtual;
                    const fichaReal = !ini.isNPC ? fichasDaMesa.find(f => f.uid === ini.uid) : null;
                    
                    // LÓGICA DA FOTO:
                    // 1. Se for Monstro e tiver foto no bestiário.
                    // 2. Se for Jogador e tiver foto na ficha (base64 ou url).
                    let imagemAvatar = null;
                    if (ini.isMonster && ini.fichaCompleta?.foto) {
                        imagemAvatar = ini.fichaCompleta.foto;
                    } else if (fichaReal && fichaReal.info?.foto) {
                        imagemAvatar = fichaReal.info.foto;
                    }
                    
                    let pvAtual = fichaReal ? fichaReal.recursos.pv_atual : (ini.pv_atual || 0);
                    let pvMax = fichaReal ? fichaReal.recursos.pv_max : (ini.pv_max || 10);
                    
                    const ocultarInfo = ini.isNPC && !souMestre;
                    const displayPV = ocultarInfo ? '?' : pvAtual;
                    const barraCor = ocultarInfo ? '#444' : '#d40000';
                    const barraWidth = ocultarInfo ? '100%' : `${getPercent(pvAtual, pvMax)}%`;

                    return (
                        <div 
                            key={index} 
                            className={`card-iniciativa ${isTurno ? 'ativo' : ''}`}
                        >
                            {/* Valor da Iniciativa */}
                            <div className="ini-valor">
                                {ini.valor}
                            </div>

                            {/* FOTO / AVATAR (NOVO) */}
                            {imagemAvatar && (
                                <div className="ini-avatar-container" style={{
                                    width: compact ? '35px' : '50px',
                                    height: compact ? '35px' : '50px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    border: isTurno ? '2px solid gold' : '2px solid #444',
                                    marginRight: '10px',
                                    flexShrink: 0,
                                    backgroundColor: '#000'
                                }}>
                                    <img 
                                        src={imagemAvatar} 
                                        alt="Avatar" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                </div>
                            )}

                            {/* Info Central */}
                            <div className="ini-info">
                                <div className="ini-nome-row">
                                    <strong>{ini.nome}</strong>
                                    {/* Botão Ficha Monstro (Só Mestre) */}
                                    {!compact && ini.isMonster && souMestre && (
                                        <button onClick={() => onVerFichaCriatura(ini.fichaCompleta)} className="btn-mini-ficha" title="Ver Ficha">📄</button>
                                    )}
                                </div>

                                {/* Barra de Vida */}
                                <div className="barra-vida-container">
                                    <div style={{ width: barraWidth, height: '100%', background: barraCor, transition: 'width 0.3s' }}></div>
                                </div>

                                {/* Input de Dano Rápido (Mestre + NPC) */}
                                {ini.isNPC && souMestre && (
                                    <div className="input-dano-rapido">
                                        <input 
                                            type="number" 
                                            value={pvAtual} 
                                            onChange={(e) => atualizarNPCStatus(mesaId, ini.uid, 'pv_atual', e.target.value)} 
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Texto PV (Escondido no compacto para jogadores) */}
                            {!compact && (
                                <div className="ini-status-texto">
                                    <span style={{color: ocultarInfo ? '#aaa' : '#d40000'}}>{displayPV}</span> / {ocultarInfo ? '?' : pvMax}
                                </div>
                            )}

                            {/* Botão Remover (Só Mestre) */}
                            {souMestre && (
                                <button 
                                    onClick={() => removerDaIniciativa(mesaId, ini.uid)} 
                                    className="btn-remover-ini"
                                >
                                    &times;
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
