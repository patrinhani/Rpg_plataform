// src/pages/Mesa/index.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { importarPersonagemParaMesa, listarPersonagensPessoais, removerJogadorDaMesa } from '../../lib/mesas';

export default function Mesa({ mesaId, onVoltar, onAbrirFichaNaMesa }) {
  const { usuario } = useAuth();
  const [mesaData, setMesaData] = useState(null);
  const [meuPersonagem, setMeuPersonagem] = useState(null);
  const [fichasDaMesa, setFichasDaMesa] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [minhasFichas, setMinhasFichas] = useState([]);

  useEffect(() => {
    if (!mesaId) return;
    const unsub = onSnapshot(doc(db, "mesas", mesaId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.jogadores && !data.jogadores.some(j => j.uid === usuario.uid)) {
           alert("Você foi removido desta mesa."); onVoltar();
        }
        setMesaData(data);
      }
    });
    return () => unsub();
  }, [mesaId, usuario.uid]);

  const souMestre = mesaData?.mestre === usuario.uid;

  useEffect(() => {
    if (!mesaId || !usuario || souMestre) return;
    const unsub = onSnapshot(doc(db, "mesas", mesaId, "personagens", usuario.uid), (snap) => {
      setMeuPersonagem(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [mesaId, usuario, souMestre]);

  useEffect(() => {
    if (!mesaId || !souMestre) return;
    const unsub = onSnapshot(collection(db, "mesas", mesaId, "personagens"), (snapshot) => {
        const lista = [];
        snapshot.forEach(doc => lista.push({ uid: doc.id, ...doc.data() }));
        setFichasDaMesa(lista);
    });
    return () => unsub();
  }, [mesaId, souMestre]);

  const handleCopiarCodigo = () => { navigator.clipboard.writeText(mesaId); alert("Código copiado!"); };
  const handleExpulsar = async (uid, nome) => { if(confirm(`Remover ${nome}?`)) await removerJogadorDaMesa(mesaId, uid); };
  
  const abrirImportacao = async () => {
    const lista = await listarPersonagensPessoais(usuario.uid);
    setMinhasFichas(lista);
    setShowImportModal(true);
  };
  const confirmarImportacao = async (dadosFicha) => {
    if(confirm(`Importar "${dadosFicha.info.nome}"?`)) { await importarPersonagemParaMesa(mesaId, usuario.uid, dadosFicha); setShowImportModal(false); }
  };
  const criarNovaNaMesa = async () => {
    if(confirm("Criar ficha do zero?")) { await importarPersonagemParaMesa(mesaId, usuario.uid, null); }
  };

  if (!mesaData) return <div className="item-placeholder">Carregando Mesa...</div>;

  return (
    <div className="login-container" style={{ flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '0', overflowY: 'auto' }}>
      <div className="dashboard-container box" style={{ background: 'rgba(10,10,10,0.95)', marginTop: '30px', minHeight: '90vh', borderColor: souMestre ? 'gold' : '#333' }}>
        
        {/* CABEÇALHO */}
        <div className="dashboard-header">
            <div>
                <h1 style={{ margin: 0, color: souMestre ? 'gold' : 'white' }}>{souMestre ? '👑' : ''} {mesaData.nome}</h1>
                {souMestre && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                        <code style={{ background: '#222', padding: '4px 8px', borderRadius: '4px', color: 'gold' }}>{mesaId}</code>
                        <button onClick={handleCopiarCodigo} style={{ fontSize: '0.8em', padding: '4px 8px' }}>Copiar ID</button>
                    </div>
                )}
            </div>
            <button onClick={onVoltar} className="item-inventario-remover">Sair da Mesa</button>
        </div>

        <div className="mesa-container">
            
            {/* --- ÁREA PRINCIPAL (ESQUERDA) --- */}
            <div className="mesa-area-principal">
                
                {/* VISÃO MESTRE */}
                {souMestre && (
                   <>
                    <h2 style={{color:'gold'}}>PERSONAGENS DOS JOGADORES</h2>
                    <div className="dashboard-grid">
                        {mesaData.jogadores.filter(j => j.uid !== usuario.uid).map(jogador => {
                            const ficha = fichasDaMesa.find(p => p.uid === jogador.uid);
                            return (
                              <div key={jogador.uid} className="dashboard-card" style={{ borderColor: '#555' }}>
                                <div style={{ width:'100%', display: 'flex', justifyContent: 'space-between' }}>
                                    <strong style={{ color: '#fff' }}>{jogador.nome}</strong>
                                    <button onClick={() => handleExpulsar(jogador.uid, jogador.nome)} style={{ background: 'transparent', border: 'none', color: 'red', cursor: 'pointer' }}>×</button>
                                </div>
                                {ficha ? (
                                  <div style={{ marginTop: '15px' }}>
                                    <h3 style={{ color: 'var(--cor-destaque)' }}>{ficha.info.nome || "..."}</h3>
                                    <p>{ficha.info.classe} - {ficha.info.nex}</p>
                                    <button onClick={() => onAbrirFichaNaMesa(jogador.uid)} className="btn-login google" style={{ width: '100%', fontSize: '0.9em' }}>Abrir Ficha</button>
                                  </div>
                                ) : <div className="estado-vazio" style={{margin:'15px 0', padding:'10px'}}>Criando ficha...</div>}
                              </div>
                            );
                        })}
                         {mesaData.jogadores.length <= 1 && <p className="estado-vazio">Nenhum jogador.</p>}
                    </div>
                   </>
                )}

                {/* VISÃO JOGADOR */}
                {!souMestre && (
                    <>
                    <h2 style={{color:'var(--cor-destaque)'}}>MEU PERSONAGEM</h2>
                    {meuPersonagem ? (
                        <div className="item-card" style={{ padding: '30px', textAlign: 'center', border: '2px solid var(--cor-destaque)', background: 'rgba(0, 145, 255, 0.05)' }}>
                            <h3 style={{ fontSize: '2.5em', margin: '10px 0' }}>{meuPersonagem.info.nome || "Sem Nome"}</h3>
                            <p style={{ fontSize: '1.2em', color: '#ccc' }}>{meuPersonagem.info.classe} - NEX {meuPersonagem.info.nex}</p>
                            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px', flexWrap: 'wrap' }}>
                                <button onClick={() => onAbrirFichaNaMesa(usuario.uid)} className="btn-login primary" style={{ padding: '15px 40px', fontSize: '1.2em' }}>JOGAR AGORA ▶</button>
                                <button onClick={abrirImportacao} className="btn-login anon">Trocar Ficha</button>
                            </div>
                        </div>
                    ) : (
                        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                            <div onClick={abrirImportacao} className="card-novo"><span style={{fontSize:'3em'}}>📥</span><h3>Importar Ficha</h3></div>
                            <div onClick={criarNovaNaMesa} className="card-novo"><span style={{fontSize:'3em'}}>✨</span><h3>Criar do Zero</h3></div>
                        </div>
                    )}
                    </>
                )}
            </div>

            {/* --- SIDEBAR (DIREITA) --- */}
            <div className="mesa-sidebar">
                <h3 style={{ borderBottom: '1px solid #555', paddingBottom: '10px', margin: 0, color: '#aaa' }}>
                    EQUIPE ({mesaData.jogadores.length})
                </h3>
                <ul className="mesa-lista-jogadores">
                    {mesaData.jogadores.map(j => (
                        <li key={j.uid} className="mesa-jogador-item">
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: j.uid === mesaData.mestre ? 'gold' : (j.uid === usuario.uid ? 'var(--cor-destaque)' : '#fff') }}></div>
                            <span style={{ color: j.uid === usuario.uid ? 'var(--cor-destaque)' : '#ddd' }}>
                                {j.nome} {j.uid === mesaData.mestre ? ' (Mestre)' : ''}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

        </div>
      </div>

      {/* MODAL IMPORTAÇÃO */}
      {showImportModal && (
        <div className="modal-overlay">
            <div className="modal-conteudo" style={{ maxWidth: '600px' }}>
                <div className="modal-header"><h3>Selecionar Personagem</h3><button onClick={() => setShowImportModal(false)} className="btn-fechar-modal">X</button></div>
                <div className="modal-body">
                    {minhasFichas.length === 0 ? <p className="estado-vazio">Sem fichas pessoais.</p> : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {minhasFichas.map(f => (
                                <div key={f.id} onClick={() => confirmarImportacao(f.dadosCompletos)} className="item-card" style={{ padding: '15px', cursor: 'pointer', border: '1px solid #444' }}>
                                    <strong style={{ color: 'var(--cor-destaque)' }}>{f.nome}</strong>
                                    <span style={{ float: 'right', color: '#aaa' }}>{f.classe}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}