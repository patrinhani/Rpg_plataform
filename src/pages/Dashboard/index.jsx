// src/pages/Dashboard/index.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { criarMesa, buscarMinhasMesas, entrarNaMesa, listarPersonagensPessoais, criarFichaPessoal, excluirFichaPessoal } from '../../lib/mesas';

export default function Dashboard({ onSelectFicha, onSelectMesa }) {
  const { usuario, logout } = useAuth();
  
  const [mesas, setMesas] = useState([]);
  const [fichasPessoais, setFichasPessoais] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showCriarMesa, setShowCriarMesa] = useState(false);
  const [showEntrarMesa, setShowEntrarMesa] = useState(false);
  const [inputNomeMesa, setInputNomeMesa] = useState('');
  const [inputCodigoMesa, setInputCodigoMesa] = useState('');

  useEffect(() => {
    carregarDados();
  }, [usuario]);

  async function carregarDados() {
    if(!usuario) return;
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

  // --- Handlers de Mesa ---
  const handleCriarMesa = async () => {
    if (!inputNomeMesa) return;
    try {
      await criarMesa(inputNomeMesa, usuario.uid);
      setInputNomeMesa(''); setShowCriarMesa(false);
      carregarDados();
    } catch (e) { alert("Erro ao criar mesa"); }
  };

  const handleEntrarMesa = async () => {
    if (!inputCodigoMesa) return;
    try {
      await entrarNaMesa(inputCodigoMesa, usuario.uid);
      setInputCodigoMesa(''); setShowEntrarMesa(false);
      carregarDados();
    } catch (e) { alert(e.message); }
  };

  // --- Handlers de Ficha Pessoal ---
  const handleCriarFicha = async () => {
    setLoading(true);
    try {
      // Cria a ficha no banco e recebe o ID
      const novoId = await criarFichaPessoal(usuario.uid);
      // Abre a ficha imediatamente
      onSelectFicha(novoId); 
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const handleExcluirFicha = async (e, id) => {
    e.stopPropagation();
    if(window.confirm("Tem certeza que deseja excluir esta ficha?")) {
        await excluirFichaPessoal(usuario.uid, id);
        carregarDados();
    }
  };

  return (
    <div className="login-container" style={{ alignItems: 'flex-start', paddingTop: '50px', overflowY: 'auto' }}>
      <div className="box" style={{ maxWidth: '1000px', width: '95%', margin: '0 auto 50px auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '1.8em' }}>Painel do Agente</h1>
          <button onClick={logout} className="item-inventario-remover">Sair</button>
        </div>

        {/* MESAS */}
        <div style={{ marginTop: '30px' }}>
          <h2 style={{ color: 'var(--cor-destaque)', borderBottom: 'none' }}>MINHAS MESAS</h2>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => setShowCriarMesa(!showCriarMesa)} className="btn-login primary" style={{width: 'auto', padding: '10px 20px', fontSize: '0.9em'}}>+ Criar Mesa</button>
            <button onClick={() => setShowEntrarMesa(!showEntrarMesa)} className="btn-login google" style={{width: 'auto', padding: '10px 20px', fontSize: '0.9em'}}>Entrar com Código</button>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
             {mesas.map(mesa => (
               <div key={mesa.id} className="item-card" style={{ cursor: 'pointer', height: '100px', justifyContent: 'center', alignItems: 'center', borderLeft: mesa.papel === 'mestre' ? '4px solid gold' : '4px solid var(--cor-destaque)' }} onClick={() => onSelectMesa(mesa.id)}>
                 <h3 style={{ color: '#fff', fontSize: '1.2em' }}>{mesa.nome}</h3>
                 <small style={{color: '#aaa'}}>{mesa.papel === 'mestre' ? 'MESTRE' : 'JOGADOR'}</small>
               </div>
             ))}
             {mesas.length === 0 && !loading && <p style={{color: '#666'}}>Nenhuma mesa encontrada.</p>}
          </div>
        </div>

        {/* FICHAS PESSOAIS */}
        <div style={{ marginTop: '50px', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <h2 style={{ color: '#aaa', fontSize: '1.2em', borderBottom: 'none', margin: 0 }}>FICHAS PESSOAIS</h2>
             <button onClick={handleCriarFicha} className="btn-add-item" style={{fontSize: '1em'}}>+ Nova Ficha</button>
          </div>
          
          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '15px' }}>
             {fichasPessoais.map(ficha => (
                <div key={ficha.id} onClick={() => onSelectFicha(ficha.id)} className="item-card" style={{ cursor: 'pointer', padding: '15px', position: 'relative' }}>
                   <h4 style={{ color: 'var(--cor-destaque)', margin: '0 0 5px 0' }}>{ficha.nome}</h4>
                   <p style={{ fontSize: '0.8em', color: '#ccc', margin: 0 }}>{ficha.classe} - {ficha.nex}</p>
                   <button 
                      onClick={(e) => handleExcluirFicha(e, ficha.id)}
                      style={{ position: 'absolute', top: '5px', right: '5px', background: 'transparent', border: 'none', color: '#666', fontSize: '1.2em', padding: 0 }}
                      title="Excluir Ficha"
                   >
                     &times;
                   </button>
                </div>
             ))}
             {fichasPessoais.length === 0 && !loading && <p style={{color: '#666'}}>Você ainda não criou fichas pessoais.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}