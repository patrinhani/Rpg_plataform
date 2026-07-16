const ENTIDADES_HTML = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
};

export function escaparHTML(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere]);
}

export function sanitizarParaHTML(valor) {
  const objetosVisitados = new WeakSet();

  const sanitizar = (conteudo, profundidade) => {
    if (typeof conteudo === 'string') return escaparHTML(conteudo);
    if (conteudo == null || typeof conteudo === 'boolean') return conteudo;
    if (typeof conteudo === 'number') return Number.isFinite(conteudo) ? conteudo : 0;
    if (typeof conteudo === 'bigint') return escaparHTML(String(conteudo));
    if (typeof conteudo !== 'object' || profundidade > 30) return '';

    if (objetosVisitados.has(conteudo)) return Array.isArray(conteudo) ? [] : {};
    objetosVisitados.add(conteudo);

    if (Array.isArray(conteudo)) {
      return conteudo.map((item) => sanitizar(item, profundidade + 1));
    }

    return Object.fromEntries(
      Object.entries(conteudo).map(([chave, item]) => [
        escaparHTML(chave),
        sanitizar(item, profundidade + 1),
      ]),
    );
  };

  return sanitizar(valor, 0);
}

export function sanitizarURLImagem(valor) {
  if (typeof valor !== 'string') return '';

  const url = valor.trim();
  if (!url) return '';

  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(url)) {
    return escaparHTML(url.replace(/\s/g, ''));
  }

  try {
    const urlNormalizada = new URL(url, 'https://caos.local/');
    if (!['http:', 'https:', 'blob:'].includes(urlNormalizada.protocol)) return '';
    return escaparHTML(url);
  } catch {
    return '';
  }
}
