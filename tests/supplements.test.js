import assert from 'node:assert/strict';
import test from 'node:test';

import { bestiario } from '../src/lib/bestiario.js';
import {
  database,
  modificacoesGranadas,
  OpcoesOrigem,
  poderesCombatente,
  poderesEspecialista,
  poderesGerais,
  poderesOcultista,
  poderesParanormais,
} from '../src/lib/database.js';
import { groupTrilhasByClass, progressaoTrilhas } from '../src/lib/progressao.js';
import { OPTIONAL_RULES, SUPPLEMENT_ITEMS } from '../src/lib/supplements.js';

const idsItens = () => [
  ...database.armasTaticas,
  ...database.armasPesadas,
  ...database.equipGeral,
  ...database.itensParanormais,
].map(item => item.id);

test('inclui origens reutilizáveis dos Arquivos Secretos com suas fontes', () => {
  assert.equal(OpcoesOrigem.ferido_por_ritual, 'Ferido por Ritual');
  assert.equal(OpcoesOrigem.transtornado_arrependido, 'Transtornado Arrependido');
  assert.equal(OpcoesOrigem.cacador_recompensas, 'Caçador de Recompensas');
  assert.equal(OpcoesOrigem.influencer_paranormal, 'Influencer Paranormal');
  assert.equal(database.periciasPorOrigem.ferido_por_ritual.fonte.sigla, 'AS #1');
  assert.deepEqual(
    database.periciasPorOrigem.ferido_por_ritual.escolhas[0].opcoesPorNarrativa.Energia,
    ['reflexos'],
  );
});

test('expõe as trilhas novas nas classes corretas', () => {
  const grupos = groupTrilhasByClass(progressaoTrilhas);
  assert.ok(grupos.ocultista.maledictologo);
  assert.ok(grupos.especialista.granadeiro_blaster);
  assert.ok(grupos.combatente.performatico);
  assert.ok(grupos.especialista.performatico);
  assert.ok(grupos.ocultista.performatico);
});

test('inclui poderes e rituais dos suplementos sem perder metadados', () => {
  assert.ok(poderesCombatente.some(poder => poder.key === 'guardiao_tropa'));
  assert.ok(poderesEspecialista.some(poder => poder.key === 'analise_conturbada'));
  assert.ok(poderesOcultista.some(poder => poder.key === 'ritual_intenso'));
  assert.ok(poderesGerais.some(poder => poder.key === 'ambidestria'));
  assert.ok(poderesParanormais.some(poder => poder.key === 'intencao_prove_se_digno'));

  const passagem = database.rituais.find(ritual => ritual.id === 'passagem_conhecimento');
  const backup = database.rituais.find(ritual => ritual.id === 'backup');
  assert.deepEqual(passagem.elementos, ['Sangue', 'Conhecimento']);
  assert.equal(passagem.fonte.sigla, 'AS #1');
  assert.equal(backup.fonte.sigla, 'AS #4');
});

test('cataloga os dezenove itens amaldiçoados de Sobrevivendo ao Horror', () => {
  const esperados = [
    'conector_membros', 'dose_praga', 'mandibula_agonizante', 'retalho_tenebroso',
    'ampulheta_tempo_sofrido', 'injecao_lodo', 'instantaneo_mortal',
    'projetil_lodo_curto', 'projetil_lodo_longo', 'radio_chiador', 'camera_obscura',
    'enxame_fantasmagorico', 'repositorio_fracasso', 'tabula_saber_custoso',
    'arreio_neural', 'centrifugador_existencial', 'espelho_refletor',
    'fuzil_alheio', 'primeira_adaga',
  ];
  const encontrados = new Set(idsItens());
  esperados.forEach(id => assert.ok(encontrados.has(id), `Item ausente: ${id}`));
  assert.equal(
    SUPPLEMENT_ITEMS.itensParanormais.filter(item => item.fonte?.livro === 'sah').length,
    19,
  );
});

test('inclui modificações de granada e a ameaça Anulado', () => {
  assert.deepEqual(
    modificacoesGranadas.map(modificacao => modificacao.key).sort(),
    ['granada_adesiva', 'granada_dupla', 'granada_programada'],
  );
  const anulado = bestiario.find(criatura => criatura.id === 'anulado');
  assert.equal(anulado.vd, 100);
  assert.equal(anulado.fonte.sigla, 'AS #1');
});

test('mantém módulos opcionais como referência, sem ativação implícita', () => {
  assert.ok(OPTIONAL_RULES.some(regra => regra.id === 'as4-hacking' && regra.status === 'opcional'));
  assert.ok(OPTIONAL_RULES.some(regra => regra.id === 'sah-perseguicoes' && regra.status === 'integrada'));
  assert.ok(OPTIONAL_RULES.every(regra => ['integrada', 'opcional', 'referencia'].includes(regra.status)));
});

test('não introduz chaves duplicadas nos catálogos complementares', () => {
  const validarUnicos = (valores, rotulo) => {
    assert.equal(new Set(valores).size, valores.length, `${rotulo} contém chaves duplicadas`);
  };
  validarUnicos(idsItens().filter(Boolean), 'Itens');
  validarUnicos(database.rituais.map(ritual => ritual.id), 'Rituais');
  validarUnicos(OPTIONAL_RULES.map(regra => regra.id), 'Regras opcionais');
});
