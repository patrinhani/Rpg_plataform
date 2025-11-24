// src/pages/Mesa/index.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, collection, onSnapshot, getDoc } from 'firebase/firestore'; // Adicionado collection
import { useAuth } from '../../contexts/AuthContext';
import { importarPersonagemParaMesa, listarPersonagensPessoais } from '../../lib/mesas';

export default function Mesa({ mesaId, onVoltar, onAbrirFichaNaMesa }) {
  const { usuario } = useAuth();
  const [mesaData, setMesaData] = useState(null);
  
  // Estado JOGADOR
  const [meuPersonagem, setMeuPersonagem] = useState(null);
  
  // Estado MESTRE
  const [personagensDaMesa, setPersonagensDaMesa] = useState([]);

  // Estado Modais (Importação)
  const [showImportModal, setShowImportModal] = useState(false);
  const [minhasFichas, setMinhasFichas] = useState([]);

  // 1. Carrega Dados da Mesa
  useEffect(() => {
    if (!mesaId) return;
    const unsub = onSnapshot(doc(db, "mesas", mesaId), (docSnap) => {
      if (docSnap.exists()) setMesaData(docSnap.data());
    });
    return () => unsub();
  }, [mesaId]);

  const souMestre = mesaData?.mestre === usuario.uid;

  // 2. (SE FOR JOGADOR) Monitora MINHA ficha
  useEffect(() => {
    if (!mesaId || !usuario || souMestre) return;
    const unsub = onSnapshot(doc(db, "mesas", mesaId, "personagens", usuario.uid), (snap) => {
      setMeuPersonagem(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [mesaId, usuario, souMestre]);

  // 3. (SE FOR MESTRE) Monitora TODAS as fichas
  useEffect(() => {
    if (!mesaId || !souMestre) return;
    const q = collection(db, "mesas", mesaId, "personagens");
    const unsub = onSnapshot(q, (snapshot) => {
        const lista = [];
        snapshot.forEach(doc => lista.push({ uid: doc.id, ...doc.data() }));
        setPersonagensDaMesa(lista);
    });
    return () => unsub();
  }, [mesaId, souMestre]);

  // --- AÇÕES ---
  const handleCopiarCodigo = () => {
    navigator.clipboard.writeText(mesaId);
    alert("Código copiado!");
  };

  const abrirImportacao = async () => {
    const lista = await listarPersonagensPessoais(usuario.uid);
    setMinhasFichas(lista);
    setShowImportModal(true);
  };

  const confirmarImportacao = async (dadosFicha) => {
    if(window.confirm(`Importar "${dadosFicha.info.nome}"?`)) {
        await importarPersonagemParaMesa(mesaId, usuario.uid, dadosFicha);
        setShowImportModal(false);
    }
  };

  const criarNovaNaMesa = async () => {
    if(window.confirm("Criar ficha do zero nesta mesa?")) {
        await importarPersonagemParaMesa(mesaId, usuario.uid, null);
    }
  };

  if (!mesaData) return <div className="item-placeholder">Carregando Mesa...</div>;

  // --- RENDERIZAÇÃO: VISÃO DO MESTRE ---
  if (souMestre) {
    return (
      <div className="login-container" style={{ flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '20px', overflowY: 'auto' }}>
        <div className="box" style={{ width: '95%', maxWidth: '1200px', minHeight: '80vh', borderColor: 'gold' }}>
          
          <div style={{ borderBottom: '1px solid #444', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                  <h1 style={{ fontSize: '1.5em', margin: 0, color: 'gold' }}>👑 {mesaData.nome} (Mestre)</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                      <span style={{ color: '#666' }}>Código de Convite:</span>
                      <code style={{ background: '#222', padding: '2px 6px', borderRadius: '4px', color: 'gold' }}>{mesaId}</code>
                      <button onClick={handleCopiarCodigo} style={{ fontSize: '0.7em', padding: '4px' }}>Copiar</button>
                  </div>
              </div>
              <button onClick={onVoltar} className="item-inventario-remover">Sair da Mesa</button>
          </div>

          <h2 style={{ color: 'gold' }}>PERSONAGENS DOS JOGADORES</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {mesaData.jogadores.filter(uid => uid !== usuario.uid).map(uid => {
                const ficha = personagensDaMesa.find(p => p.uid === uid);
                return (
                  <div key={uid} className="item-card" style={{ padding: '15px', border: '1px solid #444' }}>
                    {ficha ? (
                      <>
                        <h3 style={{ color: 'var(--cor-destaque)', margin: '0 0 5px 0' }}>{ficha.info.nome || "Sem Nome"}</h3>
                        <p style={{ color: '#aaa', fontSize: '0.9em' }}>{ficha.info.classe} - NEX {ficha.info.nex}</p>
                        <p style={{ color: '#666', fontSize: '0.8em' }}>Jogador: {ficha.info.jogador}</p>
                        <button 
                          onClick={() => onAbrirFichaNaMesa(uid)} // Abre a ficha DESTE jogador
                          className="btn-login google" 
                          style={{ marginTop: '10px', width: '100%', fontSize: '0.9em' }}
                        >
                          Ver Ficha
                        </button>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                        <p>Agente ID: {uid.slice(0,5)}...</p>
                        <small>Criando ficha...</small>
                      </div>
                    )}
                  </div>
                );
            })}
            {mesaData.jogadores.length <= 1 && (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Nenhum jogador entrou ainda. Envie o código!</p>
            )}
          </div>

        </div>
      </div>
    );
  }

  // --- RENDERIZAÇÃO: VISÃO DO JOGADOR ---
  return (
    <div className="login-container" style={{ flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '20px', overflowY: 'auto' }}>
      <div className="box" style={{ width: '95%', maxWidth: '1200px', minHeight: '80vh' }}>
        
        <div style={{ borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '1.5em', margin: 0 }}>{mesaData.nome}</h1>
            <button onClick={onVoltar} className="item-inventario-remover">Sair da Mesa</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
            
            {/* Área do Personagem */}
            <div>
                <h2 style={{ color: 'var(--cor-destaque)' }}>Meu Personagem</h2>
                
                {meuPersonagem ? (
                    <div className="item-card" style={{ padding: '30px', textAlign: 'center', border: '2px solid var(--cor-destaque)', background: 'rgba(0, 145, 255, 0.05)' }}>
                        <h3 style={{ fontSize: '2em', margin: '10px 0' }}>{meuPersonagem.info.nome || "Sem Nome"}</h3>
                        <p style={{ color: '#ccc', fontSize: '1.2em' }}>{meuPersonagem.info.classe} - NEX {meuPersonagem.info.nex}</p>
                        
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
                            <button onClick={() => onAbrirFichaNaMesa(usuario.uid)} className="btn-login primary" style={{ width: 'auto', padding: '12px 40px', fontSize: '1.1em' }}>
                                JOGAR AGORA ▶
                            </button>
                            <button onClick={abrirImportacao} className="btn-login anon" style={{ width: 'auto', fontSize: '0.9em' }}>
                                Trocar Ficha
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div onClick={abrirImportacao} className="item-card" style={{ padding: '40px', textAlign: 'center', cursor: 'pointer', border: '1px dashed #666' }}>
                            <span style={{ fontSize: '3em' }}>📥</span>
                            <h3>Importar</h3>
                            <p style={{ color: '#888' }}>Usar ficha existente</p>
                        </div>
                        <div onClick={criarNovaNaMesa} className="item-card" style={{ padding: '40px', textAlign: 'center', cursor: 'pointer', border: '1px dashed #666' }}>
                            <span style={{ fontSize: '3em' }}>✨</span>
                            <h3>Criar Nova</h3>
                            <p style={{ color: '#888' }}>Começar do zero</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Lista de Companheiros */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', alignSelf: 'start' }}>
                <h3 style={{ fontSize: '1em', color: '#aaa', borderBottom: '1px solid #333', paddingBottom: '5px', margin: 0 }}>Equipe</h3>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
                    {mesaData.jogadores.map(uid => (
                        <li key={uid} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: uid === mesaData.mestre ? 'gold' : (uid === usuario.uid ? 'var(--cor-destaque)' : '#fff') }}></div>
                            <span style={{ color: uid === usuario.uid ? 'var(--cor-destaque)' : '#ddd' }}>
                                {uid === mesaData.mestre ? 'Mestre' : (uid === usuario.uid ? 'Você' : 'Agente')}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

        </div>
      </div>

      {/* MODAL IMPORTAÇÃO (Apenas para jogador) */}
      {showImportModal && (
        <div className="modal-overlay">
            <div className="modal-conteudo" style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h3>Importar Personagem</h3>
                    <button onClick={() => setShowImportModal(false)} className="btn-fechar-modal">X</button>
                </div>
                <div className="modal-body">
                    {minhasFichas.length === 0 ? (
                        <p style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Você não tem fichas pessoais.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {minhasFichas.map(ficha => (
                                <div key={ficha.id} onClick={() => confirmarImportacao(ficha.dadosCompletos)} className="item-card" style={{ padding: '15px', cursor: 'pointer', border: '1px solid #444' }}>
                                    <strong style={{ color: 'var(--cor-destaque)' }}>{ficha.nome}</strong>
                                    <span style={{ float: 'right', color: '#aaa' }}>{ficha.classe} - {ficha.nex}</span>
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