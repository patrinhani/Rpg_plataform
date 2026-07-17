import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ErroImportacaoFicha,
  LIMITE_ARQUIVO_FICHA_BYTES,
  LIMITES_ESTRUTURA_FICHA,
  parsearFichaJson,
  validarEstruturaFicha,
  validarTamanhoArquivoFicha,
} from '../src/lib/importacaoFicha.js';

function fichaMinima(extra = {}) {
  return {
    info: { nome: 'Agente da mesa', classe: 'classe da casa', nex: '37%' },
    atributos: { for: 2, agi: 3, atributo_da_casa: 'livre' },
    ...extra,
  };
}

function deveFalharComCodigo(funcao, codigo) {
  assert.throws(funcao, erro => (
    erro instanceof ErroImportacaoFicha
    && erro.codigo === codigo
  ));
}

test('aceita exportações antigas e campos livres sem validar regras da mesa', () => {
  const ficha = fichaMinima({
    _versao: '1.0',
    campo_criado_pela_mesa: { regra: 'qualquer valor', ativo: true },
    inventario: [{ nome: 'Item caseiro', espacos: 'à escolha do mestre' }],
  });

  assert.deepEqual(parsearFichaJson(JSON.stringify(ficha)), ficha);
});

test('exige somente a estrutura mínima de uma ficha', () => {
  deveFalharComCodigo(() => parsearFichaJson('{'), 'json-invalido');
  deveFalharComCodigo(() => parsearFichaJson('[]'), 'raiz-invalida');
  deveFalharComCodigo(() => parsearFichaJson('{"info":{}}'), 'estrutura-minima');
  deveFalharComCodigo(
    () => parsearFichaJson('{"info":{},"atributos":{},"inventario":{}}'),
    'tipo-estrutural',
  );
});

test('bloqueia chaves capazes de causar poluição de protótipo em qualquer nível', () => {
  for (const chave of ['__proto__', 'prototype', 'constructor']) {
    const texto = `{"info":{},"atributos":{},"extra":{"seguro":{"${chave}":true}}}`;
    deveFalharComCodigo(() => parsearFichaJson(texto), 'chave-perigosa');
  }
});

test('recusa arquivo vazio ou maior que 2 MiB antes da leitura', () => {
  deveFalharComCodigo(() => validarTamanhoArquivoFicha(0), 'arquivo-vazio');
  deveFalharComCodigo(
    () => validarTamanhoArquivoFicha(LIMITE_ARQUIVO_FICHA_BYTES + 1),
    'arquivo-grande',
  );
  assert.equal(validarTamanhoArquivoFicha(LIMITE_ARQUIVO_FICHA_BYTES), true);
});

test('mede o conteúdo em UTF-8 e não apenas em caracteres JavaScript', () => {
  const base = JSON.stringify(fichaMinima({ nota: '' }));
  const quantidadeEmoji = Math.floor((LIMITE_ARQUIVO_FICHA_BYTES - base.length) / 2);
  const texto = JSON.stringify(fichaMinima({ nota: '🔴'.repeat(quantidadeEmoji) }));

  assert.ok(texto.length <= LIMITE_ARQUIVO_FICHA_BYTES);
  deveFalharComCodigo(() => parsearFichaJson(texto), 'arquivo-grande');
});

test('limita profundidade, quantidade de nós e tamanho de listas', () => {
  const limitesBase = { ...LIMITES_ESTRUTURA_FICHA };
  const profunda = fichaMinima({ extra: { nivel1: { nivel2: { nivel3: true } } } });
  deveFalharComCodigo(
    () => validarEstruturaFicha(profunda, { ...limitesBase, maxProfundidade: 2 }),
    'profundidade-excessiva',
  );

  deveFalharComCodigo(
    () => validarEstruturaFicha(fichaMinima({ extra: [1, 2, 3, 4] }), { ...limitesBase, maxNos: 5 }),
    'estrutura-grande',
  );

  deveFalharComCodigo(
    () => validarEstruturaFicha(fichaMinima({ extra: [1, 2] }), { ...limitesBase, maxItensArray: 1 }),
    'lista-grande',
  );
});

test('recusa valores que não podem existir em um JSON seguro', () => {
  deveFalharComCodigo(
    () => validarEstruturaFicha(fichaMinima({ extra: undefined })),
    'valor-invalido',
  );

  const circular = fichaMinima();
  circular.extra = circular;
  deveFalharComCodigo(() => validarEstruturaFicha(circular), 'referencia-circular');
});
