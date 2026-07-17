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
  assert.deepEqual(recarregado.inventario, [{ inventarioId: 'item-1', nome: 'Lanterna', modificacoes: [] }]);
  assert.ok(Array.isArray(recarregado.rituais));
  assert.ok(Array.isArray(recarregado.poderes_aprendidos));
});

test('importação parcial mescla mapas com os padrões e ignora mapas inválidos', () => {
  const parcial = new Personagem();
  parcial.carregarDados({
    atributos: { for: 4 },
    defesa: { outros: 3 },
    resistencias: { fogo: 5 },
  });

  assert.deepEqual(parcial.atributos, { for: 4, agi: 1, int: 1, pre: 1, vig: 1 });
  assert.deepEqual(parcial.defesa, { equip: 0, outros: 3 });
  assert.equal(parcial.resistencias.fogo, 5);
  assert.equal(parcial.resistencias.corte, 0);

  const invalido = new Personagem();
  invalido.carregarDados({
    atributos: ['for', 10],
    defesa: 'sem mapa',
    resistencias: null,
  });

  assert.deepEqual(invalido.atributos, { for: 1, agi: 1, int: 1, pre: 1, vig: 1 });
  assert.deepEqual(invalido.defesa, { equip: 0, outros: 0 });
  assert.equal(invalido.resistencias.fogo, 0);
});

test('condições penalizam os dados sem alterar atributos ou recursos máximos', () => {
  const personagem = criarPersonagemBase('combatente');
  const pvMaximo = personagem.recursos.pv_max;

  personagem.toggleCondicao('fraco');
  personagem.calcularValoresMaximos();

  assert.equal(personagem.getAtributoFinal('vig'), 1);
  assert.equal(personagem.recursos.pv_max, pvMaximo);
  assert.equal(personagem.getDadosPericia('fortitude', 'vig', 0).descricaoDados, '2d20 (pior)');
});

test('condições de combate alteram dados, não bônus fixos', () => {
  const casos = [
    { condicao: 'surdo', pericia: 'iniciativa', atributo: 'agi', dados: 2, mensagem: 'Surdo (-2d20 em Iniciativa)' },
    { condicao: 'desprevenido', pericia: 'reflexos', atributo: 'agi', dados: 3, mensagem: 'Desprevenido (-1d20 em Reflexos)' },
    { condicao: 'fascinado', pericia: 'percepcao', atributo: 'pre', dados: 2, mensagem: 'Fascinado (-2d20 em Percepção)' },
    { condicao: 'agarrado', pericia: 'pontaria', atributo: 'agi', dados: 3, mensagem: 'Agarrado/Enredado (-1d20 em ataques)' },
    { condicao: 'enredado', pericia: 'luta', atributo: 'for', dados: 3, mensagem: 'Agarrado/Enredado (-1d20 em ataques)' },
    { condicao: 'caido', pericia: 'luta', atributo: 'for', dados: 2, mensagem: 'Caído (-2d20 em ataques corpo a corpo)' },
  ];

  for (const caso of casos) {
    const personagem = new Personagem();
    personagem.setAtributo(caso.atributo, 4);
    personagem.toggleCondicao(caso.condicao);

    const resultado = personagem.getDadosPericia(caso.pericia, caso.atributo, 0);
    assert.equal(resultado.dados, caso.dados, caso.condicao);
    assert.equal(resultado.bonus, 0, `${caso.condicao} não deve aplicar penalidade fixa`);
    assert.match(resultado.msgCondicao, new RegExp(caso.mensagem.replace(/[()]/g, '\\$&')));
  }
});

test('restrições de Cego e Indefeso são orientativas e não bloqueiam testes', () => {
  const cego = new Personagem();
  cego.setAtributo('pre', 3);
  cego.toggleCondicao('cego');
  const percepcao = cego.getDadosPericia('percepcao', 'pre', 0);

  assert.equal(percepcao.dados, 3);
  assert.equal(percepcao.efeitosOrientativos.naoPodeObservar, true);
  assert.match(percepcao.msgCondicao, /não pode observar/i);

  const indefeso = new Personagem();
  indefeso.setAtributo('agi', 3);
  indefeso.toggleCondicao('indefeso');
  const reflexos = indefeso.getDadosPericia('reflexos', 'agi', 0);

  assert.equal(reflexos.dados, 3);
  assert.equal(reflexos.efeitosOrientativos.falhaAutomaticaReflexos, true);
  assert.match(reflexos.msgCondicao, /sem bloquear o teste/i);
});

test('deslocamento respeita Caído e arredonda Lento para a grade de 1,5m', () => {
  const lento = new Personagem();
  lento.setInfo('deslocamento', 10);
  lento.toggleCondicao('lento');
  assert.equal(lento.getDeslocamentoFinal(), 4.5);

  const caido = new Personagem();
  caido.setInfo('deslocamento', 12);
  caido.toggleCondicao('caido');
  assert.equal(caido.getDeslocamentoFinal(), 1.5);

  caido.toggleCondicao('agarrado');
  assert.equal(caido.getDeslocamentoFinal(), 0);
});

test('deriva condições de PV e SAN sem misturá-las às condições manuais', () => {
  const personagem = criarPersonagemBase('especialista');

  personagem.setRecurso('pv_atual', 0);
  personagem.setRecurso('san_atual', 0);

  assert.deepEqual(personagem.getCondicoesAutomaticas(), ['morrendo', 'inconsciente', 'enlouquecendo']);
  assert.deepEqual(personagem.condicoesAtivas, []);
});

