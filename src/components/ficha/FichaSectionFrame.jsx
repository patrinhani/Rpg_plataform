import React, { useId } from 'react';
import { AppIcon } from '../icons/NavigationIcons.jsx';

function FichaSectionFrame({
  variant,
  icon,
  eyebrow,
  title,
  description,
  metrics = [],
  action,
  children,
  className = '',
}) {
  const titleId = useId();
  const visibleMetrics = metrics.filter(metric => metric && metric.value !== undefined && metric.value !== null);

  return (
    <main className={`ficha-section-view ficha-section-view--${variant} ${className}`.trim()}>
      <section className="ficha-section-hero" aria-labelledby={titleId}>
        <div className="ficha-section-atmosphere" aria-hidden="true">
          <span className="ficha-section-atmosphere__symbol" />
          <span className="ficha-section-atmosphere__orbit ficha-section-atmosphere__orbit--outer" />
          <span className="ficha-section-atmosphere__orbit ficha-section-atmosphere__orbit--inner" />
          <span className="ficha-section-atmosphere__trace" />
        </div>

        <header className="ficha-section-hero__copy">
          <span className="ficha-section-kicker">
            <AppIcon name={icon} size={16} />
            {eyebrow}
          </span>
          <h1 id={titleId}>{title}</h1>
          <p>{description}</p>
        </header>

        <div className="ficha-section-hero__command">
          {visibleMetrics.length > 0 && (
            <dl className="ficha-section-metrics" aria-label={`Resumo de ${title}`}>
              {visibleMetrics.map(metric => (
                <div key={metric.label} className={metric.tone ? `is-${metric.tone}` : undefined}>
                  <dt>{metric.label}</dt>
                  <dd>{metric.value}</dd>
                  {metric.detail && <small>{metric.detail}</small>}
                </div>
              ))}
            </dl>
          )}
          {action && <div className="ficha-section-primary-action">{action}</div>}
        </div>
      </section>

      <div className="ficha-section-body">
        {children}
      </div>
    </main>
  );
}

export default FichaSectionFrame;
