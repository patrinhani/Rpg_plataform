import React, { useCallback, useState } from 'react';
import FichaSectionFrame from './ficha/FichaSectionFrame.jsx';
import { AppIcon } from './icons/NavigationIcons.jsx';
import ExportFicha from './ExportFicha.jsx';

const STATUS_COPY = {
  sincronizado: 'Ficha sincronizada com o destino atual.',
  local: 'Esta ficha está em modo local e não possui destino de sincronização.',
  erro: 'Não foi possível concluir a operação. Tente novamente.',
};

function ConfiguracoesFicha({
  personagem,
  calculados,
  onSync,
  onDelete,
  syncEnabled = true,
  isModoMesa = false,
}) {
  const [status, setStatus] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const nome = personagem?.info?.nome || 'Agente';

  const showTransientStatus = useCallback((nextStatus, duration = 3600) => {
    setStatus(nextStatus);
    window.setTimeout(() => setStatus(current => current === nextStatus ? null : current), duration);
  }, []);

  const handleSync = useCallback(async () => {
    if (typeof onSync !== 'function') return;
    setBusyAction('sync');
    try {
      const resultado = await onSync();
      showTransientStatus(resultado?.semDestino ? 'local' : resultado?.ok === false ? 'erro' : 'sincronizado');
    } catch (error) {
      console.error(error);
      showTransientStatus('erro');
    } finally {
      setBusyAction(null);
    }
  }, [onSync, showTransientStatus]);

  const handleDelete = useCallback(async () => {
    if (typeof onDelete !== 'function') return;
    setBusyAction('delete');
    try {
      await onDelete();
    } finally {
      setBusyAction(null);
    }
  }, [onDelete]);

  return (
    <FichaSectionFrame
      variant="settings"
      icon="settings"
      eyebrow="CENTRAL DE CONTROLE"
      title="Configurações"
      description="Sincronização, cópias de segurança, impressão e ações administrativas da ficha."
      metrics={[
        { label: 'Agente', value: nome },
        { label: 'Sincronização', value: syncEnabled ? 'Automática' : 'Local' },
        { label: 'Backup', value: 'v3.4' },
      ]}
    >
      {status && (
        <div className={`settings-status settings-status--${status}`} role={status === 'erro' ? 'alert' : 'status'} aria-live="polite">
          <span aria-hidden="true" />
          {STATUS_COPY[status]}
        </div>
      )}

      <div className="settings-grid">
        <section className="settings-panel settings-panel--sync" aria-labelledby="settings-sync-title">
          <header className="settings-panel__heading">
            <span className="settings-panel__icon"><AppIcon name="save" size={22} /></span>
            <div>
              <span className="ficha-record-kicker">PERSISTÊNCIA</span>
              <h2 id="settings-sync-title">Sincronização</h2>
            </div>
          </header>
          <p>Alterações são salvas automaticamente após uma breve pausa. Use a ação abaixo para confirmar a sincronização imediatamente.</p>
          <div className="settings-panel__state">
            <span className={syncEnabled ? 'is-online' : 'is-local'} />
            <strong>{syncEnabled ? 'Salvamento automático ativo' : 'Ficha em modo local'}</strong>
          </div>
          <button type="button" className="settings-action settings-action--primary" onClick={handleSync} disabled={!syncEnabled || busyAction !== null || typeof onSync !== 'function'}>
            <AppIcon name="save" size={18} />
            {busyAction === 'sync' ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        </section>

        <section className="settings-panel settings-panel--backup" aria-labelledby="settings-backup-title">
          <header className="settings-panel__heading">
            <span className="settings-panel__icon"><AppIcon name="export" size={22} /></span>
            <div>
              <span className="ficha-record-kicker">CÓPIA DE SEGURANÇA</span>
              <h2 id="settings-backup-title">Backup e impressão</h2>
            </div>
          </header>
          <p>O JSON preserva os dados editáveis da ficha. A versão impressa organiza os registros para consulta física.</p>
          <ExportFicha personagem={personagem} calculados={calculados} />
        </section>

        <section className="settings-panel settings-panel--import" aria-labelledby="settings-import-title">
          <header className="settings-panel__heading">
            <span className="settings-panel__icon"><AppIcon name="code" size={22} /></span>
            <div>
              <span className="ficha-record-kicker">RESTAURAÇÃO SEGURA</span>
              <h2 id="settings-import-title">Importar uma ficha</h2>
            </div>
          </header>
          <p>Importações são feitas no Painel e sempre criam uma nova ficha. Assim, nenhum arquivo substitui silenciosamente o agente aberto.</p>
          <span className="settings-inline-note">Volte ao Painel para usar “Importar JSON”.</span>
        </section>

        <section className="settings-panel settings-panel--danger" aria-labelledby="settings-danger-title">
          <header className="settings-panel__heading">
            <span className="settings-panel__icon"><AppIcon name="trash" size={22} /></span>
            <div>
              <span className="ficha-record-kicker">ZONA DE PERIGO</span>
              <h2 id="settings-danger-title">Excluir ficha</h2>
            </div>
          </header>
          <p>A exclusão remove permanentemente esta ficha e não pode ser desfeita. Gere um backup antes de continuar.</p>
          {typeof onDelete === 'function' ? (
            <button type="button" className="settings-action settings-action--danger" onClick={handleDelete} disabled={busyAction !== null}>
              <AppIcon name="trash" size={18} />
              {busyAction === 'delete' ? 'Excluindo…' : 'Excluir permanentemente'}
            </button>
          ) : (
            <span className="settings-inline-note">{isModoMesa ? 'Somente o proprietário pode excluir esta ficha.' : 'Exclusão indisponível neste modo.'}</span>
          )}
        </section>
      </div>
    </FichaSectionFrame>
  );
}

export default ConfiguracoesFicha;
