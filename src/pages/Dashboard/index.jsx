// src/pages/Dashboard/index.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { criarMesa, buscarMinhasMesas, entrarNaMesa } from '../../lib/mesas';

export default function Dashboard({ onSelectFicha, onSelectMesa }) {
  const { usuario, logout } = useAuth();
  
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para Modais simples (pode ser melhorado depois)
  const [showCriar, setShowCriar] = useState(false);
  const [showEntrar, setShowEntrar] = useState(false);
  const [inputNome, setInputNome] = useState('');
  const [inputCodigo, setInputCodigo] = useState('');

  useEffect(() => {
    carregarMesas();
  }, [usuario]);

  async function carregarMesas() {
    if(!usuario) return;
    setLoading(true);
    try {
      const lista = await buscarMinhasMesas(usuario.uid);
      setMesas(lista);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleCriarMesa = async () => {
    if (!inputNome) return alert("Digite um nome para a mesa");
    try {
      await criarMesa(inputNome, usuario.uid);
      alert("Mesa criada com sucesso!");
      setShowCriar(false);
      setInputNome('');
      carregarMesas();
    } catch (error) {
      alert("Erro ao criar mesa.");
    }
  };

  const handleEntrarMesa = async () => {
    if (!inputCodigo) return alert("Digite o código da mesa");
    try {
      await entrarNaMesa(inputCodigo, usuario.uid);
      alert("Você entrou na mesa!");
      setShowEntrar(false);
      setInputCodigo('');
      carregarMesas();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="login-container" style={{ alignItems: 'flex-start', paddingTop: '50px', overflowY: 'auto' }}>
      <div className="box" style={{ maxWidth: '1000px', width: '95%', margin: '0 auto' }}>
        
        {/* CABEÇALHO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '1.8em' }}>Painel do Agente</h1>
          <button onClick={logout} className="item-inventario-remover">Sair</button>
        </div>

        {/* ÁREA DE MESAS */}
        <div style={{ marginTop: '30px' }}>
          <h2 style={{ color: 'var(--cor-destaque)', borderBottom: 'none' }}>MINHAS MESAS</h2>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button onClick={() => setShowCriar(!showCriar)} className="btn-login primary" style={{width: 'auto', padding: '10px 20px', fontSize: '0.9em'}}>
               + Criar Mesa
            </button>
            <button onClick={() => setShowEntrar(!showEntrar)} className="btn-login google" style={{width: 'auto', padding: '10px 20px', fontSize: '0.9em'}}>
               Entrar com Código
            </button>
          </div>

          {/* Inputs Condicionais */}
          {showCriar && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
               <input type="text" placeholder="Nome da Campanha" value={inputNome} onChange={e => setInputNome(e.target.value)} style={{flex:1}} />
               <button onClick={handleCriarMesa}>Confirmar</button>
            </div>
          )}
          {showEntrar && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
               <input type="text" placeholder="Cole o ID da Mesa" value={inputCodigo} onChange={e => setInputCodigo(e.target.value)} style={{flex:1}} />
               <button onClick={handleEntrarMesa}>Entrar</button>
            </div>
          )}

          {/* Lista de Mesas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
             {mesas.map(mesa => (
               <div 
                 key={mesa.id} 
                 className="item-card" 
                 style={{ cursor: 'pointer', height: '120px', justifyContent: 'center', alignItems: 'center', borderLeft: mesa.papel === 'mestre' ? '4px solid gold' : '4px solid var(--cor-destaque)' }}
                 onClick={() => onSelectMesa(mesa.id)}
               >
                 <h3 style={{ color: '#fff' }}>{mesa.nome}</h3>
                 <small style={{color: '#aaa'}}>{mesa.papel === 'mestre' ? 'MESTRE' : 'JOGADOR'}</small>
               </div>
             ))}
             {mesas.length === 0 && !loading && <p style={{color: '#666'}}>Nenhuma mesa encontrada.</p>}
          </div>
        </div>

        {/* ÁREA DE FICHAS PESSOAIS (Separada) */}
        <div style={{ marginTop: '50px', borderTop: '1px solid #333', paddingTop: '20px' }}>
          <h2 style={{ color: '#aaa', fontSize: '1.2em', borderBottom: 'none' }}>FICHAS PESSOAIS (FORA DE MESA)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
             
             <div 
                onClick={() => onSelectFicha(usuario.uid)}
                className="item-card"
                style={{ cursor: 'pointer', height: '100px', justifyContent: 'center', alignItems: 'center', opacity: 0.7 }}
             >
               <h4>Minha Ficha Padrão</h4>
             </div>

          </div>
        </div>

      </div>
    </div>
  );
}