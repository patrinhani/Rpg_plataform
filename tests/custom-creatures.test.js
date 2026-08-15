import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  criarIdCriaturaPersonalizada,
  criarRascunhoCriatura,
  normalizarCriaturaPersonalizada,
  validarCriaturaPersonalizada,
} from '../src/lib/custom-creatures.js';

const criaturasMnemosyne = JSON.parse(readFileSync(
  new URL('../tools/campaign_manifest/config/mnemosyne.creatures.json', import.meta.url),
  'utf8',
));

test('cria o rascunho padrão quando o formulário fechado recebe criatura nula', () => {
  const rascunho = criarRascunhoCriatura(null);

  assert.equal(rascunho.pv_max, 20);
  assert.equal(rascunho.pv_atual, 20);
  assert.equal(rascunho.elemento, 'Medo');
});

test('normaliza uma ficha completa sem preservar campos arbitrários', () => {
  const criatura = normalizarCriaturaPersonalizada({
    id: 'criatura_teste_seguro',
    nome: ' Eco de Teste ',
    elemento: 'Energia e Conhecimento',
    vd: '80',
    tipo: 'Criatura - Grande',
    foto: '',
    iniciativa: '4d20+12',
    defesa: '22',
    pv_max: '180',
    pv_atual: 4,
    machucado: '90',
    atributos: { agi: 4, for: 2, int: 4, pre: 4, vig: 2, outro: 99 },
    habilidades: ['FORMA DEPENDENTE: não morre ao chegar a 0 PV.'],
    acoes: [{ nome: 'Corte de Quadro', descricao: 'Ataque corpo a corpo.' }],
    campoInjetado: true,
  });

  assert.equal(criatura.nome, 'Eco de Teste');
  assert.equal(criatura.vd, 80);
  assert.equal(criatura.pv_max, 180);
  assert.equal(criatura.pv_atual, 180);
  assert.equal(criatura.foto, '');
  assert.equal(criatura.personalizada, true);
  assert.equal('campoInjetado' in criatura, false);
  assert.equal('outro' in criatura.atributos, false);
});

test('aceita imagem HTTPS ou compactada e bloqueia protocolos ativos', () => {
  assert.equal(criarRascunhoCriatura({ foto: 'https://example.com/eco.webp' }).foto, 'https://example.com/eco.webp');
  assert.match(criarRascunhoCriatura({ foto: 'data:image/webp;base64,AAAA' }).foto, /^data:image\/webp/);
  assert.equal(criarRascunhoCriatura({ foto: 'data:text/html;base64,AAAA' }).foto, '');
  assert.match(validarCriaturaPersonalizada({
    nome: 'Eco',
    pv_max: 20,
    iniciativa: '2d20',
    foto: 'javascript:alert(1)',
  }), /HTTPS/);
});

test('explica o formato quando a imagem informada não é segura', () => {
  const rascunho = criarRascunhoCriatura({
    nome: 'Criatura com imagem',
    iniciativa: '2d20+5',
    pv_max: 30,
  });
  rascunho.foto = 'http://servidor-inseguro.example/token.png';

  assert.match(validarCriaturaPersonalizada(rascunho), /HTTPS/);
});

test('exige nome, vida e iniciativa antes de salvar', () => {
  assert.match(validarCriaturaPersonalizada({ nome: '', pv_max: 20, iniciativa: '2d20' }), /nome/i);
  assert.match(validarCriaturaPersonalizada({ nome: 'Eco', pv_max: 0, iniciativa: '2d20' }), /vida/i);
  assert.match(validarCriaturaPersonalizada({ nome: 'Eco', pv_max: 20, iniciativa: '' }), /iniciativa/i);
});

test('gera identificador imprevisível usando Web Crypto', () => {
  const id = criarIdCriaturaPersonalizada({ randomUUID: () => '12345678-1234-4234-8234-123456789abc' });
  assert.equal(id, 'criatura_12345678-1234-4234-8234-123456789abc');
});

test('mantém as fichas da Mnemosyne fora do catálogo global e balanceadas para quatro agentes NEX 25', async () => {
  const nomes = criaturasMnemosyne.map(criatura => criatura.nome);
  assert.deepEqual(nomes, ['Repetente Palíndromo', 'Dr. Otávio Leme', 'Eco Indexador']);
  assert.deepEqual(criaturasMnemosyne.map(criatura => criatura.vd), [20, 40, 80]);
  assert.ok(criaturasMnemosyne.every(criatura => criatura.habilidades[0].includes('NEX 25')));

  const { bestiario } = await import('../src/lib/bestiario.js');
  assert.ok(nomes.every(nome => !bestiario.some(criatura => criatura.nome === nome)));
});
