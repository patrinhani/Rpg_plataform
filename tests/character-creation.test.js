import test from 'node:test';
import assert from 'node:assert/strict';

import Personagem from '../src/lib/personagem.js';
import {
  criarRascunhoCriacao,
  deveExibirCriador,
  montarDadosCriacao,
  obterQuantidadePericiasLivres,
  validarEtapaCriacao,
} from '../src/lib/character-creation.js';

function criarRascunhoValido() {
  const dados = new Personagem().getDados();
  return {
    ...criarRascunhoCriacao(dados, 'Jogador'),
    nome: 'Agente Teste',
    conceito: 'Investigador em busca de respostas.',
    origem: 'academico',
    classe: 'especialista',
    atributos: { agi: 2, for: 1, int: 3, pre: 2, vig: 1 },
    periciasOrigemEscolhidas: [],
    periciasClasseLivres: [
      'atualidades', 'crime', 'diplomacia', 'fortitude', 'furtividade',
      'medicina', 'percepcao', 'reflexos', 'tecnologia', 'vontade',
    ],
  };
}

test('abre o guia apenas para fichas novas ou com criação em andamento', () => {
  assert.equal(deveExibirCriador({ nome: '', criacao_em_andamento: false }), true);
  assert.equal(deveExibirCriador({ nome: 'Rascunho', criacao_em_andamento: true }), true);
  assert.equal(deveExibirCriador({ nome: 'Agente antigo' }), false);
  assert.equal(deveExibirCriador({ nome: '', criacao_concluida: true }), false);
});

test('valida a distribuição padrão e a reduzida do sobrevivente', () => {
  const rascunho = criarRascunhoValido();
  assert.equal(validarEtapaCriacao(3, rascunho), '');

  const sobrevivente = {
    ...rascunho,
    classe: 'sobrevivente',
    atributos: { agi: 2, for: 1, int: 2, pre: 1, vig: 2 },
  };
  assert.equal(validarEtapaCriacao(3, sobrevivente), '');
  assert.match(
    validarEtapaCriacao(3, { ...sobrevivente, atributos: { ...sobrevivente.atributos, vig: 3 } }),
    /3 pontos/,
  );
});

test('calcula escolhas livres por classe e compensa perícia fixa duplicada', () => {
  const rascunho = criarRascunhoValido();
  assert.equal(obterQuantidadePericiasLivres(rascunho), 10);
  assert.equal(obterQuantidadePericiasLivres({ ...rascunho, classe: 'combatente' }), 4);
  assert.equal(obterQuantidadePericiasLivres({ ...rascunho, classe: 'sobrevivente' }), 4);
  assert.equal(obterQuantidadePericiasLivres({ ...rascunho, classe: 'ocultista' }), 6);

  const cultistaOcultista = { ...rascunho, origem: 'cultista_arrependido', classe: 'ocultista' };
  assert.equal(obterQuantidadePericiasLivres(cultistaOcultista), 7);
});

test('monta a ficha concluída, treina as escolhas e recalcula recursos cheios', () => {
  const base = new Personagem().getDados();
  const rascunho = criarRascunhoValido();
  const dados = montarDadosCriacao(base, rascunho, { concluida: true, etapa: 5 });

  assert.equal(dados.info.nome, 'Agente Teste');
  assert.equal(dados.info.criacao_concluida, true);
  assert.equal(dados.info.criacao_em_andamento, false);
  assert.equal(dados.pericias.ciencias, 5);
  assert.equal(dados.pericias.investigacao, 5);
  assert.equal(dados.pericias.tecnologia, 5);
  assert.equal(dados.pericias.luta, 0);
  assert.deepEqual(dados.periciasOrigemAplicadas.sort(), ['ciencias', 'investigacao']);
  assert.equal(dados.recursos.pv_atual, dados.recursos.pv_max);
  assert.equal(dados.recursos.pe_atual, dados.recursos.pe_max);
  assert.equal(dados.recursos.san_atual, dados.recursos.san_max);
});

test('impede avançar com escolhas repetidas entre origem e classe', () => {
  const rascunho = criarRascunhoValido();
  const invalido = {
    ...rascunho,
    periciasClasseLivres: [...rascunho.periciasClasseLivres.slice(0, 9), 'ciencias'],
  };
  assert.match(validarEtapaCriacao(4, invalido), /repetidas/);
});
