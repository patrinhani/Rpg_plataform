import React, { useEffect, useId, useRef } from 'react';
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

  useEffect(() => {
    const visual = visualRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!visual || reducedMotion.matches) return undefined;

    let animationFrame;
    const handlePointerMove = (event) => {
      if (document.body.classList.contains('modo-economia')) return;

      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const x = ((event.clientX / window.innerWidth) - 0.5) * 22;
        const y = ((event.clientY / window.innerHeight) - 0.5) * 16;
        visual.style.setProperty('--auth-shift-x', `${x}px`);
        visual.style.setProperty('--auth-shift-y', `${y}px`);
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return (
    <main className={`auth-shell auth-shell--${variant}`}>
      <div className="auth-shell__ambient" aria-hidden="true">
        <div className="auth-shell__grid" />
        <div className="auth-shell__visual" ref={visualRef}>
          <img src="/assets/images/Character.webp" alt="" />
        </div>
      </div>

      <section className="auth-shell__frame" aria-labelledby={titleId}>
        <aside className="auth-shell__brand" aria-label="Sistema C.A.O.S.">
          <div className="auth-shell__brand-status">
            <strong>C.A.O.S.</strong>
            <span><i /> sistema online</span>
          </div>

          <div className="auth-shell__emblem" aria-hidden="true">
            <span />
            <img src="/assets/images/SimboloSemafinidade.webp" alt="" />
          </div>

          <div className="auth-shell__brand-copy">
            <span>Ordo Realitas</span>
            <h1>Convergência</h1>
            <p>Identificação, registros e operações reunidos em um único terminal.</p>
          </div>

          <div className="auth-shell__sigils" aria-hidden="true">
            {listaTemas.map((tema) => (
              <span key={tema.id} style={{ '--auth-sigil-color': tema.cor }}>
                <img src={tema.simbolo} alt="" />
              </span>
            ))}
          </div>

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
