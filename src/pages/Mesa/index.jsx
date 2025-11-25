// src/pages/Mesa/index.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { 
    importarPersonagemParaMesa, 
    listarPersonagensPessoais, 
    removerJogadorDaMesa, 
    atualizarNomeMesa,
    alternarCombate,
    atualizarIniciativa,
    adicionarNPCIniciativa,
    adicionarMonstroIniciativa,
    removerDaIniciativa
} from '../../lib/mesas';
import { bestiario } from '../../lib/bestiario'; 

// Imports de Componentes da Mesa
import IniciativaTracker from '../../components/mesa/IniciativaTracker.jsx'; 
import FichaCriatura from '../../components/mesa/FichaCriatura.jsx'; 

export default function Mesa({ mesaId, onVoltar, onAbrirFichaNaMesa }) {
  const { usuario } = useAuth();
  const [mesaData, setMesaData] = useState(null);
  const [fichasDaMesa, setFichasDaMesa] = useState([]); 
  
  // Modais
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBestiarioModal, setShowBestiarioModal] = useState(false); 
  const [criaturaSelecionada, setCriaturaSelecionada] = useState(null); 
  const [minhasFichas, setMinhasFichas] = useState([]);
  
  // Inputs Combate
  const [iniValor, setIniValor] = useState('');
  const [npcNome, setNpcNome] = useState('');
  const [npcIni, setNpcIni] = useState('');
  const [npcPV, setNpcPV] = useState(20);

  // 1. Monitorar Mesa
  useEffect(() => {
    if (!mesaId) return;
    const unsub = onSnapshot(doc(db, "mesas", mesaId), (docSnap) => {
      if (docSnap.exists()) setMesaData(docSnap.data());
      else onVoltar();
    });
    return () => unsub();
  }, [mesaId]);

  const souMestre = mesaData?.mestre === usuario.uid;
  const emCombate = mesaData?.emCombate || false;

  // 2. Monitorar Fichas
  useEffect(() => {
    if (!mesaId) return;
    const unsub = onSnapshot(collection(db, "mesas", mesaId, "personagens"), (snap) => {
        const lista = []; snap.forEach(doc => lista.push({ uid: doc.id, ...doc.data() })); setFichasDaMesa(lista);
    });
    return () => unsub();
  }, [mesaId]);

  // --- AÇÕES ---
  const handleCopiarCodigo = () => { navigator.clipboard.writeText(mesaId); alert("Copiado!"); };
  const handleEditarNome = async () => { if(souMestre) { const n = prompt("Nome:", mesaData.nome); if(n) atualizarNomeMesa(mesaId, n); }};
  const handleExpulsar = async (uid) => { if(confirm("Expulsar?")) removerJogadorDaMesa(mesaId, uid); };

  // Combate
  const toggleCombate = async () => { await alternarCombate(mesaId, !emCombate, mesaData.jogadores); };
  
  const enviarIniciativa = async () => {
      if(!iniValor) return;
      const ficha = fichasDaMesa.find(f => f.uid === usuario.uid);
      const nome = ficha?.info?.nome || usuario.displayName;
      await atualizarIniciativa(mesaId, usuario.uid, nome, iniValor);
      setIniValor('');
  };

  const addNPC = async () => {
      if(!npcNome || !npcIni) return;
      await adicionarNPCIniciativa(mesaId, npcNome, npcIni, npcPV);
      setNpcNome(''); setNpcIni('');
  };

  const adicionarMonstro = async (monstro) => {
      const ini = prompt(`Iniciativa para ${monstro.nome}:`);
      if (ini) {
          await adicionarMonstroIniciativa(mesaId, monstro, ini);
          setShowBestiarioModal(false);
      }
  };

  // Importação
  const abrirImportacao = async () => { const l = await listarPersonagensPessoais(usuario.uid); setMinhasFichas(l); setShowImportModal(true); };
  const confirmarImportacao = async (dados) => { if(confirm("Importar?")) { await importarPersonagemParaMesa(mesaId, usuario.uid, dados); setShowImportModal(false); } };
  const criarNova = async () => { if(confirm("Criar nova?")) await importarPersonagemParaMesa(mesaId, usuario.uid, null); };

  if (!mesaData) return <div className="item-placeholder">Carregando...</div>;
  const tenhoFicha = fichasDaMesa.some(f => f.uid === usuario.uid);

  return (
    <div className="login-container" style={{ flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '0', overflowY: 'auto' }}>
      <div className="dashboard-container box" style={{ background: 'rgba(10,10,10,0.95)', marginTop: '30px', minHeight: '90vh', borderColor: emCombate ? 'var(--cor-destaque)' : '#333' }}>
        
        {/* HEADER */}
        <div className="dashboard-header">
             <div><h1 style={{margin:0, cursor: souMestre?'pointer':'default', color: souMestre?'gold':'#fff'}} onClick={handleEditarNome}>{souMestre?'👑 ':''}{mesaData.nome}</h1></div>
             <div style={{display:'flex', gap:'10px'}}>
                {souMestre && <button onClick={toggleCombate} style={{background: emCombate ? '#333' : 'var(--cor-destaque)', color: emCombate?'#aaa':'#000'}}>{emCombate ? 'ENCERRAR' : 'COMBATE'}</button>}
                <button onClick={onVoltar}>Sair</button>
             </div>
        </div>

        {/* TRACKER DE COMBATE */}
        {emCombate && (
            <>
                <IniciativaTracker 
                    mesaId={mesaId}
                    iniciativas={mesaData.iniciativas || []}
                    turnoAtual={mesaData.turnoAtual || 0}
                    rodada={mesaData.rodada || 1}
                    souMestre={souMestre}
                    fichasDaMesa={fichasDaMesa}
                    usuarioUid={usuario.uid}
                    onVerFichaCriatura={setCriaturaSelecionada}
                />
                
                {souMestre && (
                    <div style={{ display:'flex', gap:'15px', justifyContent:'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <button onClick={() => setShowBestiarioModal(true)} className="btn-login google" style={{width:'auto'}}>+ BESTIÁRIO</button>
                        
                        <div style={{display:'flex', gap:'5px', alignItems:'center', border:'1px solid #444', padding:'5px'}}>
                            <span style={{color:'gold', fontSize:'0.9em'}}>NPC Rápido:</span>
                            <input type="text" placeholder="Nome" value={npcNome} onChange={e=>setNpcNome(e.target.value)} style={{width:'80px'}} />
                            <input type="number" placeholder="Ini" value={npcIni} onChange={e=>setNpcIni(e.target.value)} style={{width:'40px'}} />
                            <input type="number" placeholder="PV" value={npcPV} onChange={e=>setNpcPV(e.target.value)} style={{width:'40px'}} />
                            <button onClick={addNPC}>+</button>
                        </div>
                    </div>
                )}
                
                {!souMestre && (
                    <div style={{display:'flex', gap:'5px', justifyContent:'center', marginBottom:'20px'}}>
                         <input type="number" placeholder="Iniciativa" value={iniValor} onChange={e=>setIniValor(e.target.value)} style={{width:'100px'}} />
                         <button onClick={enviarIniciativa}>Enviar</button>
                    </div>
                )}
            </>
        )}

        {/* LISTA DE JOGADORES */}
        <div className="mesa-container">
            <div className="mesa-area-principal">
                <div className="dashboard-grid">
                    {mesaData.jogadores.filter(j => j.uid !== mesaData.mestre).map(jogador => {
                        const ficha = fichasDaMesa.find(f => f.uid === jogador.uid);
                        const isMe = jogador.uid === usuario.uid;
                        const podeAbrir = souMestre || isMe;

                        return (
                            <div key={jogador.uid} className="dashboard-card" style={{ borderColor: isMe ? 'var(--cor-destaque)' : '#333' }}>
                                <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                                    <strong>{jogador.nome}</strong>
                                    {souMestre && <button onClick={()=>handleExpulsar(jogador.uid)} style={{color:'red', background:'none', border:'none'}}>×</button>}
                                </div>
                                {ficha ? (
                                    <div style={{marginTop:'10px'}}>
                                        <h3 style={{color:'var(--cor-destaque)'}}>{ficha.info.nome}</h3>
                                        <p style={{color:'#aaa'}}>{ficha.info.classe} {ficha.info.nex}</p>
                                        {podeAbrir ? <button onClick={()=>onAbrirFichaNaMesa(jogador.uid)} className="btn-login google" style={{width:'100%'}}>Abrir</button> : <div style={{color:'#555', border:'1px dashed #444', padding:'5px'}}>Oculto</div>}
                                    </div>
                                ) : <div className="estado-vazio">Sem ficha.</div>}
                            </div>
                        )
                    })}
                </div>
                {!souMestre && !tenhoFicha && (
                     <div className="dashboard-grid" style={{gridTemplateColumns:'1fr 1fr', marginTop:'20px'}}>
                         <div onClick={abrirImportacao} className="card-novo"><h3>Importar</h3></div>
                         <div onClick={criarNova} className="card-novo"><h3>Criar</h3></div>
                     </div>
                )}
            </div>
        </div>

      </div>

      {/* MODAL BESTIÁRIO */}
      {showBestiarioModal && (
        <div className="modal-overlay">
            <div className="modal-conteudo" style={{maxWidth:'800px'}}>
                <div className="modal-header"><h3>Bestiário</h3><button onClick={()=>setShowBestiarioModal(false)} className="btn-fechar-modal">X</button></div>
                <div className="modal-body">
                    {bestiario.map(m => (
                        <div key={m.id} className="item-card" style={{padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', borderLeft:`4px solid ${m.elemento==='Sangue'?'red':'#444'}`}}>
                            <div>
                                <strong style={{fontSize:'1.2em'}}>{m.nome}</strong>
                                <span style={{marginLeft:'10px', color:'#aaa'}}>VD {m.vd}</span>
                            </div>
                            <button onClick={()=>adicionarMonstro(m)} className="btn-login primary" style={{margin:0, padding:'5px 15px'}}>Adicionar</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {/* MODAL FICHA CRIATURA */}
      {criaturaSelecionada && (
          <FichaCriatura dados={criaturaSelecionada} onClose={() => setCriaturaSelecionada(null)} />
      )}
      
      {/* MODAL IMPORTAÇÃO */}
      {showImportModal && (
        <div className="modal-overlay">
            <div className="modal-conteudo">
                <div className="modal-header"><h3>Importar</h3><button onClick={()=>setShowImportModal(false)} className="btn-fechar-modal">X</button></div>
                <div className="modal-body">
                    {minhasFichas.map(f => (
                        <div key={f.id} onClick={()=>confirmarImportacao(f.dadosCompletos)} className="item-card" style={{cursor:'pointer', padding:'10px', marginBottom:'10px'}}>
                            <strong>{f.nome}</strong>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}