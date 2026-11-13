// =========================================================
// Importar o cabeçalho de uma prova em Word (.docx)
// Lê o cabeçalho da página e o começo do documento (até a 1ª questão),
// e tenta achar: nome da escola, linha de baixo (cidade/endereço),
// professor(a), logotipo, os campos do cabeçalho e as instruções.
// Tudo no aparelho, sem internet.
// =========================================================
import { unzipSync, strFromU8 } from 'fflate';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Campos conhecidos: rótulo do app ← jeitos comuns de escrever na escola. */
const CONHECIDOS = [
  ['aluno', /^(nome( do\(a\)| do| da)? alun[oa](\(a\))?|alun[oa](\(a\))?|estudante|nome( completo)?)$/i],
  ['numero', /^(n[º°o.]*|número|nº de chamada)$/i],
  ['nota', /^(nota|valor|pontuação|resultado)$/i],
  ['Disciplina', /^(disciplina|componente( curricular)?|matéria)$/i],
  ['Professor(a)', /^(prof(\.|essor(\(a\))?|essora)?)$/i],
  ['Turma', /^(turma|série|ano|ano\/turma|série\/turma|turma\/série|ano\/série)$/i],
  ['Data', /^data$/i],
];
const ESCOLA = /\b(escola|colégio|colegio|instituto|centro educacional|creche|liceu|e\.?\s?e\.?\s?f|e\.?\s?m\.?\s?e|eemti|emeief|emef)\b/i;
const INICIO_QUESTAO = /^\s*(\d{1,2}\s*[-.)–]|quest[aã]o\s*\d|\d{1,2}ª)/i;
const INSTRUCOES = /^\s*(instru[çc][õo]es|orienta[çc][õo]es)\b\s*:?/i;

const limpar = (t) => String(t || '').replace(/[_.…]{2,}/g, ' ').replace(/\s+/g, ' ').trim();
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();

/** Texto de um parágrafo, com tabulações virando espaço. */
function textoP(p) {
  let s = '';
  const andar = (n) => {
    for (const f of n.childNodes) {
      if (f.nodeType !== 1) continue;
      if (f.namespaceURI === W && f.localName === 't') s += f.textContent;
      else if (f.namespaceURI === W && (f.localName === 'tab' || f.localName === 'br')) s += '  ';
      else andar(f);
    }
  };
  andar(p);
  return s;
}

/** Quebra uma linha em pares rótulo/valor. "Aluno(a): ____ Nº: __" → 2 pares. */
function pares(linha) {
  const re = /([A-Za-zÀ-ú][A-Za-zÀ-ú()º°ª./ ]{0,28}?)\s*:/g;
  const achados = [...linha.matchAll(re)];
  if (!achados.length) return [];
  return achados.map((m, i) => {
    const fim = i + 1 < achados.length ? achados[i + 1].index : linha.length;
    return { rotulo: limpar(m[1]), valor: limpar(linha.slice(m.index + m[0].length, fim)) };
  });
}

function classificar(rotulo) {
  const r = rotulo.replace(/\s+/g, ' ').trim();
  for (const [chave, re] of CONHECIDOS) if (re.test(r)) return chave;
  return null;
}

/**
 * Lê o arquivo e devolve o que encontrou.
 * @returns {{ nome, cidade, professora, logo: Blob|null, campos: string[], instrucoes, achou: number }}
 */
