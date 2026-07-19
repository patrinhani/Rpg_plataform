import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  filterHandouts,
  normalizeHandoutCollection,
} from '../../features/vtt-table/handouts.js';
import './handout-evidence-panel.css';

const CONNECTED_STATUSES = new Set([
  'active',
  'authenticated',
  'connected',
  'online',
  'open',
  'ready',
  'synced',
]);

const PENDING_STATUSES = new Set([
  'authenticating',
  'connecting',
  'loading',
  'pending',
  'reconnecting',
  'validating',
]);

function resolveConnectionState(status) {
  if (status === true || status?.connected === true) {
    return { key: 'connected', label: 'Sincronizado', connected: true, pending: false };
  }

  const rawStatus = typeof status === 'string'
    ? status
    : status?.state || status?.status || status?.connection || '';
  const normalized = String(rawStatus).trim().toLocaleLowerCase('pt-BR');

  if (CONNECTED_STATUSES.has(normalized)) {
    return { key: 'connected', label: 'Sincronizado', connected: true, pending: false };
  }
  if (PENDING_STATUSES.has(normalized)) {
    return { key: 'pending', label: 'Conectando', connected: false, pending: true };
  }
  return { key: 'offline', label: 'Indisponível', connected: false, pending: false };
}

function mergeHandoutCatalog(handoutCatalog, deliveredHandouts) {
  const catalog = normalizeHandoutCollection(handoutCatalog);
  const delivered = normalizeHandoutCollection(deliveredHandouts);
  const deliveredById = new Map(delivered.map((item) => [item.assetId, item]));
  const source = catalog.length > 0 ? catalog : delivered;

  return source.map((item) => {
    const deliveredItem = deliveredById.get(item.assetId);
    return {
      ...item,
      ...deliveredItem,
      image: deliveredItem?.image || item.image,
      url: deliveredItem?.url || item.url,
      delivered: Boolean(deliveredItem || item.delivered || item.deliveredAt),
    };
  });
}

function handoutMeta(item) {
  if (item.image?.width && item.image?.height) {
    return `${item.image.width} × ${item.image.height}`;
  }
  const mediaType = String(item.mediaType || 'Documento');
  const subtype = mediaType.split('/')[1];
  return subtype ? subtype.toLocaleUpperCase('pt-BR') : mediaType;
}

