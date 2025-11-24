// src/pages/Mesa/index.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { importarPersonagemParaMesa, listarPersonagensPessoais } from '../../lib/mesas';

export default function Mesa({ mesaId, onVoltar, onAbrirFichaNaMesa }) {
  const { usuario } = useAuth();
  const [mesaData, setMesaData] = useState(null);
  const [meuPersonagemNaMesa, setMeuPersonagemNaMesa] = useState(null);
  
  // Estado para o Modal de Importação
  const [showImportModal, setShowImportModal] = useState(false);
  const [minhasFichas, setMinhasFichas] = useState([]);

  // 1. Listener da Mesa
  useEffect(() => {
    if (!mesaId) return;
    const unsub = onSnapshot(doc(db, "mesas", mesaId), (docSnap) => {
      if (docSnap.exists()) setMesaData(docSnap.data());
    });
    return () => unsub();
  }, [mesaId]);

  // 2. Listener do Meu Personagem nesta Mesa
  useEffect(() => {
    if (!mesaId || !usuario) return;
    // Ouve em tempo real se a ficha foi criada ou alterada
    const unsubChar = onSnapshot(doc(db, "mesas", mesaId, "personagens", usuario.uid), (snap) => {
      if (snap.exists()) {
        setMeuPersonagemNaMesa(snap.data());
      } else {
        setMeuPersonagemNaMesa(null);
      }
    });
    return () => unsubChar();
  }, [mesaId, usuario]);

  const handleCopiarCodigo = () => {
    navigator.clipboard.writeText(mesaId);
    alert("Código copiado!");
  };

  // Abre o modal e carrega as fichas pessoais
  const abrirImportacao = async () => {
    const lista = await listarPersonagensPessoais(usuario.uid);
    setMinhasFichas(lista);
    setShowImportModal(true);
  };

  const confirmarImportacao = async (dadosFicha) => {
    if(window.confirm(`Importar "${dadosFicha.info.nome}" para esta mesa? Isso substituirá qualquer personagem atual nesta mesa.`)) {
        await importarPersonagemParaMesa(mesaId, usuario.uid, dadosFicha);
        setShowImportModal(false);
        // Não precisa recarregar, o onSnapshot do useEffect 2 vai atualizar a tela automaticamente!
    }
  };

  const criarNovaNaMesa = async () => {
    if(window.confirm("Criar ficha do zero nesta mesa?")) {
        await importarPersonagemParaMesa(mesaId, usuario.uid, null);
        // Novamente, sem reload. O estado atualiza sozinho.
    }
  };

  if (!mesaData) return <div className="item-placeholder">Carregando Mesa...</div>;

  return (
    <div className="login-container" style={{ flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '20px', overflowY: 'auto' }}>
      <div className="box" style={{ width: '95%', maxWidth: '1200px', minHeight: '80vh' }}>
        
        {/* Header Mesa */}
        <div style={{ borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <h1 style={{ fontSize: '1.5em', margin: 0 }}>{mesaData.nome}</h1>
                {mesaData.mestre === usuario.uid && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                        <span style={{ color: '#666' }}>ID:</span>
                        <code style={{ background: '#222', padding: '2px 6px', borderRadius: '4px', color: 'var(--cor-destaque)' }}>{mesaId}</code>
                        <button onClick={handleCopiarCodigo} style={{ fontSize: '0.7em', padding: '4px' }}>Copiar</button>
                    </div>
                )}
            </div>
            <button onClick={onVoltar} className="item-inventario-remover">Sair da Mesa</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
            
            {/* Área do Jogador */}
            <div>
                <h2 style={{ color: 'var(--cor-destaque)' }}>Meu Personagem</h2>
                
                {meuPersonagemNaMesa ? (
                    <div className="item-card" style={{ padding: '20px', textAlign: 'center', border: '2px solid var(--cor-destaque)', background: 'rgba(0, 145, 255, 0.05)' }}>
                        <h3 style={{ fontSize: '1.8em', margin: '10px 0' }}>{meuPersonagemNaMesa.info.nome || "Sem Nome"}</h3>
                        <p style={{ color: '#ccc' }}>{meuPersonagemNaMesa.info.classe} - NEX {meuPersonagemNaMesa.info.nex}</p>
                        
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                            <button onClick={() => onAbrirFichaNaMesa(mesaId)} className="btn-login primary" style={{ width: 'auto', padding: '10px 30px' }}>
                                ABRIR FICHA
                            </button>
                            <button onClick={abrirImportacao} className="btn-login anon" style={{ width: 'auto', fontSize: '0.8em' }}>
                                Substituir Ficha
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div onClick={abrirImportacao} className="item-card" style={{ padding: '30px', textAlign: 'center', cursor: 'pointer', border: '1px dashed #666', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '200px' }}>
                            <span style={{ fontSize: '2em', marginBottom: '10px' }}>📥</span>
                            <h3>Importar Ficha</h3>
                            <p style={{ fontSize: '0.9em', color: '#888' }}>Trazer um personagem da sua lista pessoal.</p>
                        </div>
                        <div onClick={criarNovaNaMesa} className="item-card" style={{ padding: '30px', textAlign: 'center', cursor: 'pointer', border: '1px dashed #666', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '200px' }}>
                            <span style={{ fontSize: '2em', marginBottom: '10px' }}>✨</span>
                            <h3>Criar Novo</h3>
                            <p style={{ fontSize: '0.9em', color: '#888' }}>Criar um personagem do zero nesta mesa.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Lista de Jogadores */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px', alignSelf: 'start' }}>
                <h3 style={{ fontSize: '1em', color: '#aaa', borderBottom: '1px solid #333', paddingBottom: '5px', margin: 0 }}>
                    Equipe ({mesaData.jogadores.length})
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
                    {mesaData.jogadores.map(uid => (
                        <li key={uid} style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: uid === mesaData.mestre ? 'gold' : (uid === usuario.uid ? 'var(--cor-destaque)' : '#fff') }}></div>
                            <span style={{ color: uid === usuario.uid ? 'var(--cor-destaque)' : '#ddd', fontSize: '0.9em' }}>
                                {uid === mesaData.mestre ? 'Mestre' : (uid.slice(0, 6) + '...')}
                                {uid === usuario.uid && ' (Você)'}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

        </div>
      </div>

      {/* MODAL DE IMPORTAÇÃO */}
      {showImportModal && (
        <div className="modal-overlay">
            <div className="modal-conteudo" style={{ maxWidth: '600px' }}>
                <div className="modal-header">
                    <h3>Selecione um Personagem</h3>
                    <button onClick={() => setShowImportModal(false)} className="btn-fechar-modal">X</button>
                </div>
                <div className="modal-body">
                    {minhasFichas.length === 0 ? (
                        <p style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Você não tem fichas pessoais.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {minhasFichas.map(ficha => (
                                <div 
                                    key={ficha.id} 
                                    onClick={() => confirmarImportacao(ficha.dadosCompletos)}
                                    className="item-card"
                                    style={{ padding: '15px', cursor: 'pointer', border: '1px solid #444' }}
                                >
                                    <strong style={{ color: 'var(--cor-destaque)' }}>{ficha.nome}</strong>
                                    <span style={{ float: 'right', fontSize: '0.8em', color: '#aaa' }}>{ficha.classe} - {ficha.nex}</span>
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