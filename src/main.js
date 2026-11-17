// =========================================================
// Apta — telas do app (mobile primeiro). Evolução do MVP Prova Izi.
// Rotas: #/  #/nova  #/prova/ID  #/provas  #/banco  #/ajustes
// =========================================================
import '@fontsource-variable/nunito';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import {
  getConfig, salvarConfig, getBanco, salvarBanco, adicionarAoBanco, getProvas, getProva,
  salvarProva, apagarProva, uid, normalizar, CONFIANCA,
} from './store.js';
import {
  MATERIAS, SERIES, DIFICULDADES, TIPOS, escolherDoBanco, prepararParaProva,
  embaralharAlternativas, textoGabarito,
} from './montador.js';
import { validarQuestao, validarProva } from './validador.js';
import { gerarQuestoes, revisarQuestoes, iaDisponivel, testarConexao, buscarNaInternet, gerarIlustracao, conferirFigura, baixarImagemInternet, ErroIA, questoesDoMaterial } from './ia.js';
import { carregarImagens, obterImagem, guardarImagem, rasterizar, svgSeguro, imagensDasQuestoes, importarImagens } from './imagens.js';
import { baixarWord, cfgAdaptada } from './word.js';
import { lerCabecalhoWord, camposCabecalho } from './importar-cabecalho.js';
import { temModelo, modeloEmCache, preencherModelos } from './modelo-tela.js';
import { carregarMateriais, listarMateriais, guardarArquivo, obterMaterial, salvarMaterial, apagarMaterial, lerPDF, trechosRelevantes, paginasComQuestoes, lotesDePaginas, estaNoTexto } from './materiais.js';

registerSW({ immediate: true });

const main = document.getElementById('conteudo');

/* =================== Movimento =================== */
const menosMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const usaTransicao = () => Boolean(document.startViewTransition) && !menosMovimento() && !document.hidden;
/** Troca o conteúdo com View Transitions: empurra para o lado ao entrar/sair de uma tela
 *  e só esmaece ao trocar de aba. Sem suporte ou com "reduzir movimento", troca direto.
 *  Garantia: se o navegador não chamar a troca em 400 ms (aba em segundo plano, por
 *  exemplo), a tela é desenhada mesmo assim, sem animação. */
function transicao(desenhar, direcao = 'aba') {
  if (!usaTransicao()) { desenhar(); return; }
  const raiz = document.documentElement;
  let feito = false;
  const rodar = () => { if (feito) return; feito = true; desenhar(); };
  raiz.dataset.dir = direcao;
  const t = document.startViewTransition(rodar);
  const limpar = () => { if (raiz.dataset.dir === direcao) delete raiz.dataset.dir; };
  t.finished.then(limpar, limpar);
  t.ready?.catch(() => {}); t.updateCallbackDone?.catch(() => {}); // pular a animação não é erro
  setTimeout(() => { if (!feito) { try { t.skipTransition(); } catch {} rodar(); limpar(); } }, 400);
}
/** Vibração curta (Android); ignorada onde não existe. */
const vibrar = (padrao = 10) => { try { navigator.vibrate?.(padrao); } catch {} };
/* =================== Tema (claro por padrão; escolhido em Ajustes) ===================
   App de professor abre claro: a tela fica parecida com a folha impressa. */
const TEMAS = [['claro', 'Claro'], ['escuro', 'Escuro'], ['auto', 'Automático']];
function temaAtual() { try { return localStorage.getItem('pf.tema') || 'claro'; } catch { return 'claro'; } }
function aplicarTema(t = temaAtual()) {
  const escuro = t === 'escuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('escuro', escuro);
  corDaBarra();
}
/** Cor da barra do sistema: a cor do papel (claro) ou do grafite (escuro). */
function corDaBarra() {
  const escuro = document.documentElement.classList.contains('escuro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#121110' : '#FAF8F3');
}
aplicarTema();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicarTema());
document.addEventListener('change', (e) => {
  if (e.target.name !== 'tema') return;
  try { localStorage.setItem('pf.tema', e.target.value); } catch {}
  transicao(() => aplicarTema(e.target.value), 'segmento');
});

// Resposta tátil leve nas ações principais (onde o aparelho suporta)
document.addEventListener('click', (e) => { if (e.target.closest?.('.botao.principal, .nav a, .heroi, .agora')) vibrar(8); });
/** Reinicia a animação de entrada em cascata das listas. */
function cascata() { main.classList.remove('cascata'); void main.offsetWidth; main.classList.add('cascata'); }

/* =================== Ícones (traço simples, 24px) =================== */
const ICONES = {
  casa: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  doc: '<path d="M13.5 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.5z"/><path d="M13.5 3v3.5a1 1 0 0 0 1 1H18"/><path d="M9.5 12.5h5M9.5 16h3.5"/>', // doc.text
  mais: '<path d="M12 5v14M5 12h14"/>',
  banco: '<rect x="3" y="4" width="4.5" height="16" rx="1.3"/><rect x="9.5" y="4" width="4.5" height="16" rx="1.3"/><rect x="15.4" y="4.6" width="4.5" height="15.6" rx="1.3" transform="rotate(-14 17.6 12.4)"/><path d="M3 8h4.5M9.5 8H14"/>', // books.vertical
  ajustes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  voltar: '<path d="M15 18l-6-6 6-6"/>',
  seta: '<path d="M9 6l6 6-6 6"/>',
  pontos: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  imprimir: '<path d="M6 9V3h12v6"/><path d="M6 18H4v-8h16v8h-2"/><path d="M6 14h12v7H6z"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  enviar: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  certo: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  trocar: '<path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
  lixo: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  cima: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  baixo: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  ia: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M12 11v6M9 14h6"/>',
  imagem: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  brilho: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/><path d="M5 3.5l.5 1.5L7 5.5l-1.5.5L5 7.5l-.5-1.5L3 5.5l1.5-.5z"/>',
  filtro: '<path d="M4 5h16l-6 8v6l-4-2v-4z"/>',
  fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
  escola: '<path d="M3 10l9-5 9 5-9 5z"/><path d="M7 12v5c3 2 7 2 10 0v-5"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
  alerta: '<path d="M12 4L2.5 20h19z"/><path d="M12 10v4M12 17v.5"/>',
  tipo: '<path d="M4 6h16M4 12h10M4 18h7"/>',
  lapis: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
  embaralhar: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4"/><path d="M19 5l2 2-2 2M19 15l2 2-2 2"/>',
  inclusao: '<path d="M2.5 19L8 5l5.5 14M4.6 14h6.8"/><path d="M14.5 19l3.25-7.5L21 19M15.6 16.4h4.3"/>', // "Aa": como textformat.size do SF Symbols
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
};
/** Um ícone por matéria: a professora reconhece a prova de relance. */
const ICONES_MATERIA = {
  'Matemática': '<path d="M4 7h6M7 4v6M14 7h6M5 15l4 4M9 15l-4 4M14 16h6M14 19h6"/>',
  'Português': '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z"/><path d="M12 6v14"/>',
  'Ciências': '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M7.5 15h9"/>',
  'História': '<path d="M3 21h18M4 10h16M12 3l9 5H3z"/><path d="M6 10v8M10 10v8M14 10v8M18 10v8"/>',
  'Geografia': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  'Inglês': '<path d="M4 5h16v11H9l-5 4z"/><path d="M9 9h6M9 12h4"/>',
  'Arte': '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2H18a3 3 0 0 0 3-3c0-6-4-11-9-11z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  'Educação Física': '<circle cx="12" cy="12" r="9"/><path d="M12 3a14 14 0 0 1 0 18M3.5 9h17M3.5 15h17"/>',
  'Ensino Religioso': '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
};
const icMateria = (m) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONES_MATERIA[m] || ICONES.doc}</svg>`;

/** Situação de uma prova: quantas questões ainda pedem o ok da professora. */
function statusProva(p) {
  const qs = p.questoes || [];
  const erro = qs.filter((q) => q.alertas?.some((a) => a.nivel === 'erro')).length;
  const conferir = qs.filter((q) => !q.revisada && ['ia', 'exemplo', 'internet'].includes(q.origem)).length;
  return { erro, conferir, pendentes: Math.max(erro, conferir) };
}
const seloStatus = (st) => st.pendentes
  ? `<span class="selo atencao">${ic('alerta')} ${st.pendentes} a conferir</span>`
  : `<span class="selo pronta">${ic('certo')} Pronta</span>`;
const ic = (nome, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ''}</svg>`;

/* =================== utilitários =================== */
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s = '') => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
const letra = (j) => String.fromCharCode(97 + j);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Converte o HTML editado (contenteditable) de volta para texto com **negrito**. */
function htmlParaMd(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll('strong, b').forEach((b) => b.replaceWith(`**${b.textContent}**`));
  c.querySelectorAll('br').forEach((b) => b.replaceWith('\n'));
  c.querySelectorAll('div, p').forEach((d) => d.prepend('\n')); // Enter no contenteditable cria <div>
  return c.textContent.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').replace(/\*\*\s*\*\*/g, '').trim();
}

function aviso(msg, acao) {
  const caixa = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso';
  el.innerHTML = `<span>${esc(msg)}</span>`;
  if (acao) {
    const b = document.createElement('button');
    b.className = 'botao pequeno';
    b.textContent = acao.rotulo;
    b.onclick = () => { acao.fn(); sairAviso(el); };
    el.append(b);
  }
  caixa.append(el);
  setTimeout(() => sairAviso(el), acao ? 9000 : 4500);
}
/** Faz o aviso deslizar para fora antes de sumir. */
function sairAviso(el) {
  if (!el.isConnected || el.classList.contains('saindo')) return;
  if (menosMovimento()) { el.remove(); return; }
  el.classList.add('saindo');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  setTimeout(() => el.remove(), 400);
}

function baixarArquivo(nome, conteudo, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nome });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* =================== Gaveta (bottom sheet) ===================
   No celular sobe de baixo (zona do polegar); no computador vira diálogo. */
const gavetaEl = document.getElementById('gaveta');
let fechandoGaveta = null;
function abrirGaveta(titulo, corpo, aoMontar) {
  if (fechandoGaveta) { clearTimeout(fechandoGaveta); fechandoGaveta = null; gavetaEl.classList.remove('fechando'); }
  gavetaEl.innerHTML = `<div class="gaveta-cabeca"><h2 id="gaveta-titulo">${esc(titulo)}</h2>
    <button class="botao fantasma icone" data-fechar aria-label="Fechar">${ic('fechar')}</button></div>
    <div class="gaveta-corpo">${corpo}</div>`;
  gavetaEl.querySelector('[data-fechar]').onclick = fecharGaveta;
  aoMontar?.(gavetaEl.querySelector('.gaveta-corpo'));
  if (!gavetaEl.open) gavetaEl.showModal();
}
/** Fecha a gaveta descendo (no celular) antes de sumir. */
function fecharGaveta() {
  if (!gavetaEl.open || fechandoGaveta) return;
  if (menosMovimento()) { gavetaEl.close(); return; }
  gavetaEl.classList.add('fechando');
  fechandoGaveta = setTimeout(() => { fechandoGaveta = null; gavetaEl.classList.remove('fechando'); gavetaEl.close(); }, 200);
}
gavetaEl.addEventListener('click', (e) => { if (e.target === gavetaEl) fecharGaveta(); }); // toque fora fecha

/** Monta uma lista de ações para a gaveta. */
function menu(itens) {
  // '-' separa grupos (ex.: "Apagar" fica num grupo próprio, como no iPhone)
  const grupos = [[]];
  itens.forEach((it) => (it === '-' ? grupos.push([]) : grupos[grupos.length - 1].push(it)));
  return grupos.filter((g) => g.length).map((g, gi) => `<ul class="menu-lista ${gi ? 'perigo-separado' : ''}">${g.map((it) =>
    `<li><button data-op="${it.op}" class="${it.perigo ? 'perigo' : ''}">${ic(it.icone)}<span>${esc(it.rotulo)}${it.dica ? `<small>${esc(it.dica)}</small>` : ''}</span></button></li>`).join('')}</ul>`).join('');
}

/** Uma linha de lista agrupada (estilo Ajustes do iPhone). */
function linha({ href, icone, cor = '', titulo: t, meta = '', valor = '', seta = true, attrs = '' }) {
  const tag = href ? 'a' : 'div';
  return `<li><${tag} class="linha" ${href ? `href="${href}"` : ''} ${attrs}>
    ${icone ? `<span class="icone-app ${cor}">${ic(icone)}</span>` : ''}
    <span class="texto-linha"><span class="titulo-linha">${t}</span>${meta ? `<span class="meta">${meta}</span>` : ''}</span>
    ${valor ? `<span class="valor">${valor}</span>` : ''}${seta && href ? `<span class="chevron">${ic('seta')}</span>` : ''}</${tag}></li>`;
}

/* =================== Conexão =================== */
let estavaOnline = navigator.onLine;
function atualizarConexao() {
  const el = document.getElementById('conexao');
  const on = navigator.onLine;
  if (on !== estavaOnline) {
    aviso(on ? 'Internet de volta. A criação automática voltou a funcionar.' : 'Sem internet. Tudo continua funcionando com o seu banco de questões.');
    estavaOnline = on;
  }
  // Só aparece quando falta internet; "Online" não diz nada de útil
  el.hidden = on;
  el.textContent = on ? '' : 'Sem internet';
  el.title = on ? '' : 'Sem internet: o app continua funcionando com o banco de questões';
  el.classList.toggle('offline', !on);
}
addEventListener('online', atualizarConexao);
addEventListener('offline', atualizarConexao);
atualizarConexao();

