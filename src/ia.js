// =========================================================
// IA — gera e REVISA questões.
//
// Provedores:
//   - OpenAI (ChatGPT) → padrão. A chave vem do arquivo .env.local
//     (VITE_OPENAI_API_KEY), colocada pelo desenvolvedor. A professora
//     não precisa configurar nada.
//   - Claude (Anthropic) → opcional, em "Inteligência artificial > Avançado".
//
// ATENÇÃO (MVP): num app que roda no navegador, a chave vai junto no
// código. Use só em aparelhos de confiança e NÃO publique o link
// aberto na internet. Próximo passo: um servidor intermediário (proxy)
// que guarda a chave — veja o README.
//
// Como combatemos erros da IA (além do validador.js):
//   1. O prompt traz regras de boa elaboração de itens.
//   2. Saída em JSON com ESQUEMA obrigatório (sem texto solto).
//   3. A IA precisa escrever a justificativa/resolução de cada questão.
//   4. Uma 2ª chamada ("revisora") resolve as questões SEM ver o
//      gabarito; se discordar, a questão é marcada para conferência.
//   5. Embaralhamos as alternativas no código (a IA tende a pôr a
//      certa sempre na mesma letra).
// =========================================================
import Anthropic from '@anthropic-ai/sdk';
import { DIFICULDADES, TIPOS } from './montador.js';

const CHAVE_OPENAI_APP = import.meta.env.VITE_OPENAI_API_KEY || '';
const MODELO_OPENAI_APP = import.meta.env.VITE_OPENAI_MODEL || '';
// Na versão publicada (Vercel) a chave fica no servidor: o app chama /api/openai.
const USAR_PROXY = import.meta.env.VITE_IA_PROXY === '1';
const MODELO_IMAGEM = import.meta.env.VITE_OPENAI_IMAGE_MODEL || 'gpt-image-2';

