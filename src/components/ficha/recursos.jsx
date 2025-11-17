// /src/components/ficha/recursos.jsx
// (ATUALIZADO: Adicionadas barras de status compactas + caminhos de imagem corrigidos)

import React from 'react';

function Recursos({ 
  dados, 
  dadosPerseguicao, 
  dadosVisibilidade, 
  info, // Recebe o 'info' para pegar a foto e o tema
  onFichaChange 
}) {

  const handleChange = (e) => {
    const campo = e.target.id; // ex: "pv_atual"
    const valor = e.target.value;
    onFichaChange('recursos', campo, valor);
  };
  
  const handleTrackerClick = (tipo, valorAtual) => {
    const novoValor = (valorAtual >= 3) ? 0 : valorAtual + 1;
    onFichaChange('perseguicao', tipo, novoValor);
  };

  const handleVisibilidadeChange = (delta) => {
    onFichaChange('visibilidade_mudar', 'visibilidade', delta);
  };

  const handleResetClick = (e) => {
    e.stopPropagation(); 
    onFichaChange('perseguicao', 'reset', 0);
  };

  const renderBoxes = (tipo, contagem) => {
    let boxes = [];
    for (let i = 1; i <= 3; i++) {
      boxes.push(
        <div 
          key={i} 
          className={`tracker-box ${i <= contagem ? 'checked' : ''}`}
        />
      );
    }
    return (
      <div className="tracker-boxes" onClick={() => handleTrackerClick(tipo, contagem)}>
        {boxes}
      </div>
    );
  };

  const visibilidadeAtual = dadosVisibilidade || 0;
  
  // Define o caminho do símbolo do tema com base no tema do dataset (definido em App.jsx)
  const getTemaIcon = () => {
    const tema = document.documentElement.dataset.tema || 'tema-ordem';
    
    // --- CORREÇÃO APLICADA AQUI ---
    // Os caminhos agora apontam para os arquivos "Simbolo...webp" corretos
    switch (tema) {
      case "tema-sangue": return "/assets/images/SimboloSangue.webp";
      case "tema-morte": return "/assets/images/SimboloMorte.webp";
      case "tema-conhecimento": return "/assets/images/SimboloConhecimento.webp";
      case "tema-energia": return "/assets/images/SimboloEnergia.webp";
      case "tema-ordem":
      default:
        return "/assets/images/SimboloSemafinidade.webp";
    }
    // --- FIM DA CORREÇÃO ---
  };
  
  // --- CÁLCULO DE PORCENTAGEM PARA AS BARRAS ---
  const pvPerc = Math.max(0, Math.min(100, (dados.pv_atual / (dados.pv_max || 1)) * 100));
  const sanPerc = Math.max(0, Math.min(100, (dados.san_atual / (dados.san_max || 1)) * 100));
  const pePerc = Math.max(0, Math.min(100, (dados.pe_atual / (dados.pe_max || 1)) * 100));
  // --- FIM DO CÁLCULO ---

  return (
    // O container fixo agora é o próprio componente
    <div className="recursos-container-fixo">
      
      {/* --- HUD Compacta (PV, SAN, PE) --- */}
      <div className="recursos-hud-itens">
        
        {/* PV */}
        <div className="recurso-hud-item" id="hud-pv">
          <label htmlFor="pv_atual">PV</label>
          {/* --- BARRA DE PV ADICIONADA --- */}
          <div className="hud-barra-container">
            <div 
              className="hud-barra-preenchimento" 
              id="barra-pv-hud" 
              style={{ width: `${pvPerc}%` }}
            ></div>
          </div>
          {/* --- FIM DA BARRA --- */}
          <div className="hud-numeros-container">
            <input 
              type="number" 
              id="pv_atual" 
              className="hud-input-atual" 
              value={dados.pv_atual}
              onChange={handleChange}
            />
            <span className="hud-separador">/</span>
            <span className="hud-valor-max">{dados.pv_max}</span>
          </div>
        </div>
        
        {/* SAN */}
        <div className="recurso-hud-item" id="hud-san">
          <label htmlFor="san_atual">SAN</label>
          {/* --- BARRA DE SAN ADICIONADA --- */}
          <div className="hud-barra-container">
            <div 
              className="hud-barra-preenchimento" 
              id="barra-san-hud" 
              style={{ width: `${sanPerc}%` }}
            ></div>
          </div>
          {/* --- FIM DA BARRA --- */}
          <div className="hud-numeros-container">
            <input 
              type="number" 
              id="san_atual" 
              className="hud-input-atual"
              value={dados.san_atual}
              onChange={handleChange}
            />
            <span className="hud-separador">/</span>
            <span className="hud-valor-max">{dados.san_max}</span>
          </div>
        </div>
        
        {/* PE */}
        <div className="recurso-hud-item" id="hud-pe">
          <label htmlFor="pe_atual">PE</label>
          {/* --- BARRA DE PE ADICIONADA --- */}
          <div className="hud-barra-container">
            <div 
              className="hud-barra-preenchimento" 
              id="barra-pe-hud" 
              style={{ width: `${pePerc}%` }}
            ></div>
          </div>
          {/* --- FIM DA BARRA --- */}
          <div className="hud-numeros-container">
            <input 
              type="number" 
              id="pe_atual" 
              className="hud-input-atual"
              value={dados.pe_atual}
              onChange={handleChange}
            />
            <span className="hud-separador">/</span>
            <span className="hud-valor-max">{dados.pe_max}</span>
          </div>
        </div>
      </div>

      {/* --- Imagem do Personagem --- */}
      <div className="personagem-imagem-container">
        {/* Fundo Arcano (baseado no tema) */}
        <img 
          src={getTemaIcon()} 
          alt="Símbolo do Tema" 
          className="personagem-imagem-fundo" 
        />
        {/* Foto (retângulo central) */}
        <div 
          className="personagem-imagem-foto"
          style={{ backgroundImage: info.foto ? `url(${info.foto})` : 'none' }}
        ></div>
      </div>
      
      {/* --- Trackers de Furtividade / Perseguição --- */}
      <div className="recursos-hud-trackers">
        <div 
          className={`tracker-linha visibilidade ${visibilidadeAtual >= 3 ? 'full' : ''}`}
        >
          <span>Visibilidade</span>
          <div className="vis-tracker-container">
            <button className="vis-btn" onClick={() => handleVisibilidadeChange(-1)}>-</button>
            <span className="vis-numero">{visibilidadeAtual}</span>
            <button className="vis-btn" onClick={() => handleVisibilidadeChange(1)}>+</button>
          </div>
        </div>
        
        {/* Mostra perseguição se visibilidade for 3+ */}
        {visibilidadeAtual >= 3 && (
          <div className="perseguicao-container">
            <div 
              className={`tracker-linha sucesso ${dadosPerseguicao.sucessos >= 3 ? 'full' : ''}`}
            >
              <span>Sucessos</span>
              {renderBoxes('sucessos', dadosPerseguicao.sucessos)}
            </div>
            <div 
              className={`tracker-linha falha ${dadosPerseguicao.falhas >= 3 ? 'full' : ''}`}
            >
              <span>Falhas</span>
              {renderBoxes('falhas', dadosPerseguicao.falhas)}
            </div>
            <button className="btn-reset-perseguicao" onClick={handleResetClick}>
              Resetar
            </button>
          </div>
        )}
      </div>

    </div>
  );
}

export default Recursos;