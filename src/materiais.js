// =========================================================
// MATERIAIS (livros e apostilas em PDF)
// O texto do PDF é lido no próprio aparelho (pdf.js) e guardado no
// IndexedDB, página por página. A IA não recebe o livro inteiro: só os
// trechos que combinam com o conteúdo pedido (busca por palavras).
// =========================================================
import { normalizar } from './store.js';

const BANCO = 'prova-izi-materiais';
const LOJA = 'materiais';
const ARQUIVOS = 'arquivos'; // outros arquivos do usuário (ex.: modelo de cabeçalho em Word)
const arquivos = new Map();
let conexao;
let lista = []; // resumo em memória: { id, nome, materia, serie, paginas, criadoEm }
const cache = new Map(); // id → registro completo (com o texto)

function abrir() {
  if (!conexao) {
    conexao = new Promise((ok, falha) => {
      const p = indexedDB.open(BANCO, 2);
      p.onupgradeneeded = () => {
        for (const loja of [LOJA, ARQUIVOS]) if (!p.result.objectStoreNames.contains(loja)) p.result.createObjectStore(loja, { keyPath: 'id' });
      };
      p.onsuccess = () => ok(p.result);
      p.onerror = () => falha(p.error);
    });
  }
  return conexao;
}
const tx = (modo, fn, loja = LOJA) => abrir().then((db) => new Promise((ok, falha) => {
  const t = db.transaction(loja, modo);
  const r = fn(t.objectStore(loja));
  t.oncomplete = () => ok(r?.result);
  t.onerror = () => falha(t.error);
}));

const resumo = (m) => ({ id: m.id, nome: m.nome, materia: m.materia, serie: m.serie, paginas: m.textos.length, criadoEm: m.criadoEm });

/** Carrega a lista de materiais (chamar ao abrir o app). */
export async function carregarMateriais() {
  try {
    const todos = await tx('readonly', (s) => s.getAll());
    todos.forEach((m) => cache.set(m.id, m));
    lista = todos.map(resumo).sort((a, b) => b.criadoEm - a.criadoEm);
    (await tx('readonly', (s) => s.getAll(), ARQUIVOS)).forEach((a) => arquivos.set(a.id, a));
  } catch (e) { console.warn('Materiais indisponíveis', e); }
}

/* ---------- Arquivos avulsos (modelo de cabeçalho) ---------- */
export const obterArquivo = (id) => arquivos.get(id) || null;
export async function guardarArquivo(registro) {
  await tx('readwrite', (s) => s.put(registro), ARQUIVOS);
  arquivos.set(registro.id, registro);
}
export async function apagarArquivo(id) {
  await tx('readwrite', (s) => s.delete(id), ARQUIVOS);
  arquivos.delete(id);
}
export const listarMateriais = () => lista;
export const obterMaterial = (id) => cache.get(id) || null;

export async function salvarMaterial(m) {
  await tx('readwrite', (s) => s.put(m));
  cache.set(m.id, m);
  lista = [resumo(m), ...lista.filter((x) => x.id !== m.id)];
}
export async function apagarMaterial(id) {
  const m = cache.get(id);
  await tx('readwrite', (s) => s.delete(id));
  cache.delete(id);
  lista = lista.filter((x) => x.id !== id);
  return m; // para o Desfazer
}

/** Lê o texto de cada página do PDF. `progresso(feitas, total)` a cada página. */
export async function lerPDF(arquivo, progresso = () => {}) {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  let doc;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise; }
  catch (e) {
    if (e?.name === 'PasswordException') throw new Error('Esse PDF tem senha. Abra-o, salve uma cópia sem senha e tente de novo.');
    throw new Error('Não consegui abrir esse PDF. Confira se o arquivo não está corrompido.');
  }
  const textos = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pag = await doc.getPage(i);
    const c = await pag.getTextContent();
    // Junta os pedaços respeitando as quebras de linha do PDF
    let t = '';
    for (const it of c.items) { t += it.str; if (it.hasEOL) t += '\n'; else if (it.str && !/\s$/.test(it.str)) t += ' '; }
    textos.push(t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/ {2,}/g, ' ').trim());
    pag.cleanup();
    progresso(i, doc.numPages);
  }
  await doc.destroy();
  const letras = textos.join('').replace(/\s/g, '').length;
  if (letras < Math.max(200, textos.length * 40)) {
    throw new Error('Esse PDF parece ser escaneado (as páginas são fotos). O app só consegue ler PDFs com texto selecionável.');
  }
  return textos;
}