/** Para onde mandar: direto na OpenAI (com chave) ou pelo servidor do app (sem chave no navegador). */
function destinoOpenAI(caminho, chave) {
  if (!chave && USAR_PROXY) return { url: `/api/openai?p=${caminho}`, headers: { 'Content-Type': 'application/json' } };
  return { url: `https://api.openai.com/${caminho}`, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chave}` } };
}

export function iaDisponivel(config) {
  if (config.ia.provedor === 'claude') return Boolean(config.ia.chaveClaude);
  return Boolean(config.ia.chaveOpenAI || CHAVE_OPENAI_APP || USAR_PROXY);
}

export class ErroIA extends Error {}

/* ---------------- Esquemas JSON ---------------- */
const ESQ_ADAPTADA = {
  type: 'object',
  additionalProperties: false,
  required: ['enunciado', 'alternativas', 'correta', 'dica'],
  properties: {
    enunciado: { type: 'string' },
    alternativas: { type: 'array', items: { type: 'string' } },
    correta: { type: 'integer' },
    dica: { type: 'string' },
  },
};
const ESQ_FIGURA = {
  type: 'object',
  additionalProperties: false,
  required: ['tipo', 'descricao', 'svg'],
  properties: {
    tipo: { type: 'string', enum: ['nenhuma', 'diagrama', 'ilustracao'] },
    descricao: { type: 'string' },
    svg: { type: 'string' },
  },
};
const ESQ_QUESTAO = {
  type: 'object',
  additionalProperties: false,
  required: ['tipo', 'enunciado', 'alternativas', 'correta', 'resposta', 'justificativa', 'adaptada', 'figura'],
  properties: {
    tipo: { type: 'string', enum: ['multipla', 'vf', 'completar', 'aberta'] },
    enunciado: { type: 'string' },
    alternativas: { type: 'array', items: { type: 'string' } },
    correta: { type: 'integer' },
    resposta: { type: 'string' },
    justificativa: { type: 'string' },
    adaptada: ESQ_ADAPTADA,
    figura: ESQ_FIGURA,
  },
};
const ESQ_GERAR = {
  type: 'object',
  additionalProperties: false,
  required: ['questoes'],
  properties: { questoes: { type: 'array', items: ESQ_QUESTAO } },
};
const ESQ_REVISAR = {
  type: 'object',
  additionalProperties: false,
  required: ['revisoes'],
  properties: {
    revisoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['numero', 'minha_resposta', 'resolucao', 'ambigua', 'erro_de_conteudo', 'problemas'],
        properties: {
          numero: { type: 'integer' },
          minha_resposta: { type: 'string' },
          resolucao: { type: 'string' },
          ambigua: { type: 'boolean' },
          erro_de_conteudo: { type: 'boolean' },
          problemas: { type: 'string' },
        },
      },
    },
  },
};

/* ---------------- Prompts ---------------- */
const SISTEMA_GERAR = `Você é um(a) professor(a) experiente da educação básica brasileira e especialista em elaboração de itens de avaliação (no padrão dos guias do INEP/Saeb). Você escreve questões corretas, claras e alinhadas à BNCC, em português do Brasil.

REGRAS DE QUALIDADE (obrigatórias):
1. Cada questão avalia UM conhecimento do conteúdo pedido. Não fuja do tema.
2. Linguagem adequada à idade da série. Contexto do dia a dia brasileiro.
3. O enunciado é completo: o aluno entende o que fazer sem ler as alternativas.
4. Múltipla escolha: exatamente 4 alternativas, UMA correta e sem ambiguidade. Distratores plausíveis, baseados em erros comuns dos alunos. Alternativas com tamanho e estrutura parecidos. Proibido "todas/nenhuma das anteriores". Evite perguntas negativas; se usar, escreva NÃO em maiúsculas.
5. Sem pegadinhas e sem informação falsa. Só use fatos, datas e nomes de que você tem certeza. Se não tiver certeza, troque por outro fato.
6. Em cálculos, resolva passo a passo na "justificativa" e confira o resultado antes de responder.
7. V/F: 3 ou 4 afirmações em "alternativas"; "resposta" no formato "V, F, V" (mesma quantidade); misture V e F.
8. Completar: use ____ para cada lacuna; "resposta" traz as palavras que preenchem.
9. Dissertativa: "alternativas" vazia; "resposta" traz o que se espera na resposta do aluno.
10. "correta" é o índice (começando em 0) da alternativa certa; use -1 quando não for múltipla escolha. Em múltipla, "resposta" repete o texto da alternativa correta.

VERSÃO ADAPTADA (para alunos com TDAH, autismo, dislexia ou deficiência intelectual):
- Avalia o MESMO conhecimento, sem infantilizar.
- Frases curtas (até 12 palavras), uma instrução por vez, ordem direta, vocabulário concreto.
- Destaque as palavras-chave com **negrito**.
- Múltipla escolha com 3 alternativas (a correta e 2 distratores claros).
- Sem dupla negação, sem metáforas ou ironia.
- "dica": uma frase curta de apoio que ajude a pensar, SEM dar a resposta.
- V/F: as mesmas afirmações, reescritas de forma mais curta e direta.

FIGURAS ("figura"):
- Use "tipo": "nenhuma" (descricao e svg vazios) quando a questão não precisa de imagem.
- Quando o pedido permitir figuras, coloque figura SÓ onde ela ajuda de verdade (no máximo 1 a cada 3 questões): frações, formas geométricas, gráficos, tabelas, retas numéricas, relógios, mapas simples, animais, plantas, objetos.
- "diagrama": figuras exatas e matemáticas. Escreva em "svg" um SVG completo e válido com viewBox="0 0 400 300", fundo branco, traço preto (stroke-width 2 a 3), cores lisas e suaves, texto em Arial com font-size de pelo menos 16. Sem <script>, sem imagens externas, sem links. Conte e confira cada elemento (ex.: 8 fatias, 3 pintadas).
- "ilustracao": desenhos do mundo real (animais, cenas, objetos). Deixe "svg" vazio e escreva em "descricao" exatamente o que deve aparecer, com quantidades e cores.
- Em qualquer figura, "descricao" diz em uma ou duas frases o que a figura mostra (será usada para conferir a figura e como texto alternativo).
- A figura NUNCA pode entregar a resposta.
- Se usar figura, o enunciado deve citá-la (ex.: "Observe a figura.").`;

function pedidoGerar(p, quantidade, evitar = []) {
  const tipos = p.tipos.map((t) => TIPOS[t]).join(', ');
  return `Crie ${quantidade} questão(ões) para uma prova.

Matéria: ${p.materia}
Ano/série: ${p.serie}
Conteúdo: ${p.tema}
Dificuldade: ${DIFICULDADES[p.dificuldade]}
Tipos permitidos (distribua entre eles): ${tipos}
Figuras: ${p.figuras ? 'pode usar figuras quando ajudarem' : 'NÃO use figuras ("tipo": "nenhuma" em todas)'}
${p.observacoes ? `Pedido da professora: ${p.observacoes}\n` : ''}${p.contexto?.trechos?.length ? `\nMATERIAL DE BASE ("${p.contexto.nome}"): use estes trechos como fonte principal. As questões devem cobrar o que está no material, com o mesmo vocabulário e exemplos parecidos. Na "justificativa", cite a página (ex.: "Material, p. 12"). Não copie questões prontas do material; crie novas a partir do conteúdo.\n${p.contexto.trechos.map((t) => `--- página ${t.pagina} ---\n${t.texto}`).join('\n')}\n--- fim do material ---\n` : ''}${evitar.length ? `\nNÃO repita estas questões que já estão na prova:\n${evitar.map((e) => `- ${e}`).join('\n')}\n` : ''}
Responda apenas com o JSON pedido.`;
}

const SISTEMA_REVISAR = `Você é um revisor rigoroso de provas escolares. Você recebe questões SEM o gabarito. Resolva cada uma de forma independente, mostrando o raciocínio curto em "resolucao". Em "minha_resposta" escreva: para múltipla escolha, apenas a LETRA (a, b, c ou d); para V/F, no formato "V, F, V"; para as outras, a resposta curta. Marque "ambigua" se houver mais de uma resposta possível ou o enunciado não for claro. Marque "erro_de_conteudo" se houver informação falsa ou cálculo errado. Em "problemas", descreva em uma frase o que está errado (ou deixe vazio).`;

function pedidoRevisar(questoes) {
  const linhas = questoes.map((q, i) => {
    let t = `${i + 1}) [${TIPOS[q.tipo]}] ${q.enunciado}`;
    const fig = q.figura?.tipo && q.figura.tipo !== 'nenhuma' ? q.figura.descricao : q.imagem?.descricao;
    if (fig) t += `\n   [Figura: ${fig}]`;
    if (q.tipo === 'multipla') t += '\n' + q.alternativas.map((a, j) => `   ${String.fromCharCode(97 + j)}) ${a}`).join('\n');
    if (q.tipo === 'vf') t += '\n' + q.alternativas.map((a, j) => `   ${j + 1}. ${a}`).join('\n');
    return t;
  });
  return `Matéria: ${questoes[0]?.materia || ''} — ${questoes[0]?.serie || ''}\n\n${linhas.join('\n\n')}`;
}

/* ---------------- Chamadas aos provedores ---------------- */

/** Escolhe automaticamente um bom modelo GPT disponível na conta. */
async function modeloOpenAI(chave, signal) {
  if (!chave && USAR_PROXY) return 'definido-no-servidor'; // o servidor escolhe o modelo
  if (MODELO_OPENAI_APP) return MODELO_OPENAI_APP;
  try {
    const salvo = localStorage.getItem('pf.modeloOpenAI');
    if (salvo) return salvo;
  } catch {}
  const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${chave}` }, signal });
  if (!r.ok) throw await erroOpenAI(r);
  const ids = (await r.json()).data.map((m) => m.id)
    .filter((id) => /^gpt-\d/.test(id) && !/(audio|realtime|search|transcribe|tts|image|codex|instruct|nano|chat-latest|pro\b|-pro|astra)/.test(id));
  const versao = (id) => parseFloat(id.match(/^gpt-(\d+(\.\d+)?)/)?.[1] || '0');
  ids.sort((a, b) => versao(b) - versao(a) || /mini/.test(a) - /mini/.test(b) || a.length - b.length);
  const escolhido = ids[0];
  if (!escolhido) throw new ErroIA('Não encontrei um modelo GPT disponível nesta conta da OpenAI.');
  try { localStorage.setItem('pf.modeloOpenAI', escolhido); } catch {}
  return escolhido;
}

