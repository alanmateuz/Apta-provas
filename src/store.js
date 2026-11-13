// =========================================================
// Armazenamento local (fica no aparelho, funciona sem internet)
// Usamos localStorage por simplicidade no MVP. Se o banco crescer
// muito (milhares de questões com imagens), migrar para IndexedDB.
// =========================================================
import { QUESTOES_EXEMPLO } from './banco-exemplo.js';

const CHAVES = {
  config: 'pf.config',
  banco: 'pf.banco',
  provas: 'pf.provas',
};

function ler(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
    return true;
  } catch (e) {
    console.error('Falha ao salvar', e);
    throw new Error('Não foi possível salvar: o espaço do aparelho para o app acabou. Apague provas antigas ou exporte seu banco.');
  }
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- Configurações (escola + IA) ---------- */
const CONFIG_PADRAO = {
  escola: { nome: '', cidade: '', professora: '', logo: '', instrucoes: 'Leia cada questão com atenção antes de responder.\nUse caneta azul ou preta.\nVocê tem 50 minutos para fazer a prova.' },
  ia: { provedor: 'openai', chaveOpenAI: '', chaveClaude: '', revisora: true },
};

export function getConfig() {
  const c = ler(CHAVES.config, {});
  return {
    escola: { ...CONFIG_PADRAO.escola, ...(c.escola || {}) },
    ia: { ...CONFIG_PADRAO.ia, ...(c.ia || {}) },
  };
}
export function salvarConfig(c) {
  gravar(CHAVES.config, c);
}

/* ---------- Banco de questões ----------
   origem:
   - 'minha'     → escrita pela professora (confiável)
   - 'revisada'  → veio da IA mas a professora conferiu e aprovou
   - 'importada' → veio de um pacote (arquivo) de colegas/escola
   - 'exemplo'   → exemplos que vêm com o app (revisar antes de usar)
   - 'internet'  → achada pela IA numa página da internet (tem link da fonte)
   - 'ia'        → criada pela IA e AINDA NÃO conferida
*/
export const CONFIANCA = { minha: 4, revisada: 4, importada: 3, material: 2, internet: 2, exemplo: 2, ia: 1 };

export function getBanco() {
  let banco = ler(CHAVES.banco, null);
  if (!banco) {
    banco = QUESTOES_EXEMPLO.map((q) => ({ ...q, id: uid(), origem: 'exemplo' }));
    gravar(CHAVES.banco, banco);
  }
  return banco;
}
export function salvarBanco(banco) {
  gravar(CHAVES.banco, banco);
}

export function normalizar(txt = '') {
  return String(txt)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Adiciona questões ao banco sem duplicar (compara o enunciado). */
export function adicionarAoBanco(questoes, origem) {
  const banco = getBanco();
  const existentes = new Set(banco.map((q) => normalizar(q.enunciado)));
  let novas = 0;
  for (const q of questoes) {
    const chave = normalizar(q.enunciado);
    if (!chave || existentes.has(chave)) {
      // Se já existe e agora foi revisada, promove a origem
      const ja = banco.find((b) => normalizar(b.enunciado) === chave);
      if (ja && origem && CONFIANCA[origem] > CONFIANCA[ja.origem]) ja.origem = origem;
      continue;
    }
    existentes.add(chave);
    const { alertas, revisada, ...limpa } = q;
    banco.push({ ...limpa, id: uid(), origem: origem || q.origem || 'ia' });
    novas++;
  }
  salvarBanco(banco);
  return novas;
}

/* ---------- Provas ---------- */
export function getProvas() {
  return ler(CHAVES.provas, []).sort((a, b) => (b.atualizadaEm || 0) - (a.atualizadaEm || 0));
}
export function getProva(id) {
  return getProvas().find((p) => p.id === id);
}
export function salvarProva(prova) {
  const provas = ler(CHAVES.provas, []);
  prova.atualizadaEm = Date.now();
  const i = provas.findIndex((p) => p.id === prova.id);
  if (i >= 0) provas[i] = prova;
  else provas.push(prova);
  gravar(CHAVES.provas, provas);
}
export function apagarProva(id) {
  gravar(CHAVES.provas, ler(CHAVES.provas, []).filter((p) => p.id !== id));
}
