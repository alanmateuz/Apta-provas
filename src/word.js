// =========================================================
// Exportar para Word (.docx) — arquivo editável no Word,
// LibreOffice ou Google Docs. Funciona sem internet.
// =========================================================
import {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle,
} from 'docx';
import { textoGabarito, TIPOS } from './montador.js';
import { obterImagem } from './imagens.js';
import { camposCabecalho, mesclarNoModelo } from './importar-cabecalho.js';
import { obterArquivo } from './materiais.js';

/** Configuração da versão adaptada (a professora liga e desliga cada parte). */
export function cfgAdaptada(prova) {
  return { letraMaior: true, dicas: true, negrito: true, ...(prova?.adaptadaCfg || {}) };
}
const semNegrito = (t) => String(t || "").replace(/**([^*]+)**/g, "$1");

/** Converte "texto com **negrito**" em pedaços de TextRun. */
function trechos(texto, tamanho, extra = {}) {
  // Cada linha vira uma quebra de linha no Word
  return String(texto || '').split('\n').flatMap((linha, i) => [
    ...(i > 0 ? [new TextRun({ text: '', break: 1, size: tamanho })] : []),
    ...linha.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((p) => p.startsWith('**')
      ? new TextRun({ text: p.slice(2, -2), bold: true, size: tamanho, ...extra })
      : new TextRun({ text: p, size: tamanho, ...extra })),
  ]);
}

function dataUrlParaBytes(dataUrl) {
  const [cab, b64] = dataUrl.split(',');
  const tipo = /png/.test(cab) ? 'png' : 'jpg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { bytes, tipo };
}

const SEM_BORDA = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const BORDA = { style: BorderStyle.SINGLE, size: 8, color: '000000' };

function cabecalho(prova, escola, tam) {
  const linhas = [];
  const topo = [];
  if (escola.logo) {
    try {
      const { bytes, tipo } = dataUrlParaBytes(escola.logo);
      topo.push(new ImageRun({ type: tipo, data: bytes, transformation: { width: 70, height: 70 } }));
      topo.push(new TextRun({ text: '   ' }));
    } catch {}
  }
  topo.push(new TextRun({ text: escola.nome || 'Nome da escola', bold: true, size: tam + 6 }));
  linhas.push(new Paragraph({ children: topo, alignment: AlignmentType.CENTER }));
  if (escola.cidade) linhas.push(new Paragraph({ children: [new TextRun({ text: escola.cidade, size: tam - 2 })], alignment: AlignmentType.CENTER }));

  // Mesmo desenho da tela: escola | linha larga do aluno + Nº | grade de dados + Nota
  const bordas = { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA };
  const margens = { top: 80, bottom: 80, left: 140, right: 140 };
  const rotulo = (t) => new TextRun({ text: t.toUpperCase(), bold: true, size: tam - 8, color: '444444' });
  const cel = (titulo, valor, span = 1, alto = false) => new TableCell({
    columnSpan: span, borders: bordas, margins: margens,
    children: [new Paragraph({ children: [rotulo(titulo)] }), new Paragraph({ children: [new TextRun({ text: valor || ' ', size: tam })], spacing: alto ? { before: 160 } : undefined })],
  });
  // Campos da grade: os padrões ou os que vieram do cabeçalho importado
  const valor = { Disciplina: prova.materia, 'Professor(a)': escola.professora || '', Turma: prova.turma || prova.serie, Data: prova.data || '' };
  const campos = camposCabecalho(escola);
  const total = campos.length + 1;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [new TableCell({ columnSpan: total, children: linhas, borders: bordas, margins: { top: 100, bottom: 100, left: 150, right: 150 } })] }),
      new TableRow({ children: [cel('Aluno(a)', '', total - 1, true), cel('Nº', '', 1, true)] }),
      new TableRow({ children: [...campos.map((c) => cel(c, valor[c] || '')), cel('Nota', '')] }),
    ],
  });
}

