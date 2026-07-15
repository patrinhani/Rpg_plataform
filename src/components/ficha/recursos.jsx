// /src/components/ficha/recursos.jsx
// (ATUALIZADO: Adicionadas barras de status compactas + caminhos de imagem corrigidos)

import React from 'react';
import { AppIcon } from '../icons/NavigationIcons.jsx';
import { getTemaConfig } from '../../lib/temas.js';

function Recursos({ 
  dados, 
  dadosPerseguicao, 
  dadosVisibilidade, 
  info, // Recebe o 'info' para pegar a foto e o tema
  onFichaChange,
  buffsTemporarios = { exercicio: 0, leitura: 0 },
  onConsumirBuff,
  onBack,
  onOpenTracker,
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
      <button
        type="button"
        className="tracker-boxes"
        onClick={() => handleTrackerClick(tipo, contagem)}
        aria-label={`${tipo}: ${contagem} de 3. Avançar marcador`}
      >
        {boxes}
      </button>
    );
  };

  const visibilidadeAtual = dadosVisibilidade || 0;
  
  const temaConfig = getTemaConfig(info?.tema || 'tema-ordem');
  
  // --- CÁLCULO DE PORCENTAGEM PARA AS BARRAS ---
  const pvPerc = Math.max(0, Math.min(100, (dados.pv_atual / (dados.pv_max || 1)) * 100));
  const sanPerc = Math.max(0, Math.min(100, (dados.san_atual / (dados.san_max || 1)) * 100));
  const pePerc = Math.max(0, Math.min(100, (dados.pe_atual / (dados.pe_max || 1)) * 100));
  const recursosHud = [
    { id: 'pv', label: 'PV', atual: dados.pv_atual, maximo: dados.pv_max, percentual: pvPerc },
    { id: 'san', label: 'SAN', atual: dados.san_atual, maximo: dados.san_max, percentual: sanPerc },
    { id: 'pe', label: 'PE', atual: dados.pe_atual, maximo: dados.pe_max, percentual: pePerc },
  ];

  return (
    <header className="recursos-container-fixo">
      <div className="hud-agent-card">
        {onBack && (
          <button type="button" className="hud-back-button" onClick={onBack} aria-label="Voltar">
            <AppIcon name="back" size={18} />
          </button>
        )}

        <div className="personagem-imagem-container">
          <img src={temaConfig.simbolo} alt="" className="personagem-imagem-fundo" />
          <div
            className="personagem-imagem-foto"
            style={{ backgroundImage: info?.foto ? `url(${info.foto})` : 'none' }}
          ></div>
        </div>

        <div className="hud-agent-copy">
          <span className="hud-kicker">Agente em operação</span>
          <strong>{info?.nome || 'Agente sem identificação'}</strong>
          <small>{info?.classe || 'Classe indefinida'} · NEX {info?.nex || '0%'}</small>
        </div>

        {onOpenTracker && (
          <button type="button" className="hud-tracker-button" onClick={onOpenTracker} aria-label="Abrir iniciativa">
            <AppIcon name="progress" size={17} />
            <span>Iniciativa</span>
          </button>
        )}
      </div>

      <div className="recursos-hud-itens" aria-label="Recursos do personagem">
        {recursosHud.map(recurso => (
          <div className="recurso-hud-item" id={`hud-${recurso.id}`} key={recurso.id}>
            <div className="hud-recurso-topo">
              <label htmlFor={`${recurso.id}_atual`}>{recurso.label}</label>
              <span>{Math.round(recurso.percentual)}%</span>
            </div>
            <div
              className="hud-barra-container"
              role="progressbar"
              aria-label={`${recurso.label}: ${recurso.atual} de ${recurso.maximo}`}
              aria-valuemin="0"
              aria-valuemax={recurso.maximo}
              aria-valuenow={recurso.atual}
            >
              <div
                className="hud-barra-preenchimento"
                id={`barra-${recurso.id}-hud`}
                style={{ width: `${recurso.percentual}%` }}
              ></div>
            </div>
            <div className="hud-numeros-container">
              <input
                type="number"
                id={`${recurso.id}_atual`}
                className="hud-input-atual"
                value={recurso.atual}
                onChange={handleChange}
                aria-label={`${recurso.label} atual`}
              />
              <span className="hud-separador">/</span>
              <span className="hud-valor-max">{recurso.maximo}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="recursos-hud-trackers">
        {(buffsTemporarios.exercicio > 0 || buffsTemporarios.leitura > 0) && (
          <div className="tracker-linha">
            <span>Bônus de interlúdio</span>
            <div className="vis-tracker-container vis-tracker-container--wrap">
              {buffsTemporarios.exercicio > 0 && (
                <button
                  type="button"
                  className="vis-btn"
                  title="Após rolar seus dados físicos, marque um bônus de exercício como usado."
                  onClick={() => onConsumirBuff?.('exercicio')}
                >
                  Físico +1d6 ({buffsTemporarios.exercicio})
                </button>
              )}
              {buffsTemporarios.leitura > 0 && (
                <button
                  type="button"
                  className="vis-btn"
                  title="Após rolar seus dados físicos, marque um bônus de leitura como usado."
                  onClick={() => onConsumirBuff?.('leitura')}
                >
                  Mental {info.origem === 'nerd_entusiasta' ? '+2d6' : '+1d6'} ({buffsTemporarios.leitura})
                </button>
              )}
            </div>
          </div>
        )}
        <div 
          className={`tracker-linha visibilidade ${visibilidadeAtual >= 3 ? 'full' : ''}`}
        >
          <span>Visibilidade</span>
          <div className="vis-tracker-container">
            <button type="button" className="vis-btn" onClick={() => handleVisibilidadeChange(-1)} aria-label="Reduzir visibilidade">-</button>
            <span className="vis-numero" aria-live="polite">{visibilidadeAtual}</span>
            <button type="button" className="vis-btn" onClick={() => handleVisibilidadeChange(1)} aria-label="Aumentar visibilidade">+</button>
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
            <button type="button" className="btn-reset-perseguicao" onClick={handleResetClick}>
              Resetar
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Recursos;
