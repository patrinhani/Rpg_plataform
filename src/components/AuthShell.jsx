import React, { useEffect, useId, useRef, useState } from 'react';
import { listaTemas } from '../lib/temas.js';
import '../styles/auth.css';

export default function AuthShell({
  children,
  eyebrow = 'Terminal de acesso',
  title,
  description,
  variant = 'access',
  status = 'Canal protegido',
}) {
  const visualRef = useRef(null);
  const titleId = useId();
  const [showDecorativeArt, setShowDecorativeArt] = useState(() => (
    typeof window === 'undefined' || window.matchMedia('(min-width: 781px)').matches
  ));

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 781px)');
    const syncDecorativeArt = () => setShowDecorativeArt(desktopQuery.matches);
    syncDecorativeArt();
    desktopQuery.addEventListener?.('change', syncDecorativeArt);
    return () => desktopQuery.removeEventListener?.('change', syncDecorativeArt);
  }, []);

  useEffect(() => {
    const visual = visualRef.current;
    const motionAllowed = window.matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)');
    if (!visual) return undefined;

    let animationFrame;
    let listening = false;
    const handlePointerMove = (event) => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const x = ((event.clientX / window.innerWidth) - 0.5) * 22;
        const y = ((event.clientY / window.innerHeight) - 0.5) * 16;
        visual.style.setProperty('--auth-shift-x', `${x}px`);
        visual.style.setProperty('--auth-shift-y', `${y}px`);
      });
    };

    const resetParallax = () => {
      window.cancelAnimationFrame(animationFrame);
      visual.style.removeProperty('--auth-shift-x');
      visual.style.removeProperty('--auth-shift-y');
    };

    const syncMotion = () => {
      const shouldListen = motionAllowed.matches && !document.body.classList.contains('modo-economia');
      if (shouldListen && !listening) {
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        listening = true;
      } else if (!shouldListen && listening) {
        window.removeEventListener('pointermove', handlePointerMove);
        listening = false;
        resetParallax();
      }
    };

    const bodyObserver = new MutationObserver(syncMotion);
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    motionAllowed.addEventListener?.('change', syncMotion);
    syncMotion();

    return () => {
      bodyObserver.disconnect();
      motionAllowed.removeEventListener?.('change', syncMotion);
      window.removeEventListener('pointermove', handlePointerMove);
      resetParallax();
    };
  }, [showDecorativeArt]);

  return (
    <main className={`auth-shell auth-shell--${variant}`}>
      <div className="auth-shell__ambient" aria-hidden="true">
        <div className="auth-shell__grid" />
        {showDecorativeArt && (
          <div className="auth-shell__visual" ref={visualRef}>
            <img src="/assets/images/optimized/Character-1280.webp" alt="" decoding="async" />
          </div>
        )}
      </div>

      <section className="auth-shell__frame" aria-labelledby={titleId}>
        <aside className="auth-shell__brand" aria-label="Sistema C.A.O.S.">
          <div className="auth-shell__brand-status">
            <strong>C.A.O.S.</strong>
            <span><i /> sistema online</span>
          </div>

          <div className="auth-shell__emblem" aria-hidden="true">
            <span />
            <img src="/assets/images/optimized/SimboloSemafinidade-320.webp" alt="" />
          </div>

          <div className="auth-shell__brand-copy">
            <span>Ordo Realitas</span>
            <h1>Convergência</h1>
            <p>Identificação, registros e operações reunidos em um único terminal.</p>
          </div>

          {showDecorativeArt && (
            <div className="auth-shell__sigils" aria-hidden="true">
              {listaTemas.map((tema) => (
                <span key={tema.id} style={{ '--auth-sigil-color': tema.cor }}>
                  <img src={tema.simboloMini || tema.simbolo} alt="" loading="lazy" decoding="async" />
                </span>
              ))}
            </div>
          )}

          <div className="auth-shell__terminal-code">
            <span>terminal</span>
            <strong>OR-01 // ACESSO</strong>
          </div>
        </aside>

        <div className="auth-shell__panel">
          <header className="auth-shell__heading">
            <span>{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </header>

          <div className="auth-shell__content">{children}</div>

          <footer className="auth-shell__footer">
            <span className="auth-shell__connection"><i /> {status}</span>
            <span>ORDO REALITAS // v3.4</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