/* =================== Navegação =================== */
// Barra de abas no padrão do iOS 26/27 (HIG · Tab bars): poucas abas de nível superior
// e a ação de criar como botão redondo separado, como a "Buscar" do sistema.
const NAV = [
  { rota: '', rotulo: 'Provas', icone: 'doc' },
  { rota: 'banco', rotulo: 'Banco', icone: 'banco', longo: 'Banco de questões' },
  { rota: 'ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
  { rota: 'nova', rotulo: 'Criar', icone: 'mais', classe: 'criar', longo: 'Criar prova' },
];
const linkNav = (n) => `<a href="#/${n.rota}" class="${n.classe || ''}" data-rota="${n.rota}"${n.classe === 'criar' ? ` aria-label="${n.longo}"` : ''}>
  <span class="pilula">${ic(n.icone)}</span><span class="nav-rotulo">${n.rotulo}</span></a>`;
document.getElementById('nav').innerHTML = `<div class="abas">${NAV.filter((n) => n.classe !== 'criar').map(linkNav).join('')}</div>${NAV.filter((n) => n.classe === 'criar').map(linkNav).join('')}`;

/** Telas "empilhadas" (criar e editar) entram deslizando da direita, como no iPhone;
 *  trocar de aba só esmaece. */
const EMPILHADAS = ['nova', 'lote', 'prova'];
let rotaAnterior = null;
function direcaoEntre(de, para) {
  if (de === null || de === para) return null;
  if ([de, para].sort().join() === 'lote,nova') return 'segmento';
  if (EMPILHADAS.includes(para) && !EMPILHADAS.includes(de)) return 'frente';
  if (EMPILHADAS.includes(de) && !EMPILHADAS.includes(para)) return 'tras';
  return 'aba';
}

function rotear() {
  const [rotaBruta = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  const rota = ['escola', 'ia'].includes(rotaBruta) ? 'ajustes' : rotaBruta;
  const ativa = ['prova', 'provas'].includes(rota) ? '' : rota;
  const direcao = direcaoEntre(rotaAnterior, rota);
  rotaAnterior = rota;
  fecharGaveta();
  const desenhar = () => {
    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.dataset.rota === ativa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.body.classList.toggle('foco', rota === 'nova' || rota === 'prova');
    document.body.classList.toggle('em-inicio', !telasConhecidas.includes(rota) || rota === '');
    corDaBarra();
    main.classList.toggle('largo', rota === 'prova');
    main.onclick = null;
    if (!direcao || !usaTransicao()) { main.classList.remove('entrar'); void main.offsetWidth; main.classList.add('entrar'); }
    const telas = { '': telaInicio, nova: telaNova, lote: telaLote, prova: () => telaProva(id), provas: telaProvas, banco: telaBanco, ajustes: () => telaAjustes(rotaBruta) };
    document.body.classList.remove('boas-vindas');
    if (rota === '' && precisaBoasVindas()) { telaBoasVindas(); window.scrollTo(0, 0); return; }
    (telas[rota] || telaInicio)();
    cascata();
    window.scrollTo(0, 0);
  };
  if (direcao) transicao(desenhar, direcao); else desenhar();
}
addEventListener('hashchange', rotear);
const telasConhecidas = ['', 'nova', 'lote', 'prova', 'provas', 'banco', 'ajustes'];

function titulo(t) { document.title = `${t} · Apta`; }
/** Leva o foco para o título da tela (bom para leitor de tela). */
function focarTitulo() { main.querySelector('h1')?.setAttribute('tabindex', '-1'); main.querySelector('h1')?.focus({ preventScroll: true }); }

/* =================== INÍCIO =================== */
/* Cor de cada matéria (lápis de cor, tons sóbrios). Só em áreas pequenas:
   a faixa da folha e o ícone. As cores de modo (terracota, verde-lousa, lavanda) não mudam. */
const COR_MATERIA = {
  'Matemática': '#2f6db5', 'Português': '#a63d5b', 'Ciências': '#3e8a4a', 'História': '#a8741a',
  'Geografia': '#1f7a86', 'Inglês': '#8b5e3c', 'Arte': '#b8407a', 'Educação Física': '#c76a10', 'Ensino Religioso': '#7a6a58',
};
const corMateria = (m) => COR_MATERIA[m] || '#6b655c';

/** "17/11/2026" → Date (meio-dia, para não virar o dia por fuso). */
function dataDaProva(p) {
  const m = String(p.data || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12) : null;
}
const tituloCurto = (p) => {
  const t = (p.titulo || '').replace(/^Avaliação de [^—]+—\s*/, '') || p.titulo || 'Prova';
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const turmaDe = (p) => p.turma || p.serie || '';

/** A prova como papel: miniatura de folha com a faixa da matéria. */
function folhaMini(p, { legenda = true } = {}) {
  const st = statusProva(p);
  return `<a class="folha-mini" href="#/prova/${p.id}" style="--cor:${corMateria(p.materia)}" aria-label="${esc(tituloCurto(p))}, ${esc(p.materia)}, ${esc(turmaDe(p))}${st.pendentes ? `, ${st.pendentes} para conferir` : ', pronta'}">
    <span class="fm-papel" aria-hidden="true">
      <span class="fm-faixa"><span class="fm-ic">${icMateria(p.materia)}</span>${esc(p.materia || 'Prova')}</span>
      <span class="fm-cab"><i></i><i class="curta"></i></span>
      <span class="fm-titulo">${esc(tituloCurto(p))}</span>
      <span class="fm-linhas"><i></i><i></i><i class="curta"></i><i></i><i class="media"></i></span>
      <span class="fm-estado ${st.pendentes ? 'conferir' : 'pronta'}">${st.pendentes ? st.pendentes : ic('certo')}</span>
    </span>
    ${legenda ? `<span class="fm-legenda"><strong>${esc(tituloCurto(p))}</strong><small>${esc(turmaDe(p))} · ${plural(p.questoes.length, 'questão', 'questões')}</small></span>` : ''}
  </a>`;
}

/** Linha da agenda: o dia em bloco, como num planner. */
function itemAgenda(p) {
  const d = dataDaProva(p);
  const st = statusProva(p);
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const dias = Math.round((d - hoje) / 864e5);
  const quando = dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { weekday: 'long' });
  return `<li><a class="agenda-item" href="#/prova/${p.id}" style="--cor:${corMateria(p.materia)}">
    <span class="agenda-dia" aria-hidden="true"><strong>${d.getDate()}</strong><span>${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span></span>
    <span class="agenda-texto"><strong>${esc(tituloCurto(p))}</strong>
      <span class="agenda-meta"><span class="ponto-materia"></span>${esc(p.materia)} · ${esc(turmaDe(p))} · <span class="quando">${quando}</span></span></span>
    ${st.pendentes ? `<span class="selo atencao">${ic('alerta')} ${st.pendentes}</span>` : `<span class="selo pronta">${ic('certo')} Pronta</span>`}
  </a></li>`;
}

function telaInicio() {
  titulo('Início');
  const cfg = getConfig();
  const provas = getProvas();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = (cfg.escola.professora || '').trim().split(' ')[0];

  // Blocos de atenção: 1) saudação  2) Nova prova + Continuar  3) próximas provas (agenda)  4) suas provas (folhas)
  const ultima = provas[0];
  const stUltima = ultima ? statusProva(ultima) : null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const proximas = provas.filter((p) => { const d = dataDaProva(p); return d && d >= hoje; })
    .sort((a, b) => dataDaProva(a) - dataDaProva(b)).slice(0, 3);

  main.innerHTML = `
    <section class="saudacao" aria-label="Saudação">
      <h1>${saudacao}${primeiroNome ? `, <span class="cor-nome">${esc(primeiroNome)}</span>` : ''}</h1>
      ${cfg.escola.nome ? `<span class="saudacao-escola">${ic('escola', 'p')} ${esc(cfg.escola.nome)}</span>` : ''}
    </section>

    <div class="funcoes${ultima ? '' : ' unica'}">
      <a class="funcao principal" href="#/nova">
        <span class="funcao-icone">${ic('mais')}</span>
        <strong>Nova prova</strong>
        <span class="funcao-sub">Com adaptada e gabarito</span>
      </a>
      ${ultima ? `<a class="funcao" href="#/prova/${ultima.id}" style="--cor:${corMateria(ultima.materia)}">
        <span class="funcao-icone materia">${icMateria(ultima.materia)}</span>
        <strong>Continuar</strong>
        <span class="funcao-sub">${esc(tituloCurto(ultima))} · ${esc(turmaDe(ultima))}</span>
        ${stUltima.pendentes ? `<span class="funcao-selo">${stUltima.pendentes} a conferir</span>` : ''}
      </a>` : ''}
    </div>

    ${proximas.length ? `<h2 class="titulo-secao">Próximas provas</h2>
      <ul class="agenda">${proximas.map(itemAgenda).join('')}</ul>` : ''}

    <div class="titulo-secao com-link"><h2>Suas provas</h2>${provas.length > 1 ? `<a href="#/provas">Ver todas</a>` : ''}</div>
    ${provas.length
      ? `<div class="estante" role="list">${provas.slice(0, 8).map((p) => `<div role="listitem">${folhaMini(p)}</div>`).join('')}</div>`
      : `<a class="folha-vazia" href="#/nova">
          <span class="fm-papel" aria-hidden="true"><span class="fm-cab"><i></i><i class="curta"></i></span><span class="fm-linhas"><i></i><i></i><i class="curta"></i><i></i></span></span>
          <span><strong>Sua primeira prova aparece aqui</strong><small>Escolha a turma e o conteúdo. Em cerca de um minuto ela fica pronta, com a versão adaptada e o gabarito.</small></span>
        </a>`}`;
}

/* ---------- Boas-vindas (só na primeira vez) ---------- */
function precisaBoasVindas() {
  try { if (localStorage.getItem('pf.boasVindas')) return false; } catch { return false; }
  const e = getConfig().escola;
  return !e.professora && !e.nome && !getProvas().length;
}
function telaBoasVindas() {
  titulo('Bem-vinda');
  document.body.classList.add('boas-vindas');
  main.innerHTML = `<div class="bv">
    <img class="bv-icone" src="/icon.svg" alt="" width="96" height="96" />
    <img class="bv-marca marca-clara" src="/apta-marca.svg" alt="Apta" width="132" height="72" />
    <img class="bv-marca marca-escura" src="/apta-marca-escuro.svg" alt="Apta" width="132" height="72" />
    <p class="bv-slogan">Provas prontas para toda a turma.</p>
    <ul class="bv-promessas">
      <li><span class="bv-ic">${ic('doc')}</span><span><strong>Prova, adaptada e gabarito</strong>Tudo sai junto, da mesma prova.</span></li>
      <li><span class="bv-ic verde">${ic('certo')}</span><span><strong>Questões conferidas</strong>Do seu banco primeiro; o resto é revisado.</span></li>
      <li><span class="bv-ic">${ic('imprimir')}</span><span><strong>Pronta para imprimir</strong>Ou abra no Word e mude o que quiser.</span></li>
    </ul>
    <form id="form-bv" class="bv-form" novalidate>
      <div class="campo"><label for="bv-nome">Seu nome</label><input type="text" id="bv-nome" name="professora" autocomplete="name" placeholder="Ex.: Márcia Souza" /></div>
      <div class="campo"><label for="bv-escola">Escola <span class="opcional">(aparece no topo da prova)</span></label><input type="text" id="bv-escola" name="nome" autocomplete="organization" placeholder="Ex.: Escola Municipal Monteiro Lobato" /></div>
      <button class="botao principal grande cheio">Começar</button>
      <button type="button" class="botao fantasma cheio" id="bv-pular">Agora não</button>
    </form>
  </div>`;
  const fim = () => { try { localStorage.setItem('pf.boasVindas', '1'); } catch {} document.body.classList.remove('boas-vindas'); location.hash = '#/'; rotear(); };
  main.querySelector('#form-bv').onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const cfg = getConfig();
    salvarConfig({ ...cfg, escola: { ...cfg.escola, professora: fd.get('professora').trim(), nome: fd.get('nome').trim() || cfg.escola.nome } });
    fim();
  };
  main.querySelector('#bv-pular').onclick = fim;
  main.querySelector('#bv-nome').focus();
}

/* =================== CRIAR PROVA (2 passos: turma e conteúdo · formato) =================== */
const SUGESTOES = {
  'Matemática': ['Frações', 'Multiplicação e divisão', 'Problemas com dinheiro', 'Perímetro e área', 'Números decimais', 'Porcentagem'],
  'Português': ['Interpretação de texto', 'Substantivos e adjetivos', 'Pontuação', 'Ortografia', 'Verbos', 'Gêneros textuais'],
  'Ciências': ['Ciclo da água', 'Cadeia alimentar', 'Corpo humano', 'Sistema solar', 'Animais', 'Ecossistemas'],
  'História': ['Povos indígenas', 'Brasil colônia', 'Independência do Brasil', 'Abolição da escravatura', 'Egito Antigo'],
  'Geografia': ['Regiões do Brasil', 'Pontos cardeais', 'Biomas brasileiros', 'Relevo e hidrografia', 'Mapas'],
};
const EXEMPLO_TIPO = {
  multipla: 'Ex.: Qual é o resultado de 3 × 4?  a) 7  b) 12  c) 34',
  vf: 'Ex.: ( ) O Sol é uma estrela.',
  completar: 'Ex.: A água ferve a ____ graus.',
  aberta: 'Ex.: Explique com suas palavras o que é fotossíntese.',
};
const TOTAL_PASSOS = 2;
let rascunho = null;

/* Matérias: as da lista + as que a professora escreveu em "Outra" (ficam salvas) */
function materiasExtras() {
  try { return JSON.parse(localStorage.getItem('pf.materiasExtras')) || []; } catch { return []; }
}
function todasMaterias() {
  const usadas = [...getProvas().map((p) => p.materia), ...getBanco().map((q) => q.materia)];
  return [...new Set([...MATERIAS, ...materiasExtras(), ...usadas].filter(Boolean))];
}
function guardarMateria(nome) {
  const m = String(nome || '').trim().replace(/\s+/g, ' ');
  if (!m) return '';
  const igual = todasMaterias().find((x) => x.toLowerCase() === m.toLowerCase());
  if (igual) return igual;
  const fmt = m.charAt(0).toUpperCase() + m.slice(1);
  try { localStorage.setItem('pf.materiasExtras', JSON.stringify([...materiasExtras(), fmt])); } catch {}
  return fmt;
}
const OUTRA = '__outra';
/** Materiais em PDF, os da matéria escolhida primeiro. */
const materiaisDaMateria = (materia) => [...listarMateriais()].sort((a, b) => (b.materia === materia) - (a.materia === materia));

function novoRascunho() {
  let ultimo = {};
  try { ultimo = JSON.parse(localStorage.getItem('pf.ultimoPedido')) || {}; } catch {}
  const temIA = iaDisponivel(getConfig());
  return {
    passo: 1,
    materia: ultimo.materia || 'Matemática', serie: ultimo.serie || '5º ano', turma: ultimo.turma || '',
    tema: '', dificuldade: ultimo.dificuldade || 'medio', quantidade: ultimo.quantidade || 10,
    tipos: ultimo.tipos || ['multipla', 'aberta'], adaptada: ultimo.adaptada !== false, figuras: ultimo.figuras !== false,
    modo: temIA ? (ultimo.modo && ultimo.modo !== 'banco' ? ultimo.modo : 'misto') : 'banco', observacoes: '',
  };
}

function telaNova() {
  titulo('Criar prova');
  if (!rascunho) rascunho = novoRascunho();
  desenharPasso();
}

function fichas(nome, opcoes, atual, tipo = 'radio') {
  return `<div class="fichas">${opcoes.map(([v, r]) => `<label class="ficha"><input type="${tipo}" name="${nome}" value="${esc(v)}" ${(Array.isArray(atual) ? atual.includes(v) : atual === v) ? 'checked' : ''}/><span>${esc(r)}</span></label>`).join('')}</div>`;
}

/** Turmas que a professora já usou (matéria + ano + turma), as mais recentes primeiro. */
function turmasRecentes() {
  let ultimo = null;
  try { ultimo = JSON.parse(localStorage.getItem('pf.ultimoPedido')); } catch {}
  const vistas = new Map();
  [ultimo, ...getProvas()].filter((x) => x && x.materia && x.serie).forEach((x) => {
    const k = `${x.materia}|${x.serie}|${x.turma || ''}`;
    if (!vistas.has(k)) vistas.set(k, { materia: x.materia, serie: x.serie, turma: x.turma || '' });
  });
  return [...vistas.values()].slice(0, 4);
}

function desenharPasso() {
  const r = rascunho;
  const cfg = getConfig();
  const temIA = iaDisponivel(cfg);
  const opcaoLista = (tipo, nome, valor, marcado, titulo, sub, desabilitado = false) => `<label class="ficha"><input type="${tipo}" name="${nome}" value="${valor}" ${marcado ? 'checked' : ''} ${desabilitado ? 'disabled' : ''}/>
    <span><span class="op-texto"><strong>${titulo}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="marca-op" aria-hidden="true">${ic('certo')}</span></span></label>`;
  let corpo = '';
  if (r.passo === 1) {
    const recentes = turmasRecentes();
    const igual = (t) => t.materia === r.materia && t.serie === r.serie && (t.turma || '') === (r.turma || '');
    const escolhida = recentes.some(igual);
    const sugs = SUGESTOES[r.materia] || [];
    corpo = `<h1>Nova prova</h1>
      <h2 class="titulo-secao">Para qual turma?</h2>
      ${recentes.length ? `<div class="turmas-recentes" role="radiogroup" aria-label="Turmas que você já usou">${recentes.map((t, k) => `
        <button type="button" role="radio" class="turma-chip" data-turma="${k}" aria-checked="${igual(t)}" style="--cor:${corMateria(t.materia)}">
          <span class="turma-ic">${icMateria(t.materia)}</span><span><strong>${esc(t.turma || t.serie)}</strong><small>${esc(t.materia)}</small></span></button>`).join('')}</div>` : ''}
      ${recentes.length ? `<details class="revelar outra-turma" ${escolhida ? '' : 'open'}>
        <summary>Outra turma ou matéria<span class="chevron">${ic('seta')}</span></summary>` : '<div class="outra-turma cartao-form">'}
        <div class="conteudo">
          <fieldset style="border:0;padding:0;margin:0 0 16px"><legend class="rotulo">Matéria</legend>${fichas('materia', [...todasMaterias().map((m) => [m, m]), [OUTRA, '+ Outra']], r.materia)}
            <div class="campo campo-outra" ${r.materia === OUTRA ? '' : 'hidden'}><label for="materia-outra" class="visualmente-oculto">Nome da matéria</label>
              <input type="text" id="materia-outra" name="materiaOutra" value="${esc(r.materiaOutra || '')}" placeholder="Escreva a matéria. Ex.: Filosofia" autocomplete="off" />
              <div class="erro-campo" id="outra-erro" hidden>${ic('alerta', 'p')} Escreva o nome da matéria.</div></div></fieldset>
          <fieldset style="border:0;padding:0;margin:0 0 16px"><legend class="rotulo">Ano / série</legend>${fichas('serie', SERIES.map((s) => [s, s.replace(' (Ensino Médio)', ' EM')]), r.serie)}</fieldset>
          <div class="campo" style="margin:0"><label for="turma">Nome da turma <span class="opcional">(opcional)</span></label>
            <input type="text" id="turma" name="turma" value="${esc(r.turma)}" placeholder="Ex.: 5º A" autocomplete="off" /></div>
        </div>
      ${recentes.length ? '</details>' : '</div>'}
      <h2 class="titulo-secao"><label for="tema">O que vai cair?</label></h2>
      <div class="campo">
        <textarea id="tema" name="tema" aria-describedby="tema-dica tema-erro" placeholder="Ex.: frações: comparar e somar frações com o mesmo denominador">${esc(r.tema)}</textarea>
        <span class="dica" id="tema-dica" style="margin-top:8px">Escreva como falaria para um colega. Quanto mais específico, melhor.</span>
        <div class="erro-campo" id="tema-erro" hidden>${ic('alerta', 'p')} Escreva o conteúdo para continuar.</div>
        ${sugs.length ? `<div class="sugestoes" aria-label="Sugestões de conteúdo">${sugs.map((s) => `<button type="button" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
      </div>
      <a href="#/lote" class="link-lote" id="ir-lote">${ic('copiar', 'p')} Criar várias provas de uma vez</a>`;
  }
  if (r.passo === 2) {
    const origens = [
      ['misto', 'Meu banco + questões novas', 'Recomendado. Usa primeiro as suas questões e cria só as que faltarem.'],
      ['banco', 'Só do meu banco', 'Funciona sem internet.'],
      ['ia', 'Só questões novas', 'Todas criadas na hora. Precisa de internet.'],
    ];
    corpo = `<h1>Como vai ser?</h1>
      <p class="resumo-pedido" style="--cor:${corMateria(r.materia)}"><span class="ponto-materia"></span>${esc(r.materia)} · ${esc(r.turma || r.serie)} · ${esc(r.tema.split(/[:.\n]/)[0].slice(0, 50))}
        <button type="button" class="botao fantasma pequeno" data-ir="1">Alterar</button></p>
      <div class="cartao-form formato">
        <div class="formato-linha"><span class="rotulo" id="qtd-rot">Questões</span>
          <div class="contador" role="group" aria-labelledby="qtd-rot">
            <button type="button" class="botao" data-passo="-1" aria-label="Uma questão a menos">−</button>
            <output id="qtd" aria-live="polite">${r.quantidade}</output>
            <button type="button" class="botao" data-passo="1" aria-label="Uma questão a mais">+</button>
          </div></div>
        <fieldset class="formato-linha" style="border:0;padding:0;margin:0"><legend class="rotulo">Dificuldade</legend>
          <div class="segmentos segmentos-form">${Object.entries(DIFICULDADES).map(([v, rot]) => `<label><input type="radio" name="dificuldade" value="${v}" ${r.dificuldade === v ? 'checked' : ''}/><span>${rot}</span></label>`).join('')}</div></fieldset>
      </div>
      <h2 class="titulo-secao" id="tipos-rot">Tipos de questão</h2>
      ${fichas('tipos', Object.entries(TIPOS).map(([v, rot]) => [v, rot.split(' (')[0]]), r.tipos, 'checkbox')}
      <div class="erro-campo" id="tipos-erro" hidden>${ic('alerta', 'p')} Marque pelo menos um tipo.</div>
      <label class="cartao-adaptada">
        <span class="ca-ic">${ic('inclusao')}</span>
        <span class="ca-texto"><strong>Versão adaptada</strong><small>Para quem precisa: letra maior, frases curtas, palavras-chave em negrito e dicas.</small></span>
        <input type="checkbox" name="adaptada" ${r.adaptada ? 'checked' : ''} aria-label="Criar também a versão adaptada" /></label>
      <details class="revelar mais-opcoes">
        <summary>Mais opções<span class="chevron">${ic('seta')}</span></summary>
        <div class="conteudo">
          ${temIA ? `<label class="alternar" style="margin-bottom:16px;box-shadow:none;padding:0"><input type="checkbox" name="figuras" ${r.figuras ? 'checked' : ''}/>
            <span><strong>Figuras quando ajudarem</strong><small>Gráficos, frações e formas, conferidos antes de entrar.</small></span></label>` : ''}
          <div class="rotulo" id="origem-rot">De onde vêm as questões</div>
          <div class="fichas lista" role="radiogroup" aria-labelledby="origem-rot" style="margin-bottom:16px">${origens.map(([v, rot, d]) => {
            const off = v !== 'banco' && !temIA;
            return opcaoLista('radio', 'modo', v, r.modo === v, rot, off ? 'Precisa ligar a criação automática em Ajustes.' : d, off);
          }).join('')}</div>
          ${temIA && listarMateriais().length ? `<div class="campo"><label for="material-base">Livro ou apostila de base</label>
            <select id="material-base" name="materialId"><option value="">Nenhum</option>${materiaisDaMateria(r.materia).map((m) => `<option value="${m.id}" ${m.id === r.materialId ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></div>` : ''}
          <div class="campo" style="margin:0"><label for="obs">Pedido especial</label>
            <textarea id="obs" name="observacoes" style="min-height:84px" placeholder="Ex.: usar situações de mercado e dinheiro">${esc(r.observacoes)}</textarea></div>
        </div>
      </details>`;
  }

  main.innerHTML = `
    <div class="topo-criar">
      <button type="button" class="botao fantasma pequeno" id="b-voltar">${r.passo === 1 ? 'Cancelar' : `${ic('voltar', 'p')} Voltar`}</button>
      <div class="progresso" aria-label="Passo ${r.passo} de ${TOTAL_PASSOS}"><div class="progresso-trilho" role="progressbar" aria-valuemin="1" aria-valuemax="${TOTAL_PASSOS}" aria-valuenow="${r.passo}">${[1, 2].map((n) => `<span class="${n <= r.passo ? 'feito' : ''}"></span>`).join('')}</div></div>
      <span class="progresso-rotulo">${r.passo} de ${TOTAL_PASSOS}</span>
    </div>
    <form id="form-passo" novalidate>${corpo}</form>
    <div class="barra-acoes">
      <button type="button" class="botao principal grande" id="b-seguir">${r.passo === TOTAL_PASSOS ? `${ic('brilho', 'p')} Criar prova` : `Continuar ${ic('seta', 'p')}`}</button>
    </div>`;

  const form = main.querySelector('#form-passo');
  form.addEventListener('submit', (e) => { e.preventDefault(); seguir(); });
  form.addEventListener('change', () => lerPasso(form));
  form.addEventListener('input', () => lerPasso(form));
  form.querySelectorAll('[data-sug]').forEach((b) => (b.onclick = () => {
    form.tema.value = b.dataset.sug; lerPasso(form); form.tema.focus();
  }));
  form.querySelectorAll('[data-turma]').forEach((b) => (b.onclick = () => {
    lerPasso(form);
    Object.assign(r, turmasRecentes()[Number(b.dataset.turma)]);
    desenharPasso();
  }));
  form.querySelectorAll('[data-passo]').forEach((b) => (b.onclick = () => {
    r.quantidade = Math.min(20, Math.max(1, r.quantidade + Number(b.dataset.passo)));
    form.querySelector('#qtd').textContent = r.quantidade;
  }));
  form.querySelectorAll('[data-ir]').forEach((b) => (b.onclick = () => { lerPasso(form); r.passo = Number(b.dataset.ir); transicao(desenharPasso, 'tras'); }));
  main.querySelector('#b-voltar').onclick = () => {
    if (r.passo === 1) { rascunho = null; location.hash = '#/'; return; }
    lerPasso(form); r.passo--; transicao(desenharPasso, 'tras');
  };
  main.querySelector('#b-seguir').onclick = seguir;
  main.querySelector('#ir-lote')?.addEventListener('click', (e) => {
    e.preventDefault();
    lerPasso(form);
    lote = lote || novoLote();
    if (rascunho.materia !== OUTRA) Object.assign(lote.linhas[0], { materia: rascunho.materia, serie: rascunho.serie, turma: rascunho.turma, tema: rascunho.tema });
    location.hash = '#/lote';
  });
  if (!usaTransicao()) { main.classList.remove('entrar'); void main.offsetWidth; main.classList.add('entrar'); }
  window.scrollTo(0, 0);
  focarTitulo();
}

function lerPasso(form) {
  const r = rascunho;
  const fd = new FormData(form);
  if (r.passo === 1) {
    if (fd.has('materia')) { r.materia = fd.get('materia'); r.serie = fd.get('serie'); r.turma = (fd.get('turma') || '').trim(); }
    r.materiaOutra = (fd.get('materiaOutra') || '').trim();
    r.tema = (fd.get('tema') || '').trim();
    const caixa = form.querySelector('.campo-outra');
    if (caixa) {
      const abrir = r.materia === OUTRA && caixa.hidden;
      caixa.hidden = r.materia !== OUTRA;
      if (abrir) form.querySelector('#materia-outra').focus();
      if (r.materiaOutra) form.querySelector('#outra-erro').hidden = true;
    }
    // As turmas recentes mostram qual está escolhida
    const recentes = turmasRecentes();
    form.querySelectorAll('[data-turma]').forEach((b) => {
      const t = recentes[Number(b.dataset.turma)];
      b.setAttribute('aria-checked', String(t.materia === r.materia && t.serie === r.serie && (t.turma || '') === (r.turma || '')));
    });
    if (r.tema) form.querySelector('#tema-erro').hidden = true;
  }
  if (r.passo === 2) {
    r.dificuldade = fd.get('dificuldade') || r.dificuldade; r.tipos = fd.getAll('tipos'); r.figuras = fd.get('figuras') === 'on';
    r.adaptada = fd.get('adaptada') === 'on'; r.modo = fd.get('modo') || r.modo; r.materialId = fd.get('materialId') || '';
    r.observacoes = (fd.get('observacoes') || '').trim();
    if (r.tipos.length) form.querySelector('#tipos-erro').hidden = true;
  }
}

async function seguir() {
  const r = rascunho;
  const form = main.querySelector('#form-passo');
  lerPasso(form);
  if (r.passo === 1 && r.materia === OUTRA) {
    if (!r.materiaOutra) { const ot = form.querySelector('.outra-turma'); if (ot.tagName === 'DETAILS') ot.open = true; form.querySelector('#outra-erro').hidden = false; form.querySelector('#materia-outra').focus(); return; }
    r.materia = guardarMateria(r.materiaOutra); r.materiaOutra = '';
  }
  if (r.passo === 1 && !r.tema) { form.querySelector('#tema-erro').hidden = false; form.tema.focus(); return; }
  if (r.passo === 2 && !r.tipos.length) { form.querySelector('#tipos-erro').hidden = false; form.querySelector('[name=tipos]').focus(); return; }
  if (r.passo < TOTAL_PASSOS) { r.passo++; transicao(desenharPasso, 'frente'); return; }
  const pedido = { ...r };
  delete pedido.passo;
  try { localStorage.setItem('pf.ultimoPedido', JSON.stringify(pedido)); } catch {}
  const botao = main.querySelector('#b-seguir');
  if (botao) botao.disabled = true;
  try {
    const ok = await criarProva(pedido);
    if (ok) rascunho = null;
  } finally { if (botao) botao.disabled = false; }
}

/* ---------- Tela "criando a prova" com as etapas reais ---------- */
function telaCriando(etapas) {
  const ctrl = new AbortController();
  const el = document.createElement('div');
  el.className = 'criando';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'criando-titulo');
  el.innerHTML = `<div class="criando-caixa">
    <img class="criando-icone" src="/icon.svg" alt="" width="72" height="72" />
    <h1 id="criando-titulo" class="cor-marca" style="margin-top:16px">Preparando sua prova</h1>
    <span class="selo ia-selo">${ic('brilho')} Com IA</span>
    <p class="sub">Leva cerca de 1 minuto. Pode deixar esta tela aberta.</p>
    <div class="criando-barra" aria-hidden="true"><span></span></div>
    <ol class="etapas" aria-live="polite">${etapas.map((t) => `<li><span class="estado" aria-hidden="true"></span><span>${esc(t)}</span></li>`).join('')}</ol>
    <div class="esqueleto-folha" aria-hidden="true"><i></i><i></i><i class="curta"></i><i></i><i class="curta"></i></div>
    <button class="botao cheio" id="b-cancelar">Cancelar</button></div>`;
  el.querySelector('#b-cancelar').onclick = () => ctrl.abort();
  document.body.append(el);
  const lis = el.querySelectorAll('.etapas li');
  const barra = el.querySelector('.criando-barra span');
  return {
    signal: ctrl.signal,
    titulo(t, sub, comIA = true) {
      el.querySelector('#criando-titulo').textContent = t;
      if (sub) el.querySelector('.sub').textContent = sub;
      el.querySelector('.ia-selo').hidden = !comIA;
    },
    etapa(i, texto) {
      lis.forEach((li, j) => {
        li.classList.toggle('feita', j < i); li.classList.toggle('agora', j === i);
        li.querySelector('.estado').textContent = j < i ? '✓' : '';
      });
      if (texto && lis[i]) lis[i].lastElementChild.textContent = texto;
      barra.style.width = `${Math.round(((i + 0.5) / lis.length) * 100)}%`;
    },
    fechar: () => {
      if (menosMovimento()) { el.remove(); return; }
      el.classList.add('saindo');
      setTimeout(() => el.remove(), 220);
    },
  };
}

/** Monta e salva uma prova a partir do pedido (banco primeiro, IA completa o que faltar).
 *  Não mexe na tela: avisa o andamento por `etapa('criar'|'conferir'|'figuras'|'montar')`.
 *  Devolve { prova, recados }; prova = null quando não deu para montar nenhuma questão.
 *  Cancelamento (AbortError) sobe para quem chamou. */
async function montarProva(pedido, signal, etapa = () => {}) {
  const cfg = getConfig();
  const recados = [];
  // Com um livro/apostila de base, as questões saem do material (não do banco)
  const material = pedido.materialId && pedido.modo !== 'banco' && iaDisponivel(cfg) ? obterMaterial(pedido.materialId) : null;
  const doBanco = pedido.modo === 'ia' || material ? [] : escolherDoBanco(getBanco(), pedido, pedido.quantidade);
  let questoes = doBanco.map((q) => prepararParaProva(q, pedido));
  const faltam = pedido.quantidade - questoes.length;
  let pedidoIA = pedido;
  if (material) {
    const trechos = trechosRelevantes(material, `${pedido.tema} ${pedido.observacoes || ''}`);
    if (trechos.length) pedidoIA = { ...pedido, contexto: { nome: material.nome, trechos } };
    else recados.push(`Não achei “${pedido.tema}” no material “${material.nome}”. As questões foram criadas sem ele.`);
  }
  if (faltam > 0 && pedido.modo !== 'banco' && iaDisponivel(cfg)) {
    etapa('criar');
    try {
      const novas = await gerarQuestoes(cfg, pedidoIA, faltam, questoes.map((q) => q.enunciado.slice(0, 120)), signal);
      let preparadas = novas.map((q) => embaralharAlternativas(prepararParaProva(q, pedido)));
      if (cfg.ia.revisora) {
        etapa('conferir');
        try {
          const revisoes = await revisarQuestoes(cfg, preparadas, signal);
          preparadas = preparadas.map((q, i) => ({ ...q, alertas: [...q.alertas, ...(revisoes[i] || [])] }));
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          recados.push('A conferência automática não pôde ser feita agora. Confira as questões novas com atenção.');
        }
      }
      if (preparadas.some((q) => q.figura)) { etapa('figuras'); await prepararFiguras(cfg, preparadas, signal); }
      preparadas.forEach((q) => delete q.figura);
      etapa('montar');
      adicionarAoBanco(preparadas.filter((q) => !q.alertas.some((a) => a.nivel === 'erro')), 'ia');
      questoes = [...questoes, ...preparadas];
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.error(e);
      recados.push(e instanceof ErroIA ? e.message : 'Não foi possível criar questões novas agora.');
    }
  }
  if (!questoes.length) return { prova: null, recados };
  if (questoes.length < pedido.quantidade) recados.push(`A prova ficou com ${questoes.length} de ${pedido.quantidade} questões. Use “+ Questão” no rodapé para completar.`);
  const prova = {
    id: uid(),
    titulo: `Avaliação de ${pedido.materia} — ${pedido.tema.split(/[:.\n]/)[0].slice(0, 60)}`,
    materia: pedido.materia, serie: pedido.serie, turma: pedido.turma, tema: pedido.tema,
    dificuldade: pedido.dificuldade, data: new Date().toLocaleDateString('pt-BR'),
    instrucoes: cfg.escola.instrucoes || '',
    temAdaptada: pedido.adaptada, pedido, questoes, criadaEm: Date.now(),
  };
  salvarProva(prova);
  return { prova, recados };
}

/** Vai precisar da IA para este pedido? (decide se mostra a tela "Preparando") */
function precisaIA(pedido) {
  const cfg = getConfig();
  if (pedido.modo === 'banco' || !iaDisponivel(cfg)) return false;
  return pedido.modo === 'ia' || Boolean(pedido.materialId) || escolherDoBanco(getBanco(), pedido, pedido.quantidade).length < pedido.quantidade;
}

async function criarProva(pedido) {
  const cfg = getConfig();
  let tela = null;
  const etapas = [pedido.modo === 'ia' ? 'Preparando o pedido' : 'Procurando no seu banco', 'Criando as questões novas'];
  if (cfg.ia.revisora) etapas.push('Conferindo as respostas');
  if (pedido.figuras) etapas.push('Criando e conferindo as figuras');
  etapas.push('Montando a prova e a versão adaptada');
  const passo = { criar: 1, conferir: etapas.indexOf('Conferindo as respostas'), figuras: etapas.indexOf('Criando e conferindo as figuras'), montar: etapas.length - 1 };
  if (precisaIA(pedido)) { tela = telaCriando(etapas); tela.etapa(0); }
  let r;
  try {
    r = await montarProva(pedido, tela?.signal, (k) => tela?.etapa(passo[k]));
  } catch (e) {
    tela?.fechar();
    if (e.name === 'AbortError') { aviso('Criação cancelada. Suas escolhas foram mantidas.'); return false; }
    throw e;
  }
  tela?.fechar();
  if (!r.prova) {
    abrirGaveta('Não encontrei questões', `<p>${esc(r.recados[0] || 'Seu banco ainda não tem questões desse conteúdo para essa série.')}</p>
      <p>Você pode:</p><ul><li>escrever o conteúdo de outro jeito;</li><li>escolher outra série;</li><li>${iaDisponivel(cfg) ? 'escolher “Meu banco + questões novas” no último passo.' : 'adicionar questões no Banco.'}</li></ul>
      <button class="botao principal cheio" data-fechar-ok>Entendi</button>`, (c) => { c.querySelector('[data-fechar-ok]').onclick = fecharGaveta; });
    return false;
  }
  sessionStorage.setItem('pf.recados', JSON.stringify(r.recados));
  sessionStorage.setItem('pf.celebrar', '1');
  location.hash = `#/prova/${r.prova.id}`;
  return true;
}

/* =================== CRIAR VÁRIAS PROVAS (LOTE) ===================
   Cada linha vira uma prova (matéria, ano, conteúdo, turma). O formato vale
   para todas. A criação roda uma prova por vez, com o andamento de cada uma. */
let lote = null;
function novoLote() {
  let ultimo = {};
  try { ultimo = JSON.parse(localStorage.getItem('pf.ultimoPedido')) || {}; } catch {}
  const base = novoRascunho();
  const linha = () => ({ materia: ultimo.materia || 'Matemática', serie: ultimo.serie || '5º ano', tema: '', turma: '' });
  return {
    linhas: [linha(), linha()],
    dificuldade: base.dificuldade, quantidade: base.quantidade, tipos: base.tipos,
    adaptada: base.adaptada, figuras: base.figuras, modo: base.modo,
  };
}

function telaLote() {
  titulo('Criar várias provas');
  if (!lote) lote = novoLote();
  const L = lote;
  const temIA = iaDisponivel(getConfig());
  const opcoesSel = (lista, atual) => lista.map((v) => `<option ${v === atual ? 'selected' : ''}>${esc(v)}</option>`).join('');
  main.innerHTML = `
    <div class="topo-criar"><button type="button" class="botao fantasma pequeno" data-ir-modo="uma">${ic('voltar', 'p')} Uma prova só</button></div>
    <h1>Várias provas</h1>
    <p class="sub">Uma prova por cartão. O formato vale para todas.</p>
    <form id="form-lote" novalidate>
      <ol class="lote-lista">${L.linhas.map((l, k) => `<li class="lote-item" data-k="${k}">
        <div class="lote-topo"><strong>Prova ${k + 1}</strong>
          ${L.linhas.length > 1 ? `<button type="button" class="alt-remover lote-remover" data-remover="${k}" aria-label="Remover prova ${k + 1}">${ic('fechar')}</button>` : ''}</div>
        <div class="duas-colunas lote-colunas">
          <div class="campo"><label for="l-mat-${k}">Matéria</label><select id="l-mat-${k}" data-campo="materia">${opcoesSel(todasMaterias(), l.materia)}<option value="${OUTRA}" ${l.materia === OUTRA ? 'selected' : ''}>+ Outra…</option></select></div>
          <div class="campo"><label for="l-ser-${k}">Ano / série</label><select id="l-ser-${k}" data-campo="serie">${opcoesSel(SERIES, l.serie)}</select></div>
        </div>
        ${l.materia === OUTRA ? `<div class="campo"><label for="l-outra-${k}">Nome da matéria</label>
          <input type="text" id="l-outra-${k}" data-campo="materiaOutra" value="${esc(l.materiaOutra || '')}" placeholder="Ex.: Filosofia" autocomplete="off" />
          <div class="erro-campo erro-outra" hidden>${ic('alerta', 'p')} Escreva o nome da matéria.</div></div>` : ''}
        <div class="campo"><label for="l-tema-${k}">Conteúdo</label>
          <input type="text" id="l-tema-${k}" data-campo="tema" value="${esc(l.tema)}" placeholder="Ex.: frações: comparar e somar" autocomplete="off" />
          <div class="erro-campo erro-tema" hidden>${ic('alerta', 'p')} Escreva o conteúdo desta prova.</div></div>
        <div class="campo"><label for="l-turma-${k}">Turma <span class="opcional">(opcional)</span></label>
          <input type="text" id="l-turma-${k}" data-campo="turma" value="${esc(l.turma)}" placeholder="Ex.: 5º ano A" autocomplete="off" /></div>
      </li>`).join('')}</ol>
      <button type="button" class="alt-adicionar lote-adicionar" id="b-lote-mais">${ic('mais', 'p')} Adicionar prova</button>

      <div class="cabeca-secao">Formato para todas</div>
      <div class="cartao-form">
        <fieldset style="border:0;padding:0;margin:0 0 20px"><legend class="rotulo">Dificuldade</legend>${fichas('dificuldade', Object.entries(DIFICULDADES), L.dificuldade)}</fieldset>
        <div class="campo"><span class="rotulo" id="lq-rot">Questões em cada prova</span>
          <div class="contador" role="group" aria-labelledby="lq-rot">
            <button type="button" class="botao" data-passo="-1" aria-label="Uma questão a menos">−</button>
            <output id="lq" aria-live="polite">${L.quantidade}</output>
            <button type="button" class="botao" data-passo="1" aria-label="Uma questão a mais">+</button>
          </div></div>
        <fieldset style="border:0;padding:0;margin:0"><legend class="rotulo">Tipos de questão</legend>${fichas('tipos', Object.entries(TIPOS).map(([v, r]) => [v, r.split(' (')[0]]), L.tipos, 'checkbox')}</fieldset>
        <div class="erro-campo" id="lote-tipos-erro" hidden>${ic('alerta', 'p')} Marque pelo menos um tipo.</div>
      </div>
      <label class="alternar" style="margin-bottom:16px"><input type="checkbox" name="adaptada" ${L.adaptada ? 'checked' : ''}/>
        <span><strong>Criar também as versões adaptadas</strong></span></label>
      ${temIA && listarMateriais().length ? `<div class="cartao-form"><div class="campo" style="margin:0"><label for="l-material">Livro ou apostila de base <span class="opcional">(opcional)</span></label>
        <select id="l-material" name="materialId"><option value="">Nenhum</option>${listarMateriais().map((m) => `<option value="${m.id}" ${m.id === L.materialId ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></div></div>` : ''}
      <div class="cartao-form">
        <fieldset style="border:0;padding:0;margin:0"><legend class="rotulo">De onde vêm as questões</legend>${fichas('modo', [['misto', 'Banco + novas'], ['banco', 'Só do banco'], ['ia', 'Só novas']].filter(([v]) => temIA || v === 'banco'), L.modo)}</fieldset>
      </div>
    </form>
    <div class="barra-acoes">
      <button type="button" class="botao" id="b-lote-cancelar">Cancelar</button>
      <button type="button" class="botao principal grande" id="b-lote-criar">Criar ${plural(L.linhas.length, 'prova', 'provas')}</button>
    </div>`;

  const form = main.querySelector('#form-lote');
  const ler = () => {
    form.querySelectorAll('.lote-item').forEach((li) => {
      const l = L.linhas[Number(li.dataset.k)];
      li.querySelectorAll('[data-campo]').forEach((c) => { l[c.dataset.campo] = c.value.trim(); });
      if (l.tema) li.querySelector('.erro-tema').hidden = true;
      if (l.materiaOutra && li.querySelector('.erro-outra')) li.querySelector('.erro-outra').hidden = true;
    });
    const fd = new FormData(form);
    L.dificuldade = fd.get('dificuldade'); L.tipos = fd.getAll('tipos'); L.adaptada = fd.get('adaptada') === 'on'; L.modo = fd.get('modo') || 'banco'; L.materialId = fd.get('materialId') || '';
  };
  form.addEventListener('input', ler);
  form.addEventListener('change', (e) => {
    ler();
    // Escolheu "Outra…" ou saiu dela: redesenha para mostrar/esconder o campo do nome
    if (e.target.dataset.campo === 'materia' && (e.target.value === OUTRA) !== Boolean(e.target.closest('.lote-item').querySelector('[data-campo=materiaOutra]'))) {
      const k = e.target.closest('.lote-item').dataset.k; telaLote(); main.querySelector(`#l-outra-${k}`)?.focus();
    }
  });
  form.querySelectorAll('[data-passo]').forEach((b) => (b.onclick = () => { L.quantidade = Math.min(20, Math.max(1, L.quantidade + Number(b.dataset.passo))); form.querySelector('#lq').textContent = L.quantidade; }));
  form.querySelectorAll('[data-remover]').forEach((b) => (b.onclick = () => {
    ler(); const k = Number(b.dataset.remover); const [tirada] = L.linhas.splice(k, 1); telaLote();
    aviso(`Prova ${k + 1} removida.`, { rotulo: 'Desfazer', fn: () => { if (lote !== L) return; L.linhas.splice(k, 0, tirada); if (location.hash === '#/lote') telaLote(); } });
  }));
  main.querySelector('#b-lote-mais').onclick = () => {
    ler(); const ult = L.linhas[L.linhas.length - 1];
    L.linhas.push({ materia: ult.materia, serie: ult.serie, tema: '', turma: '' });
    telaLote(); main.querySelector(`#l-tema-${L.linhas.length - 1}`)?.focus();
  };
  main.querySelector('[data-ir-modo=uma]').onclick = () => {
    ler();
    // Leva a turma do 1º cartão para o assistente de uma prova
    const l = L.linhas[0];
    rascunho = rascunho || novoRascunho();
    if (rascunho.passo === 1 && l.materia !== OUTRA) Object.assign(rascunho, { materia: l.materia, serie: l.serie, turma: l.turma, tema: rascunho.tema || l.tema });
    location.hash = '#/nova';
  };
  main.querySelector('#b-lote-cancelar').onclick = () => { lote = null; location.hash = '#/'; };
  const bCriar = main.querySelector('#b-lote-criar');
  bCriar.onclick = async () => {
    if (bCriar.disabled) return;
    ler();
    const itens = [...form.querySelectorAll('.lote-item')];
    const semNome = itens.filter((li) => { const l = L.linhas[Number(li.dataset.k)]; return l.materia === OUTRA && !l.materiaOutra; });
    semNome.forEach((li) => (li.querySelector('.erro-outra').hidden = false));
    const vazias = itens.filter((li) => !L.linhas[Number(li.dataset.k)].tema);
    vazias.forEach((li) => (li.querySelector('.erro-tema').hidden = false));
    const primeiro = semNome[0]?.querySelector('[data-campo=materiaOutra]') || vazias[0]?.querySelector('[data-campo=tema]');
    if (primeiro) { primeiro.focus(); return; }
    if (!L.tipos.length) { const er = form.querySelector('#lote-tipos-erro'); er.hidden = false; er.scrollIntoView({ block: 'center' }); return; }
    L.linhas.forEach((l) => { if (l.materia === OUTRA) { l.materia = guardarMateria(l.materiaOutra); l.materiaOutra = ''; } });
    bCriar.disabled = true; // evita criar o lote duas vezes com toque duplo
    try { await criarLote(L); } finally { bCriar.disabled = false; }
  };
}

async function criarLote(L) {
  const pedidos = L.linhas.map((l) => ({
    materia: l.materia, serie: l.serie, turma: l.turma, tema: l.tema, observacoes: '',
    dificuldade: L.dificuldade, quantidade: L.quantidade, tipos: L.tipos, adaptada: L.adaptada, figuras: L.figuras, modo: L.modo, materialId: L.materialId || '',
  }));
  const nomes = pedidos.map((p) => `${p.materia} · ${p.tema.split(/[:.\n]/)[0].slice(0, 40)}`);
  const tela = telaCriando(nomes);
  tela.titulo(`Criando ${plural(pedidos.length, 'prova', 'provas')}`, 'Uma de cada vez. Pode deixar esta tela aberta.', pedidos.some(precisaIA));
  const criadas = [], falhas = [];
  let cancelado = false;
  for (let k = 0; k < pedidos.length; k++) {
    tela.etapa(k);
    try {
      const r = await montarProva(pedidos[k], tela.signal);
      if (r.prova) criadas.push(r.prova); else falhas.push({ nome: nomes[k], motivo: r.recados[0] || 'Não encontrei questões desse conteúdo.' });
    } catch (e) {
      if (e.name === 'AbortError') { cancelado = true; break; }
      console.error(e); falhas.push({ nome: nomes[k], motivo: 'Erro inesperado ao montar esta prova.' });
    }
  }
  tela.etapa(pedidos.length);
  tela.fechar();
  const listaFalhas = () => `<ul class="menu-lista">${falhas.map((f) => `<li><button type="button">${ic('alerta')}<span>${esc(f.nome)}<small>${esc(f.motivo)}</small></span></button></li>`).join('')}</ul>`;
  if (!criadas.length) {
    if (cancelado || !falhas.length) { aviso('Criação cancelada. Seus cartões foram mantidos.'); return; }
    abrirGaveta('Nenhuma prova foi criada', `${listaFalhas()}<button class="botao principal cheio" data-ok style="margin-top:12px">Entendi</button>`, (g) => { g.querySelector('[data-ok]').onclick = fecharGaveta; });
    return;
  }
  lote = null;
  location.hash = '#/provas';
  setTimeout(() => {
    if (cancelado) { aviso(`Criação cancelada. ${plural(criadas.length, 'prova já estava pronta e foi salva', 'provas já estavam prontas e foram salvas')}.`); return; }
    celebrar(`${plural(criadas.length, 'prova pronta', 'provas prontas')}!`);
    const curtas = criadas.filter((p) => p.questoes.length < L.quantidade).length;
    if (curtas && !falhas.length) aviso(`${plural(curtas, 'prova ficou', 'provas ficaram')} com menos de ${L.quantidade} questões. Abra para completar.`);
    if (falhas.length) abrirGaveta('Algumas provas não saíram', `${listaFalhas()}
      <p class="dica" style="margin-top:12px">As outras ${plural(criadas.length, 'prova foi criada', 'provas foram criadas')} normalmente.</p>
      <button class="botao principal cheio" data-ok>Entendi</button>`, (c) => { c.querySelector('[data-ok]').onclick = fecharGaveta; });
  }, 450);
}

/* =================== FIGURAS DAS QUESTÕES =================== */
const RE_ALERTA_FIGURA = /^(A figura|A questão fala de uma figura|Não foi possível criar a figura)/;

/** Gera uma ilustração e confere; tenta de novo uma vez se a conferência apontar erro. */
async function criarFiguraConferida(cfg, descricao, signal) {
  let resultado = null;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const img = await rasterizar(await gerarIlustracao(cfg, descricao, signal));
    const conf = cfg.ia.revisora ? await conferirFigura(cfg, img.src, descricao, signal) : { confere: true, problema: '' };
    resultado = { img, conf };
    if (conf.confere) break;
  }
  return resultado;
}

/**
 * Transforma o pedido de figura de cada questão (q.figura) em imagem guardada (q.imagem).
 * diagrama → SVG exato; ilustracao/recriar → gerada por IA; original → baixada da fonte.
 * Toda figura gerada passa pela conferência visual.
 */
async function prepararFiguras(cfg, questoes, signal) {
  await Promise.all(questoes.filter((q) => q.figura).map(async (q) => {
    const f = q.figura;
    delete q.figura;
    const extras = [];
    try {
      let img = null;
      let conf = null;
      let tipo = f.tipo;
      let credito = '';
      if (tipo === 'original') {
        try {
          img = await rasterizar(await baixarImagemInternet(f.url_imagem, signal));
          tipo = 'internet';
          credito = `Imagem: ${q.fonte?.nome || 'fonte original'}`;
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          tipo = 'recriar'; // não deu para baixar: redesenha a partir da descrição
        }
      }
      if (tipo === 'diagrama') {
        img = await rasterizar(svgSeguro(f.svg), { formato: 'image/png', max: 1000 });
        if (cfg.ia.revisora) conf = await conferirFigura(cfg, img.src, f.descricao, signal);
      }
      if (tipo === 'ilustracao' || tipo === 'recriar') {
        if (!f.descricao) throw new Error('Figura sem descrição.');
        ({ img, conf } = await criarFiguraConferida(cfg, f.descricao, signal));
      }
      if (img) {
        const reg = await guardarImagem(img);
        q.imagem = { id: reg.id, tipo: tipo === 'recriar' ? 'recriada' : tipo, descricao: f.descricao || '', credito };
        if (conf && !conf.confere) extras.push({ nivel: 'erro', msg: `A figura pode estar errada: ${conf.problema || 'confira com atenção.'}` });
        if (tipo === 'recriar') extras.push({ nivel: 'aviso', msg: 'A figura foi redesenhada pela IA a partir da original. Compare com a fonte.' });
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      console.warn('Figura não criada', e);
      extras.push({ nivel: 'erro', msg: 'Não foi possível criar a figura desta questão. Adicione uma imagem pelo menu ⋯ ou troque a questão.' });
    }
    q.alertas = [...(q.alertas || []).filter((a) => !RE_ALERTA_FIGURA.test(a.msg)), ...extras];
    if (!q.imagem) q.alertas = [...q.alertas, ...validarQuestao(q).filter((a) => RE_ALERTA_FIGURA.test(a.msg))];
  }));
}

function figuraHTML(q) {
  const reg = obterImagem(q.imagem?.id);
  if (!reg) return '';
  return `<figure class="q-figura"><img src="${reg.src}" alt="${esc(q.imagem.descricao || 'Figura da questão')}" />${q.imagem.credito ? `<figcaption>${esc(q.imagem.credito)}</figcaption>` : ''}</figure>`;
}

function seloFigura(q) {
  if (!q.imagem || q.revisada) return '';
  if (['ilustracao', 'recriada', 'diagrama'].includes(q.imagem.tipo)) return '<span class="selo ia">Figura gerada · confira</span>';
  return '';
}

function escolherArquivoImagem() {
  return new Promise((ok) => {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
    inp.onchange = () => ok(inp.files[0] || null);
    inp.click();
  });
}

function menuImagem(i) {
  const q = estado.prova.questoes[i];
  const cfg = getConfig();
  const podeGerar = iaDisponivel(cfg) && cfg.ia.provedor !== 'claude';
  abrirGaveta(q.imagem ? 'Imagem da questão' : 'Adicionar imagem', menu([
    { op: 'arquivo', icone: 'imagem', rotulo: q.imagem ? 'Trocar por foto ou imagem' : 'Escolher foto ou imagem', dica: 'Da galeria, da câmera ou do computador' },
    ...(podeGerar ? [{ op: 'gerar', icone: 'brilho', rotulo: 'Criar figura com IA', dica: 'Você descreve e a IA desenha e confere' }] : []),
    ...(q.imagem ? ['-', { op: 'remover', icone: 'lixo', rotulo: 'Remover imagem', perigo: true }] : []),
  ]), (c) => c.addEventListener('click', async (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op;
    if (!op) return;
    if (op === 'gerar') return formFiguraIA(i);
    fecharGaveta();
    if (op === 'arquivo') {
      const arq = await escolherArquivoImagem();
      if (!arq) return;
      try {
        const reg = await guardarImagem(await rasterizar(arq));
        q.imagem = { id: reg.id, tipo: 'professora', descricao: q.imagem?.descricao || '', credito: '' };
        q.alertas = (q.alertas || []).filter((a) => !RE_ALERTA_FIGURA.test(a.msg));
        salvarDepois(); desenharFolha(); atualizarAlertas(i);
        aviso('Imagem adicionada.');
      } catch (err) { aviso(err.message); }
    }
    if (op === 'remover') {
      const antes = q.imagem;
      delete q.imagem;
      q.alertas = (q.alertas || []).filter((a) => !RE_ALERTA_FIGURA.test(a.msg));
      salvarDepois(); desenharFolha(); atualizarAlertas(i);
      aviso('Imagem removida.', { rotulo: 'Desfazer', fn: () => { q.imagem = antes; salvarDepois(); desenharFolha(); atualizarAlertas(i); } });
    }
  }));
}

function formFiguraIA(i) {
  const q = estado.prova.questoes[i];
  const cfg = getConfig();
  abrirGaveta('Criar figura com IA', `<form novalidate><div class="cartao-form"><div class="campo"><label for="desc-fig">O que a figura deve mostrar?</label>
      <span class="dica">Seja específico com quantidades e cores. Ex.: “uma pizza dividida em 8 fatias iguais, 3 pintadas de amarelo”.</span>
      <textarea id="desc-fig" style="min-height:110px">${esc(q.imagem?.descricao || '')}</textarea>
      <div class="erro-campo" id="desc-erro" hidden>${ic('alerta', 'p')} Descreva a figura.</div></div></div>
    <p class="dica">Depois de pronta, a figura é conferida automaticamente.</p>
    <button class="botao principal grande cheio">${ic('brilho', 'p')} Criar figura</button></form>`, (c) => {
    const t = c.querySelector('#desc-fig');
    t.focus();
    c.querySelector('form').onsubmit = async (ev) => {
      ev.preventDefault();
      const descricao = t.value.trim();
      if (!descricao) { c.querySelector('#desc-erro').hidden = false; t.focus(); return; }
      fecharGaveta();
      const tela = telaCriando(['A IA está desenhando e conferindo a figura']);
      tela.etapa(0);
      try {
        const { img, conf } = await criarFiguraConferida(cfg, descricao, tela.signal);
        const reg = await guardarImagem(img);
        q.imagem = { id: reg.id, tipo: 'ilustracao', descricao, credito: '' };
        q.revisada = false;
        q.alertas = (q.alertas || []).filter((a) => !RE_ALERTA_FIGURA.test(a.msg));
        if (conf && !conf.confere) q.alertas.push({ nivel: 'erro', msg: `A figura pode estar errada: ${conf.problema || 'confira com atenção.'}` });
        salvarDepois(); desenharFolha();
        aviso(conf && !conf.confere ? 'Figura criada, mas com possível erro. Confira.' : 'Figura criada e conferida.');
      } catch (err) {
        if (err.name !== 'AbortError') aviso(err instanceof ErroIA ? err.message : 'Não foi possível criar a figura agora.');
      } finally { tela.fechar(); }
    };
  });
}

/* =================== EDITOR DA PROVA =================== */
let estado = { prova: null, aba: 'normal' };
let timerSalvar;

function salvarDepois() {
  clearTimeout(timerSalvar);
  const el = document.getElementById('status-salvo');
  if (el) el.textContent = 'Salvando…';
  timerSalvar = setTimeout(() => {
    try { salvarProva(estado.prova); if (el) el.textContent = 'Salvo'; } catch (e) { aviso(e.message); }
  }, 500);
}

function telaProva(id) {
  const prova = getProva(id);
  if (!prova) {
    main.innerHTML = `<div class="vazio">${ic('doc')}<strong>Prova não encontrada</strong>Ela pode ter sido apagada.<div class="acoes" style="justify-content:center"><a class="botao principal" href="#/provas">Ver minhas provas</a></div></div>`;
    return;
  }
  estado = { prova, aba: estado.prova?.id === id ? estado.aba : 'normal' };
  titulo(prova.titulo);
  main.innerHTML = `
    <div class="editor-topo nao-imprimir">
      <a class="voltar" href="#/provas">${ic('voltar')} Provas</a>
      <div class="titulo-ed"><strong id="titulo-texto">${esc(prova.titulo)}</strong><span id="status-salvo" class="salvo" role="status">Salvo</span></div>
      <button class="botao fantasma icone" id="b-opcoes" aria-label="Mais opções da prova">${ic('pontos')}</button>
    </div>
    <div class="segmentos nao-imprimir" role="tablist" aria-label="Versões da prova">
      <button role="tab" data-aba="normal">Prova</button>
      <button role="tab" data-aba="adaptada">Adaptada</button>
      <button role="tab" data-aba="gabarito">Gabarito</button>
    </div>
    <div class="linha-estado nao-imprimir">
      <div id="painel-revisao"></div>
      <label class="data-chip" title="Data da prova">${ic('calendario', 'p')}<span class="visualmente-oculto">Data da prova</span>
        <input type="date" id="data-prova" value="${dataParaInput(prova.data)}" /></label>
    </div>
    <div id="faixa-versao" class="nao-imprimir"></div>
    <div id="recados" class="nao-imprimir"></div>
    <div role="tabpanel"><div id="folha" class="folha"></div></div>
    <div class="barra-acoes nao-imprimir">
      <button class="botao encolhe" id="b-add">${ic('mais', 'p')} Questão</button>
      <button class="botao encolhe" id="b-word">${ic('baixar', 'p')} Word</button>
      <button class="botao principal" id="b-imprimir">${ic('imprimir', 'p')} Imprimir</button>
    </div>`;

  const recados = JSON.parse(sessionStorage.getItem('pf.recados') || '[]');
  sessionStorage.removeItem('pf.recados');
  if (recados.length) main.querySelector('#recados').innerHTML = `<div class="aviso-bloco alerta" role="status">${recados.map((t) => `<p>${esc(t)}</p>`).join('')}</div>`.replace('class="aviso-bloco alerta" role="status">', `class="aviso-bloco alerta" role="status">${ic('alerta')}<div>`).replace(/<\/div>$/, '</div></div>');

  main.querySelectorAll('.segmentos button').forEach((b) => (b.onclick = () => { if (estado.aba === b.dataset.aba) return; estado.aba = b.dataset.aba; transicao(desenharFolha, 'segmento'); }));
  main.querySelector('#b-imprimir').onclick = imprimir;
  main.querySelector('#b-word').onclick = baixarVersaoWord;
  main.querySelector('#b-add').onclick = menuAdicionar;
  main.querySelector('#b-opcoes').onclick = menuProva;

  const folha = main.querySelector('#folha');
  folha.addEventListener('input', aoEditar);
  folha.addEventListener('focusout', (e) => {
    const qEl = e.target.closest('.q[data-i]');
    if (qEl && e.target.isContentEditable) atualizarAlertas(Number(qEl.dataset.i));
  });
  folha.addEventListener('click', aoClicarFolha);
  folha.addEventListener('change', aoMudarFolha);
  // Data da prova: nem sempre é o dia em que a prova foi criada.
  // A linha inteira abre o calendário do aparelho (um ícone só, o da esquerda).
  main.querySelector('.data-chip').addEventListener('click', (e) => {
    const inp = main.querySelector('#data-prova');
    if (e.target !== inp) { e.preventDefault(); try { inp.showPicker(); } catch { inp.focus(); } }
  });
  main.querySelector('#data-prova').addEventListener('change', (e) => {
    const [a, m, d] = e.target.value.split('-');
    estado.prova.data = e.target.value ? `${d}/${m}/${a}` : '';
    salvarDepois(); desenharFolha();
  });
  // O que a versão adaptada inclui (a professora liga e desliga cada parte)
  main.querySelector('#faixa-versao').addEventListener('change', (e) => {
    const chave = e.target.dataset.adaptada;
    if (!chave) return;
    estado.prova.adaptadaCfg = { ...cfgAdaptada(estado.prova), [chave]: e.target.checked };
    salvarDepois(); desenharFolha();
  });
  desenharFolha();
  if (sessionStorage.getItem('pf.celebrar')) { sessionStorage.removeItem('pf.celebrar'); setTimeout(() => celebrar('Prova pronta!'), 350); }
}

/** "13/11/2026" → "2026-11-13" (para o seletor de data). */
function dataParaInput(t = '') {
  const m = String(t).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** Comemoração curta quando a prova fica pronta: selo, confete e vibração.
 *  Com "reduzir movimento", vira só um aviso. */
function celebrar(texto) {
  vibrar([12, 40, 18]);
  if (menosMovimento()) { aviso(texto); return; }
  const cores = ['#ffc93c', '#34c759', '#0a84ff', '#ff9f0a', '#ff375f', '#bf5af2'];
  const el = document.createElement('div');
  el.className = 'celebra nao-imprimir';
  el.setAttribute('role', 'status');
  el.innerHTML = `<div class="celebra-centro"><span class="celebra-selo">${ic('certo')}</span><strong>${esc(texto)}</strong>
    ${Array.from({ length: 16 }, (_, i) => `<i style="--a:${i * 22.5}deg;--c:${cores[i % cores.length]};--d:${80 + (i % 3) * 26}px"></i>`).join('')}</div>`;
  document.body.append(el);
  setTimeout(() => el.remove(), 1700);
}

async function baixarVersaoWord() {
  try { const nome = await baixarWord(estado.prova, getConfig().escola, estado.aba); aviso(`“${nome}” baixado. Abra no Word para editar.`); }
  catch (e) { console.error(e); aviso('Não foi possível gerar o arquivo do Word.'); }
}

function menuProva() {
  const p = estado.prova;
  abrirGaveta('Opções da prova', menu([
    { op: 'renomear', icone: 'editar', rotulo: 'Mudar o nome da prova' },
    { op: 'instrucoes', icone: 'tipo', rotulo: 'Editar instruções', dica: 'Tempo de prova, caneta, consulta…' },
    { op: 'embaralhar', icone: 'embaralhar', rotulo: 'Embaralhar alternativas', dica: 'O gabarito é atualizado sozinho' },
    { op: 'copia', icone: 'copiar', rotulo: 'Fazer uma cópia', dica: 'Útil para outra turma' },
    '-',
    { op: 'apagar', icone: 'lixo', rotulo: 'Apagar esta prova', perigo: true },
  ]), (c) => c.addEventListener('click', (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op;
    if (op === 'renomear') {
      abrirGaveta('Nome da prova', `<form id="f-nome"><div class="campo"><label for="novo-nome">Nome</label><input type="text" id="novo-nome" value="${esc(p.titulo)}" /></div>
        <button class="botao principal cheio">Salvar nome</button></form>`, (c2) => {
        const inp = c2.querySelector('#novo-nome'); inp.focus(); inp.select();
        c2.querySelector('form').onsubmit = (ev) => {
          ev.preventDefault(); p.titulo = inp.value.trim() || p.titulo; salvarDepois(); fecharGaveta();
          document.getElementById('titulo-texto').textContent = p.titulo; desenharFolha();
        };
      });
    }
    if (op === 'instrucoes') {
      abrirGaveta('Instruções da prova', `<form id="f-instr"><div class="cartao-form">
          <div class="campo"><label for="txt-instr">Instruções</label>
            <span class="dica">Aparecem logo abaixo do cabeçalho. Uma instrução por linha.</span>
            <textarea id="txt-instr" style="min-height:150px">${esc(p.instrucoes || '')}</textarea></div></div>
        <label class="alternar" style="margin-bottom:16px"><input type="checkbox" id="instr-padrao" />
          <span><strong>Usar nas próximas provas</strong><small>Salva estas instruções como padrão.</small></span></label>
        <button class="botao principal grande cheio">Salvar instruções</button></form>`, (c2) => {
        const txt = c2.querySelector('#txt-instr'); txt.focus();
        c2.querySelector('form').onsubmit = (ev) => {
          ev.preventDefault();
          p.instrucoes = txt.value.replace(/\r/g, '').trim();
          if (c2.querySelector('#instr-padrao').checked) {
            const cfg = getConfig(); salvarConfig({ ...cfg, escola: { ...cfg.escola, instrucoes: p.instrucoes } });
          }
          salvarDepois(); fecharGaveta(); desenharFolha(); aviso('Instruções atualizadas.');
        };
      });
    }
    if (op === 'embaralhar') { p.questoes.forEach(embaralharAlternativas); salvarDepois(); desenharFolha(); fecharGaveta(); aviso('Alternativas embaralhadas. Gabarito atualizado.'); }
    if (op === 'copia') {
      const c3 = structuredClone(p); c3.id = uid(); c3.titulo += ' (cópia)'; salvarProva(c3);
      fecharGaveta(); location.hash = `#/prova/${c3.id}`; aviso('Cópia criada. Você está editando a cópia.');
    }
    if (op === 'apagar') {
      fecharGaveta(); apagarProva(p.id); location.hash = '#/provas';
      aviso(`Prova apagada.`, { rotulo: 'Desfazer', fn: () => { salvarProva(p); location.hash = `#/prova/${p.id}`; } });
    }
  }));
}

function menuAdicionar() {
  const temIA = iaDisponivel(getConfig());
  abrirGaveta('Adicionar questão', menu([
    { op: 'banco', icone: 'banco', rotulo: 'Escolher do meu banco', dica: 'Funciona sem internet' },
    ...(temIA ? [{ op: 'ia', icone: 'lapis', rotulo: 'Criar uma questão nova', dica: 'Sobre o mesmo conteúdo da prova' }] : []),
    { op: 'branco', icone: 'editar', rotulo: 'Escrever uma questão', dica: 'Começa em branco' },
  ]), (c) => c.addEventListener('click', (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op;
    if (op === 'banco') escolherDoBancoGaveta();
    if (op === 'ia') { fecharGaveta(); novaQuestaoIA(); }
    if (op === 'branco') {
      fecharGaveta();
      estado.aba = 'normal';
      estado.prova.questoes.push(prepararParaProva({ tipo: 'aberta', enunciado: 'Escreva aqui a pergunta.', alternativas: [], correta: -1, resposta: '', origem: 'minha' }, estado.prova));
      salvarDepois(); desenharFolha();
      const todos = main.querySelectorAll('.q [data-campo=enunciado]');
      const ult = todos[todos.length - 1];
      ult?.scrollIntoView({ block: 'center' }); ult?.focus();
      aviso('Questão em branco no fim da prova. Toque no texto para escrever.');
    }
  }));
}

function escolherDoBancoGaveta() {
  const p = estado.prova;
  abrirGaveta(`Banco · ${p.materia}`, `<div class="busca campo">${ic('busca')}<label class="sr" for="busca-g">Procurar</label><input type="search" id="busca-g" placeholder="Procurar: frações" /></div><ul class="lista-cartoes" id="lista-g"></ul>`, (c) => {
    const desenhar = (busca = '') => {
      const nb = normalizar(busca);
      const lista = getBanco().filter((q) => q.materia === p.materia)
        .filter((q) => !nb || normalizar(`${q.tema} ${q.enunciado}`).includes(nb))
        .filter((q) => !p.questoes.some((x) => normalizar(x.enunciado) === normalizar(q.enunciado)))
        .sort((a, b) => {
          const dist = (q) => Math.abs(SERIES.indexOf(q.serie) - SERIES.indexOf(p.serie));
          return dist(a) - dist(b) || (CONFIANCA[b.origem] || 0) - (CONFIANCA[a.origem] || 0);
        }).slice(0, 40);
      c.querySelector('#lista-g').innerHTML = lista.length ? lista.map((q) => `<li class="questao-banco">
        <div class="meta">${esc(q.serie)} · ${esc(q.tema)} · ${TIPOS[q.tipo].split(' (')[0]} ${seloOrigem(q)}</div>
        <p class="enun">${md(q.enunciado)}</p><button class="botao principal pequeno" data-id="${q.id}">${ic('mais', 'p')} Usar esta</button></li>`).join('')
        : `<li class="vazio">${ic('busca')}<strong>Nada encontrado</strong>Tente outra palavra.</li>`;
    };
    desenhar();
    c.querySelector('#busca-g').oninput = (e) => desenhar(e.target.value);
    c.querySelector('#lista-g').onclick = (e) => {
      const id = e.target.closest('[data-id]')?.dataset.id;
      if (!id) return;
      p.questoes.push(prepararParaProva(getBanco().find((x) => x.id === id), p));
      salvarDepois(); desenharFolha(); fecharGaveta(); aviso('Questão adicionada no fim da prova.');
    };
  });
}

function menuQuestao(i) {
  const p = estado.prova;
  const q = p.questoes[i];
  abrirGaveta(`Questão ${i + 1}`, menu([
    { op: 'trocar', icone: 'trocar', rotulo: 'Trocar por outra', dica: 'Do banco ou uma questão nova' },
    { op: 'imagem', icone: 'imagem', rotulo: q.imagem ? 'Imagem da questão' : 'Adicionar imagem', dica: 'Foto, arquivo ou figura criada com IA' },
    { op: 'tipo', icone: 'tipo', rotulo: 'Mudar o tipo', dica: `Agora: ${TIPOS[q.tipo]}` },
    ...(q.tipo === 'multipla' || q.tipo === 'vf' ? [{ op: 'alt', icone: 'mais', rotulo: q.tipo === 'vf' ? 'Adicionar afirmação' : 'Adicionar alternativa' }] : []),
    ...(i > 0 ? [{ op: 'subir', icone: 'cima', rotulo: 'Mover para cima' }] : []),
    ...(i < p.questoes.length - 1 ? [{ op: 'descer', icone: 'baixo', rotulo: 'Mover para baixo' }] : []),
    '-',
    { op: 'apagar', icone: 'lixo', rotulo: 'Apagar questão', perigo: true },
  ]), (c) => c.addEventListener('click', (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op;
    if (!op) return;
    if (op === 'tipo') {
      abrirGaveta('Mudar o tipo', menu(Object.entries(TIPOS).map(([v, r]) => ({ op: v, icone: v === q.tipo ? 'certo' : 'tipo', rotulo: r, dica: EXEMPLO_TIPO[v] }))), (c2) =>
        c2.addEventListener('click', (ev) => { const t = ev.target.closest('[data-op]')?.dataset.op; if (t) { mudarTipo(q, t); fecharGaveta(); salvarDepois(); desenharFolha(); } }));
      return;
    }
    if (op === 'imagem') return menuImagem(i);
    fecharGaveta();
    if (op === 'trocar') return trocarQuestao(i);
    if (op === 'alt') { q.alternativas.push(q.tipo === 'vf' ? 'Nova afirmação' : 'Nova alternativa'); q.adaptada?.alternativas.push(q.tipo === 'vf' ? 'Nova afirmação' : 'Nova alternativa'); }
    if (op === 'subir') [p.questoes[i - 1], p.questoes[i]] = [p.questoes[i], p.questoes[i - 1]];
    if (op === 'descer') [p.questoes[i + 1], p.questoes[i]] = [p.questoes[i], p.questoes[i + 1]];
    if (op === 'apagar') {
      const [rem] = p.questoes.splice(i, 1);
      aviso(`Questão ${i + 1} apagada.`, { rotulo: 'Desfazer', fn: () => { p.questoes.splice(i, 0, rem); salvarDepois(); desenharFolha(); } });
    }
    salvarDepois(); desenharFolha();
  }));
}

function mudarTipo(q, tipo) {
  q.tipo = tipo;
  q.adaptada = q.adaptada || { enunciado: q.enunciado, alternativas: [], correta: -1, dica: '' };
  if (tipo === 'multipla' && q.alternativas.length < 2) { q.alternativas = ['Alternativa 1', 'Alternativa 2', 'Alternativa 3', 'Alternativa 4']; q.correta = 0; q.resposta = q.alternativas[0]; q.adaptada.alternativas = q.alternativas.slice(0, 3); q.adaptada.correta = 0; }
  if (tipo === 'vf' && q.alternativas.length < 2) { q.alternativas = ['Afirmação 1', 'Afirmação 2', 'Afirmação 3']; q.resposta = 'V, F, V'; q.adaptada.alternativas = [...q.alternativas]; }
  if (tipo === 'completar' && !/_{2,}/.test(q.enunciado)) q.enunciado += ' ____';
  if (tipo === 'aberta' || tipo === 'completar') { q.alternativas = []; q.correta = -1; q.adaptada.alternativas = []; q.adaptada.correta = -1; }
  if (tipo === 'vf') { q.correta = -1; q.adaptada.correta = -1; }
  q.alertas = validarQuestao(q);
}

function aoEditar(e) {
  const el = e.target;
  if (!el.isContentEditable) return;
  const p = estado.prova;
  if (el.dataset.cab) { p[el.dataset.cab] = htmlParaMd(el); return salvarDepois(); }
  const qEl = el.closest('.q[data-i]');
  if (!qEl) return;
  const q = p.questoes[Number(qEl.dataset.i)];
  const alvo = estado.aba === 'adaptada' ? q.adaptada : q;
  const campo = el.dataset.campo;
  if (campo === 'alt') alvo.alternativas[Number(el.dataset.j)] = htmlParaMd(el);
  else if (campo === 'resposta') q.resposta = htmlParaMd(el);
  else alvo[campo] = htmlParaMd(el);
  q.editadaPelaProfessora = true;
  salvarDepois();
}

function aoMudarFolha(e) {
  const qEl = e.target.closest('.q[data-i]');
  if (!qEl || !e.target.matches('select[data-campo=correta]')) return;
  const q = estado.prova.questoes[Number(qEl.dataset.i)];
  // No gabarito, a linha diz de qual versão é; fora dele, vale a aba aberta
  const versao = qEl.dataset.versao || (estado.aba === 'adaptada' ? 'adaptada' : 'normal');
  const alvo = versao === 'adaptada' ? q.adaptada : q;
  alvo.correta = Number(e.target.value);
  if (versao !== 'adaptada') q.resposta = q.alternativas[q.correta] || '';
  if (qEl.dataset.versao) { const t = qEl.querySelector('.so-imprimir'); if (t) t.textContent = textoGabarito(q, versao); }
  q.editadaPelaProfessora = true; // ela corrigiu: o alerta da IA revisora sai
  salvarDepois();
  atualizarAlertas(Number(qEl.dataset.i));
}

function aoClicarFolha(e) {
  const b = e.target.closest('button[data-acao]');
  if (!b) return;
  const i = Number(b.closest('.q[data-i]').dataset.i);
  const q = estado.prova.questoes[i];
  if (b.dataset.acao === 'mais') return menuQuestao(i);
  if (b.dataset.acao === 'add-alt') return adicionarAlternativa(i);
  if (b.dataset.acao === 'rem-alt') return removerAlternativa(i, Number(b.dataset.j));
  if (b.dataset.acao === 'conferi') {
    q.revisada = !q.revisada;
    if (q.revisada) { adicionarAoBanco([q], 'revisada'); aviso('Conferida! Ela agora é uma questão confiável do seu banco.'); }
    salvarDepois(); desenharFolha();
  }
}

/** Acrescenta uma alternativa/afirmação nas duas versões (normal e adaptada). */
function adicionarAlternativa(i) {
  const q = estado.prova.questoes[i];
  const nova = q.tipo === 'vf' ? 'Nova afirmação' : 'Nova alternativa';
  q.alternativas.push(nova);
  if (q.adaptada) q.adaptada.alternativas = [...(q.adaptada.alternativas || []), nova];
  if (q.tipo === 'vf') q.resposta = [...(q.resposta || '').split(',').map((s) => s.trim()).filter(Boolean), 'V'].join(', ');
  salvarDepois(); desenharFolha(); atualizarAlertas(i);
  const alts = document.querySelectorAll(`.q[data-i="${i}"] [data-campo=alt]`);
  alts[alts.length - 1]?.focus();
}

/** Remove uma alternativa só da versão que está na tela, corrigindo o gabarito. */
function removerAlternativa(i, j) {
  const q = estado.prova.questoes[i];
  const alvo = estado.aba === 'adaptada' ? q.adaptada : q;
  const minimo = q.tipo === 'multipla' ? 2 : 1;
  if (!alvo || (alvo.alternativas || []).length <= minimo) { aviso(`A questão precisa de pelo menos ${minimo} ${q.tipo === 'vf' ? 'afirmação' : 'alternativas'}.`); return; }
  const antes = JSON.stringify({ alts: alvo.alternativas, correta: alvo.correta, resposta: q.resposta });
  const [removida] = alvo.alternativas.splice(j, 1);
  let recado = q.tipo === 'vf' ? 'Afirmação removida.' : `Alternativa ${letra(j)} removida.`;
  if (q.tipo === 'multipla') {
    if (alvo.correta === j) { alvo.correta = 0; recado = 'Você removeu a alternativa certa. Escolha a nova em "Certa".'; }
    else if (alvo.correta > j) alvo.correta -= 1;
    if (alvo === q) q.resposta = q.alternativas[q.correta] || '';
  } else if (alvo === q) {
    const partes = (q.resposta || '').split(',').map((s) => s.trim());
    partes.splice(j, 1); q.resposta = partes.filter(Boolean).join(', ');
  }
  salvarDepois(); desenharFolha(); atualizarAlertas(i);
  aviso(recado, { rotulo: 'Desfazer', fn: () => { const a = JSON.parse(antes); alvo.alternativas = a.alts; alvo.correta = a.correta; if (alvo === q) q.resposta = a.resposta; salvarDepois(); desenharFolha(); atualizarAlertas(i); } });
  void removida;
}

async function trocarQuestao(i) {
  const p = estado.prova;
  const usados = p.questoes.map((q) => q.bancoId).filter(Boolean);
  const daBanco = escolherDoBanco(getBanco(), { ...p.pedido, tipos: p.pedido?.tipos || Object.keys(TIPOS) }, 1, usados)
    .filter((q) => !p.questoes.some((x) => normalizar(x.enunciado) === normalizar(q.enunciado)));
  if (daBanco.length) {
    p.questoes[i] = prepararParaProva(daBanco[0], p);
    salvarDepois(); desenharFolha(); aviso(`Questão ${i + 1} trocada por outra do banco.`);
    return;
  }
  if (iaDisponivel(getConfig())) return novaQuestaoIA(i);
  aviso('Não há outra questão desse conteúdo no banco. Edite esta ou escreva uma nova.');
}

async function novaQuestaoIA(posicao) {
  const p = estado.prova;
  const cfg = getConfig();
  const pedido = { ...p.pedido, tema: p.tema, materia: p.materia, serie: p.serie, dificuldade: p.dificuldade, tipos: p.pedido?.tipos || ['multipla'] };
  const etapas = ['Criando a questão'];
  if (cfg.ia.revisora) etapas.push('Conferindo a resposta');
  if (pedido.figuras) etapas.push('Preparando a figura, se houver');
  const tela = telaCriando(etapas);
  tela.etapa(0);
  try {
    const [nova] = await gerarQuestoes(cfg, pedido, 1, p.questoes.map((q) => q.enunciado.slice(0, 120)), tela.signal);
    if (!nova) throw new ErroIA('A IA não devolveu nenhuma questão.');
    const q = embaralharAlternativas(prepararParaProva(nova, p));
    if (cfg.ia.revisora) {
      tela.etapa(1);
      try { const [rev] = await revisarQuestoes(cfg, [q], tela.signal); q.alertas.push(...(rev || [])); } catch (e) { if (e.name === 'AbortError') throw e; }
    }
    if (q.figura) { tela.etapa(etapas.length - 1); await prepararFiguras(cfg, [q], tela.signal); }
    delete q.figura;
    if (posicao === undefined) p.questoes.push(q); else p.questoes[posicao] = q;
    salvarDepois(); desenharFolha();
    aviso(posicao === undefined ? 'Questão nova no fim da prova.' : `Questão ${posicao + 1} trocada.`);
  } catch (e) {
    if (e.name !== 'AbortError') aviso(e instanceof ErroIA ? e.message : 'Não foi possível criar a questão agora.');
  } finally { tela.fechar(); }
}

function cabecalhoHTML(p, escola, editavel = true) {
  const ce = editavel ? 'contenteditable="true"' : '';
  // Cabeçalho em blocos: escola em cima; linha larga para o nome do aluno;
  // dados da prova numa grade com rótulos pequenos; caixa de nota à direita.
  // Modelo da escola em Word: mostra o cabeçalho original, do jeito que está no arquivo
  if (temModelo(escola)) {
    queueMicrotask(() => preencherModelos(document));
    return `<div class="cabecalho-modelo" data-modelo="${escola.modelo.id}" ${modeloEmCache(escola.modelo.id) ? 'data-pronto="1"' : ''}>${modeloEmCache(escola.modelo.id) || '<div class="esqueleto-folha" aria-hidden="true"><i></i><i class="curta"></i></div>'}</div>`;
  }
  const celula = (rotulo, valor, campo) => `<div class="cab-celula"><span class="cab-rotulo">${rotulo}</span>
    <span class="cab-valor" ${campo ? `${ce} data-cab="${campo}" aria-label="${rotulo}"` : ''}>${valor}</span></div>`;
  return `<div class="cabecalho">
    <div class="cabecalho-topo">
      ${escola.logo ? `<img src="${escola.logo}" alt="Logotipo da escola" />` : ''}
      <div class="escola">${esc(escola.nome || 'Nome da escola')}${escola.cidade ? `<small>${esc(escola.cidade)}</small>` : ''}</div>
    </div>
    <div class="cab-aluno">
      <div class="cab-escrever"><span class="cab-rotulo">Aluno(a)</span><span class="cab-linha"></span></div>
      <div class="cab-escrever cab-numero"><span class="cab-rotulo">Nº</span><span class="cab-linha"></span></div>
    </div>
    <div class="cab-info">
      <div class="cab-grade">
        ${camposCabecalho(escola).map((c) => c === 'Disciplina' ? celula(c, esc(p.materia || ''))
          : c === 'Professor(a)' ? celula(c, esc(escola.professora || '') || '&nbsp;')
          : c === 'Turma' ? celula(c, esc(p.turma || p.serie || ''), 'turma')
          : c === 'Data' ? celula(c, esc(p.data || '') || '&nbsp;', 'data')
          : celula(esc(c), '&nbsp;')).join('')}
      </div>
      <div class="cab-nota"><span class="cab-rotulo">Nota</span></div>
    </div>
  </div>`;
}

function seloOrigem(q) {
  if (q.revisada) return `<span class="selo revisada">${ic('certo', 'p')} Conferida</span>`;
  if (q.origem === 'minha' || q.origem === 'revisada') return `<span class="selo revisada">${ic('certo', 'p')} Confiável</span>`;
  if (q.origem === 'ia') return '<span class="selo ia">Nova · confira</span>';
  if (q.origem === 'exemplo') return '<span class="selo exemplo">Exemplo · confira</span>';
  if (q.origem === 'importada') return '<span class="selo exemplo">Importada</span>';
  if (q.origem === 'material') return `<span class="selo material" title="Página do livro de onde a questão veio">${ic('doc', 'p')} ${esc(q.fonte?.nome || 'Do livro')}</span>`;
  if (q.origem === 'internet') {
    const url = /^https?:\/\//.test(q.fonte?.url || '') ? q.fonte.url : '';
    return url ? `<a class="selo" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(q.fonte.nome || '')}">Fonte: ${esc(q.fonte.nome || 'ver página')} ↗</a>`
      : '<span class="selo exemplo">Da internet · confira</span>';
  }
  return '';
}

function alertasHTML(q) {
  const erros = (q.alertas || []).filter((a) => a.nivel === 'erro');
  const avisos = (q.alertas || []).filter((a) => a.nivel !== 'erro');
  if (!erros.length && !avisos.length) return '';
  return `<div class="q-alertas ${erros.length ? '' : 'leve'}" role="note">${ic('alerta')}
    <div><strong>${erros.length ? 'Possível erro nesta questão' : 'Sugestões'}</strong>
    <ul>${[...erros, ...avisos].map((a) => `<li>${esc(a.msg)}</li>`).join('')}</ul></div></div>`;
}

function questaoHTML(q, i, versao) {
  const d = versao === 'adaptada' ? q.adaptada : q;
  const ce = 'contenteditable="true"';
  let corpo = `<div><span class="q-num">${i + 1}.</span> <span ${ce} data-campo="enunciado" aria-label="Enunciado da questão ${i + 1}">${md(d.enunciado)}</span></div>`;
  corpo += figuraHTML(q);
  // Cada alternativa tem o seu "remover"; no fim da lista, "+ Alternativa"
  const remover = (j, nome) => `<button type="button" class="alt-remover nao-imprimir" data-acao="rem-alt" data-j="${j}" aria-label="Remover ${nome}">${ic('fechar')}</button>`;
  const adicionar = (nome) => `<li class="nao-imprimir"><button type="button" class="alt-adicionar" data-acao="add-alt">${ic('mais', 'p')} ${nome}</button></li>`;
  if (q.tipo === 'multipla') {
    corpo += `<ol class="q-alts">${(d.alternativas || []).map((a, j) => `<li>(&nbsp;&nbsp;) ${letra(j)}) <span ${ce} data-campo="alt" data-j="${j}" aria-label="Alternativa ${letra(j)}">${md(a)}</span>${remover(j, `alternativa ${letra(j)}`)}</li>`).join('')}${adicionar('Alternativa')}</ol>`;
  } else if (q.tipo === 'vf') {
    corpo += `<ol class="q-alts">${(d.alternativas || []).map((a, j) => `<li>(&nbsp;&nbsp;&nbsp;) <span ${ce} data-campo="alt" data-j="${j}" aria-label="Afirmação ${j + 1}">${md(a)}</span>${remover(j, `afirmação ${j + 1}`)}</li>`).join('')}${adicionar('Afirmação')}</ol>`;
  } else if (q.tipo === 'aberta') {
    corpo += `<div class="q-linhas" aria-hidden="true">${'<div></div>'.repeat(versao === 'adaptada' ? 4 : 3)}</div>`;
  }
  if (versao === 'adaptada') {
    corpo += `<div class="q-dica${d.dica ? '' : ' vazia'}"><strong>Dica:</strong> <span ${ce} data-campo="dica" aria-label="Dica de apoio da questão ${i + 1}">${md(d.dica || '')}</span></div>`;
  }
  const seletorCorreta = q.tipo === 'multipla'
    ? `<label class="certa">Certa: <select data-campo="correta" aria-label="Resposta certa da questão ${i + 1}">${(d.alternativas || []).map((_, j) => `<option value="${j}" ${j === d.correta ? 'selected' : ''}>${letra(j)}</option>`).join('')}</select></label>` : '';
  return `<div class="q" data-i="${i}">
    ${corpo}
    <div class="q-ferramentas nao-imprimir">
      ${seloOrigem(q)}${seloFigura(q)}
      <button class="botao ${q.revisada ? 'conferida' : ''}" data-acao="conferi" aria-pressed="${Boolean(q.revisada)}">${ic('certo', 'p')} ${q.revisada ? 'Conferida' : 'Conferir'}</button>
      ${seletorCorreta}
      <button class="botao fantasma mais" data-acao="mais" aria-label="Mais opções da questão ${i + 1}">${ic('pontos')}</button>
    </div>
    <div class="slot-alertas nao-imprimir">${alertasHTML(q)}</div>
  </div>`;
}

function gabaritoHTML(p) {
  const tabela = (versao) => `<table><thead><tr><th scope="col">Nº</th><th scope="col">Resposta</th></tr></thead><tbody>
    ${p.questoes.map((q, i) => {
      const d = versao === 'adaptada' ? { ...q, ...q.adaptada } : q;
      // No gabarito também dá para trocar a resposta certa (na impressão sai só o texto)
      const resposta = q.tipo === 'multipla'
        ? `<span class="so-imprimir">${esc(textoGabarito(q, versao))}</span><select class="nao-imprimir gabarito-escolha" data-campo="correta" aria-label="Resposta certa da questão ${i + 1}${versao === 'adaptada' ? ' (adaptada)' : ''}">${(d.alternativas || []).map((a, j) => `<option value="${j}" ${j === d.correta ? 'selected' : ''}>${letra(j)}) ${esc(a.replace(/\*\*/g, '').slice(0, 60))}</option>`).join('')}</select>`
        : `<span contenteditable="true" data-campo="resposta" aria-label="Resposta da questão ${i + 1}">${esc(q.resposta || '')}</span>`;
      return `<tr class="q" data-i="${i}" data-versao="${versao}"><td>${i + 1}</td>
      <td>${resposta}
      ${q.justificativa ? `<div class="nao-imprimir" style="color:#555;font-size:.85em;margin-top:2px">Por quê: ${esc(q.justificativa)}</div>` : ''}</td></tr>`;
    }).join('')}</tbody></table>`;
  return `<div class="gabarito"><div class="titulo-prova">GABARITO — ${esc(p.titulo)}</div>
    <h3>Prova</h3>${tabela('normal')}
    ${p.temAdaptada !== false ? `<h3>Prova adaptada</h3>${tabela('adaptada')}` : ''}</div>`;
}

function desenharFolha() {
  const p = estado.prova;
  const escola = getConfig().escola;
  const folha = document.getElementById('folha');
  if (!folha) return;
  document.querySelectorAll('.segmentos button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === estado.aba)));
  folha.classList.toggle('adaptada', estado.aba === 'adaptada');
  document.getElementById('b-add').hidden = estado.aba === 'gabarito';
  // A versão adaptada é um "modo": faixa com cor, para quem é, e o que ligar/desligar
  const ca = cfgAdaptada(p);
  folha.classList.toggle('sem-letra-maior', !ca.letraMaior);
  folha.classList.toggle('sem-dicas', !ca.dicas);
  folha.classList.toggle('sem-negrito', !ca.negrito);
  const faixa = document.getElementById('faixa-versao');
  const opcao = (chave, rotulo) => `<label class="ficha"><input type="checkbox" data-adaptada="${chave}" ${ca[chave] ? 'checked' : ''}/><span>${rotulo}</span></label>`;
  if (faixa) faixa.innerHTML = estado.aba === 'adaptada'
    ? `<div class="faixa-adaptada">${ic('inclusao')}<div><strong>Versão adaptada</strong>
        <span>Para alunos com TDAH, autismo, dislexia ou deficiência intelectual.</span>
        <div class="fichas opcoes-adaptada" role="group" aria-label="O que a versão adaptada inclui">${opcao('letraMaior', 'Letra maior')}${opcao('dicas', 'Dicas')}${opcao('negrito', 'Palavras em negrito')}</div></div></div>`
    : '';

  if (estado.aba === 'gabarito') {
    folha.innerHTML = cabecalhoHTML(p, escola) + gabaritoHTML(p);
  } else {
    folha.innerHTML = `${cabecalhoHTML(p, escola)}
      <div class="titulo-prova">${esc(p.titulo)}</div>
      <div class="instrucoes${p.instrucoes ? '' : ' vazia'}"><strong>Instruções:</strong><div contenteditable="true" data-cab="instrucoes" aria-label="Instruções da prova">${md(p.instrucoes || '')}</div></div>
      ${p.questoes.map((q, i) => questaoHTML(q, i, estado.aba)).join('')}`;
  }
  desenharPainelRevisao();
}

function atualizarAlertas(i) {
  const q = estado.prova.questoes[i];
  if (!q) return;
  const daIA = (q.alertas || []).filter((a) => /revisora|conteúdo|mais de uma resposta|^A figura (pode|foi)/i.test(a.msg));
  q.alertas = [...validarQuestao(q), ...(q.editadaPelaProfessora ? [] : daIA)];
  const slot = document.querySelector(`.q[data-i="${i}"] .slot-alertas`);
  if (slot) slot.innerHTML = alertasHTML(q);
  salvarDepois();
  desenharPainelRevisao();
}

/** Questões que pedem o ok da professora: possível erro primeiro, depois as novas/de exemplo. */
function pendentesDaProva(p) {
  const comErro = p.questoes.map((q, i) => i).filter((i) => p.questoes[i].alertas?.some((a) => a.nivel === 'erro'));
  const novas = p.questoes.map((q, i) => i).filter((i) => !p.questoes[i].revisada && ['ia', 'exemplo', 'internet'].includes(p.questoes[i].origem) && !comErro.includes(i));
  return { comErro, novas, todas: [...comErro, ...novas] };
}

function desenharPainelRevisao() {
  const p = estado.prova;
  const el = document.getElementById('painel-revisao');
  if (!el) return;
  const { comErro, todas } = pendentesDaProva(p);
  const geral = validarProva(p.questoes);
  if (!todas.length) {
    el.innerHTML = `<span class="estado-chip ok" ${geral.length ? `title="${esc(geral.join(' '))}"` : ''}>${ic('certo', 'p')} ${geral.length ? 'Pronta · veja a dica' : 'Pronta para imprimir'}</span>`;
    return;
  }
  el.innerHTML = `<button type="button" class="estado-chip ${comErro.length ? 'erro' : 'conferir'}" id="b-conferencia">
    ${ic('alerta', 'p')} ${comErro.length ? plural(comErro.length, 'possível erro', 'possíveis erros') : plural(todas.length, 'para conferir', 'para conferir')}
    <span class="estado-acao">Revisar ${ic('seta', 'p')}</span></button>`;
  el.querySelector('#b-conferencia').onclick = () => modoConferencia();
}

/* ---------- Modo Conferência: uma questão por vez (tela especial, verde-lousa) ---------- */
function modoConferencia() {
  const p = estado.prova;
  let fila = pendentesDaProva(p).todas;
  if (!fila.length) return;
  const total = fila.length;
  let feitas = 0;
  const el = document.createElement('div');
  el.className = 'conferencia';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'conf-titulo');
  document.body.append(el);
  document.body.classList.add('em-conferencia');

  const fechar = () => {
    document.body.classList.remove('em-conferencia');
    if (menosMovimento()) el.remove(); else { el.classList.add('saindo'); setTimeout(() => el.remove(), 220); }
    salvarDepois(); desenharFolha();
  };
  const proxima = () => { fila = fila.slice(1); feitas++; desenhar(); };

  const corpoQuestao = (q, i) => {
    const alts = q.tipo === 'multipla' || q.tipo === 'vf'
      ? `<ol class="conf-alts">${(q.alternativas || []).map((a, j) => `<li class="${q.tipo === 'multipla' && j === q.correta ? 'certa' : ''}">
          <span class="conf-letra">${q.tipo === 'multipla' ? letra(j) : '•'}</span><span>${md(a)}</span>${q.tipo === 'multipla' && j === q.correta ? `<span class="conf-marca">${ic('certo', 'p')} Gabarito</span>` : ''}</li>`).join('')}</ol>` : '';
    const resp = q.tipo !== 'multipla' ? `<p class="conf-resposta"><strong>Resposta esperada:</strong> ${esc(textoGabarito(q))}</p>` : '';
    const alertas = (q.alertas || []);
    const motivo = alertas.length
      ? `<div class="conf-motivo ${alertas.some((a) => a.nivel === 'erro') ? 'erro' : ''}">${ic('alerta', 'p')}<div><strong>${alertas.some((a) => a.nivel === 'erro') ? 'Por que pedimos atenção' : 'Sugestões'}</strong><ul>${alertas.map((a) => `<li>${esc(a.msg)}</li>`).join('')}</ul></div></div>`
      : `<div class="conf-motivo">${ic('brilho', 'p')}<div><strong>${q.origem === 'ia' ? 'Questão nova, criada pela IA' : q.origem === 'internet' ? 'Questão trazida da internet' : 'Questão de exemplo do app'}</strong>Confira se o enunciado e o gabarito estão certos.</div></div>`;
    return `${motivo}
      <article class="conf-questao">
        <div class="conf-meta"><span>Questão ${i + 1}</span>${seloOrigem(q)}</div>
        <p class="conf-enunciado">${md(q.enunciado)}</p>
        ${figuraHTML(q)}${alts}${resp}
        ${q.justificativa ? `<p class="conf-porque">Por quê: ${esc(q.justificativa)}</p>` : ''}
      </article>`;
  };

  const desenhar = () => {
    if (!fila.length) {
      el.innerHTML = `<div class="conf-topo"><span class="conf-titulo" id="conf-titulo">${ic('certo', 'p')} Conferência</span></div>
        <div class="conf-fim"><span class="conf-selo">${ic('certo')}</span><h2>Tudo conferido</h2>
          <p>${plural(feitas, 'questão revisada', 'questões revisadas')}. As que você aprovou foram para o seu banco como confiáveis.</p>
          <button class="botao principal grande cheio" id="conf-imprimir">${ic('imprimir', 'p')} Imprimir</button>
          <button class="botao grande cheio" id="conf-voltar">Voltar para a prova</button></div>`;
      el.querySelector('#conf-voltar').onclick = fechar;
      el.querySelector('#conf-imprimir').onclick = () => { fechar(); setTimeout(imprimir, 260); };
      el.querySelector('#conf-voltar').focus();
      vibrar([12, 40, 18]);
      return;
    }
    const i = fila[0];
    const q = p.questoes[i];
    el.innerHTML = `<div class="conf-topo">
        <span class="conf-titulo" id="conf-titulo">${ic('certo', 'p')} Conferência</span>
        <span class="conf-contagem">${feitas + 1} de ${total}</span>
        <button type="button" class="botao pequeno conf-concluir" id="conf-sair">Concluir</button>
      </div>
      <div class="conf-barra" aria-hidden="true"><span style="width:${Math.round((feitas / total) * 100)}%"></span></div>
      <div class="conf-corpo">${corpoQuestao(q, i)}</div>
      <div class="conf-acoes">
        <button type="button" class="botao" id="conf-trocar">${ic('trocar', 'p')} Trocar</button>
        <button type="button" class="botao" id="conf-editar">${ic('editar', 'p')} Editar</button>
        <button type="button" class="botao principal verde" id="conf-ok">${ic('certo', 'p')} Está certa</button>
        <button type="button" class="botao fantasma conf-pular" id="conf-pular">Pular esta</button>
      </div>`;
    el.querySelector('#conf-sair').onclick = fechar;
    el.querySelector('#conf-pular').onclick = proxima;
    el.querySelector('#conf-ok').onclick = () => {
      q.revisada = true; q.editadaPelaProfessora = true;
      q.alertas = validarQuestao(q);
      adicionarAoBanco([q], 'revisada');
      vibrar(10); proxima();
    };
    el.querySelector('#conf-editar').onclick = () => {
      fechar();
      setTimeout(() => {
        estado.aba = 'normal'; desenharFolha();
        const alvo = document.querySelector(`.q[data-i="${i}"] [data-campo=enunciado]`);
        alvo?.scrollIntoView({ block: 'center', behavior: menosMovimento() ? 'auto' : 'smooth' }); alvo?.focus({ preventScroll: true });
      }, 240);
    };
    el.querySelector('#conf-trocar').onclick = async () => {
      await trocarQuestao(i);
      // A questão nova também precisa do ok: fica na frente da fila
      desenhar();
    };
    el.querySelector('#conf-ok').focus({ preventScroll: true });
  };
  desenhar();
}

function imprimir() {
  const problemas = estado.prova.questoes.filter((q) => q.alertas?.some((a) => a.nivel === 'erro')).length;
  if (problemas) aviso(`Lembrete: ${plural(problemas, 'questão tem', 'questões têm')} possível erro.`);
  window.print();
}

/* =================== MINHAS PROVAS =================== */
let filtroProvas = '';
function telaProvas() {
  titulo('Minhas provas');
  const provas = getProvas();
  const materias = [...new Set(provas.map((p) => p.materia).filter(Boolean))];
  if (filtroProvas && !materias.includes(filtroProvas)) filtroProvas = '';
  const lista = provas.filter((p) => !filtroProvas || p.materia === filtroProvas);
  main.innerHTML = `<div class="cabeca-tela"><h1>Provas</h1>
      <a class="botao principal icone" href="#/nova" aria-label="Nova prova">${ic('mais')}</a></div>
    ${materias.length > 1 ? `<div class="filtro-materias" role="group" aria-label="Filtrar por matéria">
      <button type="button" data-m="" aria-pressed="${!filtroProvas}">Todas</button>
      ${materias.map((m) => `<button type="button" data-m="${esc(m)}" aria-pressed="${filtroProvas === m}" style="--cor:${corMateria(m)}"><span class="ponto-materia"></span>${esc(m)}</button>`).join('')}</div>` : ''}
    ${provas.length ? `<div class="grade-folhas" role="list">${lista.map((p) => `<div role="listitem">${folhaMini(p)}</div>`).join('')}</div>`
      : `<a class="folha-vazia" href="#/nova">
          <span class="fm-papel" aria-hidden="true"><span class="fm-cab"><i></i><i class="curta"></i></span><span class="fm-linhas"><i></i><i></i><i class="curta"></i><i></i></span></span>
          <span><strong>Nenhuma prova ainda</strong><small>Toque aqui para criar a primeira. Tudo fica salvo neste aparelho, mesmo sem internet.</small></span></a>`}`;
  main.querySelector('.filtro-materias')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    filtroProvas = b.dataset.m; transicao(telaProvas, 'segmento');
  });
}

/* =================== BANCO DE QUESTÕES =================== */
let filtroBanco = { materia: '', serie: '', busca: '', origem: '', limite: 25 };
const ORIGENS = [['confiavel', 'Conferidas'], ['material', 'Dos livros (PDF)'], ['internet', 'Da internet'], ['importada', 'Importadas'], ['exemplo', 'Exemplos do app'], ['ia', 'Novas, para conferir']];

function telaBanco() {
  titulo('Banco de questões');
  const banco = getBanco();
  const temIA = iaDisponivel(getConfig());
  const porMateria = todasMaterias().map((m) => [m, banco.filter((q) => q.materia === m).length]).filter(([, n]) => n);
  main.innerHTML = `
    <div class="cabeca-tela"><h1>Banco</h1>
      <button class="botao principal icone" id="b-banco-mais" aria-label="Adicionar questões">${ic('mais')}</button></div>
    <div class="busca-linha">
      <div class="busca">${ic('busca')}<label class="sr" for="f-busca">Procurar questões</label>
        <input type="search" id="f-busca" value="${esc(filtroBanco.busca)}" placeholder="Procurar no banco" /></div>
      <button class="botao icone" id="b-filtros" aria-label="Filtros">${ic('filtro')}</button>
    </div>
    ${porMateria.length > 1 ? `<div class="filtro-materias" role="group" aria-label="Matérias">
      <button type="button" data-m="" aria-pressed="${!filtroBanco.materia}">Todas</button>
      ${porMateria.map(([m, n]) => `<button type="button" data-m="${esc(m)}" aria-pressed="${filtroBanco.materia === m}" style="--cor:${corMateria(m)}"><span class="ponto-materia"></span>${esc(m)} <small>${n}</small></button>`).join('')}</div>` : ''}
    <button class="atalho-ia" id="b-buscar-web" ${temIA ? '' : 'disabled'}>
      <span class="atalho-ic">${ic('brilho')}</span>
      <span class="texto-linha"><strong>Buscar questões com IA</strong><small>${temIA ? 'Na internet (Saeb, OBMEP…) ou nos seus livros em PDF' : 'Ligue a criação automática em Ajustes'}</small></span>
      <span class="chevron">${ic('seta')}</span></button>
    <div class="filtros-ativos" id="filtros-ativos"></div>
    <div id="contador-banco" role="status" class="contador-lista"></div>
    <ul class="lista-cartoes" id="lista-banco"></ul>
    <div class="acoes" style="justify-content:center"><button class="botao" id="b-mais" hidden>Mostrar mais</button></div>
    <input type="file" id="importar" accept=".json,application/json" hidden />`;

  const nomeOrigem = Object.fromEntries(ORIGENS);
  const desenharLista = () => {
    const nb = normalizar(filtroBanco.busca);
    const filtradas = getBanco().filter((q) =>
      (!filtroBanco.materia || q.materia === filtroBanco.materia) &&
      (!filtroBanco.serie || q.serie === filtroBanco.serie) &&
      (!filtroBanco.origem || (filtroBanco.origem === 'confiavel' ? ['minha', 'revisada'].includes(q.origem) : q.origem === filtroBanco.origem)) &&
      (!nb || normalizar(`${q.tema} ${q.enunciado}`).includes(nb)));
    const ativos = [['materia', filtroBanco.materia], ['serie', filtroBanco.serie], ['origem', nomeOrigem[filtroBanco.origem]]].filter(([, v]) => v);
    main.querySelector('#filtros-ativos').innerHTML = ativos.map(([k, v]) => `<button data-limpa="${k}" aria-label="Remover filtro ${esc(v)}">${esc(v)} ${ic('fechar', 'p')}</button>`).join('');
    main.querySelector('#contador-banco').textContent = plural(filtradas.length, 'questão', 'questões');
    main.querySelector('#lista-banco').innerHTML = filtradas.length ? filtradas.slice(0, filtroBanco.limite).map((q) => `<li class="questao-banco">
      <div class="meta" style="--cor:${corMateria(q.materia)}"><span class="ponto-materia"></span><span>${esc(q.materia)} · ${esc(q.serie)} · ${esc(q.tema)}</span>${seloOrigem(q)}</div>
      <p class="enun">${md(q.enunciado)}</p>
      ${figuraHTML(q)}
      <details class="ver-resposta"><summary>Ver resposta ${ic('seta')}</summary>
        ${q.tipo === 'multipla' || q.tipo === 'vf' ? `<ol>${q.alternativas.map((a, j) => `<li class="${j === q.correta ? 'certa' : ''}">${q.tipo === 'multipla' ? letra(j) + ') ' : '• '}${md(a)}${j === q.correta ? ' ✓' : ''}</li>`).join('')}</ol>` : ''}
        <p class="dica" style="margin:0 0 4px"><strong>Gabarito:</strong> ${esc(textoGabarito(q))}${q.justificativa ? ` — ${esc(q.justificativa)}` : ''}</p>
      </details>
      <button class="botao fantasma icone q-mais" data-menu-q="${q.id}" aria-label="Opções da questão">${ic('pontos')}</button></li>`).join('')
      : `<li class="vazio">${ic('busca')}<strong>Nenhuma questão aqui</strong>Tire algum filtro ou escreva uma questão nova.</li>`;
    main.querySelector('#b-mais').hidden = filtradas.length <= filtroBanco.limite;
  };
  desenharLista();

  main.querySelector('#f-busca').oninput = (e) => { filtroBanco.busca = e.target.value; filtroBanco.limite = 25; desenharLista(); };
  main.querySelector('#filtros-ativos').onclick = (e) => { const k = e.target.closest('[data-limpa]')?.dataset.limpa; if (k) { filtroBanco[k] = ''; desenharLista(); } };
  main.querySelector('#b-mais').onclick = () => { filtroBanco.limite += 25; desenharLista(); };
  main.querySelector('#b-filtros').onclick = () => abrirGaveta('Filtrar questões', `<form id="f-filtros"><div class="cartao-form">
      <div class="campo"><label for="ff-materia">Matéria</label><select id="ff-materia" name="materia"><option value="">Todas</option>${todasMaterias().map((m) => `<option ${m === filtroBanco.materia ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="campo"><label for="ff-serie">Ano / série</label><select id="ff-serie" name="serie"><option value="">Todas</option>${SERIES.map((s) => `<option ${s === filtroBanco.serie ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="campo"><label for="ff-origem">Origem</label><select id="ff-origem" name="origem"><option value="">Todas</option>${ORIGENS.map(([v, r]) => `<option value="${v}" ${v === filtroBanco.origem ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      </div><div class="acoes"><button type="button" class="botao" id="ff-limpar">Limpar</button><button class="botao principal" style="flex:1">Mostrar questões</button></div></form>`, (c) => {
    const f = c.querySelector('form');
    c.querySelector('#ff-limpar').onclick = () => { f.materia.value = ''; f.serie.value = ''; f.origem.value = ''; };
    f.onsubmit = (ev) => { ev.preventDefault(); const fd = new FormData(f); Object.assign(filtroBanco, { materia: fd.get('materia'), serie: fd.get('serie'), origem: fd.get('origem'), limite: 25 }); fecharGaveta(); desenharLista(); };
  });
  main.querySelector('#lista-banco').onclick = (e) => {
    const conf = e.target.closest('[data-conferir]')?.dataset.conferir;
    const apg = e.target.closest('[data-apagar-q]')?.dataset.apagarQ;
    const edt = e.target.closest('[data-editar-q]')?.dataset.editarQ;
    const mq = e.target.closest('[data-menu-q]')?.dataset.menuQ;
    if (mq) {
      const q = getBanco().find((x) => x.id === mq);
      const confiavel = q.origem === 'minha' || q.origem === 'revisada';
      abrirGaveta('Questão', menu([
        ...(confiavel ? [] : [{ op: 'conf', icone: 'certo', rotulo: 'Marcar como conferida', dica: 'Ela passa a ser usada primeiro nas provas' }]),
        { op: 'edit', icone: 'editar', rotulo: 'Editar' },
        '-',
        { op: 'apagar', icone: 'lixo', rotulo: 'Apagar', perigo: true },
      ]), (g) => g.addEventListener('click', (ev) => {
        const op = ev.target.closest('[data-op]')?.dataset.op; if (!op) return;
        fecharGaveta();
        const alvo = document.createElement('i');
        alvo.dataset[op === 'conf' ? 'conferir' : op === 'edit' ? 'editarQ' : 'apagarQ'] = mq;
        main.querySelector('#lista-banco').append(alvo); alvo.click(); alvo.remove();
      }));
      return;
    }
    const b = getBanco();
    if (edt) return formQuestao(desenharLista, b.find((q) => q.id === edt));
    if (conf) { b.find((q) => q.id === conf).origem = 'revisada'; salvarBanco(b); desenharLista(); aviso('Marcada como conferida.'); }
    if (apg) {
      const i = b.findIndex((q) => q.id === apg);
      const [rem] = b.splice(i, 1); salvarBanco(b); desenharLista();
      aviso('Questão apagada.', { rotulo: 'Desfazer', fn: () => { const b2 = getBanco(); b2.splice(i, 0, rem); salvarBanco(b2); if (location.hash === '#/banco') desenharLista(); } });
    }
  };
  main.querySelector('#b-banco-mais').onclick = () => abrirGaveta('Adicionar ao banco', menu([
    { op: 'escrever', icone: 'editar', rotulo: 'Escrever uma questão', dica: 'Ela entra como confiável' },
    ...(temIA ? [{ op: 'web', icone: 'brilho', rotulo: 'Buscar na internet com IA', dica: 'Traz o link de onde veio cada questão' }] : []),
    { op: 'pdf', icone: 'doc', rotulo: 'Livros e apostilas (PDF)', dica: listarMateriais().length ? plural(listarMateriais().length, 'material guardado', 'materiais guardados') : 'A IA consulta o livro para tirar questões' },
    '-',
    { op: 'importar', icone: 'baixar', rotulo: 'Importar pacote de questões', dica: 'Arquivo recebido de um colega' },
    { op: 'exportar', icone: 'enviar', rotulo: 'Exportar meu banco', dica: 'Gera um arquivo para enviar a colegas' },
  ]), (c) => c.addEventListener('click', (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op;
    if (!op) return;
    if (op === 'escrever') { fecharGaveta(); setTimeout(() => formQuestao(desenharLista), 220); }
    if (op === 'web') { fecharGaveta(); setTimeout(() => formBuscaInternet(() => telaBanco()), 220); }
    if (op === 'pdf') { fecharGaveta(); setTimeout(gavetaMateriais, 220); }
    if (op === 'importar') { fecharGaveta(); main.querySelector('#importar').click(); }
    if (op === 'exportar') {
      fecharGaveta();
      baixarArquivo(`banco-apta-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'apta', versao: 2, questoes: getBanco(), imagens: imagensDasQuestoes(getBanco()) }));
      aviso('Arquivo do banco baixado.');
    }
  }));
  main.querySelector('.filtro-materias')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    filtroBanco.materia = b.dataset.m; filtroBanco.limite = 25;
    main.querySelectorAll('.filtro-materias [data-m]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    desenharLista();
  });
  main.querySelector('#importar').onchange = async (e) => {
    const arq = e.target.files[0];
    if (!arq) return;
    try {
      const dados = JSON.parse(await arq.text());
      await importarImagens(dados.imagens);
      const lista = Array.isArray(dados) ? dados : dados.questoes;
      if (!Array.isArray(lista)) throw new Error();
      const validas = lista.filter((q) => q && q.enunciado && TIPOS[q.tipo] && !validarQuestao(q).some((p) => p.nivel === 'erro'));
      const novas = adicionarAoBanco(validas.map((q) => ({ ...q, origem: undefined })), 'importada');
      const recusadas = lista.length - validas.length;
      aviso(`${plural(novas, 'questão importada', 'questões importadas')}.${recusadas ? ` ${recusadas} recusada(s) por erro.` : ''}`);
      telaBanco();
    } catch { aviso('Este arquivo não é um pacote de questões válido.'); }
  };
  main.querySelector('#b-buscar-web').onclick = () => abrirGaveta('Buscar questões com IA', menu([
    { op: 'web', icone: 'busca', rotulo: 'Na internet', dica: 'Provas públicas como Saeb e OBMEP, com o link da fonte' },
    { op: 'pdf', icone: 'doc', rotulo: 'Nos meus livros (PDF)', dica: listarMateriais().length ? plural(listarMateriais().length, 'material guardado', 'materiais guardados') : 'Envie um PDF primeiro' },
  ]), (c) => c.addEventListener('click', (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op; if (!op) return;
    fecharGaveta();
    setTimeout(() => (op === 'web' ? formBuscaInternet(() => telaBanco()) : gavetaMateriais()), 220);
  }));
}