test('Machucado e Perturbado exigem estar abaixo da metade', () => {
  const personagem = criarPersonagemBase('especialista');
  personagem.recursos.pv_max = 16;
  personagem.recursos.pv_atual = 8;
  personagem.recursos.san_max = 16;
  personagem.recursos.san_atual = 8;
  assert.deepEqual(personagem.getCondicoesAutomaticas(), []);

  personagem.recursos.pv_atual = 7;
  personagem.recursos.san_atual = 7;
  assert.deepEqual(personagem.getCondicoesAutomaticas(), ['machucado', 'perturbado']);
});

test('limita recursos atuais entre zero e o máximo', () => {
  const personagem = criarPersonagemBase('ocultista');

  personagem.setRecurso('pv_atual', -30);
  personagem.setRecurso('pe_atual', 999);

  assert.equal(personagem.recursos.pv_atual, 0);
  assert.equal(personagem.recursos.pe_atual, personagem.recursos.pe_max);
});

test('Cultista Arrependido reduz apenas a Sanidade inicial', () => {
  const personagem = criarPersonagemBase('especialista', '10%');
  personagem.setInfo('origem', 'cultista_arrependido');
  personagem.calcularValoresMaximos();

  assert.equal(personagem.recursos.san_max, 12);
});

test('Sobrevivente usa estágios sem converter para NEX', () => {
  const personagem = criarPersonagemBase('sobrevivente', '75%');
  personagem.setInfo('estagio_sobrevivente', 3);
  personagem.calcularValoresMaximos();

  assert.equal(personagem.recursos.pv_max, 13);
  assert.equal(personagem.recursos.pe_max, 5);
  assert.equal(personagem.recursos.san_max, 12);
  assert.equal(personagem.calculosDetalhados.limite_pe, 1);
});

test('troca de origem remove apenas perícias concedidas pela origem', () => {
  const personagem = new Personagem();
  personagem.setTreinoPericia('fortitude', 10);
  personagem.trocarPericiasOrigem(['investigacao', 'percepcao']);

  assert.equal(personagem.pericias.fortitude, 10);
  assert.equal(personagem.pericias.sobrevivencia, 0);
  assert.equal(personagem.pericias.investigacao, 5);
  assert.equal(personagem.pericias.percepcao, 5);
  assert.deepEqual(personagem.periciasOrigemAplicadas, ['investigacao', 'percepcao']);
});

test('visibilidade pode ficar negativa conforme as regras de furtividade', () => {
  const personagem = new Personagem();
  personagem.setVisibilidade('visibilidade', -1);
  assert.equal(personagem.visibilidade, -1);
});

test('perseguição é independente da visibilidade e aceita metas da mesa', () => {
  const personagem = new Personagem();
  personagem.setVisibilidade('visibilidade', 4);
  personagem.setPerseguicao('metaSucessos', 5);
  personagem.setPerseguicao('metaFalhas', 4);
  personagem.setPerseguicao('sucessos', 5);
  personagem.setPerseguicao('falhas', 4);
  personagem.setPerseguicao('reset');

  assert.equal(personagem.visibilidade, 4);
  assert.deepEqual(personagem.perseguicao, { sucessos: 0, falhas: 0, metaSucessos: 5, metaFalhas: 4 });
});

test('interlúdio respeita participantes e limites de exercício e leitura', () => {
  const personagem = criarPersonagemBase('especialista');
  personagem.recursos.san_atual = 1;

  const relaxamento = personagem.aplicarInterludio({
    acoes: ['relaxar'],
    conforto: 'normal',
    participantesRelaxando: 3,
  });
  assert.equal(relaxamento.san, 4);

  personagem.aplicarInterludio({ acoes: ['exercitar'] });
  personagem.aplicarInterludio({ acoes: ['exercitar'] });
  assert.equal(personagem.buffsTemporarios.exercicio, 1);

  personagem.setInfo('origem', 'nerd_entusiasta');
  const leitura = personagem.aplicarInterludio({ acoes: ['ler'] });
  assert.match(leitura.extras[0], /\+2d6/);
  assert.equal(personagem.consumirBuffTemporario('leitura'), true);
  assert.equal(personagem.buffsTemporarios.leitura, 0);
});

test('interlúdio aceita decisões flexíveis da mesa e Revisar Caso duas vezes', () => {
  const personagem = criarPersonagemBase('especialista');
  const resultado = personagem.aplicarInterludio({
    acoes: ['revisar', 'revisar', 'ler'],
  });

  assert.equal(resultado.extras.filter((mensagem) => /pistas perdidas/i.test(mensagem)).length, 2);
  assert.equal(personagem.buffsTemporarios.leitura, 1);
});

test('manutenção repara somente o item selecionado', () => {
  const personagem = criarPersonagemBase('combatente');
  personagem.inventario = [
    { inventarioId: 'a', nome: 'A', quebrado: true },
    { inventarioId: 'b', nome: 'B', quebrado: true },
  ];

  personagem.aplicarInterludio({ acoes: ['manutencao'], itemManutencaoId: 'a' });
  assert.equal(personagem.inventario[0].quebrado, false);
  assert.equal(personagem.inventario[1].quebrado, true);
});

test('aplica efeitos numéricos determinísticos das origens', () => {
  const personagem = criarPersonagemBase('especialista');

  personagem.setInfo('origem', 'diplomata');
  assert.equal(personagem.getBonusPericiaOrigem('diplomacia'), 2);

  personagem.setInfo('origem', 'profetizado');
  assert.equal(personagem.getBonusPericiaOrigem('vontade'), 2);

  personagem.setInfo('origem', 'experimento');
  assert.equal(personagem.getDadosPericia('diplomacia', 'pre', 0).descricaoDados, '2d20 (pior)');
  assert.equal(personagem.getResistenciasOrigem().fogo, 2);

  personagem.setInfo('origem', 'teorico_conspiracao');
  personagem.setAtributo('int', 3);
  assert.deepEqual(personagem.getResistenciasOrigem(), { mental: 3 });
});
