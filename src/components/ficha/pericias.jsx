// src/components/ficha/pericias.jsx
import React, { useMemo, useState } from 'react';
import { useFicha } from '../../contexts/FichaContext';

const ATRIBUTO_BASE = {
  acrobacia: { nome: 'Acrobacia', attr: 'agi' },
  crime: { nome: 'Crime', attr: 'agi' },
  furtividade: { nome: 'Furtividade', attr: 'agi' },
  iniciativa: { nome: 'Iniciativa', attr: 'agi' },
  pilotagem: { nome: 'Pilotagem', attr: 'agi' },
  pontaria: { nome: 'Pontaria', attr: 'agi' },
  reflexos: { nome: 'Reflexos', attr: 'agi' },
  atletismo: { nome: 'Atletismo', attr: 'for' },
  luta: { nome: 'Luta', attr: 'for' },
  atualidades: { nome: 'Atualidades', attr: 'int' },
  ciencias: { nome: 'Ciencias', attr: 'int' },
  investigacao: { nome: 'Investigacao', attr: 'int' },
  medicina: { nome: 'Medicina', attr: 'int' },
  ocultismo: { nome: 'Ocultismo', attr: 'int' },
  profissao: { nome: 'Profissao', attr: 'int' },
  sobrevivencia: { nome: 'Sobrevivencia', attr: 'int' },
  tatica: { nome: 'Tatica', attr: 'int' },
  tecnologia: { nome: 'Tecnologia', attr: 'int' },
  adestramento: { nome: 'Adestramento', attr: 'pre' },
  artes: { nome: 'Artes', attr: 'pre' },
  diplomacia: { nome: 'Diplomacia', attr: 'pre' },
  enganacao: { nome: 'Enganacao', attr: 'pre' },
  intimidacao: { nome: 'Intimidacao', attr: 'pre' },
  intuicao: { nome: 'Intuicao', attr: 'pre' },
  percepcao: { nome: 'Percepcao', attr: 'pre' },
  religiao: { nome: 'Religiao', attr: 'pre' },
  vontade: { nome: 'Vontade', attr: 'pre' },
  fortitude: { nome: 'Fortitude', attr: 'vig' },
};

const ATRIBUTOS = [
  { valor: 'agi', nome: 'Agilidade' },
  { valor: 'for', nome: 'Forca' },
  { valor: 'int', nome: 'Intelecto' },
  { valor: 'pre', nome: 'Presenca' },
  { valor: 'vig', nome: 'Vigor' },
];