async function erroOpenAI(r) {
  if (r.status === 401) return new ErroIA('A chave da IA não é válida. Peça para quem instalou o app conferir.');
  if (r.status === 429) return new ErroIA('A IA está ocupada ou o crédito da conta acabou. Tente de novo em alguns minutos.');
  let detalhe = '';
  try { detalhe = (await r.json()).error?.message || ''; } catch {}
  return new ErroIA(`A IA respondeu com erro (${r.status}). ${detalhe}`);
}

async function chamarOpenAI({ chave, sistema, usuario, esquema, nome, signal }) {
  const model = await modeloOpenAI(chave, signal);
  const destino = destinoOpenAI('v1/chat/completions', chave);
  const r = await fetch(destino.url, {
    method: 'POST',
    signal,
    headers: destino.headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      response_format: { type: 'json_schema', json_schema: { name: nome, strict: true, schema: esquema } },
    }),
  });
  if (!r.ok) {
    if (r.status === 404 || r.status === 400) { try { localStorage.removeItem('pf.modeloOpenAI'); } catch {} }
    throw await erroOpenAI(r);
  }
  const dados = await r.json();
  const msg = dados.choices?.[0]?.message;
  if (msg?.refusal) throw new ErroIA('A IA recusou este pedido. Tente reescrever o conteúdo.');
  if (dados.choices?.[0]?.finish_reason === 'length') throw new ErroIA('A resposta da IA ficou grande demais. Peça menos questões por vez.');
  return JSON.parse(msg.content);
}

