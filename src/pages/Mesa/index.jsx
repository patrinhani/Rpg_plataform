// src/pages/Mesa/index.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, collection, onSnapshot, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { importarPersonagemParaMesa, listarPersonagensPessoais, removerJogadorDaMesa } from '../../lib/mesas';

export default function Mesa({ mesaId, onVoltar, onAbrirFichaNaMesa }) {
  const { usuario } = useAuth();
  const [mesaData, setMesaData] = useState(null);
  
  // Estado JOGADOR
  const [meuPersonagem, setMeuPersonagem] = useState(null);
  
  // Estado MESTRE (Lista de fichas)
  const [fichasDaMesa, setFichasDaMesa] = useState([]);

  // Modais
  const [showImportModal, setShowImportModal] = useState(false);
  const [minhasFichas, setMinhasFichas] = useState([]);

  // 1. Carrega Dados da Mesa (incluindo lista de nomes dos jogadores)
  useEffect(() => {
    if (!mesaId) return;
    const unsub = onSnapshot(doc(db, "mesas", mesaId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Verificação de segurança: Se fui removido, volto pro dashboard
        if (data.jogadores && !data.jogadores.some(j => j.uid === usuario.uid)) {
           alert("Você foi removido desta mesa.");
           onVoltar();
        }
        setMesaData(data);
      }
    });
    return () => unsub();
  }, [mesaId, usuario.uid]);

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
        setFichasDaMesa(lista);
    });
    return () => unsub();
  }, [mesaId, souMestre]);

  // --- AÇÕES ---
  const handleCopiarCodigo = () => {
    navigator.clipboard.writeText(mesaId);
    alert("Código copiado!");
  };

  const handleExpulsar = async (uidJogador, nomeJogador) => {
    if(window.confirm(`Tem certeza que deseja remover ${nomeJogador} da mesa?`)) {
        await removerJogadorDaMesa(mesaId, uidJogador);
    }
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
                  <h1 style={{ fontSize: '1.5em', margin: 0, color: 'gold' }}>👑 {mesaData.nome}</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                      <span style={{ color: '#666' }}>Código:</span>
                      <code style={{ background: '#222', padding: '2px 6px', borderRadius: '4px', color: 'gold' }}>{mesaId}</code>
                      <button onClick={handleCopiarCodigo} style={{ fontSize: '0.7em', padding: '4px' }}>Copiar</button>
                  </div>
              </div>
              <button onClick={onVoltar} className="item-inventario-remover">Sair</button>
          </div>

          <h2 style={{ color: 'gold' }}>JOGADORES NA MESA</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '20px' }}>
            
            {/* Filtra o mestre da lista para não aparecer para si mesmo como jogável */}
            {mesaData.jogadores.filter(j => j.uid !== usuario.uid).map(jogador => {
                const ficha = fichasDaMesa.find(p => p.uid === jogador.uid);
                return (
                  <div key={jogador.uid} className="item-card" style={{ padding: '15px', border: '1px solid #444', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <strong style={{ color: '#fff', fontSize: '1.1em' }}>{jogador.nome}</strong>
                        <button onClick={() => handleExpulsar(jogador.uid, jogador.nome)} style={{ background: 'transparent', border: 'none', color: 'red', cursor: 'pointer', fontSize: '1.2em' }} title="Expulsar">×</button>
                    </div>
                    
                    {ficha ? (
                      <div style={{ marginTop: '10px' }}>
                        <h3 style={{ color: 'var(--cor-destaque)', margin: '0 0 5px 0' }}>{ficha.info.nome || "Sem Nome"}</h3>
                        <p style={{ color: '#aaa', fontSize: '0.9em' }}>{ficha.info.classe} - NEX {ficha.info.nex}</p>
                        <button onClick={() => onAbrirFichaNaMesa(jogador.uid)} className="btn-login google" style={{ marginTop: '10px', width: '100%', fontSize: '0.9em' }}>
                          Abrir Ficha
                        </button>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                        <small>Criando ficha...</small>
                      </div>
                    )}
                  </div>
                );
            })}
            
            {mesaData.jogadores.length <= 1 && (
              <p style={{ color: '#666', fontStyle: 'italic' }}>Nenhum jogador entrou ainda.</p>
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
            <button onClick={onVoltar} className="item-inventario-remover">Sair</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
            
            <div>
                <h2 style={{ color: 'var(--cor-destaque)' }}>Meu Personagem</h2>
                {meuPersonagem ? (
                    <div className="item-card" style={{ padding: '30px', textAlign: 'center', border: '2px solid var(--cor-destaque)', background: 'rgba(0, 145, 255, 0.05)' }}>
                        <h3 style={{ fontSize: '2em', margin: '10px 0' }}>{meuPersonagem.info.nome || "Sem Nome"}</h3>
                        <p style={{ color: '#ccc', fontSize: '1.2em' }}>{meuPersonagem.info.classe} - NEX {meuPersonagem.info.nex}</p>
                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px' }}>
                            <button onClick={() => onAbrirFichaNaMesa(usuario.uid)} className="btn-login primary" style={{ width: 'auto', padding: '12px 40px', fontSize: '1.1em' }}>JOGAR ▶</button>
                            <button onClick={abrirImportacao} className="btn-login anon" style={{ width: 'auto', fontSize: '0.9em' }}>Trocar</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div onClick={abrirImportacao} className="item-card" style={{ padding: '40px', textAlign: 'center', cursor: 'pointer', border: '1px dashed #666' }}>
                            <span style={{ fontSize: '3em' }}>📥</span><h3>Importar</h3>
                        </div>
                        <div onClick={criarNovaNaMesa} className="item-card" style={{ padding: '40px', textAlign: 'center', cursor: 'pointer', border: '1px dashed #666' }}>
                            <span style={{ fontSize: '3em' }}>✨</span><h3>Criar Nova</h3>
                        </div>
                    </div>
                )}
            </div>

            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', alignSelf: 'start' }}>
                <h3 style={{ fontSize: '1em', color: '#aaa', borderBottom: '1px solid #333', paddingBottom: '5px', margin: 0 }}>Equipe</h3>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
                    {mesaData.jogadores.map(jogador => (
                        <li key={jogador.uid} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: jogador.uid === mesaData.mestre ? 'gold' : (jogador.uid === usuario.uid ? 'var(--cor-destaque)' : '#fff') }}></div>
                            <span style={{ color: jogador.uid === usuario.uid ? 'var(--cor-destaque)' : '#ddd' }}>
                                {jogador.nome} {jogador.uid === mesaData.mestre ? '(Mestre)' : ''}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
      </div>

      {showImportModal && (
        <div className="modal-overlay">
            <div className="modal-conteudo" style={{ maxWidth: '600px' }}>
                <div className="modal-header"><h3>Selecione um Personagem</h3><button onClick={() => setShowImportModal(false)} className="btn-fechar-modal">X</button></div>
                <div className="modal-body">
                    {minhasFichas.map(ficha => (
                        <div key={ficha.id} onClick={() => confirmarImportacao(ficha.dadosCompletos)} className="item-card" style={{ padding: '15px', cursor: 'pointer', border: '1px solid #444', marginBottom:'10px' }}>
                            <strong style={{ color: 'var(--cor-destaque)' }}>{ficha.nome}</strong>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
}