function questao(q, i, versao, tam, ca = cfgAdaptada()) {
  let d = versao === 'adaptada' ? { ...q, ...q.adaptada } : q;
  if (versao === 'adaptada' && !ca.negrito) d = { ...d, enunciado: semNegrito(d.enunciado), alternativas: (d.alternativas || []).map(semNegrito), dica: semNegrito(d.dica) };
  const ps = [];
  const espaco = versao === 'adaptada' ? 360 : 200;
  ps.push(new Paragraph({
    children: [new TextRun({ text: `${i + 1}. `, bold: true, size: tam }), ...trechos(d.enunciado, tam)],
    spacing: { before: espaco, after: 80, line: versao === 'adaptada' ? 400 : 300 },
    keepNext: true,
  }));
  const reg = obterImagem(q.imagem?.id);
  if (reg) {
    try {
      const { bytes, tipo } = dataUrlParaBytes(reg.src);
      const k = Math.min((versao === 'adaptada' ? 360 : 300) / reg.largura, 260 / reg.altura);
      ps.push(new Paragraph({
        children: [new ImageRun({ type: tipo, data: bytes, transformation: { width: Math.round(reg.largura * k), height: Math.round(reg.altura * k) } })],
        alignment: AlignmentType.CENTER, spacing: { before: 80, after: 40 }, keepNext: true,
      }));
      if (q.imagem.credito) ps.push(new Paragraph({ children: [new TextRun({ text: q.imagem.credito, size: 16, color: '555555' })], alignment: AlignmentType.CENTER, spacing: { after: 80 } }));
    } catch (e) { console.warn('Imagem não entrou no Word', e); }
  }
  if (q.tipo === 'multipla') {
    (d.alternativas || []).forEach((a, j) => ps.push(new Paragraph({
      children: [new TextRun({ text: `(   ) ${String.fromCharCode(97 + j)}) `, size: tam }), ...trechos(a, tam)],
      indent: { left: 360 }, spacing: { after: versao === 'adaptada' ? 120 : 40 }, keepNext: j < d.alternativas.length - 1,
    })));
  }
  if (q.tipo === 'vf') {
    (d.alternativas || []).forEach((a) => ps.push(new Paragraph({
      children: [new TextRun({ text: '(   ) ', size: tam }), ...trechos(a, tam)],
      indent: { left: 360 }, spacing: { after: versao === 'adaptada' ? 120 : 40 },
    })));
  }
  if (q.tipo === 'aberta') {
    const n = versao === 'adaptada' ? 4 : 3;
    for (let k = 0; k < n; k++) ps.push(new Paragraph({ children: [new TextRun({ text: '_'.repeat(78), size: tam, color: '555555' })], spacing: { before: 120 } }));
  }
  if (versao === 'adaptada' && ca.dicas && d.dica) {
    ps.push(new Paragraph({
      children: [new TextRun({ text: 'Dica: ', bold: true, size: tam - 2 }), ...trechos(d.dica, tam - 2)],
      border: { top: BORDA, bottom: BORDA, left: BORDA, right: BORDA }, spacing: { before: 120 },
    }));
  }
  return ps;
}

export async function baixarWord(prova, escola, versao) {
  const ca = cfgAdaptada(prova);
  const tam = versao === 'adaptada' && ca.letraMaior ? 30 : 24; // meios-pontos: 30 = 15pt, 24 = 12pt
  // Com o modelo da escola, o cabeçalho original entra no lugar do nosso
  const modelo = escola.modelo?.id ? obterArquivo(escola.modelo.id) : null;
  const filhos = modelo ? [] : [cabecalho(prova, escola, tam)];
  const titulo = versao === 'gabarito' ? `GABARITO — ${prova.titulo}` : prova.titulo + (versao === 'adaptada' ? '' : '');
  filhos.push(new Paragraph({ children: [new TextRun({ text: titulo, bold: true, size: tam + 4 })], alignment: AlignmentType.CENTER, spacing: { before: 240, after: 120 } }));

  if (versao === 'gabarito') {
    for (const v of prova.temAdaptada === false ? ['normal'] : ['normal', 'adaptada']) {
      filhos.push(new Paragraph({ children: [new TextRun({ text: v === 'normal' ? 'Prova' : 'Prova adaptada', bold: true, size: 26 })], spacing: { before: 240, after: 80 } }));
      filhos.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: ['Nº', 'Tipo', 'Resposta'].map((t) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 22 })] })] })) }),
          ...prova.questoes.map((q, i) => new TableRow({ children: [String(i + 1), TIPOS[q.tipo], textoGabarito(q, v)].map((t) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 22 })] })] })) })),
        ],
      }));
    }
  } else {
    if (prova.instrucoes) {
      filhos.push(new Paragraph({ children: [new TextRun({ text: 'Instruções:', bold: true, size: tam - 2 })], spacing: { before: 120 } }));
      filhos.push(new Paragraph({ children: trechos(prova.instrucoes, tam - 2), spacing: { after: 200 } }));
    }
    prova.questoes.forEach((q, i) => filhos.push(...questao(q, i, versao, tam, ca)));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial' } } } },
    sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children: filhos }],
  });
  let blob = await Packer.toBlob(doc);
  if (modelo) {
    try {
      const junto = mesclarNoModelo(new Uint8Array(await blob.arrayBuffer()), modelo.bytes);
      blob = new Blob([junto], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    } catch (e) { console.warn('Não deu para usar o modelo da escola; vai com o cabeçalho do app', e); }
  }
  const nome = `${prova.titulo}${versao === 'adaptada' ? ' - adaptada' : versao === 'gabarito' ? ' - gabarito' : ''}.docx`.replace(/[\\/:*?"<>|]/g, '-');
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return nome;
}
