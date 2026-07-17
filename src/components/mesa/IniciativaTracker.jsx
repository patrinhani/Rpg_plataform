import React, { useCallback, useEffect, useRef, useState } from 'react';
import { avancarTurno, removerDaIniciativa, atualizarNPCStatus } from '../../lib/mesas.js';
import AppIcon from '../icons/NavigationIcons.jsx';
import '../../styles/mesa.css';

function getHealthNumber(value, fallback = 0) {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

function NPCHealthInput({
  mesaId,
  initiative,
  currentHealth,
  disabled,
  onBusyChange,
  onClearError,
  onError,
}) {
  const normalizedCurrentHealth = getHealthNumber(currentHealth);
  const [draft, setDraft] = useState(String(normalizedCurrentHealth));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const cancelEditRef = useRef(false);

  useEffect(() => {
    if (!editing && !saving) setDraft(String(normalizedCurrentHealth));
  }, [editing, normalizedCurrentHealth, saving]);

  useEffect(() => () => {
    onBusyChange(initiative.uid, false);
  }, [initiative.uid, onBusyChange]);

  const handleFocus = () => {
    cancelEditRef.current = false;
    setEditing(true);
    onBusyChange(initiative.uid, true);
  };

  const handleBlur = async () => {
    setEditing(false);

    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      setDraft(String(normalizedCurrentHealth));
      onBusyChange(initiative.uid, false);
      return;
    }

    const nextHealth = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(nextHealth) || !Number.isInteger(nextHealth)) {
      setDraft(String(normalizedCurrentHealth));
      onBusyChange(initiative.uid, false);
      onError(`Informe um valor inteiro válido para os PV de ${initiative.nome}.`);
      return;
    }

    if (nextHealth === normalizedCurrentHealth) {
      setDraft(String(nextHealth));
      onBusyChange(initiative.uid, false);
      return;
    }

    onClearError();
    setSaving(true);
    try {
      await atualizarNPCStatus(mesaId, initiative.uid, 'pv_atual', nextHealth);
      setDraft(String(nextHealth));
    } catch (error) {
      console.error(`Erro ao atualizar os PV de ${initiative.nome}:`, error);
      setDraft(String(normalizedCurrentHealth));
      onError(`Não foi possível atualizar os PV de ${initiative.nome}. Tente novamente.`);
    } finally {
      setSaving(false);
      onBusyChange(initiative.uid, false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditRef.current = true;
      event.currentTarget.blur();
    }
  };

  return (
    <label className={`initiative-card__health-input ${saving ? 'initiative-card__health-input--saving' : ''}`}>
      <span className="caos-visually-hidden">Pontos de vida atuais de {initiative.nome}</span>
      <input
        type="number"
        step="1"
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled || saving}
        aria-busy={saving ? 'true' : undefined}
        aria-label={`Pontos de vida atuais de ${initiative.nome}`}
      />
      <span className="initiative-card__health-save-status" aria-live="polite">
        {saving ? 'Salvando...' : 'PV atual'}
      </span>
    </label>
  );
}

