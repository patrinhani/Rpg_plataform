import React from 'react';

export default function AffinityAwakening({ onComplete }) {
  const handleAnimationEnd = (event) => {
    if (event.animationName === 'affinity-awakening-lifecycle') onComplete?.();
  };

  return (
    <div
      className="affinity-awakening"
      role="status"
      aria-live="assertive"
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="affinity-awakening__scan" aria-hidden="true" />
      <div className="affinity-awakening__ring affinity-awakening__ring--outer" aria-hidden="true" />
      <div className="affinity-awakening__ring affinity-awakening__ring--inner" aria-hidden="true" />
      <div className="affinity-awakening__core">
        <span>MARCO PARANORMAL ATINGIDO</span>
        <img
          src="/assets/images/optimized/SimboloSemafinidade-320.webp"
          alt=""
          aria-hidden="true"
        />
        <strong>NEX 50%</strong>
        <b>AFINIDADE DESBLOQUEADA</b>
        <small>Escolha o elemento que respondeu ao seu despertar.</small>
      </div>
    </div>
  );
}
