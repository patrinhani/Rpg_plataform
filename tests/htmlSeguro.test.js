import assert from 'node:assert/strict';
import test from 'node:test';

import {
  escaparHTML,
  sanitizarParaHTML,
  sanitizarURLImagem,
} from '../src/lib/htmlSeguro.js';

test('escapa chaves e valores em todos os níveis antes da interpolação HTML', () => {
  const dados = {
    '<img src=x onerror=alert(1)>': {
      'campo" onclick="alert(2)': '<script>alert(3)</script>',
    },
    lista: ['<svg onload=alert(4)>'],
  };

  const seguros = sanitizarParaHTML(dados);
  const chaveRaiz = Object.keys(seguros)[0];
  const chaveInterna = Object.keys(seguros[chaveRaiz])[0];

  assert.equal(chaveRaiz, '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(chaveInterna, 'campo&quot; onclick=&quot;alert(2)');
  assert.equal(seguros[chaveRaiz][chaveInterna], '&lt;script&gt;alert(3)&lt;/script&gt;');
  assert.equal(seguros.lista[0], '&lt;svg onload=alert(4)&gt;');
});

test('normalização HTML lida defensivamente com ciclos e números inválidos', () => {
  const dados = { nome: 'Agente', valor: Number.NaN };
  dados.referencia = dados;

  assert.deepEqual(sanitizarParaHTML(dados), {
    nome: 'Agente',
    valor: 0,
    referencia: {},
  });
});

test('URL de imagem aceita formatos usados pela ficha e bloqueia protocolos ativos', () => {
  assert.equal(sanitizarURLImagem('javascript:alert(1)'), '');
  assert.equal(sanitizarURLImagem('data:image/svg+xml,<svg onload=alert(1)>'), '');
  assert.equal(sanitizarURLImagem('data:image/webp;base64,UklGRg=='), 'data:image/webp;base64,UklGRg==');
  assert.equal(sanitizarURLImagem('/assets/retrato.webp'), '/assets/retrato.webp');
  assert.equal(
    sanitizarURLImagem('https://exemplo.test/foto"onerror="alert(1)'),
    'https://exemplo.test/foto&quot;onerror=&quot;alert(1)',
  );
});

test('escape HTML também normaliza valores não textuais com segurança', () => {
  assert.equal(escaparHTML(null), '');
  assert.equal(escaparHTML('A&B <C>'), 'A&amp;B &lt;C&gt;');
});
