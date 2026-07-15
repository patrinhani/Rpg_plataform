// src/components/BackgroundDinamico.jsx
import React, { useEffect, useRef, useState } from 'react';
import { getTemaConfig } from '../lib/temas.js';

const TEMA_PADRAO = 'tema-ordem';

function getTemaAtual() {
  if (typeof document === 'undefined') return TEMA_PADRAO;
  return document.documentElement.dataset.tema || TEMA_PADRAO;
}

export default function BackgroundDinamico() {
  const backgroundRef = useRef(null);
  const frameRef = useRef(null);
  const offsetRef = useRef({ x: 0, y: 0 });
  const [temaAtual, setTemaAtual] = useState(getTemaAtual);

  const temaConfig = getTemaConfig(temaAtual);
  const simboloId = `simbolo-${temaConfig.id.replace('tema-', '')}`;

  useEffect(() => {
    const root = document.documentElement;
    const sincronizarTema = () => {
      setTemaAtual(root.dataset.tema || TEMA_PADRAO);
    };

    sincronizarTema();

    const observer = new MutationObserver(sincronizarTema);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-tema'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let movimentoDesativado = false;

    const aplicarOffset = () => {
      frameRef.current = null;
      if (!backgroundRef.current || movimentoDesativado) return;

      const { x, y } = offsetRef.current;
      backgroundRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const agendarOffset = (x, y) => {
      if (movimentoDesativado) return;

      offsetRef.current = { x, y };
      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(aplicarOffset);
      }
    };

    const atualizarPreferenciaDeMovimento = () => {
      const deveDesativar = reducedMotionQuery.matches
        || document.body.classList.contains('modo-economia');

      if (deveDesativar === movimentoDesativado) return;
      movimentoDesativado = deveDesativar;

      if (!backgroundRef.current) return;

      if (movimentoDesativado) {
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        offsetRef.current = { x: 0, y: 0 };
        backgroundRef.current.style.transform = 'translate3d(0, 0, 0)';
        backgroundRef.current.style.willChange = 'auto';
      } else {
        backgroundRef.current.style.willChange = 'transform';
      }
    };

    const handleMouseMove = (event) => {
      const x = (window.innerWidth - event.clientX * 2) / 35;
      const y = (window.innerHeight - event.clientY * 2) / 35;
      agendarOffset(x, y);
    };

    const handleOrientation = (event) => {
      const gamma = Number.isFinite(event.gamma) ? event.gamma : 0;
      const beta = Number.isFinite(event.beta) ? event.beta : 45;
      const x = Math.max(-40, Math.min(40, gamma));
      const y = Math.max(-90, Math.min(90, beta));

      agendarOffset(x * 1.2, (y - 45) * 1.2);
    };

    const bodyObserver = new MutationObserver(atualizarPreferenciaDeMovimento);
    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    if (reducedMotionQuery.addEventListener) {
      reducedMotionQuery.addEventListener('change', atualizarPreferenciaDeMovimento);
    } else {
      reducedMotionQuery.addListener?.(atualizarPreferenciaDeMovimento);
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('deviceorientation', handleOrientation, { passive: true });

    atualizarPreferenciaDeMovimento();

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      bodyObserver.disconnect();
      if (reducedMotionQuery.removeEventListener) {
        reducedMotionQuery.removeEventListener('change', atualizarPreferenciaDeMovimento);
      } else {
        reducedMotionQuery.removeListener?.(atualizarPreferenciaDeMovimento);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  return (
    <div
      ref={backgroundRef}
      id="parallax-background"
      style={{
        willChange: 'transform',
        transition: 'transform 0.1s linear',
      }}
    >
      <img
        key={temaConfig.id}
        id={simboloId}
        className="simbolo-parallax simbolo-parallax-ativo"
        src={temaConfig.simbolo}
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}
