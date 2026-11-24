// Teste de calibração de dificuldade do Apta.
// Gera provas fácil/médio/difícil com o mesmo código do app (src/ia.js, via Vite)
// e pede a um modelo mais forte que avalie cada questão ÀS CEGAS (sem saber o nível pedido).
// Uso (na pasta prova-facil): node test/calibracao/teste-dificuldade.mjs <rotulo>
// Variáveis opcionais: SO_MATERIA, NIVEIS=facil,medio, PT_SERIE, PT_TEMA, VITE_OPENAI_MODEL (para comparar modelos).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = process.cwd();
const rotulo = process.argv[2] || 'teste';
const saida = path.join(raiz, 'test/calibracao', `dificuldade-${rotulo}.json`);

// localStorage/navigator mínimos para o ia.js rodar no Node
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; } };
if (!globalThis.navigator) globalThis.navigator = { onLine: true }; else Object.defineProperty(globalThis.navigator, 'onLine', { value: true, configurable: true });

const { createServer } = await import(pathToFileURL(path.join(raiz, 'node_modules/vite/dist/node/index.js')).href);
const vite = await createServer({ root: raiz, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
const ia = await vite.ssrLoadModule('/src/ia.js');
const env = fs.readFileSync(path.join(raiz, '.env.local'), 'utf8');
const CHAVE = env.match(/^VITE_OPENAI_API_KEY=(.+)$/m)[1].trim();
const cfg = { ia: { provedor: 'openai', chaveOpenAI: '', chaveClaude: '', revisora: true } };

const PEDIDOS = [
  { materia: 'Matemática', serie: '5º ano', tema: 'Frações: comparar, somar e subtrair frações com o mesmo denominador' },
  { materia: 'Português', serie: process.env.PT_SERIE || '8º ano', tema: process.env.PT_TEMA || 'Figuras de linguagem: metáfora, comparação, personificação e hipérbole' },
  { materia: 'Física', serie: '1º ano (Ensino Médio)', tema: 'Velocidade média e movimento uniforme' },
];
const NIVEIS = (process.env.NIVEIS || 'facil,medio,dificil').split(',');
if (process.env.SO_MATERIA) PEDIDOS.splice(0, PEDIDOS.length, ...PEDIDOS.filter((p) => p.materia === process.env.SO_MATERIA));
const N = 6;

const gerado = [];
const uso = [];
const t0 = Date.now();
await Promise.all(PEDIDOS.flatMap((p) => NIVEIS.map(async (nivel) => {
  const pedido = { ...p, dificuldade: nivel, tipos: ['multipla', 'aberta'], adaptada: false, figuras: false, observacoes: '' };
  const qs = await ia.gerarQuestoes(cfg, pedido, N, []);
  qs.forEach((q) => gerado.push({ materia: p.materia, serie: p.serie, nivel, tipo: q.tipo, enunciado: q.enunciado, alternativas: q.alternativas, correta: q.correta, resposta: q.resposta, justificativa: q.justificativa }));
})));
uso.push(...JSON.parse(localStorage.getItem('pf.usoIA') || '[]'));
console.log(`Geradas ${gerado.length} questões em ${((Date.now() - t0) / 1000).toFixed(0)} s`);

// ---------- Avaliação às cegas, por matéria ----------
const ESQ = {
  type: 'object', additionalProperties: false, required: ['avaliacoes'],
  properties: { avaliacoes: { type: 'array', items: { type: 'object', additionalProperties: false,
    required: ['id', 'nivel', 'etapas', 'habilidade', 'gabarito_correto', 'problema'],
    properties: {
      id: { type: 'integer' },
      nivel: { type: 'integer', description: '1 = muito fácil, 2 = fácil, 3 = médio, 4 = difícil, 5 = muito difícil, para um aluno típico desta série' },
      etapas: { type: 'integer', description: 'quantos passos de raciocínio a questão exige' },
      habilidade: { type: 'string', enum: ['lembrar', 'compreender', 'aplicar', 'analisar', 'avaliar', 'criar'] },
      gabarito_correto: { type: 'boolean' },
      problema: { type: 'string' },
    } } } },
};
const SIST = `Você é avaliador(a) de itens do Saeb/INEP. Para cada questão, estime a dificuldade REAL para um aluno típico da série indicada numa escola pública brasileira (1 a 5), conte as etapas de raciocínio, classifique a habilidade (Bloom revisada), confira se o gabarito está correto e descreva qualquer problema em uma frase (ou vazio). Seja rigoroso e consistente entre as questões.`;
async function avaliar(lista) {
  const texto = lista.map((q) => `#${q.id} [${q.tipo}] ${q.enunciado}${q.alternativas?.length ? '\n' + q.alternativas.map((a, j) => `  ${String.fromCharCode(97 + j)}) ${a}`).join('\n') : ''}\n  Gabarito: ${q.resposta}`).join('\n\n');
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-6.1-sol', messages: [{ role: 'system', content: SIST }, { role: 'user', content: `Série: ${lista[0].serie} · Matéria: ${lista[0].materia}\n\n${texto}` }],
      response_format: { type: 'json_schema', json_schema: { name: 'avaliacao', strict: true, schema: ESQ } } }) });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j.error));
  uso.push({ papel: 'juiz', model: j.model, entrada: j.usage.prompt_tokens, saida: j.usage.completion_tokens });
  return JSON.parse(j.choices[0].message.content).avaliacoes;
}
const embaralhar = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const porMateria = PEDIDOS.map((p) => embaralhar(gerado.filter((q) => q.materia === p.materia)).map((q, i) => ({ ...q, id: i + 1 })));
const avaliacoes = await Promise.all(porMateria.map(avaliar));
const tudo = porMateria.flatMap((lista, m) => lista.map((q) => ({ ...q, aval: avaliacoes[m].find((a) => a.id === q.id) })));

// ---------- Resumo ----------
const media = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const alvo = { facil: [1, 2], medio: [3], dificil: [4, 5] };
const linhas = [];
for (const p of PEDIDOS) {
  const l = { materia: `${p.materia} ${p.serie}` };
  for (const n of NIVEIS) {
    const qs = tudo.filter((q) => q.materia === p.materia && q.nivel === n && q.aval);
    l[n] = { nivelMedio: +media(qs.map((q) => q.aval.nivel)).toFixed(2), etapas: +media(qs.map((q) => q.aval.etapas)).toFixed(1),
      noAlvo: qs.filter((q) => alvo[n].includes(q.aval.nivel)).length + '/' + qs.length, gabaritoErrado: qs.filter((q) => !q.aval.gabarito_correto).length };
  }
  linhas.push(l);
}
const geral = Object.fromEntries(NIVEIS.map((n) => {
  const qs = tudo.filter((q) => q.nivel === n && q.aval);
  return [n, { nivelMedio: +media(qs.map((q) => q.aval.nivel)).toFixed(2), noAlvo: `${qs.filter((q) => alvo[n].includes(q.aval.nivel)).length}/${qs.length}`, gabaritoErrado: qs.filter((q) => !q.aval.gabarito_correto).length }];
}));
fs.writeFileSync(saida, JSON.stringify({ rotulo, linhas, geral, uso, questoes: tudo }, null, 2));
console.log(JSON.stringify({ geral, linhas, uso: uso.map((u) => [u.papel, u.model, u.entrada, u.saida]) }, null, 1));
console.log('Arquivo:', saida);
await vite.close();