export async function lerCabecalhoWord(arquivo) {
  let zip;
  try { zip = unzipSync(new Uint8Array(await arquivo.arrayBuffer())); } catch { throw new Error('Não consegui abrir esse arquivo. Envie um arquivo do Word (.docx).'); }
  if (!zip['word/document.xml']) throw new Error('Esse arquivo não parece ser do Word (.docx).');
  const parser = new DOMParser();
  const xml = (caminho) => parser.parseFromString(strFromU8(zip[caminho]), 'application/xml');
  const relacoes = (parte) => {
    const nome = parte.split('/').pop();
    const rel = zip[`word/_rels/${nome}.rels`];
    const mapa = {};
    if (rel) for (const r of parser.parseFromString(strFromU8(rel), 'application/xml').getElementsByTagName('Relationship')) mapa[r.getAttribute('Id')] = r.getAttribute('Target');
    return mapa;
  };

  // 1) Regiões a ler: cabeçalho da página (se houver) + começo do corpo
  const regioes = []; // { elementos: Element[], rels }
  const doc = xml('word/document.xml');
  const relsDoc = relacoes('word/document.xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const refs = [...doc.getElementsByTagNameNS(W, 'headerReference')];
  const ref = refs.find((r) => r.getAttributeNS(W, 'type') === 'first') || refs.find((r) => r.getAttributeNS(W, 'type') === 'default') || refs[0];
  if (ref) {
    const alvo = relsDoc[ref.getAttributeNS(R, 'id')];
    const caminho = alvo && `word/${alvo.replace(/^\/?word\//, '')}`;
    if (caminho && zip[caminho]) regioes.push({ elementos: [xml(caminho).documentElement], rels: relacoes(caminho), dir: caminho });
  }
  const inicio = [];
  const instrucoes = [];
  let lendoInstr = false;
  let tabelas = 0;
  for (const n of body.childNodes) {
    if (n.nodeType !== 1 || n.namespaceURI !== W) continue;
    if (n.localName === 'p') {
      const t = textoP(n).trim();
      if (INICIO_QUESTAO.test(t)) break;
      if (INSTRUCOES.test(t)) { lendoInstr = true; const resto = t.replace(INSTRUCOES, '').trim(); if (resto) instrucoes.push(resto); continue; }
      if (lendoInstr) { if (t) instrucoes.push(t); if (instrucoes.length > 8) break; continue; }
      inicio.push(n);
    } else if (n.localName === 'tbl') {
      if (lendoInstr) break;
      inicio.push(n); tabelas++;
      if (tabelas >= 2) break;
    }
    if (inicio.length > 14) break;
  }
  regioes.push({ elementos: inicio, rels: relsDoc, dir: 'word/document.xml' });

  // 2) Linhas de texto e imagens
  const linhas = [];
  let logo = null;
  for (const { elementos, rels } of regioes) {
    for (const el of elementos) {
      const ps = el.localName === 'p' ? [el] : [...el.getElementsByTagNameNS(W, 'p')];
      for (const p of ps) { const t = textoP(p).replace(/\s{2,}/g, '  ').trim(); if (t) linhas.push(t); }
      if (!logo) {
        for (const b of el.getElementsByTagNameNS('*', 'blip')) {
          const alvo = rels[b.getAttributeNS(R, 'embed')];
          if (!alvo) continue;
          const caminho = `word/${alvo.replace(/^\/?word\//, '')}`;
          const tipo = /\.png$/i.test(caminho) ? 'image/png' : /\.jpe?g$/i.test(caminho) ? 'image/jpeg' : /\.gif$/i.test(caminho) ? 'image/gif' : null;
          if (tipo && zip[caminho]) { logo = new Blob([zip[caminho]], { type: tipo }); break; }
        }
      }
    }
  }

  // 3) Interpretar
  const campos = [];
  const soltas = []; // linhas sem rótulo (nome da escola, endereço…)
  let professora = '';
  let achou = 0;
  for (const linha of linhas) {
    const ps = pares(linha);
    if (!ps.length) {
      // Linha sem ":" pode ser só rótulos com traços: "Aluno(a) ______ Nº ___"
      const so = linha.split(/\s{2,}|_{2,}/).map(limpar).filter(Boolean);
      if (so.length && so.every((s) => classificar(s))) { so.forEach((s) => { const c = classificar(s); if (!['aluno', 'numero', 'nota'].includes(c) && !campos.includes(c)) campos.push(c); achou++; }); continue; }
      soltas.push(limpar(linha));
      continue;
    }
    for (const { rotulo, valor } of ps) {
      const c = classificar(rotulo);
      achou++;
      if (c === 'Professor(a)' && valor && !professora) professora = valor;
      if (c && ['aluno', 'numero', 'nota'].includes(c)) continue;
      if (c === 'Disciplina' || c === 'Turma' || c === 'Data' || c === 'Professor(a)') { if (!campos.includes(c)) campos.push(c); continue; }
      if (/escola|institui/i.test(rotulo)) { if (valor) soltas.unshift(valor); continue; }
      // Rótulo que o app não conhece (Bimestre, Turno, Valor da prova…): vira um campo em branco
      const nome = cap(rotulo);
      if (nome.length >= 3 && nome.length <= 22 && !campos.includes(nome)) campos.push(nome);
    }
  }
  const ehEscola = soltas.findIndex((s) => ESCOLA.test(s));
  const iNome = ehEscola >= 0 ? ehEscola : soltas.findIndex((s) => s.length >= 4);
  const nome = iNome >= 0 ? soltas[iNome] : '';
  const cidade = iNome >= 0 ? (soltas.slice(iNome + 1).find((s) => s.length >= 3 && !INICIO_QUESTAO.test(s)) || '') : '';
  return {
    nome: nome.slice(0, 120), cidade: cidade.slice(0, 120), professora: professora.slice(0, 80), logo,
    campos: campos.slice(0, 8), instrucoes: instrucoes.join('\n').slice(0, 1200),
    achou: achou + (nome ? 1 : 0) + (logo ? 1 : 0),
  };
}

/** Campos da grade do cabeçalho (sem Aluno, Nº e Nota, que sempre aparecem). */
export const CAMPOS_PADRAO = ['Disciplina', 'Professor(a)', 'Turma', 'Data'];
export const camposCabecalho = (escola) => (escola?.campos?.length ? escola.campos : CAMPOS_PADRAO);
