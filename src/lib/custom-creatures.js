const ELEMENTOS_CRIATURA = ['Sangue', 'Morte', 'Conhecimento', 'Energia', 'Medo'];
const ATRIBUTOS_CRIATURA = ['agi', 'for', 'int', 'pre', 'vig'];
const MAX_ACOES = 20;
const MAX_HABILIDADES = 20;
const MAX_FOTO_LENGTH = 350_000;

function texto(valor, limite = 500) {
  return String(valor ?? '').trim().slice(0, limite);
}

function inteiro(valor, minimo = 0, maximo = 9999) {
  const numero = Number.parseInt(valor, 10);
  return Math.min(maximo, Math.max(minimo, Number.isFinite(numero) ? numero : minimo));
}

function normalizarFoto(valor) {
  const foto = texto(valor, MAX_FOTO_LENGTH);
  if (!foto) return '';
  if (/^https:\/\//i.test(foto) || /^\/assets\//i.test(foto)) return foto;
  if (/^data:image\/(?:png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(foto)) return foto;
  return '';
}

function normalizarHabilidades(habilidades) {
  return (Array.isArray(habilidades) ? habilidades : [])
    .map(habilidade => texto(habilidade, 1200))
    .filter(Boolean)
    .slice(0, MAX_HABILIDADES);
}

function normalizarAcoes(acoes) {
  return (Array.isArray(acoes) ? acoes : [])
    .map(acao => ({
      nome: texto(acao?.nome, 100) || 'Ação',
      descricao: texto(acao?.descricao, 1500),
    }))
    .filter(acao => acao.descricao)
    .slice(0, MAX_ACOES);
}

function criarIdCriaturaPersonalizada(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') return `criatura_${cryptoApi.randomUUID()}`;
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Web Crypto não está disponível para gerar o identificador da criatura.');
  }
  const bytes = new Uint8Array(16);
  cryptoApi.getRandomValues(bytes);
  return `criatura_${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

function criarRascunhoCriatura(criatura = {}) {
  const dados = criatura && typeof criatura === 'object' ? criatura : {};
  const pvMax = dados.pv_max === undefined || dados.pv_max === null || dados.pv_max === ''
    ? 20
    : inteiro(dados.pv_max, 1, 9999);
  return {
    id: texto(dados.id, 100),
    nome: texto(dados.nome, 80),
    elemento: texto(dados.elemento, 50) || 'Medo',
    vd: inteiro(dados.vd, 0, 999),
    tipo: texto(dados.tipo, 100) || 'Criatura - Média',
    presenca: texto(dados.presenca, 500),
    foto: normalizarFoto(dados.foto),
    sentidos: texto(dados.sentidos, 300),
    iniciativa: texto(dados.iniciativa, 100),
    defesa: inteiro(dados.defesa, 0, 999),
    fortitude: texto(dados.fortitude, 100),
    reflexos: texto(dados.reflexos, 100),
    vontade: texto(dados.vontade, 100),
    pv_max: pvMax,
    pv_atual: inteiro(dados.pv_atual ?? pvMax, 0, pvMax),
    machucado: inteiro(dados.machucado ?? Math.floor(pvMax / 2), 0, pvMax),
    resistencias: texto(dados.resistencias, 400),
    vulnerabilidades: texto(dados.vulnerabilidades, 300),
    atributos: Object.fromEntries(
      ATRIBUTOS_CRIATURA.map(chave => [chave, inteiro(dados.atributos?.[chave], 0, 10)]),
    ),
    deslocamento: texto(dados.deslocamento, 150) || '9m | 6q',
    habilidades: normalizarHabilidades(dados.habilidades),
    acoes: normalizarAcoes(dados.acoes),
  };
}

function validarCriaturaPersonalizada(criatura) {
  if (texto(criatura?.nome, 80).length < 2) return 'Informe um nome com pelo menos 2 caracteres.';
  if (inteiro(criatura?.pv_max, 0, 9999) < 1) return 'Os pontos de vida máximos devem ser maiores que zero.';
  if (!texto(criatura?.iniciativa, 100)) return 'Informe a referência de iniciativa da criatura.';
  const fotoInformada = texto(criatura?.foto, MAX_FOTO_LENGTH);
  if (fotoInformada && !normalizarFoto(fotoInformada)) {
    return 'Use uma imagem HTTPS, um caminho /assets/ ou envie um arquivo pelo formulário.';
  }
  const acoes = Array.isArray(criatura?.acoes) ? criatura.acoes : [];
  if (acoes.some(acao => !texto(acao?.nome, 100) || !texto(acao?.descricao, 1500))) {
    return 'Preencha o nome e a descrição de todas as ações adicionadas.';
  }
  return '';
}

function normalizarCriaturaPersonalizada(criatura, idInformado) {
  const erro = validarCriaturaPersonalizada(criatura);
  if (erro) throw new Error(erro);
  const id = texto(idInformado || criatura.id, 100) || criarIdCriaturaPersonalizada();
  if (!/^criatura_[a-zA-Z0-9_-]{8,90}$/.test(id)) {
    throw new Error('Identificador de criatura personalizado inválido.');
  }
  const normalizada = criarRascunhoCriatura({ ...criatura, id });
  return {
    ...normalizada,
    id,
    pv_atual: normalizada.pv_max,
    machucado: Math.min(normalizada.machucado, normalizada.pv_max),
    personalizada: true,
  };
}

export {
  ATRIBUTOS_CRIATURA,
  ELEMENTOS_CRIATURA,
  MAX_FOTO_LENGTH,
  criarIdCriaturaPersonalizada,
  criarRascunhoCriatura,
  normalizarCriaturaPersonalizada,
  validarCriaturaPersonalizada,
};