function Pericias({
  dadosPericias,
  dadosCalculados,
  onFichaChange,
  periciasDeOrigem,
  nex,
  periciasCustom = [],
  bonusPericiasManuais = {},
  onAddPericiaCustom,
  onRemovePericiaCustom,
}) {
  const { fichaInstance } = useFicha();
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customNome, setCustomNome] = useState('');
  const [customAttr, setCustomAttr] = useState('int');

  const nexAtual = parseInt((nex || "0").replace('%','')) || 0;

  const periciasCustomOrdenadas = useMemo(() => {
    return [...(periciasCustom || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [periciasCustom]);

  const periciasCustomMap = useMemo(() => {
    return periciasCustomOrdenadas.reduce((acc, pericia) => {
      acc[pericia.key] = pericia;
      return acc;
    }, {});
  }, [periciasCustomOrdenadas]);

  const periciasCompletas = useMemo(() => {
    const custom = periciasCustomOrdenadas.reduce((acc, pericia) => {
      acc[pericia.key] = { nome: pericia.nome, attr: pericia.attr || 'int' };
      return acc;
    }, {});
    return { ...ATRIBUTO_BASE, ...custom };
  }, [periciasCustomOrdenadas]);

  const periciasLista = useMemo(() => {
    return [...Object.keys(ATRIBUTO_BASE), ...periciasCustomOrdenadas.map(pericia => pericia.key)];
  }, [periciasCustomOrdenadas]);

  const handleChange = (e) => {
    onFichaChange('pericias', e.target.id, e.target.value);
  };

  const handleBonusManualChange = (e) => {
    onFichaChange('bonusPericiasManuais', e.target.id.replace('bonus_pericia_', ''), e.target.value);
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!customNome.trim() || !onAddPericiaCustom) return;
    onAddPericiaCustom({ nome: customNome.trim(), attr: customAttr });
    setCustomNome('');
    setCustomAttr('int');
    setShowCustomForm(false);
  };

  return (
    <section className="box box-pericias" id="grid-pericias">
      <div className="pericias-header">
        <h2>PERICIAS</h2>
        <div className="pericias-header-actions">
          <div className="pericias-contador">
            Treinadas:
            <span style={{ color: dadosCalculados.periciasTreinadas > dadosCalculados.periciasTotal ? 'var(--cor-trans-sangue)' : 'var(--cor-destaque)'}}>
              {dadosCalculados.periciasTreinadas}
            </span> /
            <span>{dadosCalculados.periciasTotal}</span>
          </div>
          <button type="button" className="btn-add-item btn-pericia-custom" onClick={() => setShowCustomForm(prev => !prev)}>
            + Pericia
          </button>
        </div>
      </div>

      {showCustomForm && (
        <form className="pericia-custom-form" onSubmit={handleAddCustom}>
          <input
            type="text"
            placeholder="Nome da pericia"
            value={customNome}
            onChange={(e) => setCustomNome(e.target.value)}
            autoFocus
          />
          <select value={customAttr} onChange={(e) => setCustomAttr(e.target.value)}>
            {ATRIBUTOS.map(attr => (
              <option key={attr.valor} value={attr.valor}>{attr.nome}</option>
            ))}
          </select>
          <button type="submit">Criar</button>
        </form>
      )}

      <ul id="lista-pericias" className="pericias-grid-container">
        {periciasLista.map((periciaKey) => {
          const periciaInfo = periciasCompletas[periciaKey];
          const treinoValor = dadosPericias[periciaKey] ?? 0;
          const bonusInventario = dadosCalculados.bonusPericia[periciaKey] || 0;
          const bonusManual = bonusPericiasManuais[periciaKey] ?? 0;
          const infoDados = fichaInstance.getDadosPericia(periciaKey, periciaInfo.attr, bonusInventario);
          const isOrigem = periciasDeOrigem && periciasDeOrigem.includes(periciaKey);
          const isCustom = !!periciasCustomMap[periciaKey];

          return (
            <li
              key={periciaKey}
              className={`pericia-item treino-${treinoValor} ${isOrigem ? 'pericia-origem' : ''} ${isCustom ? 'pericia-custom' : ''}`}
              title={infoDados.msgCondicao || ""}
            >
              <span>
                {periciaInfo.nome} ({periciaInfo.attr.toUpperCase()})
                {isOrigem && <span style={{color: 'var(--cor-destaque)', marginLeft: '5px'}}>*</span>}
              </span>

              {isCustom && (
                <button
                  type="button"
                  className="btn-remover-pericia-custom"
                  onClick={() => onRemovePericiaCustom?.(periciaKey)}
                  title="Remover pericia customizada"
                >
                  &times;
                </button>
              )}

              <div className="pericia-bonus-container">
                <div
                    className="pericia-dado-shape"
                    style={{
                        backgroundColor: infoDados.temPenalidade ? '#d40000' : 'var(--cor-destaque)',
                        filter: infoDados.dados <= 0 ? 'grayscale(1)' : 'none'
                    }}
                >
                  <span className="pericia-dado-texto">{infoDados.dados}d</span>
                </div>
                <span className="pericia-bonus-texto">{infoDados.bonus >= 0 ? "+" : ""}{infoDados.bonus}</span>
              </div>

              <div className="pericia-manual-row">
                <label htmlFor={`bonus_pericia_${periciaKey}`}>Manual</label>
                <input
                  id={`bonus_pericia_${periciaKey}`}
                  type="number"
                  value={bonusManual}
                  onChange={handleBonusManualChange}
                />
              </div>

              <select
                id={periciaKey}
                className="treino-pericia"
                value={treinoValor}
                onChange={handleChange}
              >
                <option value="0">+0 (Destreinado)</option>
                <option value="5">+5 (Treinado)</option>
                <option value="10" disabled={nexAtual < 35}>
                    +10 (Vet){nexAtual < 35 ? ' (NEX 35%)' : ''}
                </option>
                <option value="15" disabled={nexAtual < 70}>
                    +15 (Exp){nexAtual < 70 ? ' (NEX 70%)' : ''}
                </option>
              </select>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default Pericias;
