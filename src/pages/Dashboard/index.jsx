// src/pages/Dashboard/index.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom'; 
import { useDialog } from '../../contexts/DialogContext'; // [NOVO]
import { criarMesa, buscarMinhasMesas, entrarNaMesa, listarPersonagensPessoais, criarFichaPessoal, excluirFichaPessoal } from '../../lib/mesas';

export default function Dashboard() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useDialog(); // [NOVO]
  
  const [mesas, setMesas] = useState([]);
  const [fichasPessoais, setFichasPessoais] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showCriarMesa, setShowCriarMesa] = useState(false);
  const [showEntrarMesa, setShowEntrarMesa] = useState(false);
  const [inputNomeMesa, setInputNomeMesa] = useState('');
  const [inputCodigoMesa, setInputCodigoMesa] = useState('');

  useEffect(() => {
    if (usuario) carregarDados();
  }, [usuario]);

  async function carregarDados() {
    setLoading(true);
    try {
      const [listaMesas, listaFichas] = await Promise.all([
        buscarMinhasMesas(usuario.uid),
        listarPersonagensPessoais(usuario.uid)
      ]);
      setMesas(listaMesas);
      setFichasPessoais(listaFichas);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleCriarMesa = async () => {
    if (!inputNomeMesa) return;
    try {
      const novoId = await criarMesa(inputNomeMesa, usuario.uid, usuario.displayName);
      setInputNomeMesa(''); setShowCriarMesa(false);
      navigate(`/mesa/${novoId}`);
    } catch (e) { 
        // [ATUALIZADO]
        showAlert("Erro ao criar mesa: " + e.message, "Erro"); 
    }
  };

  const handleEntrarMesa = async () => {
    if (!inputCodigoMesa) return;
    try {
      await entrarNaMesa(inputCodigoMesa, usuario.uid, usuario.displayName);
      navigate(`/mesa/${inputCodigoMesa}`);
    } catch (e) { 
        // [ATUALIZADO]
        showAlert(e.message, "Erro"); 
    }
  };

  const handleCriarFicha = async () => {
    setLoading(true);
    try {
      const novoId = await criarFichaPessoal(usuario.uid);
      navigate(`/ficha/${novoId}`);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleExcluirFicha = async (e, id) => {
    e.stopPropagation();
    // [ATUALIZADO] Confirm via Dialog
    const confirmado = await showConfirm("Excluir esta ficha permanentemente? Essa ação não pode ser desfeita.", "Excluir Ficha");
    if(confirmado) {
        await excluirFichaPessoal(usuario.uid, id);
        carregarDados();
    }
  };

  return (
    <div className="login-container" style={{ alignItems: 'flex-start', paddingTop: '0', overflowY: 'auto' }}>
      <div className="dashboard-container box" style={{ background: 'rgba(10,10,10,0.95)', marginTop: '50px' }}>
        
        <div className="dashboard-header">
          <h1 style={{ margin: 0 }}>Painel do Agente: <span style={{color:'var(--cor-destaque)'}}>{usuario?.displayName}</span></h1>
          <button onClick={logout} className="item-inventario-remover">SAIR DO SISTEMA</button>
        </div>

        {/* SEÇÃO DE MESAS */}
        <div className="dashboard-section">
          <h2 style={{ color: 'var(--cor-destaque)', borderBottom: 'none' }}>MISSÕES (MESAS)</h2>
          
          <div className="dashboard-actions">
            <button onClick={() => setShowCriarMesa(!showCriarMesa)} className="btn-login primary" style={{width:'auto', fontSize:'0.9em'}}>+ Criar Mesa</button>
            <button onClick={() => setShowEntrarMesa(!showEntrarMesa)} className="btn-login google" style={{width:'auto', fontSize:'0.9em'}}>Entrar com Código</button>
          </div>

          {showCriarMesa && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
               <input type="text" placeholder="Nome da Campanha" value={inputNomeMesa} onChange={e => setInputNomeMesa(e.target.value)} style={{flex:1}} />
               <button onClick={handleCriarMesa}>Confirmar</button>
            </div>
          )}
          {showEntrarMesa && (
             <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
               <input type="text" placeholder="ID da Mesa" value={inputCodigoMesa} onChange={e => setInputCodigoMesa(e.target.value)} style={{flex:1}} />
               <button onClick={handleEntrarMesa}>Entrar</button>
            </div>
          )}

          <div className="dashboard-grid">
             {mesas.map(mesa => (
               <div 
                 key={mesa.id} 
                 className="dashboard-card"
                 style={{ borderLeft: mesa.papel === 'mestre' ? '4px solid gold' : '4px solid var(--cor-destaque)' }} 
                 onClick={() => navigate(`/mesa/${mesa.id}`)} 
               >
                 <h3 style={{ color: mesa.papel === 'mestre' ? 'gold' : 'var(--cor-destaque)' }}>{mesa.nome}</h3>
                 <small>{mesa.papel === 'mestre' ? 'VOCÊ É O MESTRE' : 'AGENTE DE CAMPO'}</small>
               </div>
             ))}
             {mesas.length === 0 && !loading && <div className="estado-vazio">Nenhuma missão em andamento.</div>}
          </div>
        </div>

        {/* SEÇÃO DE FICHAS PESSOAIS */}
        <div className="dashboard-section" style={{ borderTop: '1px solid #333', paddingTop: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h2 style={{ color: '#aaa', fontSize: '1.2em', borderBottom: 'none', margin: 0 }}>FICHAS PESSOAIS (OFFLINE)</h2>
             <button onClick={handleCriarFicha} className="btn-add-item" style={{fontSize: '1em'}}>+ Nova Ficha</button>
          </div>
          
          <div className="dashboard-grid">
             {fichasPessoais.map(ficha => (
                <div key={ficha.id} onClick={() => navigate(`/ficha/${ficha.id}`)} className="dashboard-card">
                   <h4>{ficha.nome}</h4>
                   <p style={{ fontSize: '0.9em' }}>{ficha.classe} - {ficha.nex}</p>
                   <button className="btn-excluir-card" onClick={(e) => handleExcluirFicha(e, ficha.id)}>&times;</button>
                </div>
             ))}
             {fichasPessoais.length === 0 && !loading && <div className="estado-vazio">Nenhuma ficha pessoal criada.</div>}
          </div>
        </div>

      </div>
    </div>
  );
}