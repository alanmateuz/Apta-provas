// =========================================================
// IMAGENS DAS QUESTÕES
// Ficam no IndexedDB do aparelho (cabe muito mais que o localStorage
// e funciona sem internet). As questões guardam só a referência
// { id, tipo, descricao, credito }; o arquivo fica aqui.
//
// tipo da imagem:
//  - 'professora' → foto/arquivo enviado por ela
//  - 'diagrama'   → desenho exato feito pela IA em SVG (frações, formas, gráficos)
//  - 'ilustracao' → ilustração gerada por IA
//  - 'internet'   → imagem original da fonte
//  - 'recriada'   → figura da fonte recriada pela IA (comparar com a original)
// =========================================================
const BANCO = 'prova-izi';
const LOJA = 'imagens';
const cache = new Map();
let conexao;

function abrir() {
  if (!conexao) {
    conexao = new Promise((ok, falha) => {
      const pedido = indexedDB.open(BANCO, 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA, { keyPath: 'id' });
      pedido.onsuccess = () => ok(pedido.result);
      pedido.onerror = () => falha(pedido.error);
    });
  }
  return conexao;
}

function gravar(registro) {
  return abrir().then((db) => new Promise((ok, falha) => {
    const tx = db.transaction(LOJA, 'readwrite');
    tx.objectStore(LOJA).put(registro);
    tx.oncomplete = ok;
    tx.onerror = () => falha(tx.error);
  })).catch((e) => console.warn('Não salvou a imagem no aparelho', e));
}

/** Carrega todas as imagens para a memória (chamar ao abrir o app). */
export async function carregarImagens() {
  try {
    const db = await abrir();
    const todas = await new Promise((ok, falha) => {
      const r = db.transaction(LOJA).objectStore(LOJA).getAll();
      r.onsuccess = () => ok(r.result);
      r.onerror = () => falha(r.error);
    });
    todas.forEach((img) => cache.set(img.id, img));
  } catch (e) {
    console.warn('Armazenamento de imagens indisponível', e);
  }
}

export function obterImagem(id) {
  return (id && cache.get(id)) || null;
}

/** Guarda uma imagem já preparada ({ src, largura, altura }) e devolve o registro com id. */
export async function guardarImagem({ src, largura, altura }) {
  const id = 'img_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const registro = { id, src, largura, altura };
  cache.set(id, registro);
  await gravar(registro);
  return registro;
}

/**
 * Converte arquivo, Blob ou dataURL numa imagem leve (JPEG ou PNG),
 * com no máximo `max` pixels no lado maior e fundo branco.
 */
export function rasterizar(fonte, { max = 900, formato = 'image/jpeg', qualidade = 0.82 } = {}) {
  return new Promise((ok, falha) => {
    const img = new Image();
    const ehBlob = fonte instanceof Blob;
    const url = ehBlob ? URL.createObjectURL(fonte) : fonte;
    img.onload = () => {
      const w0 = img.naturalWidth || 800;
      const h0 = img.naturalHeight || 600;
      const k = Math.min(1, max / Math.max(w0, h0));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w0 * k));
      c.height = Math.max(1, Math.round(h0 * k));
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      if (ehBlob) URL.revokeObjectURL(url);
      ok({ src: c.toDataURL(formato, qualidade), largura: c.width, altura: c.height });
    };
    img.onerror = () => {
      if (ehBlob) URL.revokeObjectURL(url);
      falha(new Error('Não consegui abrir esta imagem.'));
    };
    img.src = url;
  });
}

/** Limpa um SVG escrito pela IA (sem scripts nem links externos) e devolve como Blob. */
export function svgSeguro(texto) {
  const doc = new DOMParser().parseFromString(String(texto || ''), 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) {
    throw new Error('A figura veio com defeito.');
  }
  svg.querySelectorAll('script, foreignObject, image, iframe, a').forEach((n) => n.remove());
  svg.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => {
    if (/^on/i.test(a.name) || /href$/i.test(a.name)) n.removeAttribute(a.name);
  }));
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb.every(Number.isFinite)) {
    // desenha em alta resolução para ficar nítido na impressão
    svg.setAttribute('width', String(vb[2] * 2));
    svg.setAttribute('height', String(vb[3] * 2));
  }
  return new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
}

/** Junta as imagens usadas por uma lista de questões (para exportar o banco). */
export function imagensDasQuestoes(questoes) {
  const mapa = {};
  questoes.forEach((q) => {
    const reg = obterImagem(q.imagem?.id);
    if (reg) mapa[reg.id] = reg;
  });
  return mapa;
}

/** Recebe imagens de um pacote importado. */
export async function importarImagens(mapa = {}) {
  for (const [id, reg] of Object.entries(mapa)) {
    if (cache.has(id) || !/^data:image\/(png|jpe?g|gif|webp);base64,/.test(reg?.src || '')) continue;
    const registro = { id, src: reg.src, largura: Number(reg.largura) || 600, altura: Number(reg.altura) || 400 };
    cache.set(id, registro);
    await gravar(registro);
  }
}