/* ---------- Busca de trechos ---------- */
const PARADAS = new Set('a o e é de da do das dos em no na nos nas um uma uns umas para por com sem que se ao aos à às como mais menos ou sobre entre seu sua seus suas ser ter isso esse essa este esta'.split(' '));
const palavras = (t) => normalizar(t).split(/[^a-z0-9]+/).filter((p) => p.length > 2 && !PARADAS.has(p));
const raiz = (p) => p.replace(/(coes|cao|oes|ais|eis|res|mente|s)$/, '');

/**
 * As páginas do material que mais combinam com o conteúdo pedido.
 * Devolve [{ pagina, texto }] em ordem de página, até `limite` caracteres.
 */
export function trechosRelevantes(material, tema, limite = 14000) {
  const termos = [...new Set(palavras(tema).map(raiz))];
  if (!termos.length) return [];
  const pontos = material.textos.map((texto, i) => {
    const ps = palavras(texto).map(raiz);
    if (!ps.length) return { i, n: 0 };
    let n = 0;
    for (const t of termos) { const c = ps.filter((p) => p === t || p.startsWith(t)).length; if (c) n += 1 + Math.log(c); }
    // Página com todos os termos vale bem mais do que muitas repetições de um só
    const todos = termos.every((t) => ps.some((p) => p.startsWith(t)));
    return { i, n: n * (todos ? 2 : 1) };
  }).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const escolhidas = [];
  let total = 0;
  for (const { i } of pontos) {
    const texto = material.textos[i];
    if (total + texto.length > limite && escolhidas.length) break;
    escolhidas.push({ pagina: i + 1, texto: texto.slice(0, limite) });
    total += texto.length;
  }
  return escolhidas.sort((a, b) => a.pagina - b.pagina);
}

/** Páginas que parecem ter exercícios (questões numeradas, alternativas, "Atividades"). */
const MARCAS = [/\b(exerc[ií]cios?|atividades?|quest[aã]o|questões|responda|assinale|marque|complete|resolva)\b/i, /(^|\n)\s*[a-e]\s*[).]\s+\S/m, /(^|\n)\s*\d{1,2}\s*[.)-]\s+\S/m];
export function paginasComQuestoes(material, de = 1, ate = material.textos.length) {
  const r = [];
  for (let i = Math.max(1, de); i <= Math.min(ate, material.textos.length); i++) {
    const t = material.textos[i - 1];
    if (MARCAS.filter((m) => m.test(t)).length >= 2) r.push(i);
  }
  return r;
}

/** Divide páginas em lotes que cabem num pedido à IA. */
export function lotesDePaginas(material, paginas, limite = 12000) {
  const lotes = [];
  let atual = [];
  let total = 0;
  for (const p of paginas) {
    const texto = material.textos[p - 1].slice(0, limite);
    if (total + texto.length > limite && atual.length) { lotes.push(atual); atual = []; total = 0; }
    atual.push({ pagina: p, texto });
    total += texto.length;
  }
  if (atual.length) lotes.push(atual);
  return lotes;
}

/** A questão está mesmo no texto daquela página? (contra questões inventadas) */
export function estaNoTexto(material, pagina, enunciado) {
  const alvo = normalizar(enunciado).replace(/[^a-z0-9]/g, '');
  if (alvo.length < 12) return false;
  const pedaco = alvo.slice(0, 40);
  const paginas = [pagina - 1, pagina, pagina - 2].filter((i) => i >= 0 && i < material.textos.length);
  return paginas.some((i) => normalizar(material.textos[i]).replace(/[^a-z0-9]/g, '').includes(pedaco));
}
