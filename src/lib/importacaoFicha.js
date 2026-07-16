const MEBIBYTE = 1024 * 1024;

export const LIMITE_ARQUIVO_FICHA_BYTES = 2 * MEBIBYTE;

export const LIMITES_ESTRUTURA_FICHA = Object.freeze({
  maxProfundidade: 32,
  maxNos: 100_000,
  maxItensArray: 20_000,
  maxChavesObjeto: 5_000,
  maxCaracteresString: LIMITE_ARQUIVO_FICHA_BYTES,
});

const CHAVES_PERIGOSAS = new Set(['__proto__', 'prototype', 'constructor']);

const CAMPOS_OBJETO = [
  'info',
  'atributos',
  'pericias',
  'recursos',
  'defesa',
  'resistencias',
  'perseguicao',
  'bonusManuais',
  'bonusPericiasManuais',
  'buffsTemporarios',
];

const CAMPOS_ARRAY = [
  'inventario',
  'rituais',
  'periciasCustom',
  'periciasOrigemAplicadas',
  'trilhas_personalizadas',
  'poderes_aprendidos',
  'diario',
  'condicoesAtivas',
  'condicoesAutomaticas',
  'condicoesEfetivas',
];

export class ErroImportacaoFicha extends Error {
  constructor(message, codigo) {
    super(message);
    this.name = 'ErroImportacaoFicha';
    this.codigo = codigo;
  }
}

function falhar(message, codigo) {
  throw new ErroImportacaoFicha(message, codigo);
}

export function isObjetoSimples(valor) {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return false;

  const prototipo = Object.getPrototypeOf(valor);
  return prototipo === Object.prototype || prototipo === null;
}

export function validarTamanhoArquivoFicha(tamanhoBytes) {
  if (!Number.isFinite(tamanhoBytes) || tamanhoBytes <= 0) {
    falhar('O arquivo selecionado está vazio ou não pôde ser medido.', 'arquivo-vazio');
  }

  if (tamanhoBytes > LIMITE_ARQUIVO_FICHA_BYTES) {
    falhar('O arquivo excede o limite de 2 MiB.', 'arquivo-grande');
  }

  return true;
}

function validarCamposEstruturais(ficha) {
  if (!isObjetoSimples(ficha.info) || !isObjetoSimples(ficha.atributos)) {
    falhar('O JSON não parece ser uma ficha: "info" e "atributos" precisam ser objetos.', 'estrutura-minima');
  }

  for (const campo of CAMPOS_OBJETO) {
    if (ficha[campo] !== undefined && !isObjetoSimples(ficha[campo])) {
      falhar(`O campo "${campo}" precisa ser um objeto.`, 'tipo-estrutural');
    }
  }

  for (const campo of CAMPOS_ARRAY) {
    if (ficha[campo] !== undefined && !Array.isArray(ficha[campo])) {
      falhar(`O campo "${campo}" precisa ser uma lista.`, 'tipo-estrutural');
    }
  }
}

function validarValorJson(valor) {
  if (
    valor === null
    || typeof valor === 'string'
    || typeof valor === 'boolean'
    || (typeof valor === 'number' && Number.isFinite(valor))
  ) {
    return;
  }

  if (typeof valor !== 'object') {
    falhar('A ficha contém um valor incompatível com JSON.', 'valor-invalido');
  }
}

export function validarEstruturaFicha(ficha, limites = LIMITES_ESTRUTURA_FICHA) {
  if (!isObjetoSimples(ficha)) {
    falhar('O conteúdo principal da ficha precisa ser um objeto JSON.', 'raiz-invalida');
  }

  const visitados = new WeakSet();
  const pilha = [{ valor: ficha, profundidade: 0 }];
  let totalNos = 0;

  while (pilha.length > 0) {
    const atual = pilha.pop();
    const { valor, profundidade } = atual;
    totalNos += 1;

    if (totalNos > limites.maxNos) {
      falhar('A ficha contém elementos demais para ser importada com segurança.', 'estrutura-grande');
    }

    if (profundidade > limites.maxProfundidade) {
      falhar('A ficha possui níveis de aninhamento demais.', 'profundidade-excessiva');
    }

    validarValorJson(valor);

    if (typeof valor === 'string' && valor.length > limites.maxCaracteresString) {
      falhar('A ficha contém um texto grande demais.', 'texto-grande');
    }

    if (valor === null || typeof valor !== 'object') continue;

    if (visitados.has(valor)) {
      falhar('A ficha contém uma referência circular inválida.', 'referencia-circular');
    }
    visitados.add(valor);

    if (Array.isArray(valor)) {
      if (Object.getPrototypeOf(valor) !== Array.prototype) {
        falhar('A ficha contém uma lista com formato inválido.', 'objeto-complexo');
      }
      if (valor.length > limites.maxItensArray) {
        falhar('A ficha contém uma lista grande demais.', 'lista-grande');
      }
      for (let indice = 0; indice < valor.length; indice += 1) {
        pilha.push({ valor: valor[indice], profundidade: profundidade + 1 });
      }
      continue;
    }

    if (!isObjetoSimples(valor)) {
      falhar('A ficha contém um objeto com formato inválido.', 'objeto-complexo');
    }

    const chaves = Object.keys(valor);
    if (chaves.length > limites.maxChavesObjeto) {
      falhar('A ficha contém um objeto com campos demais.', 'objeto-grande');
    }

    for (const chave of chaves) {
      if (CHAVES_PERIGOSAS.has(chave)) {
        falhar(`A ficha contém uma chave não permitida ("${chave}").`, 'chave-perigosa');
      }

      const descritor = Object.getOwnPropertyDescriptor(valor, chave);
      if (!descritor || !Object.prototype.hasOwnProperty.call(descritor, 'value')) {
        falhar('A ficha contém um campo com formato inválido.', 'campo-invalido');
      }

      pilha.push({ valor: descritor.value, profundidade: profundidade + 1 });
    }
  }

  validarCamposEstruturais(ficha);
  return ficha;
}

export function parsearFichaJson(texto) {
  if (typeof texto !== 'string' || texto.length === 0) {
    falhar('O arquivo selecionado está vazio.', 'arquivo-vazio');
  }

  if (texto.length > LIMITE_ARQUIVO_FICHA_BYTES) {
    falhar('O arquivo excede o limite de 2 MiB.', 'arquivo-grande');
  }

  const tamanhoUtf8 = new TextEncoder().encode(texto).byteLength;
  validarTamanhoArquivoFicha(tamanhoUtf8);

  let conteudo;
  try {
    conteudo = JSON.parse(texto);
  } catch {
    falhar('O arquivo não contém um JSON válido.', 'json-invalido');
  }

  return validarEstruturaFicha(conteudo);
}
