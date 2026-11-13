// =========================================================
// VALIDADOR DE QUESTÕES — a camada "antierro" da IA
//
// A IA erra de formas previsíveis. Este arquivo verifica, com regras
// fixas (sem IA, funciona offline), os erros mais comuns em questões:
//
//  ERRO (bloqueia a confiança na questão):
//   - gabarito ausente/fora das alternativas ou que não confere
//   - alternativas repetidas ou vazias
//   - V/F com número de respostas diferente das afirmações
//   - "complete" sem lacuna
//   - texto "de máquina" (ex.: "como modelo de linguagem", "[inserir")
//  AVISO (vale a professora olhar):
//   - "todas/nenhuma das anteriores"
//   - pergunta negativa (NÃO / EXCETO / INCORRETA)
//   - alternativa correta muito maior que as outras (entrega a resposta)
//   - resposta escrita no próprio enunciado
//   - palavras absolutas (sempre/nunca) só em algumas alternativas
//   - enunciado longo demais para a série
//   - versão adaptada que não ficou mais simples
//
// Referências de boas práticas de elaboração de itens: guias de itens
// do INEP (BNI/Saeb) e as regras de Haladyna & Downing para múltipla escolha.
// =========================================================
import { normalizar } from './store.js';

const RE_MAQUINA = /(como (um )?modelo de linguagem|como (uma )?ia\b|\[inserir|\[insira|lorem ipsum|xxx|<placeholder>|\{\{)/i;
const RE_TODAS = /(todas|nenhuma) (as|das) (anteriores|alternativas|acima)/i;
const RE_NEGATIVA = /\b(n[ãa]o|exceto|incorreta|falsa|errada)\b/i;
const RE_ABSOLUTO = /\b(sempre|nunca|jamais|todos|nenhum|somente|apenas)\b/i;
const RE_CITA_FIGURA = /\b(observe|veja|analise|olhe)\s+(a|o|as|os)\s+(figura|imagem|gr[áa]fico|desenho|ilustra[çc][ãa]o|mapa)s?\b|\b(figura|imagem|gr[áa]fico|desenho|ilustra[çc][ãa]o)s?\s+(abaixo|acima|ao lado|a seguir)\b/i;
const RE_LACUNA = /(_{2,}|\(\s*\)|\.{4,}|\[\s*\])/;

// Normalização "leve": mantém sinais (−, %, °) que mudam o sentido.
const leve = (t = '') => String(t).toLowerCase().replace(/\*\*/g, '').replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim();

export function contarPalavras(txt = '') {
  return String(txt).replace(/\*\*/g, '').trim().split(/\s+/).filter(Boolean).length;
}

function mediaPalavrasPorFrase(txt = '') {
  const frases = String(txt).replace(/\*\*/g, '').split(/[.!?]+/).map((f) => f.trim()).filter(Boolean);
  if (!frases.length) return 0;
  return frases.reduce((s, f) => s + contarPalavras(f), 0) / frases.length;
}

function anoDaSerie(serie = '') {
  const m = String(serie).match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return /s[ée]rie|EM|m[ée]dio/i.test(serie) ? 9 + n : n;
}

function respostasVF(resposta = '') {
  return (String(resposta).toUpperCase().match(/\b[VF]\b/g) || []);
}

/** Verifica as alternativas de múltipla escolha (versão normal ou adaptada). */
function checarMultipla(alts, correta, problemas, rotulo, esperadas) {
  if (!Array.isArray(alts) || alts.length < 2) {
    problemas.push({ nivel: 'erro', msg: `${rotulo}Tem menos de 2 alternativas.` });
    return;
  }
  if (esperadas && (alts.length < esperadas[0] || alts.length > esperadas[1])) {
    problemas.push({ nivel: 'aviso', msg: `${rotulo}Tem ${alts.length} alternativas (o esperado é ${esperadas.join(' a ')}).` });
  }
  if (!Number.isInteger(correta) || correta < 0 || correta >= alts.length) {
    problemas.push({ nivel: 'erro', msg: `${rotulo}Não há alternativa correta marcada (ou ela não existe).` });
  }
  const norm = alts.map((a) => leve(a));
  if (norm.some((a) => !a)) problemas.push({ nivel: 'erro', msg: `${rotulo}Há alternativa vazia.` });
  if (new Set(norm).size !== norm.length) problemas.push({ nivel: 'erro', msg: `${rotulo}Há alternativas repetidas.` });
  if (alts.some((a) => RE_TODAS.test(a))) {
    problemas.push({ nivel: 'aviso', msg: `${rotulo}Usa "todas/nenhuma das anteriores" — prática desaconselhada.` });
  }
  if (Number.isInteger(correta) && alts[correta]) {
    const tam = alts.map((a) => String(a).length);
    const outras = tam.filter((_, i) => i !== correta);
    const media = outras.reduce((s, t) => s + t, 0) / (outras.length || 1);
    if (tam[correta] > 25 && tam[correta] > media * 1.7) {
      problemas.push({ nivel: 'aviso', msg: `${rotulo}A alternativa correta é bem mais longa que as outras — isso entrega a resposta.` });
    }
    const absolutas = alts.filter((a) => RE_ABSOLUTO.test(a)).length;
    if (absolutas > 0 && absolutas < alts.length && !RE_ABSOLUTO.test(alts[correta]) && absolutas === alts.length - 1) {
      problemas.push({ nivel: 'aviso', msg: `${rotulo}Só as erradas têm "sempre/nunca/apenas" — o aluno acerta por eliminação.` });
    }
  }
}

/**
 * Valida UMA questão. Retorna lista de { nivel: 'erro'|'aviso', msg }.
 */
export function validarQuestao(q) {
  const problemas = [];
  const enunciado = String(q.enunciado || '');
  const ano = anoDaSerie(q.serie);

  if (contarPalavras(enunciado) < 3) problemas.push({ nivel: 'erro', msg: 'Enunciado vazio ou curto demais.' });
  const tudo = [enunciado, ...(q.alternativas || []), q.resposta, q.adaptada?.enunciado].join(' ');
  if (RE_MAQUINA.test(tudo)) problemas.push({ nivel: 'erro', msg: 'Tem texto de máquina ou espaço para preencher (ex.: "[inserir").' });

  if (RE_CITA_FIGURA.test(enunciado) && !q.imagem && !q.figura) {
    problemas.push({ nivel: 'erro', msg: 'A questão fala de uma figura, mas não tem imagem. Adicione pelo menu ⋯.' });
  }
  if (ano && ano <= 5 && contarPalavras(enunciado) > 60) {
    problemas.push({ nivel: 'aviso', msg: 'Enunciado longo para a série (mais de 60 palavras).' });
  }
  if (RE_NEGATIVA.test(enunciado) && q.tipo === 'multipla') {
    problemas.push({ nivel: 'aviso', msg: 'Pergunta negativa (NÃO/EXCETO/INCORRETA) confunde. Se mantiver, destaque a palavra.' });
  }

  switch (q.tipo) {
    case 'multipla': {
      checarMultipla(q.alternativas, q.correta, problemas, '', [3, 5]);
      const certa = q.alternativas?.[q.correta];
      if (certa && q.resposta) {
        const a = leve(certa), r = leve(q.resposta);
        if (r && a !== r && !a.includes(r) && !r.includes(a)) {
          problemas.push({ nivel: 'erro', msg: `O gabarito ("${q.resposta}") não confere com a alternativa marcada ("${certa}").` });
        }
      }
      if (certa && String(certa).length > 4 && !/^\s*[\d.,\s%/R$°−-]+\s*\w{0,3}$/.test(certa)) {
        if (normalizar(enunciado).includes(normalizar(certa))) {
          problemas.push({ nivel: 'aviso', msg: 'A resposta certa aparece escrita no próprio enunciado.' });
        }
      }
      break;
    }
    case 'vf': {
      const n = q.alternativas?.length || 0;
      if (n < 2) problemas.push({ nivel: 'erro', msg: 'V/F precisa de pelo menos 2 afirmações.' });
      const r = respostasVF(q.resposta);
      if (r.length !== n) problemas.push({ nivel: 'erro', msg: `O gabarito tem ${r.length} respostas V/F para ${n} afirmações.` });
      else if (n >= 3 && new Set(r).size === 1) problemas.push({ nivel: 'aviso', msg: 'Todas as afirmações têm a mesma resposta (todas V ou todas F).' });
      break;
    }
    case 'completar':
      if (!RE_LACUNA.test(enunciado)) problemas.push({ nivel: 'erro', msg: 'Questão de completar sem lacuna (use ____).' });
      if (!String(q.resposta || '').trim()) problemas.push({ nivel: 'aviso', msg: 'Sem resposta no gabarito.' });
      break;
    case 'aberta':
      if (!String(q.resposta || '').trim()) problemas.push({ nivel: 'aviso', msg: 'Sem resposta esperada no gabarito.' });
      break;
    default:
      problemas.push({ nivel: 'erro', msg: `Tipo de questão desconhecido: ${q.tipo}` });
  }

  // ---- versão adaptada ----
  const ad = q.adaptada;
  if (ad) {
    if (contarPalavras(ad.enunciado) < 3) problemas.push({ nivel: 'erro', msg: 'Adaptada: enunciado vazio.' });
    if (contarPalavras(ad.enunciado) > contarPalavras(enunciado) * 1.3 + 5) {
      problemas.push({ nivel: 'aviso', msg: 'Adaptada: ficou mais longa que a original — deveria ser mais simples.' });
    }
    if (mediaPalavrasPorFrase(ad.enunciado) > 16) {
      problemas.push({ nivel: 'aviso', msg: 'Adaptada: frases longas (mais de 16 palavras). Quebre em frases curtas.' });
    }
    if ((String(ad.enunciado).match(RE_NEGATIVA_GLOBAL) || []).length >= 2) {
      problemas.push({ nivel: 'aviso', msg: 'Adaptada: tem mais de uma negação. Prefira frases afirmativas.' });
    }
    if (q.tipo === 'multipla') checarMultipla(ad.alternativas, ad.correta, problemas, 'Adaptada: ', [2, 3]);
  }

  return problemas;
}
const RE_NEGATIVA_GLOBAL = /\b(n[ãa]o|exceto|incorreta|nunca|nenhum)\b/gi;

/** Similaridade simples entre dois textos (0 a 1), para achar questões repetidas. */
export function similaridade(a, b) {
  const A = new Set(normalizar(a).split(' ').filter((w) => w.length > 2));
  const B = new Set(normalizar(b).split(' ').filter((w) => w.length > 2));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

/** Problemas que só aparecem olhando a prova inteira. */
export function validarProva(questoes) {
  const avisos = [];
  for (let i = 0; i < questoes.length; i++) {
    for (let j = i + 1; j < questoes.length; j++) {
      if (similaridade(questoes[i].enunciado, questoes[j].enunciado) > 0.8) {
        avisos.push(`As questões ${i + 1} e ${j + 1} são muito parecidas.`);
      }
    }
  }
  const mult = questoes.filter((q) => q.tipo === 'multipla' && Number.isInteger(q.correta));
  if (mult.length >= 4) {
    const cont = {};
    mult.forEach((q) => (cont[q.correta] = (cont[q.correta] || 0) + 1));
    const max = Math.max(...Object.values(cont));
    if (max / mult.length > 0.5) avisos.push('Mais da metade das respostas está na mesma letra. Use "Embaralhar alternativas".');
  }
  return avisos;
}

/** Junta validação + resultado da IA revisora em um resumo por questão. */
export function resumoQuestao(q) {
  const lista = [...(q.alertas || [])];
  return {
    erros: lista.filter((p) => p.nivel === 'erro'),
    avisos: lista.filter((p) => p.nivel !== 'erro'),
  };
}
