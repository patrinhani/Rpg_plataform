// src/pages/Mesa/index.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { importarPersonagemParaMesa } from '../../lib/mesas';
import { ficha as FichaClass } from '../../lib/personagem'; // Para pegar dados atuais se quiser clonar

export default function Mesa({ mesaId, onVoltar, onAbrirFichaNaMesa }) {
  const { usuario } = useAuth();
  const [mesaData, setMesaData] = useState(null);
  const [meuPersonagemNaMesa, setMeuPersonagemNaMesa] = useState(null);

  // 1. Listener da Mesa (Para ver quem entrou em tempo real)
  useEffect(() => {
    if (!mesaId) return;
    const unsub = onSnapshot(doc(db, "mesas", mesaId), (docSnap) => {
      if (docSnap.exists()) {
        setMesaData(docSnap.data());
      }
    });
    return () => unsub();
  }, [mesaId]);

  // 2. Verificar se eu já tenho ficha nesta mesa
  useEffect(() => {
    if (!mesaId || !usuario) return;
    // O caminho da ficha do jogador nesta mesa é fixo na nossa lógica simplificada
    const charRef = doc(db, "mesas", mesaId, "personagens", usuario.uid);
    
    const checkChar = async () => {
      const snap = await getDoc(charRef);
      if (snap.exists()) {
        setMeuPersonagemNaMesa(snap.data());
      } else {
        setMeuPersonagemNaMesa(null);
      }
    };
    checkChar();
  }, [mesaId, usuario]);

  const handleCopiarCodigo = () => {
    navigator.clipboard.writeText(mesaId);
    alert("Código copiado: " + mesaId);
  };

  // Importar ficha pessoal atual para a mesa
  const handleImportarAtual = async () => {
    if(window.confirm("Deseja copiar sua Ficha Pessoal atual para esta mesa?")) {
      // 1. Pega os dados da ficha pessoal (que estão carregados na classe estática ou no banco)
      // O ideal seria buscar do banco, mas para simplificar, vamos assumir que o usuário quer criar uma nova ou clonar a que ele tem em memória se ele veio de lá.
      
      // Vamos buscar do banco a ficha pessoal dele para garantir
      const snapPessoal = await getDoc(doc(db, "personagens", usuario.uid));
      const dadosPessoais = snapPessoal.exists() ? snapPessoal.data() : null;

      await importarPersonagemParaMesa(mesaId, usuario.uid, dadosPessoais);
      // Recarrega a tela (o useEffect vai detectar a ficha nova)
      window.location.reload(); // Maneira rápida de atualizar estado
    }
  };

  const handleCriarNova = async () => {
    if(window.confirm("Criar uma ficha zerada para esta mesa?")) {
      await importarPersonagemParaMesa(mesaId, usuario.uid, null); // null cria padrão
      window.location.reload();
    }
  };

  if (!mesaData) return <div className="item-placeholder">Carregando Mesa...</div>;

  const souMestre = mesaData.mestre === usuario.uid;

  return (
    <div className="login-container" style={{ flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '20px', overflowY: 'auto' }}>
      <div className="box" style={{ width: '95%', maxWidth: '1200px' }}>
        
        {/* TOPO DA MESA */}
        <div style={{ borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <h1 style={{ fontSize: '1.5em', margin: 0 }}>{mesaData.nome}</h1>
                {souMestre && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                        <span style={{ color: '#666' }}>Código de Convite:</span>
                        <code style={{ background: '#222', padding: '5px', borderRadius: '4px', color: 'var(--cor-destaque)' }}>{mesaId}</code>
                        <button onClick={handleCopiarCodigo} style={{ fontSize: '0.7em', padding: '5px' }}>Copiar</button>
                    </div>
                )}
            </div>
            <button onClick={onVoltar} className="item-inventario-remover">Sair da Mesa</button>
        </div>

        {/* CONTEÚDO PRINCIPAL */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
            
            {/* ESQUERDA: Minha Participação */}
            <div>
                <h2 style={{ color: 'var(--cor-destaque)' }}>Meu Personagem</h2>
                
                {meuPersonagemNaMesa ? (
                    <div 
                        className="item-card"
                        style={{ padding: '20px', textAlign: 'center', cursor: 'pointer', border: '2px solid var(--cor-destaque)' }}
                        onClick={() => onAbrirFichaNaMesa(mesaId)} // Abre a ficha no contexto da mesa
                    >
                        <h3 style={{ fontSize: '1.8em' }}>{meuPersonagemNaMesa.info.nome || "Sem Nome"}</h3>
                        <p>{meuPersonagemNaMesa.info.classe} - NEX {meuPersonagemNaMesa.info.nex}</p>
                        <p style={{ color: 'var(--cor-destaque)', marginTop: '10px', fontWeight: 'bold' }}>JOGAR AGORA ▶</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <div 
                            onClick={handleImportarAtual}
                            className="item-card"
                            style={{ flex: 1, padding: '20px', textAlign: 'center', cursor: 'pointer', border: '1px dashed #666' }}
                        >
                            <h3>Importar Minha Ficha</h3>
                            <p>Copiar sua ficha pessoal para esta mesa.</p>
                        </div>
                        <div 
                            onClick={handleCriarNova}
                            className="item-card"
                            style={{ flex: 1, padding: '20px', textAlign: 'center', cursor: 'pointer', border: '1px dashed #666' }}
                        >
                            <h3>Criar Nova Ficha</h3>
                            <p>Começar um agente do zero.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* DIREITA: Lista de Jogadores (Visível para todos, mas Mestre pode ter mais opções no futuro) */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px' }}>
                <h3 style={{ fontSize: '1em', color: '#aaa', borderBottom: '1px solid #333', paddingBottom: '5px' }}>
                    Agentes na Missão ({mesaData.jogadores.length})
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
                    {mesaData.jogadores.map(uid => (
                        <li key={uid} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: uid === mesaData.mestre ? 'gold' : '#0091ff' }}></div>
                            <span style={{ color: uid === usuario.uid ? 'var(--cor-destaque)' : '#fff' }}>
                                {uid === mesaData.mestre ? 'Mestre' : (uid.slice(0,5) + '...')}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>

        </div>
      </div>
    </div>
  );
}