async function chamarClaude({ chave, sistema, usuario, esquema, signal }) {
  const client = new Anthropic({ apiKey: chave, dangerouslyAllowBrowser: true });
  let resp;
  try {
    resp = await client.beta.messages.create(
      {
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: sistema,
        messages: [{ role: 'user', content: usuario }],
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquema } },
      },
      { signal },
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ErroIA('A chave do Claude não é válida.');
    if (e instanceof Anthropic.RateLimitError) throw new ErroIA('A IA está ocupada. Tente de novo em alguns minutos.');
    if (e instanceof Anthropic.APIConnectionError) throw new ErroIA('Sem conexão com a IA. Verifique a internet.');
    throw e;
  }
  if (resp.stop_reason === 'refusal') throw new ErroIA('A IA recusou este pedido. Tente reescrever o conteúdo.');
  if (resp.stop_reason === 'max_tokens') throw new ErroIA('A resposta da IA ficou grande demais. Peça menos questões por vez.');
  const texto = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(texto);
}

function chamar(config, args) {
  if (!navigator.onLine) throw new ErroIA('Sem internet agora. Use "Só do meu banco" ou tente quando tiver conexão.');
  if (config.ia.provedor === 'claude') return chamarClaude({ chave: config.ia.chaveClaude, ...args });
  return chamarOpenAI({ chave: config.ia.chaveOpenAI || CHAVE_OPENAI_APP, ...args });
}

/* ---------------- Funções usadas pelo app ---------------- */

/** Limpa e padroniza o que veio da IA (nunca confie no formato). */
function sanear(q) {
  const tipo = ['multipla', 'vf', 'completar', 'aberta'].includes(q.tipo) ? q.tipo : 'aberta';
  const alts = Array.isArray(q.alternativas) ? q.alternativas.map((a) => String(a).replace(/^\s*[a-eA-E][).]\s+/, '').trim()) : [];
  const ad = q.adaptada || {};
  const altsAd = Array.isArray(ad.alternativas) ? ad.alternativas.map((a) => String(a).replace(/^\s*[a-eA-E][).]\s+/, '').trim()) : [];
  return {
    tipo,
    enunciado: String(q.enunciado || '').trim(),
    alternativas: tipo === 'aberta' || tipo === 'completar' ? [] : alts,
    correta: tipo === 'multipla' ? Number(q.correta) : -1,
    resposta: String(q.resposta || '').trim(),
    justificativa: String(q.justificativa || '').trim(),
    adaptada: {
      enunciado: String(ad.enunciado || '').trim(),
      alternativas: tipo === 'aberta' || tipo === 'completar' ? [] : altsAd,
      correta: tipo === 'multipla' ? Number(ad.correta) : -1,
      dica: String(ad.dica || '').trim(),
    },
    figura: q.figura && ['diagrama', 'ilustracao'].includes(q.figura.tipo)
      ? { tipo: q.figura.tipo, descricao: String(q.figura.descricao || '').trim(), svg: String(q.figura.svg || '') }
      : null,
    origem: 'ia',
  };
}

export async function gerarQuestoes(config, pedido, quantidade, evitar, signal) {
  const dados = await chamar(config, {
    sistema: SISTEMA_GERAR,
    usuario: pedidoGerar(pedido, quantidade, evitar),
    esquema: ESQ_GERAR,
    nome: 'questoes',
    signal,
  });
  return (dados.questoes || []).map(sanear).map((q) => ({
    ...q, materia: pedido.materia, serie: pedido.serie, tema: pedido.tema, dificuldade: pedido.dificuldade,
  }));
}

/**
 * IA revisora: resolve as questões sem ver o gabarito e compara.
 * Devolve, para cada questão, uma lista de alertas novos.
 */
