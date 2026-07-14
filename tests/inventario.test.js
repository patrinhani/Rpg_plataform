import assert from 'node:assert/strict';
import test from 'node:test';

import { calcularDanoArma } from '../src/lib/calculosCombate.js';
import {
  calcularAlcanceItem,
  calcularCriticoItem,
  calcularDefesaItem,
  calcularStatsItem,
  getModificacoesCompativeis,
} from '../src/lib/inventario.js';
import { database } from '../src/lib/database.js';
import Personagem from '../src/lib/personagem.js';

test('calcula categoria e espaços finais das modificações', () => {
  const item = {
    categoriaBase: 1,
    espacosBase: 2,
    modificacoes: ['reforcada'],
  };

  assert.deepEqual(calcularStatsItem(item), {
    categoria: 2,
    espacos: 3,
    modificacoes: ['reforcada'],
  });
});

test('calcula dano, crítico e alcance sem rolar dados', () => {
  const arma = {
    dano: '2d10',
    critico: '19/x3',
    alcance: 'Médio',
    modificacoes: ['calibre_grosso', 'explosiva', 'mira_laser', 'dum_dum', 'mira_telescopica'],
  };

  assert.equal(calcularDanoArma(arma), '3d10 + 2d6');
  assert.equal(calcularCriticoItem(arma), '17/x4');
  assert.equal(calcularAlcanceItem(arma), 'Longo');
});

test('preserva as duas formas de dano de armas versáteis', () => {
  assert.equal(calcularDanoArma({ dano: '1d6/1d8', modificacoes: [] }), '1d6/1d8');
  assert.equal(
    calcularDanoArma({ dano: '1d6/1d8', modificacoes: ['cruel'] }),
    '1d6+2/1d8+2',
  );
});

test('aplica Defesa e RD de proteção modificada', () => {
  const personagem = new Personagem();
  personagem.addItemInventario({
    id: 'protecao_pesada',
    defesa: 10,
    categoria: 2,
    espacos: 5,
    modificacoes: ['reforcada', 'blindada'],
  });

  assert.equal(calcularDefesaItem(personagem.inventario[0]), 12);
  assert.equal(personagem.getBonusDefesaInventario(), 12);
  assert.deepEqual(personagem.getResistenciasInventario(), {
    balistico: 5,
    corte: 5,
    impacto: 5,
    perfuracao: 5,
  });
  assert.equal(personagem.getPesoTotal(), 7);
});

test('identifica carga normal, sobrecarga e limite absoluto', () => {
  const personagem = new Personagem();
  personagem.atributos.for = 1;
  personagem.addItemInventario({ id: 'caixa', categoria: 0, espacos: 6 });

  assert.deepEqual(personagem.getEstadoCarga(), {
    atual: 6,
    maximo: 5,
    limiteAbsoluto: 10,
    sobrecarregado: true,
    acimaDoLimite: false,
    penalidadeDefesa: -5,
    penalidadePericias: -5,
    penalidadeDeslocamento: -3,
  });
});

test('Mochila Militar aumenta a capacidade em 2 sem ocupar espaço', () => {
  const personagem = new Personagem();
  personagem.atributos.for = 1;
  const mochila = database.equipGeral.find(item => item.id === 'mochila_militar');

  personagem.addItemInventario(mochila);

  assert.equal(personagem.getPesoTotal(), 0);
  assert.equal(personagem.getMaxPeso(), 7);
  assert.equal(personagem.getEstadoCarga().limiteAbsoluto, 14);
});

test('reconhece Mochila Militar legada sem acumular bônus de itens', () => {
  const personagem = new Personagem();
  personagem.carregarDados({
    atributos: { ...personagem.atributos, for: 1 },
    info: personagem.info,
    inventario: [
      { inventarioId: 'mochila_militar', nome: 'Mochila Militar', espacos: 0 },
      { id: 'mochila_militar', nome: 'Mochila Militar', espacos: 0, bonusCapacidadeCarga: 2 },
    ],
  });

  assert.equal(personagem.getMaxPeso(), 7);

  personagem.inventario[0].ignorarCalculos = true;
  personagem.inventario[1].quebrado = true;
  assert.equal(personagem.getMaxPeso(), 5);
});

test('filtra modificações pelo tipo do item', () => {
  const protecao = { id: 'protecao_leve' };
  const chaves = getModificacoesCompativeis(protecao).map(modificacao => modificacao.key);

  assert.deepEqual(chaves.sort(), ['discreta_protecao', 'reforcada'].sort());
});
