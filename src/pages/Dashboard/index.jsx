// src/pages/Dashboard/index.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom'; 
import { useDialog } from '../../contexts/DialogContext'; 
import { criarMesa, buscarMinhasMesas, entrarNaMesa, listarPersonagensPessoais, criarFichaPessoal, excluirFichaPessoal } from '../../lib/mesas';
import '../Login/Login.css'; 

// --- IMPORTS DO FIREBASE ---
import { db } from '../../lib/firebase'; 
import { collection, addDoc } from 'firebase/firestore';

export default function Dashboard() {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useDialog(); 
  
  const [mesas, setMesas] = useState([]);
  const [fichasPessoais, setFichasPessoais] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showCriarMesa, setShowCriarMesa] = useState(false);
  const [showEntrarMesa, setShowEntrarMesa] = useState(false);
  const [inputNomeMesa, setInputNomeMesa] = useState('');
  const [inputCodigoMesa, setInputCodigoMesa] = useState('');

  // --- EFEITO DE PARALAXE ---
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (window.innerWidth - e.pageX * 2) / 25;
      const y = (window.innerHeight - e.pageY * 2) / 25;
      setOffset({ x, y });
    };

    const handleOrientation = (e) => {
      let x = e.gamma;
      let y = e.beta;
      if (y > 90) y = 90;
      if (y < -90) y = -90;
      const mobileSensibilidade = 1.5; 
      setOffset({ 
        x: x * mobileSensibilidade, 
        y: (y - 45) * mobileSensibilidade 
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation);
      }
    };
  }, []);

  // --- CARREGAMENTO DE DADOS ---
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

  // --- AÇÕES DE MESA ---
  const handleCriarMesa = async () => {
    if (!inputNomeMesa) return;
    try {
      const novoId = await criarMesa(inputNomeMesa, usuario.uid, usuario.displayName);
      setInputNomeMesa(''); setShowCriarMesa(false);
      navigate(`/mesa/${novoId}`);
    } catch (e) { 
        showAlert("Erro ao criar mesa: " + e.message, "Erro"); 
    }
  };

  const handleEntrarMesa = async () => {
    if (!inputCodigoMesa) return;
    try {
      await entrarNaMesa(inputCodigoMesa, usuario.uid, usuario.displayName);
      navigate(`/mesa/${inputCodigoMesa}`);
    } catch (e) { 
        showAlert(e.message, "Erro"); 
    }
  };

  // --- AÇÕES DE FICHA ---
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
    const confirmado = await showConfirm("Excluir esta ficha permanentemente? Essa ação não pode ser desfeita.", "Excluir Ficha");
    if(confirmado) {
        await excluirFichaPessoal(usuario.uid, id);
        carregarDados();
    }
  };

  // --- FUNÇÃO DE IMPORTAR JSON (CORRIGIDA) ---
  const handleImportarFicha = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const jsonContent = JSON.parse(e.target.result);
        
        if (!jsonContent.info || !jsonContent.atributos) {
            throw new Error("Arquivo inválido. O JSON não parece ser uma ficha.");
        }

        const nomeLido = jsonContent.info.nome || "Sem Nome";
        const confirmacao = window.confirm(`Arquivo lido: "${nomeLido}".\nDeseja importar esta ficha para sua conta?`);
        
        if (!confirmacao) {
            setLoading(false);
            return;
        }

        // Constrói objeto manualmente para evitar erros de referência
        const novaFicha = {
            uid: usuario.uid,
            dono: usuario.displayName,
            dataCriacao: new Date().toISOString(),
            info: jsonContent.info || {},
            atributos: jsonContent.atributos || {},
            pericias: jsonContent.pericias || {},
            recursos: jsonContent.recursos || {},
            defesa: jsonContent.defesa || {},
            resistencias: jsonContent.resistencias || {},
            inventario: Array.isArray(jsonContent.inventario) ? jsonContent.inventario : [],
            rituais: Array.isArray(jsonContent.rituais) ? jsonContent.rituais : [],
            poderes_aprendidos: Array.isArray(jsonContent.poderes_aprendidos) ? jsonContent.poderes_aprendidos : [],
            trilhas_personalizadas: Array.isArray(jsonContent.trilhas_personalizadas) ? jsonContent.trilhas_personalizadas : [],
            diario: Array.isArray(jsonContent.diario) ? jsonContent.diario : [],
            perseguicao: jsonContent.perseguicao || { sucessos: 0, falhas: 0 },
            visibilidade: jsonContent.visibilidade || 0,
            bonusManuais: jsonContent.bonusManuais || {}
        };

        const colecaoDestino = collection(db, "users", usuario.uid, "personagens");
        await addDoc(colecaoDestino, novaFicha);

        showAlert(`Ficha "${nomeLido}" importada com sucesso!`, "Sucesso");
        window.location.reload(); 

      } catch (error) {
        console.error("Erro ao importar:", error);
        showAlert("Erro ao processar o arquivo: " + error.message, "Erro");
        setLoading(false);
      }
    };
    
    reader.readAsText(file);
    event.target.value = null; 
  };

  return (
    <div style={{ paddingTop: '50px', width: '100%', minHeight: '100vh', position: 'relative', overflowX: 'hidden', backgroundColor: '#020406' }}>
      
      <div 
        className="parallax-layer" 
        style={{ 
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          position: 'fixed', 
          zIndex: 0
        }}
      >
        <img src="/assets/images/Character.webp" alt="Símbolo de Fundo" className="login-bg-symbol" />
      </div>

      <div 
        className="dashboard-container box" 
        style={{ 
          background: 'rgba(12, 18, 24, 0.75)', 
          backdropFilter: 'blur(12px)',         
          WebkitBackdropFilter: 'blur(12px)',   
          border: '1px solid rgba(255, 255, 255, 0.1)', 
          boxShadow: '0 0 60px rgba(0, 0, 0, 0.8)',     
          position: 'relative', 
          zIndex: 1 
        }}
      >
        
        <div className="dashboard-header">
          <h1 style={{ margin: 0 }}>Painel do Agente: <span style={{color:'var(--cor-destaque)'}}>{usuario?.displayName}</span></h1>
          <button onClick={logout} className="item-inventario-remover">SAIR DO SISTEMA</button>
        </div>

        {/* SEÇÃO 1: MESAS */}
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

        {/* SEÇÃO 2: FICHAS PESSOAIS */}
        <div className="dashboard-section" style={{ borderTop: '1px solid #333', paddingTop: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
             <h2 style={{ color: '#aaa', fontSize: '1.2em', borderBottom: 'none', margin: 0 }}>FICHAS PESSOAIS (OFFLINE)</h2>
             
             <div style={{display: 'flex', gap: '10px'}}>
               <label className="btn-login google" style={{width:'auto', fontSize:'0.9em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0}}>
                 Importar JSON
                 <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportarFicha} 
                    style={{display: 'none'}} 
                 />
               </label>

               <button onClick={handleCriarFicha} className="btn-add-item" style={{fontSize: '1em'}}>+ Nova Ficha</button>
             </div>
          </div>
          
          <div className="dashboard-grid">
             {fichasPessoais.map(ficha => (
                <div key={ficha.id} onClick={() => navigate(`/ficha/${ficha.id}`)} className="dashboard-card">
                   {/* CORREÇÃO DO PROBLEMA VISUAL: Usamos ficha.nome em vez de ficha.info.nome */}
                   <h4>{ficha.nome || "Sem Nome"}</h4>
                   <p style={{ fontSize: '0.9em' }}>{ficha.classe || "Mundano"} - {ficha.nex || "0%"}</p>
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