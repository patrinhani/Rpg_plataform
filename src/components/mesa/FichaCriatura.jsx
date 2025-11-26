// src/components/mesa/FichaCriatura.jsx
import React from 'react';

export default function FichaCriatura({ dados, onClose }) {
  if (!dados) return null;

  // Cores baseadas no elemento
  const cores = {
    Sangue: '#d40000',
    Morte: '#444',
    Conhecimento: '#d4af37',
    Energia: '#9c27b0',
    Medo: '#fff'
  };
  
  const corTema = cores[dados.elemento] || '#fff';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-conteudo" style={{ maxWidth: '600px', border: `2px solid ${corTema}`, padding: '0', overflow: 'hidden' }}>
        
        {/* CABEÇALHO */}
        <div style={{ background: corTema, padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <h2 style={{ margin: 0, color: '#000', fontFamily: '"Special Elite", monospace', fontSize: '1.8em' }}>{dados.nome.toUpperCase()}</h2>
                <span style={{ color: '#000', fontWeight: 'bold', background:'rgba(255,255,255,0.3)', padding:'2px 6px', borderRadius:'4px' }}>{dados.elemento}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: 0, color: '#000', fontSize: '2.5em', lineHeight: 1 }}>VD {dados.vd}</h1>
            </div>
        </div>

        <div className="modal-body" style={{ padding: '20px', maxHeight: '80vh', overflowY: 'auto', background: '#111' }}>
            
            {/* --- ÁREA DA FOTO (NOVO) --- */}
            {dados.foto && (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                    <img 
                        src={dados.foto} 
                        alt={dados.nome} 
                        style={{ 
                            maxWidth: '100%', 
                            maxHeight: '300px', 
                            objectFit: 'contain', 
                            border: `1px solid ${corTema}`,
                            borderRadius: '4px',
                            boxShadow: `0 0 15px ${corTema}40`, // Brilho suave com a cor do elemento
                            backgroundColor: '#000'
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

        <button className="btn-fechar-modal" onClick={onClose} style={{ position: 'absolute', top: '10px', right: '10px', color: '#000', fontSize: '1.5em', background: 'none', border: 'none', cursor: 'pointer' }}>
            &times;
        </button>
      </div>
    </div>
  );
}