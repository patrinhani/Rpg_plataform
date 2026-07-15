// src/components/mesa/FichaCriatura.jsx
import React, { memo } from 'react';

function FichaCriatura({ dados, onClose }) {
  if (!dados) return null;

  // Cores baseadas no elemento
  const cores = {
    Sangue: '#d40000',
    Morte: '#444',
    Conhecimento: '#d4af37',
    Energia: '#9c27b0',
    Medo: '#fff'
  };
  
  // Caminhos dos símbolos
  const simbolos = {
    Sangue: '/assets/images/SimboloSangue.webp',
    Morte: '/assets/images/SimboloMorte.webp',
    Conhecimento: '/assets/images/SimboloConhecimento.webp',
    Energia: '/assets/images/SimboloEnergia.webp',
    Medo: '/assets/images/SimboloSemafinidade.webp',
    undefined: '/assets/images/SimboloSemafinidade.webp'
  };
  
  const corTema = cores[dados.elemento] || '#fff';
  const simboloFundo = simbolos[dados.elemento] || simbolos.Medo;

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="modal-conteudo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ficha-criatura-titulo"
        style={{ maxWidth: '600px', border: `2px solid ${corTema}`, padding: '0', overflow: 'hidden', position: 'relative' }}
      >
        
        {/* CABEÇALHO */}
        <div style={{ background: corTema, padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <h2 id="ficha-criatura-titulo" style={{ margin: 0, color: '#000', fontFamily: '"Special Elite", monospace', fontSize: '1.8em' }}>{dados.nome.toUpperCase()}</h2>
                <span style={{ color: '#000', fontWeight: 'bold', background:'rgba(255,255,255,0.3)', padding:'2px 6px', borderRadius:'4px' }}>{dados.elemento}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: 0, color: '#000', fontSize: '2.5em', lineHeight: 1 }}>VD {dados.vd}</h1>
            </div>
        </div>

        <div className="modal-body" style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto', background: '#111' }}>
            
            {/* --- ÁREA DA FOTO (ESTILIZADA COM SÍMBOLO) --- */}
            {dados.foto && (
                <div style={{ 
                    width: '100%', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    marginBottom: '20px',
                    position: 'relative',       
                    overflow: 'hidden',         
                    borderRadius: '6px',
                    border: `1px solid ${corTema}`,
                    boxShadow: `0 0 20px ${corTema}30`, 
                    backgroundColor: '#080808', 
                    minHeight: '250px'          
                }}>
                    
                    {/* 1. Símbolo de Fundo (Marca d'água) */}
                    <div style={{
                        position: 'absolute',
                        top: '-10%', left: '-10%', width: '120%', height: '120%', 
                        backgroundImage: `url(${simboloFundo})`,
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: 'contain',
                        opacity: 0.15,          
                        filter: 'grayscale(0.4)', 
                        zIndex: 0
                    }}></div>

                    {/* 2. Vinheta (Sombra nas bordas) */}
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, width: '100%', height: '100%',
                        background: 'radial-gradient(circle, transparent 40%, #111 100%)',
                        zIndex: 1
                    }}></div>

                    {/* 3. A Foto da Criatura (OTIMIZADA) */}
                    <img 
                        src={dados.foto} 
                        alt={dados.nome} 
                        loading="lazy"      // <-- Carregamento preguiçoso
                        decoding="async"    // <-- Decodificação em paralelo
                        style={{ 
                            maxWidth: '100%', 
                            maxHeight: '400px', 
                            objectFit: 'contain', 
                            zIndex: 2,             
                            position: 'relative',
                            filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.8))' 
                        }}
                    />
                </div>
            )}

            {/* Tipo e Presença */}
            <div style={{ marginBottom: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                <p style={{ color: '#aaa', fontStyle: 'italic' }}>{dados.tipo}</p>
                <div style={{ background: '#222', padding: '10px', borderLeft: `4px solid ${corTema}`, marginTop: '5px' }}>
                    <strong style={{ color: corTema }}>PRESENÇA PERTURBADORA</strong><br/>
                    {dados.presenca}
                </div>
            </div>

            {/* Status Principais */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                    <h4 style={{ color: corTema, borderBottom: `1px solid ${corTema}` }}>SENTIDOS</h4>
                    <p style={{fontSize:'0.9em'}}>{dados.sentidos}</p>
                    <p style={{fontSize:'0.9em'}}><strong>Iniciativa:</strong> {dados.iniciativa}</p>
                </div>
                <div>
                    <h4 style={{ color: corTema, borderBottom: `1px solid ${corTema}` }}>DEFESA {dados.defesa}</h4>
                    <p style={{fontSize:'0.9em'}}><strong>Fortitude:</strong> {dados.fortitude}</p>
                    <p style={{fontSize:'0.9em'}}><strong>Reflexos:</strong> {dados.reflexos}</p>
                    <p style={{fontSize:'0.9em'}}><strong>Vontade:</strong> {dados.vontade}</p>
                </div>
            </div>

            {/* Vida e Resistências */}
            <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>PONTOS DE VIDA <strong>{dados.pv_max}</strong></span>
                    <span style={{ color: '#666' }}>Machucado {dados.machucado}</span>
                </div>
                <p style={{ fontSize: '0.9em', color: '#ccc' }}><strong>Resistências:</strong> {dados.resistencias}</p>
                <p style={{ fontSize: '0.9em', color: '#ccc' }}><strong>Vulnerabilidades:</strong> {dados.vulnerabilidades}</p>
            </div>

            {/* Atributos */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', background: '#000', padding: '10px' }}>
                {Object.entries(dados.atributos).map(([attr, val]) => (
                    <div key={attr} style={{ textAlign: 'center' }}>
                        <div style={{ color: '#666', fontSize: '0.8em' }}>{attr.toUpperCase()}</div>
                        <div style={{ fontSize: '1.5em', color: corTema, fontWeight: 'bold' }}>{val}</div>
                    </div>
                ))}
            </div>

            {/* Deslocamento e Ações */}
            <div style={{ marginBottom: '20px' }}>
                <p><strong>Deslocamento:</strong> {dados.deslocamento}</p>
            </div>

            <div>
                <h3 style={{ color: corTema, borderBottom: '1px solid #333', paddingBottom: '5px' }}>AÇÕES</h3>
                {dados.acoes.map((acao, idx) => (
                    <div key={idx} style={{ marginBottom: '10px' }}>
                        <strong style={{ color: '#fff' }}>◆ {acao.nome}</strong>
                        <p style={{ color: '#bbb', fontSize: '0.9em', margin: 0 }}>{acao.descricao}</p>
                    </div>
                ))}
            </div>

        </div>

        <button type="button" aria-label="Fechar ficha da criatura" className="btn-fechar-modal" onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', color: '#000', fontSize: '1.5em', background: 'none', border: 'none', cursor: 'pointer' }}>
            &times;
        </button>
      </div>
    </div>
  );
}

// OTIMIZAÇÃO: Exporta com memo para evitar re-render desnecessário
export default memo(FichaCriatura);
