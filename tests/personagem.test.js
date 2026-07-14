import assert from 'node:assert/strict';
import test from 'node:test';

import Personagem from '../src/lib/personagem.js';

function criarPersonagemBase(classe, nex = '5%') {
  const personagem = new Personagem();
  personagem.setInfo('classe', classe);
  personagem.setInfo('origem', 'academico');
  personagem.setInfo('nex', nex);
  personagem.calcularValoresMaximos();
  return personagem;
}

test('calcula os recursos iniciais das classes básicas', () => {
  const casos = [
    ['combatente', { pv_max: 21, pe_max: 3, san_max: 12 }],
    ['especialista', { pv_max: 17, pe_max: 4, san_max: 16 }],
    ['ocultista', { pv_max: 13, pe_max: 5, san_max: 20 }],
  ];

  for (const [classe, esperado] of casos) {
    const personagem = criarPersonagemBase(classe);
    assert.deepEqual(
      {
        pv_max: personagem.recursos.pv_max,
        pe_max: personagem.recursos.pe_max,
        san_max: personagem.recursos.san_max,
      },
      esperado,
    );
    assert.equal(personagem.calculosDetalhados.limite_pe, 1);
  }
});

test('trata NEX 99% como o vigésimo patamar', () => {
  const personagem = criarPersonagemBase('combatente', '99%');

  assert.equal(personagem.recursos.pv_max, 116);
  assert.equal(personagem.recursos.pe_max, 60);
  assert.equal(personagem.recursos.san_max, 69);
  assert.equal(personagem.calculosDetalhados.limite_pe, 20);
});

test('mantém a estrutura necessária ao exportar e recarregar uma ficha', () => {
  const original = criarPersonagemBase('especialista');
  original.setInfo('nome', 'Agente Teste');
  original.inventario.push({ inventarioId: 'item-1', nome: 'Lanterna' });

  const recarregado = new Personagem();
  recarregado.carregarDados(original.getDados());

  assert.equal(recarregado.info.nome, 'Agente Teste');
  assert.equal(recarregado.info.classe, 'especialista');
  assert.deepEqual(recarregado.inventario, [{ inventarioId: 'item-1', nome: 'Lanterna' }]);
  assert.ok(Array.isArray(recarregado.rituais));
  assert.ok(Array.isArray(recarregado.poderes_aprendidos));
});
