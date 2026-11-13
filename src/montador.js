// =========================================================
// MONTADOR — escolhe questões do banco (sem internet) e prepara
// cada questão para a prova (versão adaptada, embaralhar, validar).
// Regra de ouro: BANCO PRIMEIRO. A IA só completa o que faltar.
// =========================================================
import { normalizar, uid, CONFIANCA } from './store.js';
import { validarQuestao } from './validador.js';

export const MATERIAS = ['Português', 'Matemática', 'Ciências', 'História', 'Geografia', 'Inglês', 'Arte', 'Educação Física', 'Ensino Religioso'];
export const SERIES = [
  '1º ano', '2º ano', '3º ano', '4º ano', '5º ano', '6º ano', '7º ano', '8º ano', '9º ano',
  '1ª série (Ensino Médio)', '2ª série (Ensino Médio)', '3ª série (Ensino Médio)',
];
export const DIFICULDADES = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
export const TIPOS = {
  multipla: 'Múltipla escolha',
  vf: 'Verdadeiro ou falso',
  completar: 'Completar lacunas',
  aberta: 'Resposta escrita (dissertativa)',
};
const ORDEM_DIF = ['facil', 'medio', 'dificil'];

const PALAVRAS_VAZIAS = new Set(('com para por sobre entre como que dos das nos nas uma umas uns sem mais menos muito ' +
  'questao questoes prova conteudo problemas problema exercicio exercicios simples basico basica ano serie').split(' '));

function palavrasDoTema(tema) {
  return normalizar(tema).split(' ').filter((w) => w.length > 3 && !PALAVRAS_VAZIAS.has(w));
}

function pontuar(q, pedido) {
  if (q.materia !== pedido.materia) return -1;
  if (!pedido.tipos.includes(q.tipo)) return -1;
  let p = 0;
  const dSerie = Math.abs(SERIES.indexOf(q.serie) - SERIES.indexOf(pedido.serie));
  if (dSerie === 0) p += 30; else if (dSerie === 1) p += 12; else return -1;

  const palavras = palavrasDoTema(pedido.tema);
  const alvo = ` ${normalizar(`${q.tema} ${q.enunciado}`)}`;
  // compara pelo "radical" no começo da palavra (fração/frações, somar/soma)
  const acertos = palavras.filter((w) => alvo.includes(' ' + w.slice(0, Math.max(4, w.length - 3)))).length;
  const temaOk = palavras.length === 0 ? 1 : acertos / palavras.length;
  if (palavras.length && temaOk === 0) return -1; // fora do conteúdo pedido
  p += temaOk * 40;

  const dDif = Math.abs(ORDEM_DIF.indexOf(q.dificuldade) - ORDEM_DIF.indexOf(pedido.dificuldade));
  p += dDif === 0 ? 15 : dDif === 1 ? 5 : 0;
  p += (CONFIANCA[q.origem] || 1) * 4; // prefere questões confiáveis
  return p;
}

/** Escolhe até N questões do banco para o pedido. */
export function escolherDoBanco(banco, pedido, quantidade, excluirIds = []) {
  return banco
    .filter((q) => !excluirIds.includes(q.id))
    .map((q) => ({ q, p: pontuar(q, pedido) }))
    .filter((x) => x.p >= 0)
    .sort((a, b) => b.p - a.p || Math.random() - 0.5)
    .slice(0, quantidade)
    .map((x) => x.q);
}

/** Cria uma versão adaptada simples, sem IA (quando a questão não tem uma). */
export function adaptarSemIA(q) {
  const ad = {
    enunciado: q.enunciado,
    alternativas: [...(q.alternativas || [])],
    correta: q.correta,
    dica: '',
  };
  if (q.tipo === 'multipla' && ad.alternativas.length > 3 && Number.isInteger(q.correta)) {
    // Mantém a correta + 2 distratores (menos opções = menos carga de memória)
    const erradas = ad.alternativas.filter((_, i) => i !== q.correta).slice(0, 2);
    const novas = [q.alternativas[q.correta], ...erradas];
    const ordem = embaralharIndices(novas.length);
    ad.alternativas = ordem.map((i) => novas[i]);
    ad.correta = ordem.indexOf(0);
  }
  if (q.tipo === 'vf') ad.dica = 'Leia uma frase de cada vez. Marque V se estiver certa e F se estiver errada.';
  if (q.tipo === 'aberta') ad.dica = 'Você pode responder com frases curtas.';
  return ad;
}

function embaralharIndices(n) {
  const a = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Embaralha as alternativas de múltipla escolha mantendo o gabarito certo. */
export function embaralharAlternativas(q) {
  if (q.tipo !== 'multipla') return q;
  const mexer = (alts, correta) => {
    if (!Array.isArray(alts) || !Number.isInteger(correta) || correta < 0) return { alts, correta };
    const ordem = embaralharIndices(alts.length);
    return { alts: ordem.map((i) => alts[i]), correta: ordem.indexOf(correta) };
  };
  const n = mexer(q.alternativas, q.correta);
  q.alternativas = n.alts; q.correta = n.correta;
  if (q.adaptada) {
    const a = mexer(q.adaptada.alternativas, q.adaptada.correta);
    q.adaptada.alternativas = a.alts; q.adaptada.correta = a.correta;
  }
  return q;
}

/** Copia a questão para dentro de uma prova: adaptada garantida + validação. */
export function prepararParaProva(q, pedido) {
  const copia = structuredClone({
    materia: pedido.materia, serie: pedido.serie, tema: pedido.tema, dificuldade: pedido.dificuldade,
    ...q,
  });
  copia.id = uid();
  copia.bancoId = q.id || null;
  if (!copia.adaptada || !copia.adaptada.enunciado) copia.adaptada = adaptarSemIA(copia);
  copia.revisada = copia.origem === 'minha' || copia.origem === 'revisada';
  copia.alertas = validarQuestao(copia);
  return copia;
}

/** Gabarito em texto para uma questão. */
export function textoGabarito(q, versao = 'normal') {
  const d = versao === 'adaptada' ? { ...q, ...q.adaptada } : q;
  if (q.tipo === 'multipla') {
    const letra = String.fromCharCode(97 + d.correta);
    return Number.isInteger(d.correta) && d.correta >= 0 ? `${letra}) ${d.alternativas[d.correta]}` : '—';
  }
  return q.resposta || '—';
}