/* ---------- Livros e apostilas em PDF ---------- */
function gavetaMateriais() {
  const temIA = iaDisponivel(getConfig());
  const mats = listarMateriais();
  abrirGaveta('Livros e apostilas', `
    ${mats.length ? `<ul class="lista-materiais">${mats.map((m) => `<li>
      <span class="materia-icone">${icMateria(m.materia)}</span>
      <span class="texto-linha"><strong>${esc(m.nome)}</strong><small>${esc(m.materia)} · ${esc(m.serie)} · ${plural(m.paginas, 'página', 'páginas')}</small>
        ${temIA ? `<button type="button" class="botao pequeno" data-buscar-mat="${m.id}">${ic('busca', 'p')} Buscar questões</button>` : ''}</span>
      <button type="button" class="alt-remover mat-remover" data-apagar-mat="${m.id}" aria-label="Apagar ${esc(m.nome)}">${ic('fechar')}</button></li>`).join('')}</ul>`
      : `<p class="dica" style="margin:0 0 12px">A IA consulta o livro para criar questões no mesmo estilo e encontra os exercícios que já estão nele.</p>`}
    <label class="botao ${mats.length ? '' : 'principal'} cheio" for="mat-arquivo">${ic('enviar', 'p')} Adicionar PDF</label>
    <input type="file" id="mat-arquivo" accept="application/pdf,.pdf" class="sr" />
    ${temIA ? '' : '<p class="dica" style="margin:12px 0 0">Para a IA usar os livros, ligue a criação automática em Ajustes.</p>'}`, (g) => {
    g.querySelector('#mat-arquivo').onchange = (e) => { const arq = e.target.files[0]; if (arq) { fecharGaveta(); adicionarMaterial(arq); } };
    g.addEventListener('click', async (e) => {
      const buscar = e.target.closest('[data-buscar-mat]')?.dataset.buscarMat;
      const apagar = e.target.closest('[data-apagar-mat]')?.dataset.apagarMat;
      if (buscar) { fecharGaveta(); formBuscaMaterial(obterMaterial(buscar)); }
      if (apagar) {
        const m = await apagarMaterial(apagar);
        fecharGaveta();
        if (location.hash === '#/banco') telaBanco();
        aviso(`“${m.nome}” apagado.`, { rotulo: 'Desfazer', fn: async () => { await salvarMaterial(m); if (location.hash === '#/banco') telaBanco(); } });
      }
    });
  });
}