function HandoutCard({
  item,
  manager,
  connected,
  pending,
  onOpen,
  onToggleDelivery,
}) {
  const canPreview = Boolean(item.url);
  const statusLabel = item.privateReference
    ? 'Referência privada do Mestre'
    : item.delivered
      ? manager ? 'Entregue à mesa' : 'Recebida na investigação'
      : 'Aguardando entrega';

  return (
    <article
      className={`handout-evidence__card${item.delivered ? ' is-delivered' : ''}${item.privateReference ? ' is-reference' : ''}`}
    >
      <button
        type="button"
        className="handout-evidence__thumbnail"
        onClick={() => onOpen(item)}
        disabled={!canPreview}
        aria-label={canPreview ? `Visualizar ${item.label}` : `${item.label} sem prévia disponível`}
      >
        <span className="handout-evidence__document-mark" aria-hidden="true">◇</span>
        {item.thumbnailUrl && String(item.mediaType || '').startsWith('image/') && (
          <img
            src={item.thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        )}
        <small>{handoutMeta(item)}</small>
      </button>

      <div className="handout-evidence__card-body">
        <span className="handout-evidence__card-status">{statusLabel}</span>
        <strong title={item.label}>{item.label}</strong>
        <span className="handout-evidence__asset-code" title={item.assetId}>{item.assetId}</span>

        <div className="handout-evidence__card-actions">
          <button type="button" onClick={() => onOpen(item)} disabled={!canPreview}>
            Visualizar
          </button>
          {manager && !item.privateReference && (
            <button
              type="button"
              className={item.delivered ? 'is-revoke' : 'is-deliver'}
              onClick={() => onToggleDelivery(item)}
              disabled={!connected || pending}
              aria-busy={pending || undefined}
            >
              {pending ? 'Processando…' : item.delivered ? 'Recolher' : 'Entregar'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function EvidenceGroup({
  title,
  description,
  items,
  manager,
  connected,
  pendingIds,
  onOpen,
  onToggleDelivery,
  emptyMessage,
}) {
  return (
    <section className="handout-evidence__group">
      <header className="handout-evidence__group-heading">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        <span>{items.length.toString().padStart(2, '0')}</span>
      </header>

      {items.length > 0 ? (
        <div className="handout-evidence__grid">
          {items.map((item) => (
            <HandoutCard
              key={item.assetId}
              item={item}
              manager={manager}
              connected={connected}
              pending={pendingIds.has(item.assetId)}
              onOpen={onOpen}
              onToggleDelivery={onToggleDelivery}
            />
          ))}
        </div>
      ) : (
        <div className="handout-evidence__empty">
          <span aria-hidden="true">◇</span>
          <p>{emptyMessage}</p>
        </div>
      )}
    </section>
  );
}

/**
 * Painel visual de evidências da Mesa.
 *
 * As coleções aceitam os mesmos itens normalizados do VTT. O componente não
 * abre conexões nem persiste estado: as ações são devolvidas ao integrador.
 */
export default function HandoutEvidencePanel({
  mode = 'viewer',
  status = 'offline',
  role = 'player',
  error = '',
  deliveredHandouts = [],
  handoutCatalog = [],
  masterReferences = [],
  onDeliver,
  onRevoke,
  onReconnect,
}) {
  const headingId = useId();
  const searchId = useId();
  const previewTitleId = useId();
  const previewRef = useRef(null);
  const returnFocusRef = useRef(null);
  const [query, setQuery] = useState('');
  const [previewId, setPreviewId] = useState('');
  const [zoom, setZoom] = useState(0.7);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [actionError, setActionError] = useState('');

  const manager = mode === 'manager';
  const canManage = manager && role === 'master';
  const connection = resolveConnectionState(status);
  const catalogItems = useMemo(
    () => mergeHandoutCatalog(handoutCatalog, deliveredHandouts),
    [deliveredHandouts, handoutCatalog],
  );
  const viewerItems = useMemo(
    () => normalizeHandoutCollection(deliveredHandouts).map((item) => ({
      ...item,
      delivered: true,
    })),
    [deliveredHandouts],
  );
  const referenceItems = useMemo(
    () => normalizeHandoutCollection(masterReferences).map((item) => ({
      ...item,
      delivered: false,
      privateReference: true,
    })),
    [masterReferences],
  );
  const primaryItems = manager ? catalogItems : viewerItems;
  const filteredPrimaryItems = useMemo(
    () => filterHandouts(primaryItems, query),
    [primaryItems, query],
  );
  const filteredReferenceItems = useMemo(
    () => filterHandouts(referenceItems, query),
    [query, referenceItems],
  );
  const allVisibleItems = manager
    ? [...catalogItems, ...referenceItems]
    : viewerItems;
  const previewHandout = allVisibleItems.find((item) => item.assetId === previewId) || null;
  const itemCount = primaryItems.length + (manager ? referenceItems.length : 0);
  const deliveredCount = manager
    ? catalogItems.filter((item) => item.delivered).length
    : viewerItems.length;
  const showSearch = itemCount > 4 || Boolean(query);
  const visibleError = actionError || (typeof error === 'string' ? error : error?.message) || '';

  const closePreview = useCallback(() => {
    setPreviewId('');
    window.requestAnimationFrame(() => returnFocusRef.current?.focus?.());
  }, []);

  const openPreview = useCallback((item) => {
    if (!item?.url) return;
    returnFocusRef.current = document.activeElement;
    setZoom(0.7);
    setPreviewId(item.assetId);
  }, []);

  useEffect(() => {
    if (!previewHandout) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      previewRef.current?.querySelector('[data-preview-close]')?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePreview();
        return;
      }
      if (event.key !== 'Tab' || !previewRef.current) return;

      const focusable = [...previewRef.current.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hidden);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closePreview, previewHandout]);

  const handleToggleDelivery = useCallback(async (item) => {
    if (!canManage || !connection.connected || pendingIds.has(item.assetId)) return;

    const revoke = Boolean(item.delivered);
    const handler = revoke ? onRevoke : onDeliver;
    if (typeof handler !== 'function') return;

    const confirmation = revoke
      ? `Recolher “${item.label}”? Novos acessos serão bloqueados, mas cópias já salvas não podem ser apagadas.`
      : `Entregar “${item.label}” para todos os jogadores desta mesa?`;
    if (!window.confirm(confirmation)) return;

    setActionError('');
    setPendingIds((current) => new Set(current).add(item.assetId));
    try {
      await handler(item.assetId);
    } catch (caughtError) {
      setActionError(caughtError instanceof Error
        ? caughtError.message
        : 'Não foi possível atualizar a entrega desta evidência.');
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(item.assetId);
        return next;
      });
    }
  }, [canManage, connection.connected, onDeliver, onRevoke, pendingIds]);

  return (
    <section
      className={`handout-evidence handout-evidence--${manager ? 'manager' : 'viewer'}`}
      aria-labelledby={headingId}
    >
      <header className="handout-evidence__heading">
        <div>
          <span className="handout-evidence__eyebrow">
            {manager ? 'ARQUIVO DA CAMPANHA' : 'MATERIAL DA INVESTIGAÇÃO'}
          </span>
          <h2 id={headingId}>
            {manager ? 'Entrega de evidências' : 'Evidências recebidas'}
          </h2>
          <p>
            {manager
              ? `${deliveredCount} de ${catalogItems.length} documentos disponíveis para a mesa.`
              : `${viewerItems.length} ${viewerItems.length === 1 ? 'documento vinculado' : 'documentos vinculados'} às suas anotações.`}
          </p>
        </div>
        <span className={`handout-evidence__connection is-${connection.key}`} role="status">
          <i aria-hidden="true" />
          {connection.label}
        </span>
      </header>

      {(!connection.connected || visibleError) && (
        <div className={`handout-evidence__notice${visibleError ? ' is-error' : ''}`} role={visibleError ? 'alert' : 'status'}>
          <div>
            <strong>{connection.pending ? 'Conectando ao arquivo da mesa' : 'Arquivo da mesa temporariamente indisponível'}</strong>
            <span>
              {visibleError || (manager
                ? 'As entregas ficam pausadas até a conexão retornar.'
                : 'Suas anotações continuam disponíveis; tente novamente para carregar as evidências.')}
            </span>
          </div>
          {!connection.pending && typeof onReconnect === 'function' && (
            <button type="button" onClick={onReconnect}>Tentar novamente</button>
          )}
        </div>
      )}

      {manager && !canManage && (
        <div className="handout-evidence__notice is-error" role="alert">
          <div>
            <strong>Controles reservados ao Mestre</strong>
            <span>Entre com a conta responsável pela mesa para entregar ou recolher evidências.</span>
          </div>
        </div>
      )}

      {showSearch && (
        <label className="handout-evidence__search" htmlFor={searchId}>
          <span>Buscar no arquivo</span>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nome, código ou pista…"
            autoComplete="off"
          />
        </label>
      )}

      <div className="handout-evidence__content" aria-live="polite">
        <EvidenceGroup
          title={manager ? 'Catálogo de evidências' : 'Arquivos da investigação'}
          description={manager
            ? 'Entregue documentos quando os agentes encontrarem as pistas correspondentes.'
            : 'Documentos liberados pelo Mestre ficam reunidos com o seu diário de campo.'}
          items={filteredPrimaryItems}
          manager={canManage}
          connected={connection.connected}
          pendingIds={pendingIds}
          onOpen={openPreview}
          onToggleDelivery={handleToggleDelivery}
          emptyMessage={query
            ? 'Nenhuma evidência corresponde à busca.'
            : manager
              ? 'O catálogo desta campanha ainda não possui evidências.'
              : 'Nenhuma evidência foi entregue. Suas anotações continuam logo abaixo.'}
        />

        {manager && (referenceItems.length > 0 || !query) && (
          <EvidenceGroup
            title="Dossiê do mestre"
            description="Referências privadas para consulta. Estes arquivos nunca podem ser entregues aos jogadores."
            items={filteredReferenceItems}
            manager={false}
            connected={connection.connected}
            pendingIds={pendingIds}
            onOpen={openPreview}
            onToggleDelivery={handleToggleDelivery}
            emptyMessage={query
              ? 'Nenhuma referência privada corresponde à busca.'
              : 'Nenhuma referência privada foi vinculada à campanha.'}
          />
        )}
      </div>

      {manager && (
        <footer className="handout-evidence__footer">
          Recolher bloqueia novos acessos, mas não apaga arquivos ou capturas que os jogadores já tenham salvo.
        </footer>
      )}

      {previewHandout && typeof document !== 'undefined' && createPortal(
        <div
          className="handout-evidence-preview"
          role="dialog"
          aria-modal="true"
          aria-labelledby={previewTitleId}
          ref={previewRef}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePreview();
          }}
        >
          <div className="handout-evidence-preview__surface">
            <header>
              <div>
                <span>
                  {previewHandout.privateReference
                    ? 'Dossiê privado do Mestre'
                    : manager && !previewHandout.delivered
                      ? 'Prévia antes da entrega'
                      : 'Documento da investigação'}
                </span>
                <strong id={previewTitleId}>{previewHandout.label}</strong>
              </div>
              <div className="handout-evidence-preview__actions">
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.max(0.25, value - 0.15))}
                  aria-label="Diminuir documento"
                >−</button>
                <output aria-label="Ampliação atual">{Math.round(zoom * 100)}%</output>
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.min(2, value + 0.15))}
                  aria-label="Aumentar documento"
                >+</button>
                <button type="button" onClick={() => setZoom(0.7)}>Enquadrar</button>
                <button type="button" data-preview-close onClick={closePreview}>Fechar</button>
              </div>
            </header>

            <div className="handout-evidence-preview__canvas">
              {String(previewHandout.mediaType || '').startsWith('image/') ? (
                <img
                  src={previewHandout.url}
                  alt={previewHandout.label}
                  draggable="false"
                  style={{
                    width: `${Math.max(480, previewHandout.image?.width || 1600) * zoom}px`,
                  }}
                />
              ) : (
                <div className="handout-evidence-preview__fallback">
                  <span aria-hidden="true">◇</span>
                  <strong>Prévia visual indisponível</strong>
                  <p>Abra o arquivo original para consultar este formato.</p>
                  <a href={previewHandout.url} target="_blank" rel="noreferrer">Abrir arquivo</a>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
