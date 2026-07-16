import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/modals.css';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let openModalCount = 0;
const openModalStack = [];
let appRootHadInert = false;
let appRootAriaHidden = null;

function isVisibleFocusable(element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.closest('[hidden], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none'
    && style.visibility !== 'hidden'
    && element.getClientRects().length > 0;
}

function lockPageScroll() {
  if (openModalCount === 0) {
    const appRoot = document.getElementById('root');
    if (appRoot) {
      appRootHadInert = appRoot.hasAttribute('inert');
      appRootAriaHidden = appRoot.getAttribute('aria-hidden');
      appRoot.setAttribute('inert', '');
      appRoot.setAttribute('aria-hidden', 'true');
    }
  }
  openModalCount += 1;
  document.body.classList.add('caos-modal-open');
}

function unlockPageScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.body.classList.remove('caos-modal-open');
    const appRoot = document.getElementById('root');
    if (appRoot) {
      if (!appRootHadInert) appRoot.removeAttribute('inert');
      if (appRootAriaHidden === null) appRoot.removeAttribute('aria-hidden');
      else appRoot.setAttribute('aria-hidden', appRootAriaHidden);
    }
  }
}

export default function ModalBase({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'medium',
  className = '',
  bodyClassName = '',
  panelStyle,
  closeLabel = 'Fechar modal',
  closeOnOverlay = true,
  initialFocusRef,
  describedBy,
  role = 'dialog',
}) {
  const panelRef = useRef(null);
  const modalIdRef = useRef(Symbol('caos-modal'));
  const onCloseRef = useRef(onClose);
  const generatedTitleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const modalId = modalIdRef.current;
    panel?.focus();
    openModalStack.push(modalId);
    lockPageScroll();

    const focusFrame = window.requestAnimationFrame(() => {
      const preferredTarget = isVisibleFocusable(initialFocusRef?.current) ? initialFocusRef.current : null;
      const firstFocusable = panel
        ? Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).find(isVisibleFocusable)
        : null;
      (preferredTarget || firstFocusable || panel)?.focus();
    });

    const handleKeyDown = (event) => {
      if (openModalStack[openModalStack.length - 1] !== modalId) return;

      if (event.key === 'Escape' && onCloseRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !panel) return;

      const focusable = Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR))
        .filter(isVisibleFocusable);

      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

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

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      const stackIndex = openModalStack.lastIndexOf(modalId);
      if (stackIndex >= 0) openModalStack.splice(stackIndex, 1);
      unlockPageScroll();
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [initialFocusRef, isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (event) => {
    const isTopModal = openModalStack[openModalStack.length - 1] === modalIdRef.current;
    if (isTopModal && closeOnOverlay && onClose && event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div className="caos-modal" onMouseDown={handleOverlayClick}>
      <section
        ref={panelRef}
        className={`caos-modal__panel caos-modal__panel--${size} ${className}`.trim()}
        style={panelStyle}
        role={role}
        aria-modal="true"
        aria-labelledby={generatedTitleId}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        <header className="caos-modal__header">
          <div>
            <span className="caos-modal__eyebrow">C.A.O.S. // terminal</span>
            <h2 id={generatedTitleId}>{title}</h2>
          </div>
          {onClose && (
            <button type="button" className="caos-modal__close" onClick={onClose} aria-label={closeLabel}>
              <span aria-hidden="true">×</span>
            </button>
          )}
        </header>

        <div className={`caos-modal__body ${bodyClassName}`.trim()}>{children}</div>

        {footer && <footer className="caos-modal__footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
