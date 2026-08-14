import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const mesaPage = readFileSync(new URL('../src/pages/Mesa/index.jsx', import.meta.url), 'utf8');

test('ficha da mesa exige que dono ou mestre ainda sejam membros válidos do pai', () => {
  assert.match(rules, /function acessoAoPersonagemNaMesaValido\(\)/);
  assert.match(rules, /let mesaPai = get\([\s\S]*?\/mesas\/\$\(mesaId\)[\s\S]*?\)\.data;/);
  assert.match(
    rules,
    /return membroDaMesa\(mesaPai\)[\s\S]*?request\.auth\.uid == personagemUid \|\| mestreDaMesa\(mesaPai\)/,
  );
  assert.match(
    rules,
    /allow read, create, update, delete: if acessoAoPersonagemNaMesaValido\(\);/,
  );
});

test('array compartilhado de iniciativas é escrito somente pelo mestre', () => {
  assert.doesNotMatch(rules, /atualizacaoDeIniciativaDoJogadorValida/);
  assert.doesNotMatch(rules, /alterouSomente\(\['iniciativas'\]\)/);
  assert.match(
    rules,
    /allow update: if atualizacaoDoMestreValida\(\)\s*\|\| entradaPropriaValida\(\);/,
  );
});

test('interface não oferece escrita de iniciativa ao jogador', () => {
  assert.doesNotMatch(mesaPage, /onSubmit=\{enviarIniciativa\}/);
  assert.match(mesaPage, /onSubmit=\{registrarIniciativaAgente\}/);
  assert.match(mesaPage, /Informe ao mestre/);
});

test('criaturas personalizadas ficam vinculadas à mesa e somente o mestre escreve', () => {
  assert.match(rules, /match \/criaturas\/\{criaturaId\}/);
  assert.match(rules, /allow read: if membroDaMesa\(mesaPaiCriatura\(\)\);/);
  assert.match(
    rules,
    /allow create, update: if mestreDaMesa\(mesaPaiCriatura\(\)\)[\s\S]*?fichaCriaturaValida\(\);/,
  );
  assert.match(rules, /request\.resource\.data\.personalizada == true/);
  assert.match(rules, /request\.resource\.data\.acoes\.size\(\) <= 20/);
});
