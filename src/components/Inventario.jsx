import React from 'react';
import ItemCard from './ItemCard.jsx';
import FichaSectionFrame from './ficha/FichaSectionFrame.jsx';
import { AppIcon } from './icons/NavigationIcons.jsx';
import { calcularBonusCapacidadeCargaItem } from '../lib/inventario.js';

function Inventario({ inventario, calculados, onAbrirLoja, onRemoveItem, onToggleItem, onEditItem }) {
  const itens = inventario || [];
  const cargaAtual = Number(calculados?.cargaAtual) || 0;
  const cargaMax = Number(calculados?.cargaMax) || 0;
  const cargaLimiteAbsoluto = Number(calculados?.cargaLimiteAbsoluto) || 0;
  const percentualCarga = cargaMax > 0 ? Math.min(100, Math.max(0, (cargaAtual / cargaMax) * 100)) : 0;
  const fontesCapacidade = itens
    .filter(item => !item.ignorarCalculos && !item.quebrado)
    .map(item => ({ nome: item.nome, bonus: calcularBonusCapacidadeCargaItem(item) }))
    .filter(item => item.bonus > 0);
  const bonusCapacidadeAplicado = Math.max(0, ...fontesCapacidade.map(item => item.bonus));
  const fontesCapacidadeAplicadas = fontesCapacidade
    .filter(item => item.bonus === bonusCapacidadeAplicado)
    .filter((item, index, lista) => lista.findIndex(fonte => fonte.nome === item.nome) === index);
  const maximoAcessivelCarga = Math.max(cargaAtual, cargaMax, cargaLimiteAbsoluto, 1);
  const estadoCarga = calculados?.cargaAcimaDoLimite
    ? { label: 'Limite excedido', tone: 'danger' }
    : calculados?.sobrecarregado
      ? { label: 'Sobrecarregado', tone: 'warning' }
      : { label: 'Operacional', tone: 'ok' };

  return (
    <FichaSectionFrame
      variant="inventory"
      icon="inventory"
      eyebrow="ARSENAL DO AGENTE"
      title="Inventário"
      description="Equipamentos, recursos e carga reunidos em uma leitura operacional única."
      metrics={[
        { label: 'Itens', value: itens.length },
        { label: 'Carga', value: `${cargaAtual} / ${cargaMax}` },
        { label: 'Deslocamento', value: `${calculados?.deslocamentoFinal ?? 0} m` },
      ]}
      action={(
        <button type="button" className="ficha-section-action" id="btn-abrir-loja-inv" onClick={onAbrirLoja}>
          <AppIcon name="plus" size={18} />
          Adicionar item
        </button>
      )}
    >
      <section className={`inventory-load-panel is-${estadoCarga.tone}`} aria-labelledby="inventory-load-title">
        <div className="inventory-load-panel__heading">
          <div>
            <span className="ficha-record-kicker">LOGÍSTICA DE CAMPO</span>
            <h2 id="inventory-load-title">Capacidade de carga</h2>
          </div>
          <span className="inventory-load-status">{estadoCarga.label}</span>
        </div>

        <div className="inventory-load-readout">
          <strong>{cargaAtual}</strong>
          <span>de {cargaMax} espaços</span>
          <small>Limite absoluto: {cargaLimiteAbsoluto}</small>
        </div>
        <div
          className="inventory-load-track"
          role="progressbar"
          aria-label="Carga utilizada"
          aria-valuemin="0"
          aria-valuemax={maximoAcessivelCarga}
          aria-valuenow={cargaAtual}
          aria-valuetext={`${cargaAtual} de ${cargaMax} espaços; limite absoluto ${cargaLimiteAbsoluto}`}
        >
          <span style={{ '--inventory-load': `${percentualCarga}%` }} />
        </div>

        <div className="inventory-load-details">
          <span>Deslocamento atual <strong>{calculados?.deslocamentoFinal ?? 0} m</strong></span>
          {fontesCapacidadeAplicadas.length > 0 && (
            <span>
              Bônus aplicado{' '}
              <strong>
                {fontesCapacidadeAplicadas.map(item => `${item.nome} +${item.bonus}`).join(' · ')}
                {' '}(maior bônus ativo)
              </strong>
            </span>
          )}
          {(calculados?.sobrecarregado || calculados?.cargaAcimaDoLimite) && (
            <span className="inventory-load-consequence">
              {calculados?.cargaAcimaDoLimite && 'Acima do limite absoluto · ajuste o inventário · '}
              DEF −5 · perícias de carga −5 · deslocamento −3 m
            </span>
          )}
        </div>
      </section>

      <section className="ficha-record-panel inventory-record-panel" id="grid-inventario" aria-labelledby="inventory-record-title">
        <header className="ficha-record-heading">
          <div>
            <span className="ficha-record-kicker">EQUIPAMENTO EM CAMPO</span>
            <h2 id="inventory-record-title">Itens carregados</h2>
          </div>
          <span className="ficha-record-count">{itens.length.toString().padStart(2, '0')}</span>
        </header>

        <ul id="lista-inventario-pessoal" className="loja-lista-itens inventory-grid">
          {itens.length > 0 ? (
            itens.map(item => (
              <ItemCard
                key={item.inventarioId}
                item={item}
                tipo="inventario"
                onRemove={onRemoveItem}
                onToggle={onToggleItem}
                onEdit={onEditItem}
              />
            ))
          ) : (
            <li className="item-placeholder ficha-section-empty-state">
              <AppIcon name="inventory" size={28} />
              <strong>Nenhum equipamento registrado</strong>
              <span>Adicione itens para montar o arsenal deste agente.</span>
            </li>
          )}
        </ul>
      </section>
    </FichaSectionFrame>
  );
}

export default Inventario;
