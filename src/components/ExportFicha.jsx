// src/components/ExportFicha.jsx
// Export de ficha como JSON (download direto) e PDF (via impressão CSS otimizada)
// Não requer nenhuma dependência externa — usa apenas APIs nativas do browser.

import React, { useState, useCallback } from 'react';
import { calcularDanoArma } from '../lib/calculosCombate.js';
import {
  calcularAlcanceItem,
  calcularCriticoItem,
  calcularDefesaItem,
  calcularStatsItem,
} from '../lib/inventario.js';
import { sanitizarParaHTML, sanitizarURLImagem } from '../lib/htmlSeguro.js';
import { AppIcon } from './icons/NavigationIcons.jsx';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function formatarNex(nex) {
  if (!nex) return '5%';
  return String(nex).includes('%') ? nex : `${nex}%`;
}

function capitalizarPrimeira(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatarProgressao(info = {}) {
  if (String(info.classe).toLowerCase() === 'sobrevivente') {
    return { valor: String(info.estagio_sobrevivente || 1), escala: 'ESTÁGIO' };
  }
  return { valor: formatarNex(info.nex), escala: 'NEX' };
}

function normalizarNomeArquivo(nome) {
  return String(nome || 'ficha')
    .replace(/\s+/g, '_')
    .replace(/[<>:"/\\|?*]|\p{Cc}/gu, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'ficha';
}

const ATRIBUTOS_LABEL = {
  for: 'Força',
  agi: 'Agilidade',
  int: 'Intelecto',
  pre: 'Presença',
  vig: 'Vigor',
};

const PERICIAS_LABEL = {
  acrobacia: 'Acrobacia', adestramento: 'Adestramento', artes: 'Artes',
  atletismo: 'Atletismo', atualidades: 'Atualidades', ciencias: 'Ciências',
  crime: 'Crime', diplomacia: 'Diplomacia', enganacao: 'Enganação',
  fortitude: 'Fortitude', furtividade: 'Furtividade', iniciativa: 'Iniciativa',
  intimidacao: 'Intimidação', intuicao: 'Intuição', investigacao: 'Investigação',
  luta: 'Luta', medicina: 'Medicina', ocultismo: 'Ocultismo',
  percepcao: 'Percepção', pilotagem: 'Pilotagem', pontaria: 'Pontaria',
  profissao: 'Profissão', reflexos: 'Reflexos', religiao: 'Religião',
  sobrevivencia: 'Sobrevivência', tatica: 'Tática', tecnologia: 'Tecnologia',
  vontade: 'Vontade',
};

const RES_LABEL = {
  balistico: 'Balístico', corte: 'Corte', impacto: 'Impacto',
  perfuracao: 'Perfuração', eletricidade: 'Eletricidade', fogo: 'Fogo',
  frio: 'Frio', quimico: 'Químico', mental: 'Mental',
  sangue: 'Sangue', morte: 'Morte', conhecimento: 'Conhecimento', energia: 'Energia',
};

// ------------------------------------------------------------------
// Export JSON
// ------------------------------------------------------------------
function exportarJSON(personagem, nomeArquivo) {
  const payload = {
    _exportadoEm: new Date().toISOString(),
    _versao: '3.4',
    _sistema: 'CAOS - Ordem Paranormal',
    ...personagem,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nomeArquivo || 'ficha'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------
// Gerador do HTML de impressão
// ------------------------------------------------------------------
function gerarHTMLImpressao(personagem, calculados) {
  const dadosSeguros = sanitizarParaHTML(personagem) || {};
  const calculosSeguros = sanitizarParaHTML(calculados) || {};
  const {
    info = {},
    atributos = {},
    pericias = {},
    recursos = {},
    defesa = {},
    resistencias = {},
    inventario = [],
    rituais = [],
    poderes_aprendidos = [],
    condicoesAtivas = [],
    condicoesEfetivas = [],
  } = dadosSeguros;
  const fotoSegura = sanitizarURLImagem(personagem?.info?.foto);
  const progressao = formatarProgressao(info);
  const condicoesExibidas = condicoesEfetivas.length > 0 ? condicoesEfetivas : condicoesAtivas;

  const paletaImpressao = {
    'tema-ordem': { clara: '#36a8ff', escura: '#006fbd' },
    'tema-sangue': { clara: '#ff6b70', escura: '#b4232b' },
    'tema-morte': { clara: '#e0e0e0', escura: '#3f3f46' },
    'tema-conhecimento': { clara: '#ffeb3b', escura: '#7a6800' },
    'tema-energia': { clara: '#dc78f8', escura: '#8b1bb3' },
  }[info.tema || 'tema-ordem'] || { clara: '#36a8ff', escura: '#006fbd' };
  const corTema = paletaImpressao.escura;
  const corTemaClara = paletaImpressao.clara;

  const periciasTreinadas = Object.entries(pericias)
    .filter(([, v]) => parseInt(v) >= 5)
    .map(([k, v]) => ({ nome: PERICIAS_LABEL[k] || k, treino: v }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const resistenciasAtivas = Object.entries(calculosSeguros.resistenciasCalculadas || resistencias)
    .filter(([, v]) => parseInt(v) > 0)
    .map(([k, v]) => ({ nome: RES_LABEL[k] || k, valor: v }));

  const inventarioArmas = inventario.filter(i => i.dano);
  const inventarioProtecoes = inventario.filter(i => i.defesa > 0);
  const inventarioItens = inventario.filter(i => !i.dano && !(i.defesa > 0));

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: blob: https:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; script-src 'none'; base-uri 'none'; form-action 'none'"/>
<title>Ficha — ${info.nome || 'Agente'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700&family=Special+Elite&display=swap');
  
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  body {
    font-family: 'Roboto Condensed', sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.4;
  }

  @page {
    size: A4;
    margin: 12mm 10mm;
  }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-break { break-inside: avoid; }
    .page-break { break-before: page; }
  }

  /* ---- Layout ---- */
  .page { max-width: 190mm; margin: 0 auto; }

  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 14px;
    background: #111;
    border-left: 6px solid ${corTemaClara};
    border-radius: 4px;
    margin-bottom: 12px;
  }
  .header-foto {
    width: 64px; height: 64px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid ${corTemaClara};
    flex-shrink: 0;
  }
  .header-foto-placeholder {
    width: 64px; height: 64px;
    border-radius: 50%;
    background: #333;
    border: 3px solid ${corTemaClara};
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    flex-shrink: 0;
  }
  .header-nome {
    font-family: 'Special Elite', monospace;
    font-size: 20pt;
    color: ${corTemaClara};
    letter-spacing: 1px;
    line-height: 1;
  }
  .header-sub {
    font-size: 9pt;
    color: #aaa;
    margin-top: 3px;
    letter-spacing: 0.5px;
  }
  .header-nex {
    margin-left: auto;
    font-family: 'Special Elite', monospace;
    font-size: 24pt;
    color: ${corTemaClara};
    text-align: right;
    line-height: 1;
  }
  .header-nex small { display: block; font-size: 8pt; color: #aaa; }

  /* ---- Seções ---- */
  .secao-titulo {
    font-family: 'Special Elite', monospace;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: ${corTema};
    border-bottom: 1.5px solid ${corTema};
    padding-bottom: 2px;
    margin-bottom: 6px;
    margin-top: 10px;
  }

  /* ---- Grid 3 colunas ---- */
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  /* ---- Card de recurso (PV/PE/SAN) ---- */
  .recurso-card {
    background: #f5f5f5;
    border: 1.5px solid #ddd;
    border-radius: 6px;
    padding: 6px 10px;
    text-align: center;
  }
  .recurso-label {
    font-family: 'Special Elite', monospace;
    font-size: 8pt;
    color: #666;
    letter-spacing: 1px;
  }
  .recurso-valor {
    font-size: 16pt;
    font-weight: 700;
    color: #111;
    line-height: 1.1;
  }
  .recurso-barra {
    height: 5px;
    background: #ddd;
    border-radius: 3px;
    margin-top: 4px;
    overflow: hidden;
  }
  .recurso-barra-fill { height: 100%; border-radius: 3px; }

  /* ---- Atributo ---- */
  .attr-card {
    background: #111;
    border-left: 4px solid ${corTemaClara};
    border-radius: 4px;
    padding: 5px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .attr-nome { font-family: 'Special Elite', monospace; color: #aaa; font-size: 8.5pt; }
  .attr-val { font-size: 14pt; font-weight: 700; color: ${corTemaClara}; }

  /* ---- Tabela de perícias ---- */
  .tabela-pericias {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }
  .tabela-pericias th {
    font-family: 'Special Elite', monospace;
    background: #111;
    color: ${corTemaClara};
    padding: 3px 6px;
    text-align: left;
    font-size: 8pt;
  }
  .tabela-pericias td { padding: 2px 6px; border-bottom: 0.5px solid #eee; }
  .tabela-pericias tr:nth-child(even) td { background: #f9f9f9; }
  .treino-dot { color: ${corTema}; font-weight: bold; }

  /* ---- Defesa / resistências ---- */
  .stat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 3px 8px;
    border-bottom: 0.5px solid #eee;
    font-size: 9pt;
  }
  .stat-row:last-child { border-bottom: none; }
  .stat-val { font-weight: 700; color: ${corTema}; }

  /* ---- Inventário ---- */
  .item-row {
    display: flex;
    align-items: baseline;
    gap: 6px;
    padding: 2px 0;
    border-bottom: 0.5px solid #f0f0f0;
    font-size: 8.5pt;
  }
  .item-nome { font-weight: 700; min-width: 120px; }
  .item-detalhe { color: #555; font-size: 8pt; }
  .item-tag {
    background: ${corTema}22;
    color: ${corTema};
    border-radius: 3px;
    padding: 0 4px;
    font-size: 7.5pt;
    font-family: 'Special Elite', monospace;
  }

  /* ---- Rituais ---- */
  .ritual-card {
    border: 1px solid #e0e0e0;
    border-left: 3px solid ${corTema};
    border-radius: 3px;
    padding: 5px 8px;
    margin-bottom: 5px;
    font-size: 8.5pt;
    break-inside: avoid;
  }
  .ritual-nome { font-weight: 700; font-size: 9pt; }
  .ritual-meta { color: #777; font-size: 8pt; margin-top: 1px; }
  .ritual-desc { color: #444; margin-top: 3px; font-size: 8pt; line-height: 1.4; }

  /* ---- Poderes ---- */
  .poder-card {
    border: 1px solid #e0e0e0;
    border-left: 3px solid #888;
    border-radius: 3px;
    padding: 4px 8px;
    margin-bottom: 4px;
    font-size: 8.5pt;
    break-inside: avoid;
  }
  .poder-nome { font-weight: 700; }
  .poder-tipo { color: #888; font-size: 7.5pt; margin-left: 6px; }
  .poder-desc { color: #555; font-size: 8pt; margin-top: 2px; }

  /* ---- Condições ---- */
  .condicao-badge {
    display: inline-block;
    background: #fee2e2;
    color: #991b1b;
    border-radius: 3px;
    padding: 1px 6px;
    font-size: 8pt;
    margin: 2px;
    font-family: 'Special Elite', monospace;
  }

  /* ---- Rodapé ---- */
  .rodape {
    text-align: center;
    font-size: 7.5pt;
    color: #bbb;
    border-top: 1px solid #eee;
    padding-top: 6px;
    margin-top: 14px;
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header">
    ${fotoSegura
      ? `<img class="header-foto" src="${fotoSegura}" alt="Foto" referrerpolicy="no-referrer"/>`
      : `<div class="header-foto-placeholder">👤</div>`}
    <div>
      <div class="header-nome">${info.nome || 'Sem Nome'}</div>
      <div class="header-sub">
        ${capitalizarPrimeira(info.classe)} &nbsp;|&nbsp; ${capitalizarPrimeira(info.origem)} &nbsp;|&nbsp; Trilha: ${capitalizarPrimeira(info.trilha || 'Nenhuma')}
      </div>
      <div class="header-sub" style="margin-top:2px">Jogador: ${info.jogador || '—'} &nbsp;|&nbsp; Prestígio: ${info.prestigio || 0} PP</div>
    </div>
    <div class="header-nex">
      ${progressao.valor}
      <small>${progressao.escala}</small>
    </div>
  </div>

  <!-- RECURSOS -->
  <div class="secao-titulo">Recursos</div>
  <div class="grid-3 no-break">
    ${[
      { label: 'PV', atual: recursos.pv_atual, max: recursos.pv_max, cor: '#d40000' },
      { label: 'PE', atual: recursos.pe_atual, max: recursos.pe_max, cor: '#0091ff' },
      { label: 'SAN', atual: recursos.san_atual, max: recursos.san_max, cor: '#22c55e' },
    ].map(r => {
      const pct = Math.max(0, Math.min(100, ((r.atual || 0) / (r.max || 1)) * 100)).toFixed(0);
      return `<div class="recurso-card">
        <div class="recurso-label">${r.label}</div>
        <div class="recurso-valor">${r.atual || 0} <span style="font-size:9pt;color:#999">/ ${r.max || 0}</span></div>
        <div class="recurso-barra"><div class="recurso-barra-fill" style="width:${pct}%;background:${r.cor}"></div></div>
      </div>`;
    }).join('')}
  </div>

  <!-- ATRIBUTOS + DEFESA -->
  <div class="grid-2" style="margin-top:10px">
    <div class="no-break">
      <div class="secao-titulo">Atributos</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
        ${Object.entries(atributos).map(([k, v]) =>
          `<div class="attr-card">
            <span class="attr-nome">${ATRIBUTOS_LABEL[k] || k}</span>
            <span class="attr-val">${v || 0}</span>
          </div>`
        ).join('')}
      </div>
    </div>

    <div class="no-break">
      <div class="secao-titulo">Defesa &amp; Combate</div>
      <div style="background:#f5f5f5;border-radius:6px;border:1px solid #ddd;overflow:hidden">
        ${[
          ['Defesa Total', calculosSeguros.defesaTotal ?? 10],
          ['Bloqueio (RD)', calculosSeguros.bloqueio_rd ?? '—'],
          ['Esquiva', calculosSeguros.esquiva_bonus ?? '—'],
          ['Defesa Equip.', calculosSeguros.equipamentoDefesa ?? defesa?.equip ?? 0],
          ['Defesa Outros', defesa?.outros || 0],
          ['Deslocamento', `${calculosSeguros.deslocamentoFinal ?? info.deslocamento ?? 9}m`],
          ['Limite PE/turno', calculosSeguros.limite_pe ?? 1],
        ].map(([l, v]) => `<div class="stat-row"><span>${l}</span><span class="stat-val">${v}</span></div>`).join('')}
      </div>
    </div>
  </div>

  <!-- PERÍCIAS -->
  ${periciasTreinadas.length > 0 ? `
  <div class="secao-titulo">Perícias Treinadas</div>
  <div class="no-break">
    <table class="tabela-pericias">
      <thead><tr><th>Perícia</th><th>Treino</th><th>Bônus</th></tr></thead>
      <tbody>
        ${periciasTreinadas.map(p => `
        <tr>
          <td>${p.nome}</td>
          <td>${[...Array(Math.floor(parseInt(p.treino || 0) / 5))].map(() => `<span class="treino-dot">●</span>`).join('')} ${p.treino}</td>
          <td>${calculosSeguros.bonusPericia?.[Object.keys(PERICIAS_LABEL).find(k => PERICIAS_LABEL[k] === p.nome)] || 0}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- RESISTÊNCIAS -->
  ${resistenciasAtivas.length > 0 ? `
  <div class="secao-titulo">Resistências</div>
  <div class="grid-3 no-break">
    ${resistenciasAtivas.map(r =>
      `<div class="stat-row" style="background:#f5f5f5;border-radius:4px;border:1px solid #ddd">
        <span>${r.nome}</span><span class="stat-val">${r.valor}</span>
      </div>`
    ).join('')}
  </div>` : ''}

  <!-- CONDIÇÕES ATIVAS -->
  ${condicoesExibidas.length > 0 ? `
  <div class="secao-titulo">Condições Ativas</div>
  <div class="no-break">
    ${condicoesExibidas.map(c => `<span class="condicao-badge">${capitalizarPrimeira(c)}</span>`).join('')}
  </div>` : ''}

  <!-- ARMAS -->
  ${inventarioArmas.length > 0 ? `
  <div class="secao-titulo">Armas</div>
  <div class="no-break">
    ${inventarioArmas.map(item => `
    <div class="item-row">
      <span class="item-nome">${item.nome}</span>
      <span class="item-tag">Dano ${calcularDanoArma(item)}</span>
      <span class="item-tag">Crítico ${calcularCriticoItem(item) || '—'}</span>
      <span class="item-tag">${calcularAlcanceItem(item) || 'Corpo'}</span>
      <span class="item-tag">Cat ${calcularStatsItem(item).categoria}</span>
      ${(item.modificacoes || []).length > 0 ? `<span class="item-detalhe">+${item.modificacoes.join(', ')}</span>` : ''}
    </div>`).join('')}
  </div>` : ''}

  <!-- PROTEÇÕES -->
  ${inventarioProtecoes.length > 0 ? `
  <div class="secao-titulo">Proteções</div>
  <div class="no-break">
    ${inventarioProtecoes.map(item => `
    <div class="item-row">
      <span class="item-nome">${item.nome}</span>
      <span class="item-tag">+${calcularDefesaItem(item)} DEF</span>
      <span class="item-tag">${calcularStatsItem(item).espacos} esp.</span>
    </div>`).join('')}
  </div>` : ''}

  <!-- ITENS GERAIS -->
  ${inventarioItens.length > 0 ? `
  <div class="secao-titulo">Inventário Geral</div>
  <div class="no-break">
    ${inventarioItens.map(item => `
    <div class="item-row">
      <span class="item-nome">${item.nome}</span>
      <span class="item-tag">Cat ${calcularStatsItem(item).categoria}</span>
      <span class="item-tag">${calcularStatsItem(item).espacos} esp.</span>
      ${item.descricao ? `<span class="item-detalhe">${item.descricao.substring(0, 80)}${item.descricao.length > 80 ? '…' : ''}</span>` : ''}
    </div>`).join('')}
  </div>` : ''}

  <!-- RITUAIS -->
  ${rituais && rituais.length > 0 ? `
  <div class="secao-titulo page-break">Grimório de Rituais</div>
  ${rituais.map(rit => `
  <div class="ritual-card">
    <div class="ritual-nome">${rit.nome}
      <span style="font-size:8pt;font-weight:normal;color:#888;margin-left:8px">${rit.elemento} · ${rit.circulo}º Círculo</span>
    </div>
    <div class="ritual-meta">⏱ ${rit.execucao || '—'} &nbsp;|&nbsp; 📍 ${rit.alcance || '—'} &nbsp;|&nbsp; ⏳ ${rit.duracao || '—'}</div>
    ${rit.descricao ? `<div class="ritual-desc">${rit.descricao}</div>` : ''}
  </div>`).join('')}` : ''}

  <!-- PODERES -->
  ${poderes_aprendidos && poderes_aprendidos.length > 0 ? `
  <div class="secao-titulo">Poderes &amp; Habilidades</div>
  ${poderes_aprendidos.map(p => `
  <div class="poder-card">
    <div><span class="poder-nome">${p.nome}</span><span class="poder-tipo">${p.tipo || ''}</span></div>
    ${p.descricao ? `<div class="poder-desc">${p.descricao.substring(0, 200)}${p.descricao.length > 200 ? '…' : ''}</div>` : ''}
  </div>`).join('')}` : ''}

  <!-- RODAPÉ -->
  <div class="rodape">
    Sistema C.A.O.S. — Ordem Paranormal &nbsp;|&nbsp; Exportado em ${new Date().toLocaleDateString('pt-BR')} &nbsp;|&nbsp; ${info.nome || 'Agente'} · ${progressao.escala} ${progressao.valor}
  </div>

</div>
</body>
</html>`;
}

// ------------------------------------------------------------------
// Componente principal
// ------------------------------------------------------------------
export default function ExportFicha({ personagem, calculados }) {
  const [status, setStatus] = useState(null); // null | 'json' | 'pdf' | 'popup' | 'erro'

  const handleExportJSON = useCallback(() => {
    try {
      const nome = normalizarNomeArquivo(personagem?.info?.nome);
      exportarJSON(personagem, `CAOS_${nome}`);
      setStatus('json');
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      console.error(e);
      setStatus('erro');
      setTimeout(() => setStatus(null), 3000);
    }
  }, [personagem]);

  const handleExportPDF = useCallback(() => {
    try {
      const html = gerarHTMLImpressao(personagem, calculados);
      const janela = window.open('', '_blank', 'width=900,height=700');
      if (!janela) {
        setStatus('popup');
        setTimeout(() => setStatus(null), 4000);
        return;
      }
      const documento = new Blob([html], { type: 'text/html;charset=utf-8' });
      const urlDocumento = URL.createObjectURL(documento);
      // Aguarda fontes e imagens carregarem antes de chamar print
      janela.addEventListener('load', () => {
        URL.revokeObjectURL(urlDocumento);
        setTimeout(() => {
          janela.focus();
          janela.print();
        }, 800);
      }, { once: true });
      janela.location.replace(urlDocumento);
      setStatus('pdf');
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setStatus('erro');
      setTimeout(() => setStatus(null), 3000);
    }
  }, [personagem, calculados]);

  const nome = personagem?.info?.nome || 'Agente';

  return (
    <div className="settings-backup-controls">
      <div className="settings-action-stack">
        <button
          type="button"
          onClick={handleExportJSON}
          className="settings-action settings-action--primary"
        >
          <AppIcon name="export" size={18} />
          Baixar backup JSON
        </button>
        <button
          type="button"
          onClick={handleExportPDF}
          className="settings-action"
        >
          <AppIcon name="print" size={18} />
          Imprimir / Salvar PDF
        </button>
      </div>

      {status && (
        <div
          className={`settings-backup-feedback settings-backup-feedback--${status}`}
          role={status === 'erro' || status === 'popup' ? 'alert' : 'status'}
          aria-live={status === 'erro' || status === 'popup' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {status === 'json' && `Backup de ${nome} baixado com sucesso.`}
          {status === 'pdf' && 'Janela de impressão aberta. Use “Salvar como PDF” no navegador.'}
          {status === 'popup' && 'Permita pop-ups para este site e tente gerar o PDF novamente.'}
          {status === 'erro' && 'Erro ao exportar. Tente novamente.'}
        </div>
      )}

      <span className="settings-inline-note">
        Na impressão, ative “Gráficos em segundo plano” para preservar as cores do tema.
      </span>
    </div>
  );
}