async function adicionarMaterial(arquivo) {
  if (arquivo.size > 80 * 1024 * 1024) { aviso('Esse PDF é grande demais (mais de 80 MB). Envie só os capítulos que vai usar.'); return; }
  const tela = telaCriando(['Lendo as páginas', 'Guardando no aparelho']);
  tela.titulo('Lendo o PDF', 'O texto fica guardado só neste aparelho.', false);
  tela.etapa(0);
  let textos;
  try {
    textos = await lerPDF(arquivo, (i, n) => tela.etapa(0, `Lendo as páginas (${i} de ${n})`));
  } catch (e) { tela.fechar(); console.error(e); aviso(e.message || 'Não consegui ler esse PDF.'); return; }
  tela.fechar();
  if (tela.signal.aborted) return;
  let ultimo = {};
  try { ultimo = JSON.parse(localStorage.getItem('pf.ultimoPedido')) || {}; } catch {}
  const nomeArq = arquivo.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim();
  abrirGaveta('Guardar material', `<form novalidate>
    <p class="dica" style="margin:0 0 16px">Li ${plural(textos.length, 'página', 'páginas')}.</p>
    <div class="campo"><label for="m-nome">Nome</label><input type="text" id="m-nome" name="nome" value="${esc(nomeArq.slice(0, 80))}" placeholder="Ex.: Livro de Ciências 5º ano" /></div>
    <div class="duas-colunas">
      <div class="campo"><label for="m-materia">Matéria</label><select id="m-materia" name="materia">${todasMaterias().map((m) => `<option ${m === (filtroBanco.materia || ultimo.materia || 'Matemática') ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
      <div class="campo"><label for="m-serie">Ano / série</label><select id="m-serie" name="serie">${SERIES.map((s) => `<option ${s === (filtroBanco.serie || ultimo.serie || '5º ano') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div>
    <button class="botao principal grande cheio">${ic('certo', 'p')} Guardar</button></form>`, (g) => {
    const f = g.querySelector('form');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      try {
        await salvarMaterial({ id: uid(), nome: fd.get('nome').trim() || nomeArq || 'Material', materia: fd.get('materia'), serie: fd.get('serie'), textos, criadoEm: Date.now() });
      } catch (err) { console.error(err); aviso('Não deu para guardar: o aparelho está sem espaço.'); return; }
      fecharGaveta();
      if (location.hash === '#/banco') telaBanco();
      aviso('Material guardado. Ele aparece no Criar prova, no passo do conteúdo.');
      setTimeout(gavetaMateriais, 350);
    };
  });
}

function formBuscaMaterial(m) {
  const total = m.textos.length;
  abrirGaveta('Buscar questões no livro', `<form novalidate>
    <p class="dica" style="margin:0 0 16px">${esc(m.nome)} · ${plural(total, 'página', 'páginas')}</p>
    <div class="duas-colunas lote-colunas">
      <div class="campo"><label for="bm-de">Da página</label><input type="number" inputmode="numeric" id="bm-de" name="de" min="1" max="${total}" value="1" /></div>
      <div class="campo"><label for="bm-ate">Até a página</label><input type="number" inputmode="numeric" id="bm-ate" name="ate" min="1" max="${total}" value="${total}" /></div>
    </div>
    <div class="erro-campo" id="bm-erro" hidden></div>
    <button class="botao principal grande cheio">${ic('brilho', 'p')} Buscar com IA</button></form>`, (g) => {
    const f = g.querySelector('form');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const de = Math.max(1, Number(f.de.value) || 1);
      const ate = Math.min(total, Number(f.ate.value) || total);
      const erro = g.querySelector('#bm-erro');
      if (de > ate) { erro.innerHTML = `${ic('alerta', 'p')} A primeira página precisa vir antes da última.`; erro.hidden = false; return; }
      const paginas = paginasComQuestoes(m, de, ate);
      if (!paginas.length) { erro.innerHTML = `${ic('alerta', 'p')} Não achei exercícios nessas páginas. Tente outro intervalo.`; erro.hidden = false; return; }
      fecharGaveta();
      await buscarNoMaterial(m, paginas);
    };
  });
}

async function buscarNoMaterial(m, paginas) {
  const cfg = getConfig();
  const MAX_LOTES = 6;
  const todos = lotesDePaginas(m, paginas);
  const lotes = todos.slice(0, MAX_LOTES);
  const ultimaPag = lotes.at(-1).at(-1).pagina;
  const tela = telaCriando([...lotes.map((l) => `Lendo as páginas ${l[0].pagina} a ${l.at(-1).pagina}`), 'Conferindo as questões']);
  tela.titulo('Procurando questões no livro', 'A IA lê só as páginas com exercícios.', true);
  let achadas = [];
  try {
    for (let k = 0; k < lotes.length; k++) {
      tela.etapa(k);
      achadas.push(...await questoesDoMaterial(cfg, m, lotes[k], tela.signal));
    }
    tela.etapa(lotes.length);
    achadas = achadas.map((q) => ({
      ...q,
      alertas: [
        ...(estaNoTexto(m, q.fonte.pagina, q.enunciado) ? [] : [{ nivel: 'erro', msg: `Não achei esta questão no texto da página ${q.fonte.pagina}. Pode ter sido inventada: confira no livro.` }]),
        ...(q.precisaFigura ? [{ nivel: 'erro', msg: 'Depende de uma figura do livro. Adicione a imagem antes de usar.' }] : []),
        ...(q.gabaritoNoMaterial ? [] : [{ nivel: 'aviso', msg: 'O livro não traz o gabarito: a IA resolveu. Confira a resposta.' }]),
        ...validarQuestao(q),
      ],
    }));
    if (cfg.ia.revisora && achadas.length) {
      try {
        const revisoes = await revisarQuestoes(cfg, achadas, tela.signal);
        achadas = achadas.map((q, i) => ({ ...q, alertas: [...q.alertas, ...(revisoes[i] || [])] }));
      } catch (e) { if (e.name === 'AbortError') throw e; }
    }
  } catch (e) {
    tela.fechar();
    if (e.name !== 'AbortError') { console.error(e); aviso(e instanceof ErroIA ? e.message : 'A busca não funcionou agora. Tente de novo em alguns minutos.'); }
    return;
  }
  tela.fechar();
  if (!achadas.length) { aviso('A IA não encontrou exercícios prontos nessas páginas.'); return; }
  if (todos.length > lotes.length) aviso(`Li até a página ${ultimaPag}. Para ver as outras, busque de novo a partir da página ${ultimaPag + 1}.`);
  achadas.forEach((q) => { delete q.precisaFigura; delete q.gabaritoNoMaterial; });
  mostrarResultadosBusca(achadas, () => { if (location.hash === '#/banco') telaBanco(); }, 'material');
}


/* ---------- Buscar questões na internet ---------- */
function formBuscaInternet(depois) {
  let ultimo = {};
  try { ultimo = JSON.parse(localStorage.getItem('pf.ultimoPedido')) || {}; } catch {}
  abrirGaveta('Buscar na internet com IA', `<form id="form-busca" novalidate>
    <p class="dica" style="margin:0 0 16px">A IA procura questões que já existem e traz o link de onde vieram. Você escolhe quais guardar.</p>
    <div class="duas-colunas">
      <div class="campo"><label for="b-materia">Matéria</label><select id="b-materia" name="materia">${todasMaterias().map((m) => `<option ${m === (filtroBanco.materia || ultimo.materia || 'Matemática') ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="campo"><label for="b-serie">Ano / série</label><select id="b-serie" name="serie">${SERIES.map((s) => `<option ${s === (filtroBanco.serie || ultimo.serie || '5º ano') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="campo"><label for="b-tema">Conteúdo</label>
      <input type="text" id="b-tema" name="tema" placeholder="Frações" aria-describedby="b-tema-erro" />
      <div class="erro-campo" id="b-tema-erro" hidden>${ic('alerta', 'p')} Escreva o conteúdo.</div></div>
    <fieldset style="border:0;padding:0;margin:0 0 24px"><legend class="rotulo">Quantas questões?</legend>${fichas('quantidade', [['3', '3'], ['5', '5'], ['8', '8']], '5')}</fieldset>
    <button class="botao principal grande cheio">${ic('brilho', 'p')} Buscar com IA</button></form>`, (c) => {
    const f = c.querySelector('form');
    f.tema.focus();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const pedido = { materia: fd.get('materia'), serie: fd.get('serie'), tema: fd.get('tema').trim(), quantidade: Number(fd.get('quantidade')) || 5, dificuldade: 'medio' };
      if (!pedido.tema) { c.querySelector('#b-tema-erro').hidden = false; f.tema.focus(); return; }
      fecharGaveta();
      await executarBusca(pedido, depois);
    };
  });
}

async function executarBusca(pedido, depois) {
  const cfg = getConfig();
  const etapas = ['A IA está pesquisando na internet', 'Conferindo as fontes e as respostas', 'Preparando e conferindo as figuras', 'Separando as questões para você escolher'];
  const tela = telaCriando(etapas);
  tela.etapa(0);
  let achadas = [];
  try {
    achadas = await buscarNaInternet(cfg, pedido, tela.signal);
    tela.etapa(1);
    achadas = achadas.map((q) => ({
      ...q,
      alertas: [
        ...(q.fonteConfirmada ? [] : [{ nivel: 'erro', msg: 'Não encontrei este link na pesquisa. A questão pode ter sido inventada: abra a fonte e confira.' }]),
        ...validarQuestao(q),
      ],
    }));
    if (cfg.ia.revisora && achadas.length) {
      try {
        const revisoes = await revisarQuestoes(cfg, achadas, tela.signal);
        achadas = achadas.map((q, i) => ({ ...q, alertas: [...q.alertas, ...(revisoes[i] || [])] }));
      } catch (e) { if (e.name === 'AbortError') throw e; }
    }
    tela.etapa(2);
    if (achadas.some((q) => q.figura)) await prepararFiguras(cfg, achadas, tela.signal);
    achadas.forEach((q) => delete q.figura);
    tela.etapa(3);
  } catch (e) {
    tela.fechar();
    if (e.name !== 'AbortError') {
      console.error(e);
      aviso(e instanceof ErroIA ? e.message : 'A busca não funcionou agora. Tente de novo em alguns minutos.');
    }
    return;
  }
  tela.fechar();
  if (!achadas.length) {
    abrirGaveta('Nada encontrado', `<p>A IA não achou questões prontas de <strong>${esc(pedido.tema)}</strong> para o ${esc(pedido.serie)} que possam ser usadas só com texto.</p>
      <p>Tente escrever o conteúdo de outro jeito ou escolher uma série vizinha.</p><button class="botao principal cheio" data-ok>Entendi</button>`, (c) => { c.querySelector('[data-ok]').onclick = fecharGaveta; });
    return;
  }
  mostrarResultadosBusca(achadas, depois);
}

function mostrarResultadosBusca(achadas, depois, origem = 'internet') {
  const comErro = achadas.filter((q) => q.alertas.some((a) => a.nivel === 'erro')).length;
  const resumo = comErro === 0 ? 'Todas passaram na conferência automática.'
    : `${plural(comErro, 'questão tem', 'questões têm')} possível problema e ${comErro === 1 ? 'ficou desmarcada' : 'ficaram desmarcadas'}.`;
  abrirGaveta(`Achei ${plural(achadas.length, 'questão', 'questões')}`, `
    <p class="dica" style="margin:0 0 12px">${resumo}${origem === 'internet' ? ' Toque no nome da fonte para ver a página original.' : ''}</p>
    <form id="form-escolha"><ul class="lista-cartoes">${achadas.map((q, i) => {
      const erro = q.alertas.some((a) => a.nivel === 'erro');
      return `<li class="questao-banco">
        <label class="linha-escolha"><input type="checkbox" name="sel" value="${i}" ${erro ? '' : 'checked'} aria-label="Guardar a questão ${i + 1}" />
          <span class="meta">${seloOrigem(q)} <span>${TIPOS[q.tipo].split(' (')[0]}</span></span></label>
        <p class="enun">${md(q.enunciado)}</p>
        ${figuraHTML(q)}
        ${q.tipo === 'multipla' || q.tipo === 'vf' ? `<ol>${q.alternativas.map((a, j) => `<li class="${j === q.correta ? 'certa' : ''}">${q.tipo === 'multipla' ? letra(j) + ') ' : '• '}${md(a)}${j === q.correta ? ' ✓' : ''}</li>`).join('')}</ol>` : ''}
        <p class="dica" style="margin:0"><strong>Gabarito:</strong> ${esc(textoGabarito(q))}</p>
        ${alertasHTML(q)}</li>`;
    }).join('')}</ul>
    <div style="position:sticky;bottom:0;background:var(--superficie);padding:12px 0 0">
      <button class="botao principal grande cheio" id="b-guardar"></button></div></form>`, (c) => {
    const f = c.querySelector('form');
    const atualizar = () => {
      const n = f.querySelectorAll('[name=sel]:checked').length;
      c.querySelector('#b-guardar').innerHTML = `${ic('certo', 'p')} ${n ? `Guardar ${plural(n, 'questão', 'questões')} no banco` : 'Marque ao menos uma questão'}`;
    };
    f.onchange = atualizar;
    atualizar();
    f.onsubmit = (e) => {
      e.preventDefault();
      const sel = [...f.querySelectorAll('[name=sel]:checked')].map((x) => achadas[Number(x.value)]);
      if (!sel.length) return;
      const novas = adicionarAoBanco(sel, origem);
      fecharGaveta();
      aviso(novas ? `${plural(novas, 'questão guardada', 'questões guardadas')} no banco, ${origem === 'internet' ? 'com o link da fonte' : 'com a página do livro'}.` : 'Essas questões já estavam no seu banco.');
      depois?.();
    };
  });
}

/** Escrever uma questão nova ou editar uma do banco (existente). */
function formQuestao(depois, existente = null) {
  const x = existente || {};
  const nAlts = Math.max(4, (x.alternativas || []).length);
  abrirGaveta(existente ? 'Editar questão' : 'Escrever questão', `<form id="form-q" novalidate>
    <div class="duas-colunas">
      <div class="campo"><label for="q-materia">Matéria</label><select id="q-materia" name="materia">${todasMaterias().map((m) => `<option ${m === (x.materia || filtroBanco.materia || 'Matemática') ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="campo"><label for="q-serie">Ano / série</label><select id="q-serie" name="serie">${SERIES.map((s) => `<option ${s === (x.serie || filtroBanco.serie || '5º ano') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="campo"><label for="q-tema">Conteúdo</label><input type="text" id="q-tema" name="tema" placeholder="Frações" value="${esc(x.tema || '')}" /></div>
    <fieldset style="border:0;padding:0;margin:0 0 24px"><legend class="rotulo">Dificuldade</legend>${fichas('dificuldade', Object.entries(DIFICULDADES), x.dificuldade || 'medio')}</fieldset>
    <div class="campo"><label for="q-tipo">Tipo</label><select id="q-tipo" name="tipo">${Object.entries(TIPOS).map(([v, r]) => `<option value="${v}" ${v === x.tipo ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="campo"><label for="q-enunciado">Pergunta</label>
      <span class="dica">Para destacar uma palavra, escreva entre dois asteriscos: **palavra**</span>
      <textarea id="q-enunciado" name="enunciado">${esc(x.enunciado || '')}</textarea></div>
    <fieldset id="q-alts" style="border:0;padding:0;margin:0 0 24px"><legend class="rotulo">Alternativas</legend><span class="dica">Toque no círculo da alternativa certa. Deixe em branco para tirar uma alternativa.</span>
      ${Array.from({ length: nAlts }, (_, j) => `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
        <input type="radio" name="correta" value="${j}" ${j === (existente ? x.correta : 0) ? 'checked' : ''} aria-label="A alternativa ${letra(j)} é a certa" style="width:28px;height:28px;flex:none;accent-color:var(--sucesso)"/>
        <input type="text" name="alt" aria-label="Alternativa ${letra(j)}" placeholder="Alternativa ${letra(j)}" value="${esc((x.alternativas || [])[j] || '')}" /></div>`).join('')}</fieldset>
    <div class="campo"><span class="rotulo">Imagem <span class="opcional">(opcional)</span></span>
      <div class="acoes" style="margin:0"><label class="botao pequeno" for="q-img">${ic('imagem', 'p')} Escolher imagem</label>
      <input type="file" id="q-img" accept="image/*" class="sr" /><span class="dica" id="q-img-nome" style="margin:0"></span></div></div>
    <div class="campo" id="q-resp"><label for="q-resposta">Resposta esperada</label>
      <span class="dica">Para V/F escreva assim: V, F, V</span>
      <input type="text" id="q-resposta" name="resposta" value="${existente && x.tipo !== 'multipla' ? esc(x.resposta || '') : ''}" /></div>
    <div class="aviso-bloco erro" id="q-erros" role="alert" hidden></div>
    <button class="botao principal grande cheio">${ic('certo', 'p')} ${existente ? 'Salvar alterações' : 'Salvar no banco'}</button></form>`, (c) => {
    const form = c.querySelector('form');
    const ajustar = () => {
      const t = form.tipo.value;
      c.querySelector('#q-alts').hidden = !['multipla', 'vf'].includes(t);
      c.querySelector('#q-alts legend').textContent = t === 'vf' ? 'Afirmações' : 'Alternativas';
      c.querySelector('#q-alts .dica').hidden = t !== 'multipla';
      c.querySelectorAll('#q-alts input[type=radio]').forEach((r) => (r.hidden = t !== 'multipla'));
      c.querySelector('#q-resp').hidden = t === 'multipla';
    };
    form.tipo.onchange = ajustar; ajustar();
    c.querySelector('#q-img').onchange = (ev) => { c.querySelector('#q-img-nome').textContent = ev.target.files[0]?.name || ''; };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const tipo = fd.get('tipo');
      const altsBrutas = fd.getAll('alt').map((a) => a.trim());
      const alternativas = ['multipla', 'vf'].includes(tipo) ? altsBrutas.filter(Boolean) : [];
      const correta = tipo === 'multipla' ? alternativas.indexOf(altsBrutas[Number(fd.get('correta'))]) : -1;
      const q = {
        materia: fd.get('materia'), serie: fd.get('serie'), dificuldade: fd.get('dificuldade'), tema: fd.get('tema').trim(),
        tipo, enunciado: fd.get('enunciado').trim(), alternativas, correta,
        resposta: tipo === 'multipla' ? (alternativas[correta] || '') : fd.get('resposta').trim(), justificativa: existente?.justificativa || '',
      };
      if (existente?.imagem) q.imagem = existente.imagem;
      const arqImg = c.querySelector('#q-img').files[0];
      if (arqImg) {
        try { const reg = await guardarImagem(await rasterizar(arqImg)); q.imagem = { id: reg.id, tipo: 'professora', descricao: '', credito: '' }; }
        catch (err) { aviso(err.message); return; }
      }
      const erros = validarQuestao(q).filter((p) => p.nivel === 'erro').map((p) => p.msg);
      if (!q.tema) erros.unshift('Escreva o conteúdo.');
      const caixa = c.querySelector('#q-erros');
      if (erros.length) { caixa.hidden = false; caixa.innerHTML = `<strong>Falta corrigir:</strong><ul>${erros.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`; caixa.scrollIntoView({ block: 'nearest' }); return; }
      if (existente) {
        // Editada pela professora: vira questão dela (confiável), mantendo id e imagem
        const b = getBanco();
        const k = b.findIndex((y) => y.id === existente.id);
        if (k >= 0) { b[k] = { ...existente, ...q, origem: 'minha', alertas: [] }; salvarBanco(b); }
        fecharGaveta(); aviso('Questão atualizada.'); depois?.();
        return;
      }
      adicionarAoBanco([q], 'minha');
      fecharGaveta(); aviso('Questão salva no banco.'); depois?.();
    };
  });
}

/* =================== AJUSTES (escola + IA) =================== */
function telaAjustes(ancora) {
  titulo('Ajustes');
  const cfg = getConfig();
  const e = cfg.escola;
  const pronta = iaDisponivel(cfg);
  main.innerHTML = `<h1>Ajustes</h1>

    <section id="escola" aria-labelledby="t-escola">
      <div class="cabeca-secao" id="t-escola">Minha escola</div>
      <form id="form-escola">
        <div class="cartao-form">
          <div class="campo"><label for="e-nome">Nome da escola</label><input type="text" id="e-nome" name="nome" value="${esc(e.nome)}" autocomplete="organization" placeholder="Ex.: Escola Municipal Monteiro Lobato" /></div>
          <div class="duas-colunas">
            <div class="campo"><label for="e-prof">Seu nome</label><input type="text" id="e-prof" name="professora" value="${esc(e.professora)}" autocomplete="name" placeholder="Ex.: Maria Souza" /></div>
            <div class="campo"><label for="e-cidade">Cidade <span class="opcional">(opcional)</span></label><input type="text" id="e-cidade" name="cidade" value="${esc(e.cidade)}" placeholder="Ex.: Campinas – SP" /></div>
          </div>
          <div class="campo"><label for="e-instr">Instruções da prova</label>
            <span class="dica">Aparecem logo abaixo do cabeçalho em todas as provas novas. Uma instrução por linha. Dá para mudar em cada prova também.</span>
            <textarea id="e-instr" name="instrucoes" style="min-height:120px" placeholder="Ex.: Você tem 50 minutos para fazer a prova.">${esc(e.instrucoes || '')}</textarea></div>
          <div class="campo"><span class="rotulo">Logotipo <span class="opcional">(opcional)</span></span>
            <div class="acoes" style="margin:0">
              <label class="botao pequeno" for="e-logo">${ic('enviar', 'p')} Escolher imagem</label>
              <input type="file" id="e-logo" accept="image/png,image/jpeg" class="sr" />
              <button type="button" class="botao pequeno perigo" id="b-tirar-logo" ${e.logo ? '' : 'hidden'}>Remover</button>
            </div></div>
        </div>
        <div class="cabeca-secao cabeca-com-acao">Topo da prova
          <button type="button" class="botao fantasma pequeno" id="b-campos-padrao" ${e.campos?.length ? '' : 'hidden'}>Voltar ao padrão</button></div>
        <div class="previa-cabecalho" id="previa"></div>
        <p class="dica modelo-nome" id="modelo-nome" hidden></p>
        <div class="importar-cab">
          <label class="botao cheio" for="e-word">${ic('doc', 'p')} Importar cabeçalho de um Word</label>
          <input type="file" id="e-word" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="sr" />
          <p class="dica" id="importar-resultado" role="status">Tem uma prova antiga da escola? O app copia o cabeçalho dela.</p>
        </div>
        <button class="botao principal grande cheio" style="margin-top:16px">Salvar dados da escola</button>
      </form>
    </section>

    <section id="ia" aria-labelledby="t-ia" style="margin-top:32px">
      <div class="cabeca-secao" id="t-ia">Criação automática de questões</div>
      ${pronta ? `<div class="aviso-bloco sucesso">${ic('certo')}<div><strong>Ligada</strong>Cria e confere questões novas quando há internet. Não precisa configurar nada.</div></div>`
        : `<div class="aviso-bloco alerta">${ic('alerta')}<div><strong>Desligada</strong>O app funciona normalmente com o seu banco de questões. Peça para quem instalou o app ligar.</div></div>`}
      <form id="form-ia">
        <label class="alternar" style="margin-bottom:16px"><input type="checkbox" name="revisora" ${cfg.ia.revisora ? 'checked' : ''}/>
          <span><strong>Conferir questões novas automaticamente</strong><small>Recomendado. Uma segunda verificação resolve cada questão sem ver o gabarito e avisa quando discorda.</small></span></label>
        <details class="revelar"><summary>Sobre o Apta<span class="chevron">${ic('seta')}</span></summary>
          <div class="conteudo"><p style="margin:0 0 8px"><img src="/apta-marca.svg" alt="Apta" width="88" height="48" class="marca-clara" /><img src="/apta-marca-escuro.svg" alt="Apta" width="88" height="48" class="marca-escura" /></p>
            <p style="margin:0 0 8px">Prova, versão adaptada e gabarito prontos para imprimir, com questões conferidas. Evolução do MVP Prova Izi.</p>
            <p style="margin:0;color:var(--texto-3);font-size:.88rem">Interface desenhada seguindo as Human Interface Guidelines da Apple: barra de abas flutuante, sheets, listas agrupadas, controle segmentado e tipografia do sistema (SF Pro e SF Pro Rounded).</p></div></details>
        <details class="revelar"><summary>Como o Apta evita erros<span class="chevron">${ic('seta')}</span></summary>
          <div class="conteudo"><ul style="margin:0;padding-left:20px">
            <li>Usa <strong>primeiro as questões do seu banco</strong> e só cria as que faltarem.</li>
            <li>Toda questão passa por uma <strong>verificação automática</strong>: gabarito, alternativas repetidas, “todas as anteriores” e outros erros comuns.</li>
            <li>Questões novas ficam marcadas como <strong>“confira”</strong> até você tocar em <em>Conferir</em>.</li>
          </ul></div></details>
        <details class="revelar"><summary>Avançado (para quem instalou o app)<span class="chevron">${ic('seta')}</span></summary>
          <div class="conteudo">
            <fieldset style="border:0;padding:0;margin:0 0 16px"><legend class="rotulo">Serviço</legend>${fichas('provedor', [['openai', 'OpenAI'], ['claude', 'Anthropic (Claude)']], cfg.ia.provedor === 'claude' ? 'claude' : 'openai')}</fieldset>
            <div class="campo"><label for="ia-openai">Chave da OpenAI</label><span class="dica">Vazio = usa a chave embutida no app.</span>
              <input type="password" id="ia-openai" name="chaveOpenAI" value="${esc(cfg.ia.chaveOpenAI)}" autocomplete="off" spellcheck="false" /></div>
            <div class="campo"><label for="ia-claude">Chave do Claude</label>
              <input type="password" id="ia-claude" name="chaveClaude" value="${esc(cfg.ia.chaveClaude)}" autocomplete="off" spellcheck="false" /></div>
            <p class="dica" style="margin:0">As chaves ficam salvas só neste aparelho.</p>
          </div></details>
        <div class="acoes"><button class="botao principal">Salvar</button><button type="button" class="botao" id="b-testar">Testar conexão</button></div>
        <p id="resultado-teste" role="status"></p>
      </form>
    </section>

    <section aria-labelledby="t-tema" style="margin-top:32px">
      <div class="cabeca-secao" id="t-tema">Aparência</div>
      <div class="cartao-form">
        <fieldset style="border:0;padding:0;margin:0"><legend class="rotulo">Tema do app</legend>
          <span class="dica">Recomendado: Claro. A tela fica parecida com a folha que os alunos recebem.</span>
          ${fichas('tema', TEMAS, temaAtual())}</fieldset>
      </div>
    </section>`;

  if (ancora === 'ia' || ancora === 'escola') document.getElementById(ancora)?.scrollIntoView();

  const form = main.querySelector('#form-escola');
  let logo = e.logo;
  let campos = e.campos || [];
  let modelo = e.modelo || null; // { id, nome } do Word da escola
  const previa = () => {
    const fd = new FormData(form);
    const instr = (fd.get('instrucoes') || '').trim();
    main.querySelector('#previa').innerHTML = cabecalhoHTML({ materia: 'Matemática', serie: '5º ano', data: new Date().toLocaleDateString('pt-BR') },
      { nome: fd.get('nome'), cidade: fd.get('cidade'), professora: fd.get('professora'), logo, campos, modelo }, false)
      + (instr ? `<div class="instrucoes" style="margin-top:10px"><strong>Instruções:</strong><div>${md(instr)}</div></div>` : '');
    main.querySelector('#b-tirar-logo').hidden = !logo;
    main.querySelector('#b-campos-padrao').hidden = !campos.length && !modelo;
    main.querySelector('#modelo-nome').hidden = !modelo;
    main.querySelector('#modelo-nome').innerHTML = modelo ? `${ic('doc', 'p')} Cabeçalho do arquivo “${esc(modelo.nome)}”, do jeito que está no Word.` : '';
  };
  previa();
  form.oninput = previa;
  main.querySelector('#e-logo').onchange = async (ev) => { const arq = ev.target.files[0]; if (arq) { logo = await reduzirImagem(arq, 240); previa(); } };
  main.querySelector('#b-tirar-logo').onclick = () => { logo = ''; previa(); };
  main.querySelector('#b-campos-padrao').onclick = () => {
    const antes = { campos, modelo }; campos = []; modelo = null; previa();
    aviso('O cabeçalho voltou ao padrão do app. Salve para confirmar.', { rotulo: 'Desfazer', fn: () => { ({ campos, modelo } = antes); previa(); } });
  };
  main.querySelector('#e-word').onchange = async (ev) => {
    const arq = ev.target.files[0]; ev.target.value = '';
    if (!arq) return;
    const res = main.querySelector('#importar-resultado');
    res.textContent = 'Lendo o arquivo…';
    try {
      const r = await lerCabecalhoWord(arq);
      if (!r.modelo && !r.achou) { res.textContent = 'Não achei um cabeçalho nesse arquivo. Ele precisa ter o cabeçalho antes da primeira questão.'; return; }
      const antes = { nome: form.nome.value, cidade: form.cidade.value, professora: form.professora.value, instrucoes: form.instrucoes.value, logo, campos, modelo };
      // O cabeçalho vai do jeito que está no Word (o arquivo inteiro do cabeçalho vira o modelo)
      if (r.modelo) {
        const id = uid();
        await guardarArquivo({ id, nome: arq.name, bytes: r.modelo, criadoEm: Date.now() });
        modelo = { id, nome: arq.name.replace(/\.docx$/i, '') };
        campos = [];
      }
      if (r.nome) form.nome.value = r.nome;
      if (r.cidade) form.cidade.value = r.cidade;
      if (r.professora) form.professora.value = r.professora;
      if (r.instrucoes) form.instrucoes.value = r.instrucoes;
      if (r.logo) logo = await reduzirImagem(r.logo, 240);
      if (!r.modelo && r.campos.length) campos = r.campos;
      previa();
      res.innerHTML = r.modelo ? `<strong>${ic('certo', 'p')} Cabeçalho importado como está no Word.</strong> Confira a prévia e salve.`
        : `<strong>${ic('certo', 'p')} Importei os dados do cabeçalho.</strong> Confira a prévia e salve.`;
      main.querySelector('#previa').scrollIntoView({ behavior: menosMovimento() ? 'auto' : 'smooth', block: 'center' });
      aviso('Cabeçalho importado.', { rotulo: 'Desfazer', fn: () => {
        form.nome.value = antes.nome; form.cidade.value = antes.cidade; form.professora.value = antes.professora; form.instrucoes.value = antes.instrucoes;
        logo = antes.logo; campos = antes.campos; modelo = antes.modelo; previa(); res.textContent = 'Importação desfeita.';
      } });
    } catch (err) { console.error(err); res.textContent = err.message || 'Não consegui ler esse arquivo.'; }
  };
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    try {
      salvarConfig({ ...getConfig(), escola: { nome: fd.get('nome').trim(), cidade: fd.get('cidade').trim(), professora: fd.get('professora').trim(), instrucoes: fd.get('instrucoes').replace(/\r/g, '').trim(), logo, campos, modelo } });
      aviso('Dados da escola salvos.');
    } catch (err) { aviso(err.message); }
  };

  const formIA = main.querySelector('#form-ia');
  const lerIA = () => {
    const fd = new FormData(formIA);
    const c = getConfig();
    return { ...c, ia: { ...c.ia, revisora: fd.get('revisora') === 'on', provedor: fd.get('provedor') || 'openai', chaveOpenAI: fd.get('chaveOpenAI').trim(), chaveClaude: fd.get('chaveClaude').trim() } };
  };
  formIA.onsubmit = (ev) => { ev.preventDefault(); salvarConfig(lerIA()); try { localStorage.removeItem('pf.modeloOpenAI'); } catch {} aviso('Ajustes salvos.'); };
  main.querySelector('#b-testar').onclick = async () => {
    const r = main.querySelector('#resultado-teste');
    const c = lerIA();
    if (!iaDisponivel(c)) { r.textContent = 'Nenhuma chave configurada.'; return; }
    r.textContent = 'Testando…';
    try { await testarConexao(c); r.innerHTML = `<strong style="color:var(--verde)">Conexão funcionando.</strong>`; }
    catch (err) { r.innerHTML = `<strong style="color:var(--vermelho)">${esc(err.message)}</strong>`; }
  };
}

/** Diminui a imagem do logo para não ocupar muito espaço no aparelho. */
function reduzirImagem(arquivo, max) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/png'));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = falha;
    img.src = URL.createObjectURL(arquivo);
  });
}

Promise.allSettled([carregarImagens(), carregarMateriais()]).finally(rotear);