export async function revisarQuestoes(config, questoes, signal) {
  if (!questoes.length) return [];
  const dados = await chamar(config, {
    sistema: SISTEMA_REVISAR,
    usuario: pedidoRevisar(questoes),
    esquema: ESQ_REVISAR,
    nome: 'revisao',
    signal,
  });
  return questoes.map((q, i) => {
    const rev = (dados.revisoes || []).find((r) => r.numero === i + 1);
    const alertas = [];
    if (!rev) return alertas;
    if (q.tipo === 'multipla') {
      const letra = String(rev.minha_resposta || '').trim().toLowerCase().match(/^[a-e]/)?.[0];
      const esperada = String.fromCharCode(97 + q.correta);
      if (letra && letra !== esperada) {
        alertas.push({ nivel: 'erro', msg: `A IA revisora marcou "${letra}", mas o gabarito diz "${esperada}". Confira! (${rev.resolucao})` });
      }
    }
    if (q.tipo === 'vf') {
      const a = (String(rev.minha_resposta).toUpperCase().match(/\b[VF]\b/g) || []).join('');
      const b = (String(q.resposta).toUpperCase().match(/\b[VF]\b/g) || []).join('');
      if (a && b && a !== b) alertas.push({ nivel: 'erro', msg: `A IA revisora respondeu "${a.split('').join(', ')}", diferente do gabarito. Confira!` });
    }
    if (rev.erro_de_conteudo) alertas.push({ nivel: 'erro', msg: `Possível erro de conteúdo: ${rev.problemas || 'confira os fatos e cálculos.'}` });
    else if (rev.ambigua) alertas.push({ nivel: 'aviso', msg: `Pode ter mais de uma resposta: ${rev.problemas || 'confira o enunciado.'}` });
    return alertas;
  });
}

export async function testarConexao(config) {
  const dados = await chamar(config, {
    sistema: 'Responda em JSON.',
    usuario: 'Diga ok.',
    esquema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
    nome: 'teste',
  });
  return dados.ok === true;
}

/* =========================================================
   BUSCA NA INTERNET — a IA pesquisa questões que JÁ EXISTEM
   (provas públicas, olimpíadas, materiais abertos) e traz o link.

   Anti-invenção:
   - cada questão precisa vir com a URL da página onde foi achada;
   - conferimos se essa URL apareceu de verdade na pesquisa
     (citações/fontes devolvidas pela ferramenta de busca);
   - se não apareceu, a questão é marcada como "fonte não confirmada";
   - depois ainda passa pelo validador e pela IA revisora.
   ========================================================= */