export default function IniciativaTracker({
  mesaId,
  iniciativas = [],
  turnoAtual = 0,
  rodada = 1,
  souMestre,
  fichasDaMesa = [],
  onVerFichaCriatura,
  compact = false,
}) {
  const scrollRef = useRef(null);
  const [advancing, setAdvancing] = useState(false);
  const [removingUid, setRemovingUid] = useState(null);
  const [busyHealthUids, setBusyHealthUids] = useState(() => new Set());
  const [actionError, setActionError] = useState('');

  const handleHealthBusyChange = useCallback((uid, isBusy) => {
    setBusyHealthUids((currentUids) => {
      const nextUids = new Set(currentUids);
      if (isBusy) nextUids.add(uid);
      else nextUids.delete(uid);
      return nextUids;
    });
  }, []);

  const handleAdvance = async () => {
    if (advancing || removingUid || iniciativas.length === 0) return;
    setActionError('');
    setAdvancing(true);
    try {
      await avancarTurno(mesaId, turnoAtual, iniciativas.length);
    } catch (error) {
      console.error('Erro ao avançar o turno:', error);
      setActionError('Não foi possível avançar o turno. Verifique a conexão e tente novamente.');
    } finally {
      setAdvancing(false);
    }
  };

  const handleRemove = async (initiative) => {
    if (removingUid || busyHealthUids.size > 0) return;
    setActionError('');
    setRemovingUid(initiative.uid);
    try {
      await removerDaIniciativa(mesaId, initiative.uid);
    } catch (error) {
      console.error(`Erro ao remover ${initiative.nome} da iniciativa:`, error);
      setActionError(`Não foi possível remover ${initiative.nome} da iniciativa. Tente novamente.`);
    } finally {
      setRemovingUid(null);
    }
  };

  useEffect(() => {
    if (!compact || !scrollRef.current) return;
    const activeItem = scrollRef.current.children[turnoAtual];
    if (!activeItem) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.body.classList.contains('modo-economia');
    activeItem.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  }, [turnoAtual, compact]);

  const getPercent = (current, maximum) => {
    const safeCurrent = Number(current) || 0;
    const safeMaximum = Math.max(1, Number(maximum) || 1);
    return Math.max(0, Math.min(100, (safeCurrent / safeMaximum) * 100));
  };

  return (
    <section className={`initiative-tracker ${compact ? 'initiative-tracker--compact' : 'initiative-tracker--normal'}`} aria-label="Ordem de iniciativa">
      <header className="initiative-tracker__header">
        <div>
          <span>Ordem de ação</span>
          <h3>Combate <small>Rodada {rodada}</small></h3>
        </div>

        {souMestre && (
          <button
            type="button"
            onClick={handleAdvance}
            className="initiative-tracker__next"
            disabled={advancing || Boolean(removingUid) || iniciativas.length === 0}
          >
            <span>{advancing ? 'Avançando...' : 'Próximo'}</span>
            <AppIcon name="back" size={17} />
          </button>
        )}
      </header>

      {actionError && (
        <div className="initiative-tracker__feedback" role="alert">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label="Fechar aviso de erro">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}

      <div className="initiative-tracker__list" ref={scrollRef} role="list">
        {iniciativas.length === 0 && (
          <p className="initiative-tracker__empty">Nenhum participante na iniciativa.</p>
        )}

        {iniciativas.map((initiative, index) => {
          const isCurrentTurn = index === turnoAtual;
          const playerSheet = !initiative.isNPC
            ? fichasDaMesa.find((sheet) => sheet.uid === initiative.uid)
            : null;

          const avatar = initiative.isMonster && initiative.fichaCompleta?.foto
            ? initiative.fichaCompleta.foto
            : playerSheet?.info?.foto || null;

          const currentHealth = playerSheet?.recursos?.pv_atual ?? initiative.pv_atual ?? 0;
          const maximumHealth = playerSheet?.recursos?.pv_max ?? initiative.pv_max ?? 10;
          const safeCurrentHealth = getHealthNumber(currentHealth);
          const safeMaximumHealth = Math.max(1, getHealthNumber(maximumHealth, 1));
          const accessibleCurrentHealth = Math.max(0, Math.min(safeMaximumHealth, safeCurrentHealth));
          const hideHealth = initiative.isNPC && !souMestre;
          const healthPercent = hideHealth ? 100 : getPercent(safeCurrentHealth, safeMaximumHealth);

          return (
            <article
              key={initiative.uid || `${initiative.nome}-${initiative.valor}`}
              className={`initiative-card ${isCurrentTurn ? 'initiative-card--active' : ''} ${souMestre ? 'initiative-card--removable' : ''}`.trim()}
              role="listitem"
              aria-current={isCurrentTurn ? 'step' : undefined}
            >
              <span className="initiative-card__value" aria-label={`Iniciativa ${initiative.valor}`}>
                {initiative.valor}
              </span>

              <div className="initiative-card__avatar">
                {avatar ? (
                  <img src={avatar} alt={`Avatar de ${initiative.nome}`} loading="lazy" decoding="async" />
                ) : (
                  <span aria-hidden="true">{initiative.nome?.charAt(0)?.toUpperCase() || '?'}</span>
                )}
              </div>

              <div className="initiative-card__main">
                <div className="initiative-card__name">
                  <strong>{initiative.nome}</strong>
                  {!compact && initiative.isMonster && souMestre && (
                    <button
                      type="button"
                      onClick={() => onVerFichaCriatura?.(initiative.fichaCompleta)}
                      className="initiative-card__sheet"
                      aria-label={`Ver ficha de ${initiative.nome}`}
                    >
                      <AppIcon name="overview" size={16} />
                    </button>
                  )}
                </div>

                <div
                  className={`initiative-card__health ${hideHealth ? 'initiative-card__health--hidden' : ''}`}
                  role="progressbar"
                  aria-label={hideHealth ? `Pontos de vida de ${initiative.nome} ocultos` : `Pontos de vida de ${initiative.nome}`}
                  aria-valuemin={hideHealth ? undefined : 0}
                  aria-valuemax={hideHealth ? undefined : safeMaximumHealth}
                  aria-valuenow={hideHealth ? undefined : accessibleCurrentHealth}
                  aria-valuetext={hideHealth ? 'Ocultos' : undefined}
                >
                  <span style={{ width: `${healthPercent}%` }} />
                </div>

                {initiative.isNPC && souMestre && (
                  <NPCHealthInput
                    mesaId={mesaId}
                    initiative={initiative}
                    currentHealth={currentHealth}
                    disabled={Boolean(removingUid)}
                    onBusyChange={handleHealthBusyChange}
                    onClearError={() => setActionError('')}
                    onError={setActionError}
                  />
                )}
              </div>

              {!compact && (
                <span className={`initiative-card__health-text ${hideHealth ? 'initiative-card__health-text--hidden' : ''}`}>
                  <strong>{hideHealth ? '?' : currentHealth}</strong>
                  <small>/ {hideHealth ? '?' : maximumHealth}</small>
                </span>
              )}

              {souMestre && (
                <button
                  type="button"
                  onClick={() => handleRemove(initiative)}
                  className="initiative-card__remove"
                  disabled={Boolean(removingUid) || busyHealthUids.size > 0}
                  aria-label={`Remover ${initiative.nome} da iniciativa`}
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
