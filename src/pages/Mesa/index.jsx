// src/pages/Mesa/index.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { useDialog } from '../../contexts/DialogContext'; // [NOVO] Import do Dialog

import { 
    importarPersonagemParaMesa, 
    listarPersonagensPessoais, 
    removerJogadorDaMesa, 
    atualizarNomeMesa, 
    alternarCombate, 
    atualizarIniciativa, 
    adicionarNPCIniciativa, 
    adicionarMonstroIniciativa, 
    removerDaIniciativa,
    atualizarNPCStatus,
    avancarTurno
} from '../../lib/mesas';
import { bestiario } from '../../lib/bestiario';
import { FichaProvider } from '../../contexts/FichaContext.jsx';

// --- IMPORTAÇÕES DE COMPONENTES ---
import IniciativaTracker from '../../components/mesa/IniciativaTracker.jsx';
import FichaCriatura from '../../components/mesa/FichaCriatura.jsx';
import Ficha from '../Ficha/index.jsx';

export default function Mesa() {
  const { mesaId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  
  // [NOVO] Hook do Dialog
  const { showAlert, showConfirm, showPrompt } = useDialog();
  
  const [mesaData, setMesaData] = useState(null);
  const [fichasDaMesa, setFichasDaMesa] = useState([]);
  const [fichaAbertaId, setFichaAbertaId] = useState(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showBestiarioModal, setShowBestiarioModal] = useState(false);
  const [criaturaSelecionada, setCriaturaSelecionada] = useState(null);
  const [minhasFichas, setMinhasFichas] = useState([]);

  const [iniValor, setIniValor] = useState('');
  const [npcNome, setNpcNome] = useState('');
  const [npcIni, setNpcIni] = useState('');
  const [npcPV, setNpcPV] = useState(20);

  const sairDaMesa = () => navigate('/');

  // 1. Monitorar Dados da Mesa
  useEffect(() => {
    if (!mesaId) return;
    const unsub = onSnapshot(doc(db, "mesas", mesaId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.jogadores && !data.jogadores.some(j => j.uid === usuario.uid)) {
           // [ATUALIZADO] Alerta via Dialog (sem await pois é dentro de useEffect, apenas dispara)
           showAlert("Você foi removido desta mesa.", "Aviso");
           sairDaMesa();
           return;
        }
        setMesaData(data);
      } else {
          // [ATUALIZADO]
          showAlert("Esta mesa foi excluída ou não existe.", "Erro");
          sairDaMesa();
      }
    }, (error) => {
       console.error("Erro ao carregar mesa:", error);
       // [ATUALIZADO]
       showAlert("Erro de permissão ou conexão.", "Erro");
       sairDaMesa();
    });
    return () => unsub();
  }, [mesaId, usuario.uid]);

  const souMestre = mesaData?.mestre === usuario.uid;
  const emCombate = mesaData?.emCombate || false;
  const isFichaOpen = !!fichaAbertaId;

  // 2. Monitorar Todas as Fichas
  useEffect(() => {
    if (!mesaId) return;
    const unsub = onSnapshot(collection(db, "mesas", mesaId, "personagens"), (snapshot) => {
        const lista = [];
        snapshot.forEach(doc => lista.push({ uid: doc.id, ...doc.data() }));
        setFichasDaMesa(lista);
    });
    return () => unsub();
  }, [mesaId]);

  // --- AÇÕES GERAIS ---
  const handleCopiarCodigo = () => { 
      navigator.clipboard.writeText(mesaId); 
      // [ATUALIZADO]
      showAlert("Código copiado para a área de transferência!", "Sucesso"); 
  };
  
  const handleEditarNome = async () => {
      if (!souMestre) return;
      // [ATUALIZADO] Prompt via Dialog
      const novo = await showPrompt("Novo nome da mesa:", "Editar Mesa", "Nome da Mesa", mesaData.nome);
      if (novo && novo.trim()) await atualizarNomeMesa(mesaId, novo);
  };

  const handleExpulsar = async (uid) => {
      // [ATUALIZADO] Confirm via Dialog
      const confirmado = await showConfirm("Tem certeza que deseja remover este jogador da mesa?", "Expulsar Jogador");
      if (confirmado) {
          await removerJogadorDaMesa(mesaId, uid);
      }
  };

  // --- AÇÕES DE COMBATE ---
  const toggleCombate = async () => {
      await alternarCombate(mesaId, !emCombate, mesaData.jogadores);
  };
  
  const enviarIniciativa = async () => {
      if (!iniValor) return;
      const ficha = fichasDaMesa.find(f => f.uid === usuario.uid);
      const nomeExibicao = ficha?.info?.nome || usuario.displayName;
      await atualizarIniciativa(mesaId, usuario.uid, nomeExibicao, iniValor);
      setIniValor('');
  };

  const addNPC = async () => {
      if (!npcNome || !npcIni) return;
      await adicionarNPCIniciativa(mesaId, npcNome, npcIni, npcPV);
      setNpcNome(''); setNpcIni('');
  };

  const adicionarMonstro = async (monstro) => {
      // [ATUALIZADO] Prompt via Dialog
      const ini = await showPrompt(`Iniciativa para ${monstro.nome} (Bônus: ${monstro.iniciativa}):`, "Adicionar Monstro", "0", "0");
      if (ini !== null) { // Verifica se não cancelou (pode ser string vazia se o usuário apagar, mas geralmente retorna valor)
          await adicionarMonstroIniciativa(mesaId, monstro, ini || "0");
          setShowBestiarioModal(false);
      }
  };

  // --- IMPORTAÇÃO E CRIAÇÃO ---
  const abrirImportacao = async () => {
      const lista = await listarPersonagensPessoais(usuario.uid);
      setMinhasFichas(lista);
      setShowImportModal(true);
  };
  
  const confirmarImportacao = async (dadosFicha) => {
      // [ATUALIZADO] Confirm via Dialog
      const confirmado = await showConfirm(`Importar "${dadosFicha.info.nome}" para esta mesa?`, "Importar Personagem");
      if (confirmado) {
          await importarPersonagemParaMesa(mesaId, usuario.uid, dadosFicha);
          setShowImportModal(false);
      }
  };

  const criarNova = async () => {
      // [ATUALIZADO] Confirm via Dialog
      const confirmado = await showConfirm("Criar uma ficha do zero nesta mesa?", "Nova Ficha");
      if (confirmado) {
          await importarPersonagemParaMesa(mesaId, usuario.uid, null);
      }
  };

  if (!mesaData) return <div className="item-placeholder">Carregando Mesa...</div>;
  
  const meuPersonagem = fichasDaMesa.find(f => f.uid === usuario.uid);
  
  // RENDERIZAÇÃO: MODO FICHA
  if (isFichaOpen) {
      return (
        <FichaProvider>
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--cor-fundo)' }}>
                {emCombate && (
                    <IniciativaTracker 
                        mesaId={mesaId}
                        iniciativas={mesaData.iniciativas || []}
                        turnoAtual={mesaData.turnoAtual || 0}
                        rodada={mesaData.rodada || 1}
                        souMestre={souMestre}
                        fichasDaMesa={fichasDaMesa}
                        usuarioUid={usuario.uid}
                        onVerFichaCriatura={setCriaturaSelecionada}
                        compact={true} 
                    />
                )}
                <div style={{ position: 'relative', flexGrow: 1, marginTop: emCombate ? '70px' : '0' }}>
                    <button 
                        onClick={() => setFichaAbertaId(null)} 
                        className="btn-voltar-flutuante"
                        style={{ top: emCombate ? '85px' : '15px' }} 
                    >
                        ← VOLTAR PARA A MESA
                    </button>
                    <Ficha fichaId={fichaAbertaId} mesaContexto={mesaId} />
                </div>
                {criaturaSelecionada && <FichaCriatura dados={criaturaSelecionada} onClose={() => setCriaturaSelecionada(null)} />}
            </div>
        </FichaProvider>
      );
  }

  // RENDERIZAÇÃO: MODO LOBBY
  return (
    <div className="login-container" style={{ flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '0', overflowY: 'auto' }}>
      <div className="dashboard-container box" style={{ background: 'rgba(10,10,10,0.95)', marginTop: '30px', minHeight: '90vh', borderColor: emCombate ? 'var(--cor-destaque)' : '#333' }}>
        
        <div className="dashboard-header">
             <div>
                 <h1 
                    style={{margin:0, cursor: souMestre?'pointer':'default', color: souMestre?'gold':'#fff'}} 
                    onClick={handleEditarNome}
                    title={souMestre ? "Clique para editar o nome" : ""}
                 >
                    {souMestre?'👑 ':''}{mesaData.nome}
                 </h1>
                 {souMestre && (
                    <div style={{display:'flex', alignItems:'center', gap:'10px', marginTop:'5px'}}>
                        <code style={{background:'#222', padding:'2px 6px', borderRadius:'4px', color:'gold'}}>{mesaId}</code>
                        <button onClick={handleCopiarCodigo} style={{fontSize:'0.7em', padding:'2px 5px'}}>Copiar ID</button>
                    </div>
                 )}
             </div>
             <div style={{display:'flex', gap:'10px'}}>
                {souMestre && (
                    <button 
                        onClick={toggleCombate} 
                        style={{
                            background: emCombate ? '#333' : 'var(--cor-destaque)', 
                            color: emCombate ? '#aaa' : '#000',
                            border: '1px solid #555'
                        }}
                    >
                        {emCombate ? 'ENCERRAR COMBATE' : '⚔️ INICIAR COMBATE'}
                    </button>
                )}
                <button onClick={sairDaMesa} className="item-inventario-remover">Sair</button>
             </div>
        </div>

        {/* TRACKER DE COMBATE (MODO GRANDE) */}
        {emCombate && (
            <div style={{ marginBottom: '20px' }}>
                <IniciativaTracker 
                    mesaId={mesaId}
                    iniciativas={mesaData.iniciativas || []}
                    turnoAtual={mesaData.turnoAtual || 0}
                    rodada={mesaData.rodada || 1}
                    souMestre={souMestre}
                    fichasDaMesa={fichasDaMesa}
                    usuarioUid={usuario.uid}
                    onVerFichaCriatura={setCriaturaSelecionada}
                    compact={false}
                />
                <div style={{ display:'flex', gap:'15px', justifyContent:'center', marginTop: '10px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.6)', padding:'15px', borderRadius:'0 0 8px 8px' }}>
                    {souMestre ? (
                        <>
                            <button onClick={() => setShowBestiarioModal(true)} className="btn-login google" style={{width:'auto', padding:'5px 20px'}}>+ BESTIÁRIO</button>
                            <div style={{display:'flex', gap:'5px', alignItems:'center', borderLeft:'1px solid #555', paddingLeft:'15px'}}>
                                <span style={{color:'gold', fontSize:'0.9em'}}>NPC Rápido:</span>
                                <input type="text" placeholder="Nome" value={npcNome} onChange={e=>setNpcNome(e.target.value)} style={{width:'100px'}} />
                                <input type="number" placeholder="Ini" value={npcIni} onChange={e=>setNpcIni(e.target.value)} style={{width:'50px'}} />
                                <input type="number" placeholder="PV" value={npcPV} onChange={e=>setNpcPV(e.target.value)} style={{width:'50px'}} />
                                <button onClick={addNPC}>Add</button>
                            </div>
                        </>
                    ) : (
                        <div style={{display:'flex', gap:'5px', alignItems:'center'}}>
                            <label>Sua Iniciativa:</label>
                            <input type="number" placeholder="Valor" value={iniValor} onChange={e=>setIniValor(e.target.value)} style={{width:'100px'}} />
                            <button onClick={enviarIniciativa} className="btn-login primary" style={{margin:0}}>ENVIAR</button>
                        </div>
                    )}
                </div>
            </div>
        )}

        <div className="mesa-container">
            <div className="mesa-area-principal">
                {!souMestre && (
                    <div style={{marginBottom: '30px'}}>
                        <h2 style={{color:'var(--cor-destaque)'}}>MEU PERSONAGEM</h2>
                        {meuPersonagem ? (
                            <div className="item-card" style={{ padding: '20px', textAlign: 'center', border: '2px solid var(--cor-destaque)', background: 'rgba(0, 145, 255, 0.05)' }}>
                                <h3 style={{ fontSize: '2em', margin: '10px 0' }}>{meuPersonagem.info.nome || "Sem Nome"}</h3>
                                <p style={{ fontSize: '1.2em', color: '#ccc' }}>{meuPersonagem.info.classe} - NEX {meuPersonagem.info.nex}</p>
                                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '20px' }}>
                                    <button onClick={() => setFichaAbertaId(usuario.uid)} className="btn-login primary" style={{ padding: '10px 30px', fontSize: '1.1em' }}>ABRIR FICHA ▶</button>
                                    <button onClick={abrirImportacao} className="btn-login anon" style={{fontSize:'0.9em'}}>Trocar Ficha</button>
                                </div>
                            </div>
                        ) : (
                            <div className="dashboard-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
                                <div onClick={abrirImportacao} className="card-novo"><span>📥</span><h3>Importar</h3></div>
                                <div onClick={criarNova} className="card-novo"><span>✨</span><h3>Criar Novo</h3></div>
                            </div>
                        )}
                    </div>
                )}

                <h2 style={{color: souMestre ? 'gold' : '#aaa'}}>TODOS OS AGENTES</h2>
                <div className="dashboard-grid">
                    {mesaData.jogadores.filter(j => j.uid !== mesaData.mestre).map(jogador => {
                        const ficha = fichasDaMesa.find(f => f.uid === jogador.uid);
                        const isMe = jogador.uid === usuario.uid;
                        const podeAbrir = souMestre || isMe;
                        return (
                            <div key={jogador.uid} className="dashboard-card" style={{ borderColor: isMe ? 'var(--cor-destaque)' : '#333', opacity: ficha ? 1 : 0.7 }}>
                                <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                                    <strong>{jogador.nome}</strong>
                                    {souMestre && <button onClick={()=>handleExpulsar(jogador.uid)} style={{color:'red', background:'none', border:'none', fontSize:'1.2em', cursor:'pointer'}} title="Expulsar">×</button>}
                                </div>
                                {ficha ? (
                                    <div style={{marginTop:'10px'}}>
                                        <h4 style={{color:'var(--cor-destaque)', margin:'5px 0'}}>{ficha.info.nome}</h4>
                                        <p style={{fontSize:'0.8em', color:'#aaa'}}>{ficha.info.classe} {ficha.info.nex}</p>
                                        {podeAbrir ? (
                                            <button onClick={() => setFichaAbertaId(jogador.uid)} className={isMe ? "btn-login primary" : "btn-login google"} style={{width:'100%', fontSize:'0.8em', marginTop:'5px'}}>
                                                {isMe ? 'Abrir Minha Ficha' : 'Ver Ficha (Mestre)'}
                                            </button>
                                        ) : (
                                            <div style={{fontSize:'0.8em', color:'#555', border:'1px dashed #444', padding:'5px', marginTop:'5px', borderRadius:'4px'}}>Ficha Oculta</div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="estado-vazio" style={{fontSize:'0.8em', padding:'5px', marginTop:'10px'}}>Sem ficha vinculada.</div>
                                )}
                            </div>
                        )
                    })}
                    {mesaData.jogadores.length <= 1 && <div className="estado-vazio" style={{gridColumn:'1/-1'}}>Nenhum jogador conectado.</div>}
                </div>
            </div>

            <div className="mesa-sidebar">
                 <h3 style={{color:'#aaa', borderBottom:'1px solid #444', margin:'0 0 10px 0', paddingBottom:'5px'}}>
                    Conectados ({mesaData.jogadores.length})
                 </h3>
                 <ul className="mesa-lista-jogadores">
                    {mesaData.jogadores.map(j => (
                        <li key={j.uid} className="mesa-jogador-item">
                             <div style={{width:'8px', height:'8px', borderRadius:'50%', background: j.uid === mesaData.mestre ? 'gold' : (j.uid === usuario.uid ? 'var(--cor-destaque)' : '#fff')}}></div>
                             <span style={{color: j.uid===usuario.uid?'var(--cor-destaque)':'#ddd'}}>
                                {j.nome} {j.uid === mesaData.mestre ? '(Mestre)' : ''}
                             </span>
                        </li>
                    ))}
                 </ul>
            </div>
        </div>
      </div>

      {showBestiarioModal && (
        <div className="modal-overlay">
            <div className="modal-conteudo" style={{maxWidth:'800px'}}>
                <div className="modal-header"><h3>Bestiário</h3><button onClick={()=>setShowBestiarioModal(false)} className="btn-fechar-modal">X</button></div>
                <div className="modal-body">
                    {bestiario.map(m => (
                        <div key={m.id} className="item-card" style={{padding:'15px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', borderLeft:`4px solid ${m.elemento==='Sangue'?'red':'#444'}`}}>
                            <div>
                                <strong style={{fontSize:'1.2em'}}>{m.nome}</strong>
                                <div style={{fontSize:'0.9em', color:'#aaa'}}>
                                    VD {m.vd} | <span style={{color:'gold'}}>Iniciativa: {m.iniciativa}</span>
                                </div>
                            </div>
                            <button onClick={()=>adicionarMonstro(m)} className="btn-login primary" style={{margin:0, padding:'5px 15px'}}>Adicionar</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}

      {criaturaSelecionada && <FichaCriatura dados={criaturaSelecionada} onClose={() => setCriaturaSelecionada(null)} />}
      
      {showImportModal && (
        <div className="modal-overlay">
            <div className="modal-conteudo">
                <div className="modal-header"><h3>Importar Personagem</h3><button onClick={()=>setShowImportModal(false)} className="btn-fechar-modal">X</button></div>
                <div className="modal-body">
                    {minhasFichas.length === 0 ? <p className="estado-vazio">Você não tem fichas pessoais criadas.</p> : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {minhasFichas.map(f => (
                                <div key={f.id} onClick={()=>confirmarImportacao(f.dadosCompletos)} className="item-card" style={{cursor:'pointer', padding:'15px', border:'1px solid #444'}}>
                                    <strong style={{color:'var(--cor-destaque)'}}>{f.nome}</strong>
                                    <span style={{float:'right', color:'#aaa'}}>{f.classe} {f.nex}</span>
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