const ESQ_BUSCA = {
  type: 'object',
  additionalProperties: false,
  required: ['questoes'],
  properties: {
    questoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'enunciado', 'alternativas', 'correta', 'resposta', 'justificativa', 'fonte_url', 'fonte_nome', 'figura'],
        properties: {
          tipo: { type: 'string', enum: ['multipla', 'vf', 'completar', 'aberta'] },
          enunciado: { type: 'string' },
          alternativas: { type: 'array', items: { type: 'string' } },
          correta: { type: 'integer' },
          resposta: { type: 'string' },
          justificativa: { type: 'string' },
          fonte_url: { type: 'string' },
          fonte_nome: { type: 'string' },
          figura: {
            type: 'object',
            additionalProperties: false,
            required: ['tipo', 'url_imagem', 'descricao'],
            properties: {
              tipo: { type: 'string', enum: ['nenhuma', 'original', 'recriar'] },
              url_imagem: { type: 'string' },
              descricao: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

const SISTEMA_BUSCA = `Você é um(a) assistente de professores da educação básica brasileira. Sua tarefa é PESQUISAR NA INTERNET questões de prova que JÁ EXISTEM e transcrevê-las com fidelidade.

Onde procurar (prefira nesta ordem): itens públicos do Saeb/Prova Brasil e do INEP, OBMEP e outras olimpíadas, provas e simulados publicados por secretarias de educação, livros didáticos abertos e portais educacionais confiáveis.

REGRAS:
1. Só traga questões que você LEU em uma página da pesquisa. Nunca invente nem complete uma questão.
2. "fonte_url" é o endereço exato da página onde a questão está. "fonte_nome" é o nome do site ou da prova (ex.: "OBMEP 2019 — Nível 1").
3. Transcreva o enunciado e as alternativas como estão na fonte (pode corrigir só erros de digitação óbvios).
4. Questões com figura (imagem, gráfico, mapa, desenho) podem vir. Em "figura":
   - "original": se você achou o endereço DIRETO da imagem (termina em .png, .jpg, .jpeg, .gif ou .webp), coloque em "url_imagem";
   - "recriar": se não achou o arquivo da imagem, descreva em "descricao" TUDO o que a figura mostra (formas, quantidades, números, rótulos), para ela ser redesenhada;
   - "nenhuma": se a questão não tem figura (url_imagem e descricao vazios).
   Tabelas simples podem ser escritas no próprio enunciado.
5. Se a fonte não mostra o gabarito, resolva a questão e explique em "justificativa"; se não tiver certeza da resposta, não traga a questão.
6. "correta" é o índice (começando em 0) da alternativa certa; -1 se não for múltipla escolha. Em V/F, "resposta" no formato "V, F, V".
7. Prefira questões adequadas à série pedida. Se achar menos questões do que o pedido, devolva só as que achou.`;

function pedidoBusca(p) {
  return `Pesquise e traga até ${p.quantidade} questões de prova já existentes.
Matéria: ${p.materia}
Ano/série: ${p.serie}
Conteúdo: ${p.tema}
Responda apenas com o JSON pedido.`;
}

/** Normaliza URL para comparar (sem protocolo, www, barra final e parâmetros de rastreio). */
export function chaveUrl(u = '') {
  try {
    const x = new URL(String(u).trim());
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach((k) => x.searchParams.delete(k));
    return (x.host.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '') + x.search).toLowerCase();
  } catch { return ''; }
}

function extrairJSON(texto) {
  const t = String(texto || '').replace(/```(?:json)?/g, '');
  const i = t.indexOf('{');
  const j = t.lastIndexOf('}');
  if (i < 0 || j < i) throw new ErroIA('A IA não devolveu as questões no formato esperado. Tente de novo.');
  return JSON.parse(t.slice(i, j + 1));
}

async function buscarOpenAI({ chave, pedido, signal }) {
  const model = await modeloOpenAI(chave, signal);
  const corpo = (comFormato) => ({
    model,
    tools: [{ type: 'web_search' }],
    include: ['web_search_call.action.sources'],
    input: [
      { role: 'system', content: SISTEMA_BUSCA },
      { role: 'user', content: pedidoBusca(pedido) },
    ],
    ...(comFormato ? { text: { format: { type: 'json_schema', name: 'busca', strict: true, schema: ESQ_BUSCA } } } : {}),
  });
  const destino = destinoOpenAI('v1/responses', chave);
  const enviar = (comFormato) => fetch(destino.url, {
    method: 'POST',
    signal,
    headers: destino.headers,
    body: JSON.stringify(corpo(comFormato)),
  });
  let r = await enviar(true);
  if (r.status === 400) r = await enviar(false); // alguns modelos não aceitam busca + esquema juntos
  if (!r.ok) throw await erroOpenAI(r);
  const dados = await r.json();
  const urls = new Set();
  let texto = '';
  for (const item of dados.output || []) {
    if (item.type === 'web_search_call') (item.action?.sources || []).forEach((s) => s.url && urls.add(chaveUrl(s.url)));
    if (item.type === 'message') {
      for (const c of item.content || []) {
        if (c.type === 'refusal') throw new ErroIA('A IA recusou este pedido.');
        if (c.type === 'output_text') {
          texto += c.text;
          (c.annotations || []).forEach((a) => a.url && urls.add(chaveUrl(a.url)));
        }
      }
    }
  }
  return { dados: extrairJSON(texto), urls };
}

async function buscarClaude({ chave, pedido, signal }) {
  const client = new Anthropic({ apiKey: chave, dangerouslyAllowBrowser: true });
  const messages = [{ role: 'user', content: `${pedidoBusca(pedido)}\n\nFormato do JSON: ${JSON.stringify(ESQ_BUSCA)}` }];
  const urls = new Set();
  let resp;
  for (let volta = 0; volta < 4; volta++) {
    try {
      resp = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SISTEMA_BUSCA,
        messages,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }],
        output_config: { effort: 'medium' },
      }, { signal });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new ErroIA('A chave do Claude não é válida.');
      if (e instanceof Anthropic.APIConnectionError) throw new ErroIA('Sem conexão com a IA. Verifique a internet.');
      throw e;
    }
    for (const b of resp.content) {
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) b.content.forEach((s) => s.url && urls.add(chaveUrl(s.url)));
      if (b.type === 'text') (b.citations || []).forEach((c) => c.url && urls.add(chaveUrl(c.url)));
    }
    if (resp.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: resp.content }); // a busca ainda não terminou: continua
  }
  if (resp.stop_reason === 'refusal') throw new ErroIA('A IA recusou este pedido.');
  const texto = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { dados: extrairJSON(texto), urls };
}

/**
 * Pesquisa questões na internet. Devolve questões já saneadas, cada uma
 * com `fonte` e `fonteConfirmada` (a URL apareceu de verdade na pesquisa?).
 */
export async function buscarNaInternet(config, pedido, signal) {
  if (!navigator.onLine) throw new ErroIA('Sem internet agora. A busca precisa de conexão.');
  const args = { pedido, signal };
  const { dados, urls } = config.ia.provedor === 'claude'
    ? await buscarClaude({ chave: config.ia.chaveClaude, ...args })
    : await buscarOpenAI({ chave: config.ia.chaveOpenAI || CHAVE_OPENAI_APP, ...args });
  return (dados.questoes || []).map((q) => {
    const { adaptada, ...base } = sanear({ ...q, adaptada: {} });
    const url = String(q.fonte_url || '').trim();
    let host = 'site';
    try { host = new URL(url).host.replace(/^www\./, ''); } catch {}
    return {
      ...base,
      materia: pedido.materia, serie: pedido.serie, tema: pedido.tema, dificuldade: pedido.dificuldade || 'medio',
      origem: 'internet',
      fonte: { url, nome: String(q.fonte_nome || '').trim() || host },
      fonteConfirmada: Boolean(url) && urls.has(chaveUrl(url)),
      figura: q.figura && ['original', 'recriar'].includes(q.figura.tipo)
        ? { tipo: q.figura.tipo, url_imagem: String(q.figura.url_imagem || '').trim(), descricao: String(q.figura.descricao || '').trim(), svg: '' }
        : null,
    };
  });
}


/* =========================================================
   FIGURAS — gerar, conferir e baixar
   ========================================================= */
function promptIlustracao(descricao) {
  return `Ilustração educativa para prova escolar brasileira. Estilo plano e limpo, contornos pretos, cores suaves, fundo branco liso, sem sombras. Sem texto, sem letras e sem números, a não ser que a descrição peça. Siga EXATAMENTE as quantidades e cores pedidas. Descrição: ${descricao}`;
}

/** Gera uma ilustração com IA (OpenAI). Devolve um dataURL JPEG. */
export async function gerarIlustracao(config, descricao, signal) {
  if (config.ia.provedor === 'claude') throw new ErroIA('A criação de ilustrações usa o serviço da OpenAI.');
  if (!navigator.onLine) throw new ErroIA('Sem internet agora.');
  const chave = config.ia.chaveOpenAI || CHAVE_OPENAI_APP;
  const destino = destinoOpenAI('v1/images/generations', chave);
  const r = await fetch(destino.url, {
    method: 'POST',
    signal,
    headers: destino.headers,
    body: JSON.stringify({ model: MODELO_IMAGEM, prompt: promptIlustracao(descricao), size: '1024x1024', quality: 'low', output_format: 'jpeg', n: 1 }),
  });
  if (!r.ok) throw await erroOpenAI(r);
  const dados = await r.json();
  const b64 = dados.data?.[0]?.b64_json;
  if (!b64) throw new ErroIA('A IA não devolveu a imagem.');
  return `data:image/jpeg;base64,${b64}`;
}

/**
 * Confere com visão se a figura mostra o que deveria (contagens, cores, formas).
 * Geradores de imagem erram contagens com frequência; por isso conferimos sempre.
 */
export async function conferirFigura(config, dataURL, descricao, signal) {
  if (config.ia.provedor === 'claude' || !descricao) return { confere: true, problema: '', conferida: false };
  const dados = await chamarOpenAI({
    chave: config.ia.chaveOpenAI || CHAVE_OPENAI_APP,
    sistema: 'Você confere figuras de provas escolares. Seja rigoroso: conte os elementos um por um.',
    usuario: [
      { type: 'text', text: `A figura deveria mostrar: "${descricao}". Ela corresponde exatamente (quantidades, cores, formas, números)? Ela entrega a resposta da questão de forma indevida? Responda no JSON.` },
      { type: 'image_url', image_url: { url: dataURL } },
    ],
    esquema: {
      type: 'object', additionalProperties: false, required: ['confere', 'problema'],
      properties: { confere: { type: 'boolean' }, problema: { type: 'string' } },
    },
    nome: 'conferencia_figura',
    signal,
  });
  return { confere: dados.confere === true, problema: String(dados.problema || ''), conferida: true };
}

/** Baixa a imagem original de uma questão da internet (pelo servidor do app, por causa do bloqueio entre sites). */
export async function baixarImagemInternet(url, signal) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Endereço de imagem inválido.');
  if (USAR_PROXY) {
    const r = await fetch(`/api/imagem?url=${encodeURIComponent(url)}`, { signal });
    if (!r.ok) throw new Error('Não foi possível baixar a imagem original.');
    return (await r.json()).src;
  }
  const r = await fetch(url, { signal, mode: 'cors' }); // no computador de desenvolvimento pode ser bloqueado
  if (!r.ok || !/^image\//.test(r.headers.get('content-type') || '')) throw new Error('Não foi possível baixar a imagem original.');
  return await r.blob();
}

/* =========================================================
   MATERIAL EM PDF — achar as questões que JÁ EXISTEM no livro
   Anti-invenção: cada questão traz a página; o app confere se o
   começo do enunciado está mesmo no texto daquela página.
   ========================================================= */
const ESQ_MATERIAL = {
  type: 'object',
  additionalProperties: false,
  required: ['questoes'],
  properties: {
    questoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'enunciado', 'alternativas', 'correta', 'resposta', 'justificativa', 'pagina', 'tema', 'gabarito_no_material', 'precisa_figura'],
        properties: {
          tipo: { type: 'string', enum: ['multipla', 'vf', 'completar', 'aberta'] },
          enunciado: { type: 'string' },
          alternativas: { type: 'array', items: { type: 'string' } },
          correta: { type: 'integer' },
          resposta: { type: 'string' },
          justificativa: { type: 'string' },
          pagina: { type: 'integer' },
          tema: { type: 'string' },
          gabarito_no_material: { type: 'boolean' },
          precisa_figura: { type: 'boolean' },
        },
      },
    },
  },
};

const SISTEMA_MATERIAL = `Você ajuda professores da educação básica brasileira a reaproveitar exercícios de livros didáticos e apostilas. Você recebe o TEXTO de algumas páginas de um material (extraído de um PDF, pode ter quebras de linha estranhas).

TAREFA: encontrar as questões/exercícios que JÁ ESTÃO nessas páginas e transcrevê-las com fidelidade.
REGRAS:
1. Só transcreva questões que estão no texto. Nunca invente nem complete uma questão. Explicações e textos corridos não são questões.
2. Copie o enunciado e as alternativas como estão (pode juntar linhas quebradas e corrigir hifenização). Tire a numeração do início ("1.", "a)").
3. "pagina" é o número da página (está no marcador "--- página N ---") onde a questão começa.
4. Se o material traz o gabarito, use-o e marque "gabarito_no_material": true. Se não traz, resolva a questão, explique em "justificativa" e marque false.
5. "correta" é o índice (começando em 0) da alternativa certa; -1 se não for múltipla escolha. Em V/F, "resposta" no formato "V, F, V". Dissertativa: "alternativas" vazia e "resposta" com o esperado.
6. Questões que dependem de uma figura, mapa, gráfico ou imagem que não está no texto: marque "precisa_figura": true.
7. Itens com várias letras (a, b, c) que são perguntas diferentes, e não alternativas, viram questões separadas, cada uma com o contexto necessário no enunciado.
8. "tema" é o conteúdo da questão em poucas palavras (ex.: "frações equivalentes").
9. Se não houver questões nessas páginas, devolva a lista vazia.`;

export async function questoesDoMaterial(config, { nome, materia, serie }, trechos, signal) {
  const dados = await chamar(config, {
    sistema: SISTEMA_MATERIAL,
    usuario: `Material: ${nome}
Matéria: ${materia} — ${serie}

${trechos.map((t) => `--- página ${t.pagina} ---
${t.texto}`).join('\n')}
--- fim ---
Responda apenas com o JSON pedido.`,
    esquema: ESQ_MATERIAL,
    nome: 'material',
    signal,
  });
  return (dados.questoes || []).map((q) => {
    const { adaptada, figura, ...base } = sanear({ ...q, adaptada: {}, figura: null });
    return {
      ...base,
      materia, serie, tema: String(q.tema || '').trim() || materia, dificuldade: 'medio',
      origem: 'material',
      fonte: { nome: `${nome}, p. ${q.pagina}`, pagina: Number(q.pagina) || 0, material: nome },
      gabaritoNoMaterial: Boolean(q.gabarito_no_material),
      precisaFigura: Boolean(q.precisa_figura),
    };
  });
}
