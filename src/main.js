// =========================================================
// Apta — telas do app (mobile primeiro).
// Rotas: #/  #/nova  #/prova/ID  #/provas  #/banco  #/ajustes
// =========================================================
import '@fontsource-variable/nunito';
import './styles.css';
import './apta-figma.css';
import { registerSW } from 'virtual:pwa-register';
import {
  getConfig, salvarConfig, getBanco, salvarBanco, adicionarAoBanco, getProvas, getProva,
  salvarProva, apagarProva, uid, normalizar, CONFIANCA,
} from './store.js';
import {
  MATERIAS, SERIES, DIFICULDADES, TIPOS, escolherDoBanco, prepararParaProva,
  embaralharAlternativas, textoGabarito, adaptarSemIA,
} from './montador.js';
import { validarQuestao, validarProva } from './validador.js';
import { gerarQuestoes, revisarQuestoes, iaDisponivel, testarConexao, buscarNaInternet, gerarIlustracao, conferirFigura, baixarImagemInternet, ErroIA, questoesDoMaterial, questoesDaFoto } from './ia.js';
import { carregarImagens, obterImagem, guardarImagem, rasterizar, svgSeguro, imagensDasQuestoes, importarImagens } from './imagens.js';
import { baixarWord, cfgAdaptada } from './word.js';
import { lerCabecalhoWord, camposCabecalho } from './importar-cabecalho.js';
import { temModelo, modeloEmCache, preencherModelos } from './modelo-tela.js';
import { carregarMateriais, listarMateriais, guardarArquivo, obterMaterial, salvarMaterial, apagarMaterial, lerPDF, trechosRelevantes, paginasComQuestoes, lotesDePaginas, estaNoTexto } from './materiais.js';

// Atualiza sozinho: procura versão nova ao abrir, a cada 30 min e ao voltar para o app.
// Assim nenhum aparelho fica preso numa versão antiga guardada pelo modo offline.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const checar = () => reg.update().catch(() => {});
    setInterval(checar, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checar(); });
  },
});

const main = document.getElementById('conteudo');
document.body.classList.add('figma');

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
function temaAtual() {
  try { const t = localStorage.getItem('pf.tema'); return TEMAS.some(([v]) => v === t) ? t : 'claro'; } catch { return 'claro'; }
}
function aplicarTema(t = temaAtual()) {
  const escuro = t === 'escuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('escuro', escuro);
  corDaBarra();
}
/** Cor da barra do sistema: a cor do papel (claro) ou do grafite (escuro). */
function corDaBarra() {
  const escuro = document.documentElement.classList.contains('escuro');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#163f9e' : '#1f56d1');
}
aplicarTema();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicarTema());
document.addEventListener('change', (e) => {
  // Só o seletor de tema em Ajustes (rádios). O campo do conteúdo da prova também se chama "tema".
  if (e.target.name !== 'tema' || e.target.type !== 'radio' || !TEMAS.some(([v]) => v === e.target.value)) return;
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
  inclusao: '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="7.2" r="1.4"/><path d="M7.3 9.9l4.7 1 4.7-1M12 10.9v3.4M9.6 18.2l2.4-3.9 2.4 3.9"/>', // accessibility (SF Symbols)
  menos: '<path d="M5 12h14"/>',
  updown: '<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  aparencia: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>',
  compartilhar: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M8 10H6v11h12V10h-2"/>',
  turma: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><circle cx="17" cy="9" r="2.6"/><path d="M16.2 14c2.5.1 4.2 1.6 4.8 4"/>',
  livro: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M13 4h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  refazer: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  texto: '<path d="M3.5 18L8 6h1l4.5 12M5 14h7"/><path d="M14.5 18l3-7.5h.6l3 7.5M15.6 15.5h4.4"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  certoCirc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  negrito: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  moldura: '<rect x="4" y="4" width="16" height="16" rx="1.5"/><rect x="7.5" y="7.5" width="9" height="9"/>',
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
function abrirGaveta(titulo, corpo, aoMontar, { centro = false } = {}) {
  gavetaEl.classList.toggle('centro', centro);
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
];
const linkNav = (n) => `<a href="#/${n.rota}" class="${n.classe || ''}" data-rota="${n.rota}"${n.classe === 'criar' ? ` aria-label="${n.longo}"` : ''}>
  <span class="pilula">${ic(n.icone)}</span><span class="nav-rotulo">${n.rotulo}</span></a>`;
document.getElementById('nav').innerHTML = `<div class="abas">${NAV.filter((n) => n.classe !== 'criar').map(linkNav).join('')}</div>${NAV.filter((n) => n.classe === 'criar').map(linkNav).join('')}`;

/** Telas "empilhadas" (criar e editar) entram deslizando da direita, como no iPhone;
 *  trocar de aba só esmaece. */
const EMPILHADAS = ['nova', 'lote', 'prova', 'semana', 'livro'];
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
  const rota = ['escola', 'ia'].includes(rotaBruta) ? 'ajustes' : rotaBruta === 'provas' ? '' : rotaBruta;
  const ativa = ['prova', 'nova', 'lote', 'semana'].includes(rota) ? '' : rota === 'livro' ? 'banco' : rota;
  const direcao = direcaoEntre(rotaAnterior, rota);
  rotaAnterior = rota;
  fecharGaveta();
  if (sairDosAjustes) { const f = sairDosAjustes; sairDosAjustes = null; f(); }
  const desenhar = () => {
    document.querySelectorAll('.nav a').forEach((a) => {
      if (a.dataset.rota === ativa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.body.classList.toggle('foco', ['nova', 'prova', 'semana', 'livro', 'lote'].includes(rota) || (rota === 'ajustes' && id === 'modelo'));
    document.body.classList.toggle('em-inicio', !telasConhecidas.includes(rota) || rota === '');
    corDaBarra();
    main.classList.toggle('largo', rota === 'prova');
    main.onclick = null;
    if (!direcao || !usaTransicao()) { main.classList.remove('entrar'); void main.offsetWidth; main.classList.add('entrar'); }
    const telas = { '': telaInicio, nova: telaNova, lote: telaLote, prova: () => telaProva(id), banco: telaBanco, ajustes: () => telaAjustes(['escola', 'ia'].includes(rotaBruta) ? rotaBruta : id), semana: telaSemana, livro: telaLivro };
    document.body.classList.remove('boas-vindas');
    if (rota === '' && precisaBoasVindas()) { telaBoasVindas(); window.scrollTo(0, 0); return; }
    (telas[rota] || telaInicio)();
    cascata();
    window.scrollTo(0, 0);
  };
  if (direcao) transicao(desenhar, direcao); else desenhar();
}
addEventListener('hashchange', rotear);
const telasConhecidas = ['', 'nova', 'lote', 'prova', 'provas', 'banco', 'ajustes', 'semana', 'livro'];

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

/** A prova de verdade, em miniatura: a folha renderizada (cabeçalho, título e primeiras questões)
 *  e reduzida para caber no quadro. Nada de linhas falsas. */
function miniaturaFolha(p, escola) {
  const qs = (p.questoes || []).slice(0, 4).map((q, i) => questaoHTML(q, i, 'normal')).join('');
  const html = `${cabecalhoHTML(p, escola, false)}
    <div class="titulo-prova">${esc(p.titulo)}</div>
    ${p.instrucoes ? `<div class="instrucoes"><strong>Instruções:</strong><div>${md(p.instrucoes)}</div></div>` : ''}
    ${qs}`;
  return `<span class="mini-quadro" aria-hidden="true"><span class="folha mini-folha">${html.replace(/contenteditable="true"/g, '')}</span></span>`;
}
/** Ajusta a escala de cada miniatura à largura do quadro (A4 = 794 px de largura). */
function escalarMiniaturas(raiz = document) {
  raiz.querySelectorAll('.mini-quadro').forEach((q) => q.style.setProperty('--k', String(q.clientWidth / 794)));
}
addEventListener('resize', () => escalarMiniaturas());

function cartaoProva(p, escola) {
  const st = statusProva(p);
  return `<div class="cartao-folha">
    <a class="cf-link" href="#/prova/${p.id}">
      ${miniaturaFolha(p, escola)}
      <span class="cf-texto">
        <strong>${esc(tituloCurto(p))}</strong>
        <span class="cf-meta"><span class="ponto-materia" style="--cor:${corMateria(p.materia)}"></span><span class="cf-meta-txt">${esc(p.materia || 'Prova')} · ${esc(turmaDe(p))}</span></span>
        <span class="cf-estado ${st.pendentes ? 'conferir' : 'pronta'}">${st.pendentes ? `<mark>${st.pendentes} para conferir</mark>` : `${ic('certo', 'p')} Pronta`}</span>
      </span>
    </a>
    <button type="button" class="cf-baixar" data-baixar="${p.id}" aria-label="Baixar ${esc(tituloCurto(p))}">${ic('baixar', 'p')}</button>
  </div>`;
}

let filtroProvas = '';
let turmaRapida = -1;
let verTodas = false;
/** Cartão de uma prova na Início: miniatura da folha, matéria, turma e situação. */
function cartaoProvaApta(p) {
  const st = statusProva(p);
  return `<div class="cartao-apta" style="position:relative">
    <a class="prova-cartao" href="#/prova/${p.id}">
      <span class="mini" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>
      <span class="txt"><strong>${esc(tituloCurto(p))}</strong><small>${esc(p.materia || 'Prova')} · ${esc(turmaDe(p))} · ${plural((p.questoes || []).length, 'questão', 'questões')}</small><br>
        <span class="estado-apta ${st.pendentes ? 'rev' : 'ok'}">${st.pendentes ? `${ic('alerta')} ${st.pendentes} para revisar` : `${ic('certo')} Pronta`}</span></span>
    </a>
    <button type="button" class="baixar-redondo" data-baixar="${p.id}" aria-label="Baixar ${esc(tituloCurto(p))}">${ic('baixar')}</button></div>`;
}
function telaInicio() {
  titulo('Provas');
  const cfg = getConfig();
  const provas = getProvas();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const primeiroNome = (cfg.escola.professora || '').trim().split(' ')[0];
  const turmas = getTurmas().slice(0, 3);
  if (turmaRapida >= turmas.length) turmaRapida = -1;
  const s = getSemana();
  const itens = itensSemana(s);
  const c = contarSemana(itens);
  // Blocos: 1) saudação no céu  2) o caderno onde a prova começa  3) a semana de provas  4) as provas
  main.innerHTML = `<div class="inicio">
    <header class="ceu">
      <div class="ceu-grande"><div><h1>${saudacao}${primeiroNome ? `, ${esc(primeiroNome)}` : ''}</h1>
        ${cfg.escola.nome ? `<p>${ic('escola')} ${esc(cfg.escola.nome)}</p>` : ''}</div></div>
    </header>
    <section class="caderno-apta" aria-labelledby="t-caderno">
      ${VISTO('caderno-visto')}
      <div class="caderno-folha">
        <h2 id="t-caderno">O que vamos avaliar?</h2>
        <form class="campo-criar" id="form-rapido" role="search" aria-label="Começar uma prova">
          <label for="rapido-tema" class="visualmente-oculto">Conteúdo da prova</label>
          <input type="text" id="rapido-tema" name="tema" placeholder="Ex.: frações" autocomplete="off" enterkeyhint="go" />
          <button type="submit">${ic('brilho')} Criar</button>
        </form>
        <div class="para-turmas" role="radiogroup" aria-label="Para qual turma">
          <span>Para</span>
          ${turmas.map((t, k) => `<button type="button" role="radio" class="chip-apta" data-rapida="${k}" aria-checked="${k === turmaRapida}">${ic('turma')} ${esc(t.nome)}</button>`).join('')}
          <button type="button" class="chip-apta mais" id="b-outra-turma">${ic('mais')} Outra</button>
        </div>
      </div>
    </section>
    <a class="cartao-apta semana-cartao" href="#/semana">
      <div class="semana-topo">${ic('calendario')}<div class="txt"><strong>Semana de provas</strong>
        <small>${s ? `${periodoTexto(s)} · ${faltamDias(s)}` : 'Planeje as provas da semana e acompanhe o que falta'}</small></div><span class="chev">${ic('seta', 'p')}</span></div>
      ${s && itens.length ? `${barraProgresso(c)}${legendaProgresso(c)}` : ''}
    </a>
    <div class="secao-linha"><h2>Suas provas</h2>${provas.length > 3 ? `<button type="button" id="b-ver-todas">${verTodas ? 'Ver menos' : 'Ver todas'}</button>` : ''}</div>
    ${provas.length
      ? `<div class="provas-lista" role="list">${(verTodas ? provas : provas.slice(0, 3)).map((p) => `<div role="listitem">${cartaoProvaApta(p)}</div>`).join('')}</div>`
      : `<div class="cartao-apta vazio-apta"><strong>Nenhuma prova ainda</strong>Escreva o conteúdo no caderno e toque em Criar. Em cerca de um minuto ela fica pronta, com as versões adaptadas e o gabarito.</div>`}
  </div>`;
  main.querySelectorAll('[data-baixar]').forEach((b) => (b.onclick = () => menuBaixar(getProva(b.dataset.baixar))));
  main.querySelectorAll('[data-rapida]').forEach((b) => (b.onclick = () => {
    turmaRapida = Number(b.dataset.rapida) === turmaRapida ? -1 : Number(b.dataset.rapida);
    main.querySelectorAll('[data-rapida]').forEach((x) => x.setAttribute('aria-checked', String(Number(x.dataset.rapida) === turmaRapida)));
    vibrar(6);
  }));
  main.querySelector('#b-outra-turma').onclick = () => gavetaTurma(() => { turmaRapida = Math.min(getTurmas().length - 1, 2); telaInicio(); });
  main.querySelector('#b-ver-todas')?.addEventListener('click', () => { verTodas = !verTodas; transicao(telaInicio, 'segmento'); });
  // Com o conteúdo e a turma, vai direto para os ajustes da prova (etapa 2)
  main.querySelector('#form-rapido').onsubmit = (ev) => {
    ev.preventDefault();
    const tema = ev.target.tema.value.trim();
    rascunho = novoRascunho();
    if (turmaRapida >= 0) Object.assign(rascunho, { turma: turmas[turmaRapida].nome, serie: turmas[turmaRapida].serie });
    rascunho.tema = tema;
    if (tema && turmaRapida >= 0) rascunho.passo = 2;
    location.hash = '#/nova';
  };
}

/** Baixar direto do Início: as três versões, um toque cada. */
function menuBaixar(p) {
  if (!p) return;
  abrirGaveta('Baixar em Word', menu([
    { op: 'normal', icone: 'doc', rotulo: 'Prova', dica: tituloCurto(p) },
    ...versoesDa(p).map((v, k) => ({ op: `v${k}`, icone: 'inclusao', rotulo: `V${k + 1} · ${v.nome}`, dica: resumoCfg(v.cfg) })),
    { op: 'gabarito', icone: 'certo', rotulo: 'Gabarito', dica: 'Só para você' },
  ]), (g) => g.addEventListener('click', async (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op; if (!op) return;
    fecharGaveta();
    const moldura = getFolhaCfg().moldura;
    try {
      let nome;
      if (op.startsWith('v')) { const v = versoesDa(p)[Number(op.slice(1))]; nome = await baixarWord({ ...provaDaVersao(p, v), titulo: `${p.titulo} - ${v.nome}` }, getConfig().escola, 'adaptada', { moldura }); }
      else nome = await baixarWord(p, getConfig().escola, op, { moldura });
      aviso(`“${nome}” baixado.`);
    }
    catch (err) { console.error(err); aviso('Não foi possível gerar o arquivo do Word.'); }
  }));
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
const TOTAL_PASSOS = 4;
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
    tipos: ultimo.tipos || ['multipla', 'aberta'], adaptada: ultimo.adaptada !== false, figuras: ultimo.figuras === true,
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

/** Topo de tela modal (como um sheet do iOS): ação à esquerda, título no meio. */
function barraModal(esquerda, titulo, direita = '') {
  return `<div class="barra-modal">
    <div class="bm-lado">${esquerda}</div><strong class="bm-titulo">${titulo}</strong><div class="bm-lado direita">${direita}</div></div>`;
}
/** "Uma prova | Várias provas": as duas formas de criar, expostas no topo. */
function segmentoCriar(atual) {
  return `<div class="segmentos segmento-criar" role="tablist" aria-label="Quantas provas">
    <button type="button" role="tab" aria-selected="${atual === 'uma'}" data-modo-criar="uma">Uma prova</button>
    <button type="button" role="tab" aria-selected="${atual === 'varias'}" data-modo-criar="varias">Várias provas</button></div>`;
}
/** Linha de lista agrupada com um seletor nativo; o valor fica à direita, na cor de destaque. */
const linhaSelect = (id, rotulo, nome, opcoes, atual) => `<label class="linha-ios" for="${id}"><span class="li-rotulo">${rotulo}</span>
  <span class="li-valor"><select id="${id}" name="${nome}">${opcoes.map(([v, r]) => `<option value="${esc(v)}" ${v === atual ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select>${ic('updown', 'li-seta')}</span></label>`;
const linhaTexto = (id, rotulo, nome, valor, ph) => `<label class="linha-ios" for="${id}"><span class="li-rotulo">${rotulo}</span>
  <input class="li-campo" type="text" id="${id}" name="${nome}" value="${esc(valor)}" placeholder="${esc(ph)}" autocomplete="off" /></label>`;
const linhaEscolha = (tipo, nome, valor, marcado, rotulo, sub = '') => `<label class="linha-ios escolha"><input class="visualmente-oculto" type="${tipo}" name="${nome}" value="${esc(valor)}" ${marcado ? 'checked' : ''}/>
  <span class="li-rotulo">${rotulo}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="li-check" aria-hidden="true">${ic('certo')}</span></label>`;

/* Criar prova em 4 etapas na tela (Turma · Ajustes · Questões · Adaptadas); a 5ª, Revisão, é a própria prova. */
const ICONE_TIPO = { multipla: 'lista', vf: 'certoCirc', completar: 'lapis', aberta: 'doc' };
function desenharPasso(opcoes = {}) {
  const r = rascunho;
  const cfg = getConfig();
  const temIA = iaDisponivel(cfg);
  if (!r.versoes) r.versoes = getPerfis().map(novaVersao);
  if (!r.fontes) r.fontes = { ia: temIA && r.modo !== 'banco', banco: r.modo !== 'ia' };
  let corpo = '';
  let cabeca = ['', ''];
  let botao = '';
  if (r.passo === 1) {
    const turmas = getTurmas();
    const materias = todasMaterias();
    cabeca = ['Para quem é a prova?', 'Escolha a turma. A gente cuida do resto.'];
    corpo = `<h2 class="secao-azul" id="q-turma">Para qual turma?</h2>
      <div role="radiogroup" aria-labelledby="q-turma">${turmas.map((t, k) => `<button type="button" role="radio" class="turma-op" data-turma="${k}" aria-checked="${r.turma === t.nome && r.serie === t.serie}">
        <span class="avatar">${ic('turma')}</span><span class="txt"><strong>${esc(t.nome)}</strong><small>${esc(descTurma(t))}</small></span><span class="marca-circ">${ic('certo')}</span></button>`).join('')}</div>
      ${turmas.length ? '' : '<p class="ajuda" style="margin:0 2px 6px">Cadastre a primeira turma para começar.</p>'}
      <button type="button" class="link-apta" id="b-outra-turma">${ic('mais')} Outra turma</button>
      <div class="erro-apta" id="turma-erro" hidden>${ic('alerta', 'p')} Escolha a turma.</div>
      <h2 class="secao-azul" id="q-materia">Matéria</h2>
      <div class="chips-apta" role="radiogroup" aria-labelledby="q-materia">${materias.map((m) => `<button type="button" role="radio" class="chip-apta" data-materia="${esc(m)}" aria-checked="${r.materia === m}">${icMateria(m)} ${esc(m)}</button>`).join('')}
        <button type="button" class="chip-apta mais" id="b-outra-materia">${ic('mais')} Outra matéria</button></div>`;
    botao = 'Continuar para configurações';
  }
  if (r.passo === 2) {
    cabeca = ['Seu jeito de avaliar', 'Quantidade, formato e desafio na medida.'];
    corpo = `<h2 class="secao-azul" id="q-qtd">Quantas questões?</h2>
      <div class="cartao-apta contador-apta" style="box-shadow:none"><span>Questões</span><div class="ctrl" role="group" aria-labelledby="q-qtd">
        <button type="button" data-passo="-1" aria-label="Uma questão a menos">${ic('menos')}</button><output id="qtd" aria-live="polite">${r.quantidade}</output>
        <button type="button" data-passo="1" aria-label="Uma questão a mais">${ic('mais')}</button></div></div>
      <div class="atalhos-apta" role="group" aria-label="Quantidades comuns">${[5, 10, 15, 20].map((n) => `<button type="button" data-qtd="${n}" aria-pressed="${r.quantidade === n}">${n}</button>`).join('')}</div>
      <h2 class="secao-azul" id="q-tipos">Tipos de questão</h2>
      <ul class="lista-apta" role="group" aria-labelledby="q-tipos">${Object.entries(TIPOS).map(([v, rot]) => `<li><label class="opcao-linha">${ic(ICONE_TIPO[v] || 'doc')}<span class="txt">${esc(rot.split(' (')[0])}</span>
        <input type="checkbox" name="tipos" value="${v}" ${r.tipos.includes(v) ? 'checked' : ''}/><span class="marca-circ">${ic('certo')}</span></label></li>`).join('')}</ul>
      <div class="erro-apta" id="tipos-erro" hidden>${ic('alerta', 'p')} Marque pelo menos um tipo.</div>
      <h2 class="secao-azul" id="q-dif">Dificuldade</h2>
      <div class="seg-apta cinza" role="radiogroup" aria-labelledby="q-dif">${Object.entries(DIFICULDADES).map(([v, rot]) => `<button type="button" role="radio" data-dif="${v}" aria-selected="${r.dificuldade === v}" aria-checked="${r.dificuldade === v}">${esc(rot)}</button>`).join('')}</div>
      ${temIA ? `<ul class="lista-apta" style="margin-top:18px"><li><label class="opcao-linha">${ic('imagem')}<span class="txt">Figuras quando ajudarem<small>A IA cria e confere cada figura</small></span>
        <input type="checkbox" class="switch-apta" name="figuras" ${r.figuras ? 'checked' : ''}/></label></li></ul>` : ''}`;
    botao = 'Continuar para questões';
  }
  if (r.passo === 3) {
    cabeca = ['O que vamos avaliar?', 'Traga o conteúdo que sua turma aprendeu.'];
    const sugs = (SUGESTOES[r.materia] || []).filter((s) => !r.tema.toLowerCase().includes(s.toLowerCase())).slice(0, 3);
    const conferidas = getBanco().filter((q) => q.materia === r.materia && ['minha', 'revisada'].includes(q.origem)).length;
    corpo = `<h2 class="secao-azul"><label for="tema">Sobre o que é a prova?</label></h2>
      <div class="caderno-campo"><textarea id="tema" name="tema" placeholder="Ex.: frações: comparar e somar frações com o mesmo denominador">${esc(r.tema)}</textarea></div>
      <p class="ajuda">Quanto mais específico, mais certeira fica a prova.</p>
      <div class="erro-apta" id="tema-erro" hidden>${ic('alerta', 'p')} Escreva o conteúdo para continuar.</div>
      ${sugs.length ? `<div class="pilha" style="justify-items:start;margin-top:10px;gap:8px">${sugs.map((s) => `<button type="button" class="chip-apta" data-sug="${esc(s)}">${ic('mais')} ${esc(s)}</button>`).join('')}</div>` : ''}
      <h2 class="secao-azul">De onde vêm as questões?</h2>
      <ul class="lista-apta">
        <li><label class="opcao-linha">${ic('brilho')}<span class="txt">Criar com IA<small>${temIA ? 'Questões novas, conferidas uma a uma' : 'Ligue a criação automática em Ajustes'}</small></span>
          <input type="checkbox" class="switch-apta" name="fonteIA" ${r.fontes.ia && temIA ? 'checked' : ''} ${temIA ? '' : 'disabled'}/></label></li>
        <li><label class="opcao-linha">${ic('banco')}<span class="txt">Do meu banco<small>${conferidas} ${conferidas === 1 ? 'questão' : 'questões'} de ${esc(r.materia)} já ${conferidas === 1 ? 'conferida' : 'conferidas'}</small></span>
          <input type="checkbox" class="switch-apta" name="fonteBanco" ${r.fontes.banco ? 'checked' : ''}/></label></li>
        ${temIA && listarMateriais().length ? `<li><label class="opcao-linha">${ic('livro')}<span class="txt">Livro de base<small>A IA segue o conteúdo do livro</small></span>
          <select name="materialId" style="max-width:45%;border:0;background:none;color:var(--azul);font:inherit"><option value="">Nenhum</option>${materiaisDaMateria(r.materia).map((m) => `<option value="${m.id}" ${m.id === r.materialId ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></label></li>` : ''}
      </ul>
      <div class="erro-apta" id="fonte-erro" hidden>${ic('alerta', 'p')} Ligue pelo menos uma origem.</div>`;
    botao = 'Continuar para adaptações';
  }
  if (r.passo === 4) {
    cabeca = ['Uma prova, vários jeitos', 'Crie quantas versões sua turma precisar.'];
    corpo = `<div style="text-align:center"><button type="button" class="link-apta" id="b-add-versao" style="font-weight:600">${ic('mais')} Adicionar versão adaptada</button></div>
      <div style="margin-top:12px">${r.versoes.map((v, k) => `<div class="cartao-apta versao-cartao" style="box-shadow:none">
        <div class="topo-v"><span class="tag-v">V${k + 1}</span><strong>${esc(v.nome)}</strong><button type="button" class="q-icone cinza" data-rem-versao="${k}" aria-label="Tirar a versão ${esc(v.nome)}">${ic('fechar', 'p')}</button></div>
        <p>${esc(resumoCfg(v.cfg))}</p>
        <div class="duas"><button type="button" class="btn-apta suave pequeno" style="width:100%" data-editar-versao="${k}">Editar ajustes</button>
          <button type="button" class="btn-apta suave pequeno" style="width:100%" data-dup-versao="${k}">Duplicar versão</button></div></div>`).join('')}</div>
      <p class="ajuda">${r.versoes.length ? 'A original é mantida. Cada versão tem seus ajustes.' : 'Sem versões adaptadas: sai só a original e o gabarito.'}</p>`;
    botao = `${ic('brilho')} ${r.versoes.length ? `Criar original + ${plural(r.versoes.length, 'adaptada', 'adaptadas')}` : 'Criar prova'}`;
  }

  main.innerHTML = `${ceu({ esquerda: `<button type="button" class="ceu-botao" id="b-voltar">${r.passo === 1 ? 'Cancelar' : `${ic('voltar')} Voltar`}</button>`, titulo: 'Nova prova', direita: `<span class="ceu-passo">${r.passo} de 5</span>`, etapa: r.passo })}
    <div class="folha-branca"><div class="cabeca-folha"><h1>${cabeca[0]}</h1><p>${cabeca[1]}</p></div>
      <form id="form-passo" novalidate>${corpo}</form></div>
    <div class="barra-acoes"><button type="button" class="btn-apta" id="b-seguir">${botao}</button></div>`;

  const form = main.querySelector('#form-passo');
  const redesenhar = () => { lerPasso(form); desenharPasso({ manterRolagem: true }); };
  form.addEventListener('submit', (e) => { e.preventDefault(); seguir(); });
  form.addEventListener('change', () => lerPasso(form));
  form.addEventListener('input', () => lerPasso(form));
  // Etapa 1
  form.querySelectorAll('[data-turma]').forEach((b) => (b.onclick = () => {
    const t = getTurmas()[Number(b.dataset.turma)];
    Object.assign(r, { turma: t.nome, serie: t.serie });
    form.querySelectorAll('[data-turma]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    form.querySelector('#turma-erro').hidden = true; vibrar(6);
  }));
  form.querySelector('#b-outra-turma')?.addEventListener('click', () => gavetaTurma((t) => { Object.assign(r, { turma: t.nome, serie: t.serie }); desenharPasso({ manterRolagem: true }); }));
  form.querySelectorAll('[data-materia]').forEach((b) => (b.onclick = () => {
    r.materia = b.dataset.materia;
    form.querySelectorAll('[data-materia]').forEach((x) => x.setAttribute('aria-checked', String(x === b))); vibrar(4);
  }));
  form.querySelector('#b-outra-materia')?.addEventListener('click', () => abrirGaveta('Nova matéria', `<p class="gaveta-texto">Adicione uma matéria para usar nesta e nas próximas provas.</p>
    <form id="f-materia"><label class="campo-apta"><span>Nome da matéria</span><input name="nome" placeholder="Ex.: Arte" autocomplete="off" required /></label>
    <button class="btn-apta">Adicionar matéria</button><div style="text-align:center"><button type="button" class="texto-btn" data-cancelar>Cancelar</button></div></form>`, (g) => {
    const f = g.querySelector('form'); f.nome.focus();
    g.querySelector('[data-cancelar]').onclick = fecharGaveta;
    f.onsubmit = (ev) => { ev.preventDefault(); const m = guardarMateria(f.nome.value); if (!m) return; r.materia = m; fecharGaveta(); desenharPasso({ manterRolagem: true }); };
  }, { centro: true }));
  // Etapa 2
  const mudarQtd = (n) => {
    r.quantidade = Math.min(20, Math.max(1, n));
    form.querySelector('#qtd').textContent = r.quantidade;
    form.querySelectorAll('[data-qtd]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.qtd) === r.quantidade)));
    vibrar(4);
  };
  form.querySelectorAll('[data-passo]').forEach((b) => (b.onclick = () => mudarQtd(r.quantidade + Number(b.dataset.passo))));
  form.querySelectorAll('[data-qtd]').forEach((b) => (b.onclick = () => mudarQtd(Number(b.dataset.qtd))));
  form.querySelectorAll('[data-dif]').forEach((b) => (b.onclick = () => {
    r.dificuldade = b.dataset.dif;
    form.querySelectorAll('[data-dif]').forEach((x) => { x.setAttribute('aria-selected', String(x === b)); x.setAttribute('aria-checked', String(x === b)); });
  }));
  // Etapa 3
  form.querySelectorAll('[data-sug]').forEach((b) => (b.onclick = () => {
    const t = form.tema.value.trim();
    form.tema.value = t ? `${t}${/[.,;:]$/.test(t) ? '' : ','} ${b.dataset.sug.toLowerCase()}` : b.dataset.sug;
    b.remove(); lerPasso(form); form.tema.focus();
  }));
  // Etapa 4
  form.querySelector('#b-add-versao')?.addEventListener('click', () => escolherPerfil((v) => { r.versoes.push(v); desenharPasso({ manterRolagem: true }); }));
  form.querySelectorAll('[data-editar-versao]').forEach((b) => (b.onclick = () => gavetaAjustesVersao(r.versoes[Number(b.dataset.editarVersao)], () => desenharPasso({ manterRolagem: true }))));
  form.querySelectorAll('[data-dup-versao]').forEach((b) => (b.onclick = () => {
    const v = r.versoes[Number(b.dataset.dupVersao)];
    r.versoes.splice(Number(b.dataset.dupVersao) + 1, 0, { ...structuredClone(v), id: uid(), nome: `${v.nome} (cópia)` });
    desenharPasso({ manterRolagem: true });
  }));
  form.querySelectorAll('[data-rem-versao]').forEach((b) => (b.onclick = () => { r.versoes.splice(Number(b.dataset.remVersao), 1); redesenhar(); }));

  main.querySelector('#b-voltar').onclick = () => {
    if (r.passo === 1) { const voltarSemana = r.planejadaId; rascunho = null; location.hash = voltarSemana ? '#/semana' : '#/'; return; }
    lerPasso(form); r.passo--; transicao(desenharPasso, 'tras');
  };
  main.querySelector('#b-seguir').onclick = seguir;
  if (!usaTransicao() && !opcoes.manterRolagem) { main.classList.remove('entrar'); void main.offsetWidth; main.classList.add('entrar'); }
  if (!opcoes.manterRolagem) window.scrollTo(0, 0);
}

function lerPasso(form) {
  const r = rascunho;
  const fd = new FormData(form);
  if (r.passo === 2) {
    r.tipos = fd.getAll('tipos'); r.figuras = fd.get('figuras') === 'on';
    if (r.tipos.length) form.querySelector('#tipos-erro').hidden = true;
  }
  if (r.passo === 3) {
    r.tema = (fd.get('tema') || '').trim();
    r.fontes = { ia: fd.get('fonteIA') === 'on', banco: fd.get('fonteBanco') === 'on' };
    r.modo = r.fontes.ia && r.fontes.banco ? 'misto' : r.fontes.ia ? 'ia' : 'banco';
    r.materialId = fd.get('materialId') || '';
    if (r.tema) form.querySelector('#tema-erro').hidden = true;
    if (r.fontes.ia || r.fontes.banco) form.querySelector('#fonte-erro').hidden = true;
  }
}

async function seguir() {
  const r = rascunho;
  const form = main.querySelector('#form-passo');
  lerPasso(form);
  if (r.passo === 1 && !getTurmas().some((t) => t.nome === r.turma && t.serie === r.serie)) {
    form.querySelector('#turma-erro').hidden = false; form.querySelector('[data-turma], #b-outra-turma')?.focus(); return;
  }
  if (r.passo === 2 && !r.tipos.length) { form.querySelector('#tipos-erro').hidden = false; form.querySelector('[name=tipos]').focus(); return; }
  if (r.passo === 3 && !r.tema) { form.querySelector('#tema-erro').hidden = false; form.tema.focus(); return; }
  if (r.passo === 3 && !r.fontes.ia && !r.fontes.banco) { form.querySelector('#fonte-erro').hidden = false; return; }
  if (r.passo < 4) { r.passo++; transicao(desenharPasso, 'frente'); return; }
  const pedido = { ...r, adaptada: r.versoes.length > 0 };
  delete pedido.passo; delete pedido.fontes;
  try { const { versoes, planejadaId, ...guardar } = pedido; void versoes; void planejadaId; localStorage.setItem('pf.ultimoPedido', JSON.stringify(guardar)); } catch {}
  const botao = main.querySelector('#b-seguir');
  if (botao) botao.disabled = true;
  try {
    const ok = await criarProva(pedido);
    if (ok) rascunho = null;
  } finally { if (botao) botao.disabled = false; }
}

/* ---------- Tela "Criando sua prova" (céu azul, lista de etapas numa folha) ---------- */
function telaCriando(etapas) {
  const ctrl = new AbortController();
  let avisar = false;
  const el = document.createElement('div');
  el.className = 'criando-apta';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'criando-titulo');
  el.innerHTML = `<div class="meio">
      <span class="icone-app"><img src="/icon.svg" alt="" width="84" height="84" /></span>
      <h1 id="criando-titulo">Criando sua prova</h1>
      <p class="sub">Leva cerca de 1 minuto. Pode sair do app: avisamos quando ficar pronta.</p>
      <div class="criando-pilha"><ol aria-live="polite">${etapas.map((t) => `<li><span class="bolinha" aria-hidden="true"></span><span><span class="et">${esc(t)}</span><small></small></span></li>`).join('')}</ol></div>
    </div>
    <div class="rodape"><button type="button" class="btn-apta contorno" id="b-avisar">Avisar quando ficar pronta</button>
      <button type="button" class="texto-btn" id="b-cancelar">Cancelar</button></div>`;
  el.querySelector('#b-cancelar').onclick = () => ctrl.abort();
  el.querySelector('#b-avisar').onclick = async (e) => {
    const b = e.currentTarget;
    try { if ('Notification' in window) avisar = (await Notification.requestPermission()) === 'granted'; } catch {}
    b.textContent = avisar ? 'Vamos avisar quando ficar pronta' : 'Avisamos aqui quando ficar pronta';
    b.disabled = true;
  };
  document.body.append(el);
  const lis = el.querySelectorAll('ol li');
  return {
    signal: ctrl.signal,
    titulo(t, sub) {
      el.querySelector('#criando-titulo').textContent = t;
      if (sub) el.querySelector('.sub').textContent = sub;
    },
    etapa(i, texto, detalhe = '') {
      lis.forEach((li, j) => {
        li.classList.toggle('feita', j < i); li.classList.toggle('agora', j === i);
        li.querySelector('.bolinha').innerHTML = j < i ? ic('certo') : '';
        if (j !== i) li.querySelector('small').textContent = '';
      });
      if (texto && lis[i]) lis[i].querySelector('.et').textContent = texto;
      if (lis[i]) lis[i].querySelector('small').textContent = detalhe;
    },
    fechar: () => {
      if (avisar && document.hidden) { try { new Notification('Sua prova está pronta', { body: 'Abra o Apta para conferir.', icon: '/icon.svg' }); } catch {} }
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
    instrucoes: getFolhaCfg().instrucoes ? cfg.escola.instrucoes || '' : '',
    temAdaptada: pedido.versoes ? pedido.versoes.length > 0 : pedido.adaptada,
    versoes: (pedido.versoes || (pedido.adaptada === false ? [] : getPerfis().map(novaVersao))).map((v) => ({ ...v, cfg: { ...v.cfg } })),
    pedido, questoes, criadaEm: Date.now(),
  };
  // Veio da semana de provas: a prova fica ligada ao planejamento e ganha o dia marcado
  const semana = pedido.planejadaId ? getSemana() : null;
  const pl = semana?.planejadas?.find((x) => x.id === pedido.planejadaId);
  if (pl) { pl.provaId = prova.id; if (pl.data) prova.data = isoParaBR(pl.data); salvarSemana(semana); }
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
  const etapas = [`Escrevendo ${plural(pedido.quantidade, 'questão', 'questões')}`];
  if (cfg.ia.revisora) etapas.push('Conferindo cada resposta');
  if (pedido.figuras) etapas.push('Criando e conferindo as figuras');
  const nv = pedido.versoes?.length || 0;
  if (nv) etapas.push(`Fazendo ${plural(nv, 'versão adaptada', 'versões adaptadas')}`);
  etapas.push('Montando o gabarito');
  const passo = { criar: 0, conferir: etapas.indexOf('Conferindo cada resposta'), figuras: etapas.indexOf('Criando e conferindo as figuras'), montar: etapas.length - 1 };
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
    ${barraModal('<button type="button" class="bm-botao" id="b-lote-cancelar">Cancelar</button>', 'Várias provas')}
    ${segmentoCriar('varias')}
    <p class="rodape-grupo" style="margin-top:0">Uma prova por cartão. O formato, embaixo, vale para todas.</p>
    <form id="form-lote" novalidate>
      <ol class="lote-lista">${L.linhas.map((l, k) => `<li class="lote-item" data-k="${k}">
        <div class="lote-topo"><h2 class="lote-titulo">Prova ${k + 1}</h2>
          ${L.linhas.length > 1 ? `<button type="button" class="lote-remover" data-remover="${k}" aria-label="Remover prova ${k + 1}">Remover</button>` : ''}</div>
        <div class="duas-colunas">
          <div class="campo"><label for="l-mat-${k}">Matéria</label><select id="l-mat-${k}" data-campo="materia">${opcoesSel(todasMaterias(), l.materia)}<option value="${OUTRA}" ${l.materia === OUTRA ? 'selected' : ''}>Outra…</option></select></div>
          <div class="campo"><label for="l-ser-${k}">Ano</label><select id="l-ser-${k}" data-campo="serie">${opcoesSel(SERIES, l.serie)}</select></div>
        </div>
        ${l.materia === OUTRA ? `<div class="campo"><label for="l-outra-${k}">Qual matéria?</label><input type="text" id="l-outra-${k}" data-campo="materiaOutra" value="${esc(l.materiaOutra || '')}" placeholder="Ex.: Filosofia" autocomplete="off" /></div>` : ''}
        <div class="campo"><label for="l-tema-${k}">Conteúdo</label><textarea id="l-tema-${k}" data-campo="tema" rows="2" placeholder="Ex.: frações">${esc(l.tema)}</textarea></div>
        <div class="campo"><label for="l-turma-${k}">Turma <span class="opcional">(opcional)</span></label><input type="text" id="l-turma-${k}" data-campo="turma" value="${esc(l.turma)}" placeholder="Ex.: 5º A" autocomplete="off" /></div>
        <div class="erro-campo erro-outra" hidden>${ic('alerta', 'p')} Escreva o nome da matéria.</div>
        <div class="erro-campo erro-tema" hidden>${ic('alerta', 'p')} Escreva o conteúdo desta prova.</div>
      </li>`).join('')}</ol>
      <button type="button" class="botao lote-adicionar" id="b-lote-mais">${ic('mais', 'p')} Adicionar prova</button>

      <h2 class="cabeca-grupo">Formato para todas</h2>
      <div class="grupo-ios">
        <div class="linha-ios"><span class="li-rotulo" id="lq-rot">Questões em cada</span>
          <span class="li-valor"><output id="lq" aria-live="polite">${L.quantidade}</output>
          <span class="stepper" role="group" aria-labelledby="lq-rot"><button type="button" data-passo="-1" aria-label="Uma questão a menos">${ic('menos')}</button><span class="st-div"></span><button type="button" data-passo="1" aria-label="Uma questão a mais">${ic('mais')}</button></span></span></div>
        <div class="linha-ios"><span class="li-rotulo">Dificuldade</span>
          <span class="segmentos segmentos-form" role="radiogroup">${Object.entries(DIFICULDADES).map(([v, rot]) => `<label><input type="radio" name="dificuldade" value="${v}" ${L.dificuldade === v ? 'checked' : ''}/><span>${rot}</span></label>`).join('')}</span></div>
        ${temIA ? `<label class="linha-ios" for="l-modo"><span class="li-rotulo">Origem das questões</span><span class="li-valor"><select id="l-modo" name="modo">${[['misto', 'Banco + novas'], ['banco', 'Só do banco'], ['ia', 'Só novas']].map(([v, r]) => `<option value="${v}" ${v === L.modo ? 'selected' : ''}>${r}</option>`).join('')}</select>${ic('updown', 'li-seta')}</span></label>` : '<input type="hidden" name="modo" value="banco" />'}
        ${temIA && listarMateriais().length ? `<label class="linha-ios" for="l-material"><span class="li-rotulo">Livro de base</span><span class="li-valor"><select id="l-material" name="materialId"><option value="">Nenhum</option>${listarMateriais().map((m) => `<option value="${m.id}" ${m.id === L.materialId ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>${ic('updown', 'li-seta')}</span></label>` : ''}
      </div>
      <h2 class="cabeca-grupo" id="lt-rot">Tipos de questão</h2>
      <div class="grupo-ios" role="group" aria-labelledby="lt-rot">${Object.entries(TIPOS).map(([v, rot]) => linhaEscolha('checkbox', 'tipos', v, L.tipos.includes(v), rot.split(' (')[0])).join('')}</div>
      <div class="erro-campo" id="lote-tipos-erro" hidden>${ic('alerta', 'p')} Marque pelo menos um tipo.</div>
      <h2 class="cabeca-grupo">Acessibilidade</h2>
      <div class="grupo-ios"><label class="linha-ios"><span class="li-ic azul">${ic('inclusao')}</span><span class="li-rotulo">Versões adaptadas</span>
        <input type="checkbox" class="switch azul" name="adaptada" ${L.adaptada ? 'checked' : ''} /></label></div>
    </form>
    <div class="barra-acoes">
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
  main.querySelector('[data-modo-criar=uma]').onclick = () => {
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
    planejadaId: l.planejadaId, versoes: L.versoes,
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
  location.hash = '#/';
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
    main.innerHTML = `${ceu({ esquerda: voltarBtn('#/', 'Provas'), titulo: 'Prova', baixo: true })}<div class="folha-branca"><div class="cartao-apta vazio-apta" style="margin:0"><strong>Prova não encontrada</strong>Ela pode ter sido apagada.</div></div>`;
    return;
  }
  if (!Array.isArray(prova.versoes)) prova.versoes = versoesDa(prova);
  const mesma = estado.prova?.id === id;
  estado = { prova, aba: mesma ? estado.aba : 'normal', versao: mesma ? estado.versao || 0 : 0 };
  titulo(prova.titulo);
  main.innerHTML = `<div class="prova-apta">
    ${ceu({ esquerda: voltarBtn('#/', 'Provas'), titulo: `<span id="titulo-texto">${esc(tituloCurto(prova))}</span>`,
      direita: `<button type="button" class="ceu-botao icone" id="b-exportar-topo" aria-label="Exportar">${ic('compartilhar')}</button><button type="button" class="ceu-botao icone" id="b-opcoes" aria-label="Mais opções da prova">${ic('pontos')}</button>`, etapa: 5 })}
    <div class="folha-branca">
      <div class="cabeca-folha nao-imprimir" id="cabeca-prova"></div>
      <div class="seg-apta nao-imprimir" role="tablist" aria-label="Versões da prova">
        <button type="button" role="tab" data-aba="normal">Original</button>
        <button type="button" role="tab" data-aba="adaptada">Adaptadas (${prova.versoes.length})</button>
        <button type="button" role="tab" data-aba="gabarito">Gabarito</button></div>
      <div id="painel-revisao" class="nao-imprimir"></div>
      <div id="painel-versao" class="nao-imprimir"></div>
      <div id="recados" class="nao-imprimir"></div>
      <div role="tabpanel"><div id="folha" class="folha"></div></div>
      <p class="ajuda nao-imprimir" style="display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;margin:14px 0">
        <span id="status-salvo" role="status">Salvo</span> ·
        <button type="button" class="texto-btn" id="b-add" style="min-height:36px">+ Questão</button> ·
        <label class="texto-btn data-chip" style="display:inline-flex;align-items:center;gap:4px;position:relative;min-height:36px">${ic('calendario', 'p')}<span class="data-texto">${dataCurta(prova.data)}</span>
          <input type="date" id="data-prova" value="${dataParaInput(prova.data)}" aria-label="Data da prova" style="position:absolute;inset:0;opacity:0;width:100%" /></label></p>
    </div>
    <div class="barra-acoes nao-imprimir"><button type="button" class="btn-apta" id="b-exportar">Exportar e imprimir</button></div></div>`;

  const recados = JSON.parse(sessionStorage.getItem('pf.recados') || '[]');
  sessionStorage.removeItem('pf.recados');
  if (recados.length) main.querySelector('#recados').innerHTML = `<div class="banner-conf" role="status" style="cursor:default">${ic('alerta')}<span class="txt">${recados.map((t) => `<small style="display:block;color:var(--texto-2)">${esc(t)}</small>`).join('')}</span></div>`;

  main.querySelectorAll('.seg-apta [data-aba]').forEach((b) => (b.onclick = () => { if (estado.aba === b.dataset.aba) return; estado.aba = b.dataset.aba; transicao(desenharFolha, 'segmento'); }));
  main.querySelector('#b-exportar').onclick = () => {
    if (estado.aba === 'adaptada' && estado.prova.versoes.length) { salvarProva(estado.prova); aviso(`Ajustes da versão ${estado.versao + 1} salvos.`); vibrar(8); return; }
    gavetaExportar();
  };
  main.querySelector('#b-exportar-topo').onclick = gavetaExportar;
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
  main.querySelector('#data-prova').addEventListener('change', (e) => {
    const [a, m, d] = e.target.value.split('-');
    estado.prova.data = e.target.value ? `${d}/${m}/${a}` : '';
    main.querySelector('.data-texto').textContent = dataCurta(estado.prova.data);
    salvarDepois(); desenharFolha();
  });
  desenharFolha();
  if (sessionStorage.getItem('pf.celebrar')) { sessionStorage.removeItem('pf.celebrar'); setTimeout(() => celebrar('Prova pronta!'), 350); }
}

/** "17/11/2026" → "17 nov" (data curta para a barra do editor). */
function dataCurta(t = '') {
  const m = String(t).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return 'Data';
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '').replace(' de ', ' ');
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
    { op: 'versoes', icone: 'inclusao', rotulo: 'Versões adaptadas', dica: p.versoes?.length ? plural(p.versoes.length, 'versão', 'versões') : 'Nenhuma ainda' },
    { op: 'exportar', icone: 'enviar', rotulo: 'Exportar e imprimir', dica: 'Word ou PDF, com moldura' },
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
          document.getElementById('titulo-texto').textContent = tituloCurto(p); desenharFolha();
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
    if (op === 'versoes') { fecharGaveta(); estado.aba = 'adaptada'; transicao(desenharFolha, 'segmento'); }
    if (op === 'exportar') { fecharGaveta(); setTimeout(gavetaExportar, 220); }
    if (op === 'embaralhar') { p.questoes.forEach(embaralharAlternativas); salvarDepois(); desenharFolha(); fecharGaveta(); aviso('Alternativas embaralhadas. Gabarito atualizado.'); }
    if (op === 'copia') {
      const c3 = structuredClone(p); c3.id = uid(); c3.titulo += ' (cópia)'; salvarProva(c3);
      fecharGaveta(); location.hash = `#/prova/${c3.id}`; aviso('Cópia criada. Você está editando a cópia.');
    }
    if (op === 'apagar') {
      fecharGaveta();
      const nv = p.versoes?.length || 0;
      alertaIOS({ titulo: 'Apagar esta prova?', texto: `A prova, ${nv ? `${nv === 1 ? 'a versão adaptada' : `as ${nv} versões adaptadas`} e o gabarito` : 'e o gabarito'} saem do aparelho. Não dá para desfazer.`, ok: 'Apagar', perigo: true })
        .then((sim) => { if (!sim) return; apagarProva(p.id); location.hash = '#/'; aviso('Prova apagada.'); });
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
  if (b.dataset.acao === 'refazer') return gavetaRefazer(i);
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

async function novaQuestaoIA(posicao, pedidoExtra = '') {
  const p = estado.prova;
  const cfg = getConfig();
  const pedido = { ...p.pedido, tema: p.tema, materia: p.materia, serie: p.serie, dificuldade: p.dificuldade, tipos: p.pedido?.tipos || ['multipla'] };
  if (pedidoExtra) { pedido.observacoes = [p.pedido?.observacoes, pedidoExtra].filter(Boolean).join(' '); if (posicao !== undefined) pedido.tipos = [p.questoes[posicao].tipo]; }
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
      <button type="button" class="q-chip ${q.revisada ? 'ok' : 'conferir'}" data-acao="conferi" aria-pressed="${Boolean(q.revisada)}">${ic(q.revisada ? 'certo' : 'alerta', 'p')} ${q.revisada ? 'Conferida' : 'Conferir'}</button>
      <span class="q-nivel">${esc(DIFICULDADES[q.dificuldade] || '')}${q.etapas ? ` · ${plural(q.etapas, 'etapa', 'etapas')}` : ''}</span>
      ${seloFigura(q)}${seletorCorreta}
      <button type="button" class="q-icone" data-acao="refazer" aria-label="Refazer a questão ${i + 1}">${ic('refazer')}</button>
      <button type="button" class="q-icone cinza" data-acao="mais" aria-label="Mais opções da questão ${i + 1}">${ic('pontos')}</button>
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
    ${(p.versoes ? p.versoes.length > 0 : p.temAdaptada !== false) ? `<h3>Prova adaptada</h3>${tabela('adaptada')}` : ''}</div>`;
}

function desenharFolha() {
  const p = estado.prova;
  const escola = getConfig().escola;
  const folha = document.getElementById('folha');
  if (!folha) return;
  document.querySelectorAll('.seg-apta [data-aba]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === estado.aba)));
  const cab = document.getElementById('cabeca-prova');
  if (cab) cab.innerHTML = estado.aba === 'adaptada' ? '<h1>Cada versão, um cuidado</h1><p>Ajuste esta versão sem mudar a original.</p>'
    : estado.aba === 'gabarito' ? '<h1>Gabarito</h1><p>Só para você. Toque numa resposta para corrigir.</p>'
      : '<h1>Confira sua prova</h1><p>Revise as questões antes de exportar.</p>';
  const exp = document.getElementById('b-exportar');
  if (exp) exp.textContent = estado.aba === 'adaptada' && p.versoes.length ? 'Salvar ajustes desta versão' : 'Exportar e imprimir';
  folha.className = `folha moldura-${getFolhaCfg().moldura}`;
  folha.dataset.versao = estado.aba;
  document.getElementById('b-add').hidden = estado.aba !== 'normal';
  const painelV = document.getElementById('painel-versao');
  let vista = p;
  if (estado.aba === 'adaptada') {
    if (estado.versao >= p.versoes.length) estado.versao = Math.max(0, p.versoes.length - 1);
    const v = p.versoes[estado.versao];
    painelV.innerHTML = painelVersaoHTML(p, v);
    ligarPainelVersao(painelV);
    if (!v) { folha.hidden = true; desenharPainelRevisao(); return; }
    vista = provaDaVersao(p, v);
    folha.classList.add('adaptada');
    folha.classList.toggle('sem-letra-maior', !v.cfg.letraMaior);
    folha.classList.toggle('sem-dicas', !v.cfg.dicas);
    folha.classList.toggle('sem-negrito', !v.cfg.negrito);
  } else painelV.innerHTML = '';
  folha.hidden = false;
  if (estado.aba === 'gabarito') {
    folha.innerHTML = cabecalhoHTML(p, escola) + gabaritoHTML(p);
  } else {
    folha.innerHTML = `${cabecalhoHTML(vista, escola)}
      <div class="titulo-prova">${esc(p.titulo)}</div>
      <div class="instrucoes${p.instrucoes ? '' : ' vazia'}"><strong>Instruções:</strong><div contenteditable="true" data-cab="instrucoes" aria-label="Instruções da prova">${md(p.instrucoes || '')}</div></div>
      ${vista.questoes.map((q, i) => questaoHTML(q, i, estado.aba)).join('')}`;
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

/** Faixa da conferência: quantas estão conferidas e qual questão pede o olhar da professora. */
function desenharPainelRevisao() {
  const p = estado.prova;
  const el = document.getElementById('painel-revisao');
  if (!el) return;
  if (estado.aba !== 'normal') { el.innerHTML = ''; return; }
  const { comErro, todas } = pendentesDaProva(p);
  const total = p.questoes.length;
  if (!todas.length) {
    el.innerHTML = `<div class="banner-conf ok" role="status">${ic('certoCirc')}<span class="txt"><strong>${total} de ${total} questões conferidas</strong><small>Pronta para exportar e imprimir.</small></span></div>`;
    return;
  }
  const primeira = todas[0] + 1;
  el.innerHTML = `<button type="button" class="banner-conf" id="b-conferencia">${ic('alerta')}<span class="txt"><strong>${total - todas.length} de ${total} questões conferidas</strong>
    <small>${todas.length === 1 ? `A questão ${primeira} precisa do seu olhar.` : `${todas.length} questões precisam do seu olhar${comErro.length ? `, ${plural(comErro.length, 'com possível erro', 'com possível erro')}` : ''}.`}</small></span><span class="ver">Ver</span></button>`;
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

/* =================== BANCO DE QUESTÕES =================== */
let filtroBanco = { materia: '', serie: '', busca: '', origem: '', limite: 25 };
const ORIGENS = [['confiavel', 'Conferidas'], ['material', 'Dos livros (PDF)'], ['internet', 'Da internet'], ['importada', 'Importadas'], ['exemplo', 'Exemplos do app'], ['ia', 'Novas, para conferir']];

function telaBanco() {
  titulo('Banco de questões');
  const banco = getBanco();
  const temIA = iaDisponivel(getConfig());
  const porMateria = todasMaterias().map((m) => [m, banco.filter((q) => q.materia === m).length]).filter(([, n]) => n);
  main.innerHTML = `<div class="banco-apta">
    <header class="ceu"><div class="ceu-grande"><h1>Banco</h1><button type="button" class="ceu-mais" id="b-banco-mais" aria-label="Adicionar questões">${ic('mais')}</button></div></header>
    <div class="cartao-apta busca-cartao">
      <div class="busca-apta">${ic('busca')}<label class="sr" for="f-busca">Procurar questões</label><input type="search" id="f-busca" value="${esc(filtroBanco.busca)}" placeholder="Procurar no banco" />
        <button type="button" id="b-filtros" aria-label="Filtros">${ic('filtro')}</button></div>
      <div class="chips-apta rolar filtro-materias" role="group" aria-label="Matérias"><button type="button" class="chip-apta" data-m="" aria-pressed="${!filtroBanco.materia}">Todas</button>
        ${porMateria.map(([m]) => `<button type="button" class="chip-apta" data-m="${esc(m)}" aria-pressed="${filtroBanco.materia === m}">${icMateria(m)} ${esc(m)}</button>`).join('')}</div>
    </div>
    <button type="button" class="banner-ia" id="b-buscar-web" ${temIA ? '' : 'disabled'}>${ic('brilho')}<span class="txt"><strong>Buscar questões com IA</strong><small>${temIA ? 'Na internet e nos livros que você enviou' : 'Ligue a criação automática em Ajustes'}</small></span>${ic('seta', 'p')}</button>
    <div class="filtros-ativos" id="filtros-ativos" style="margin:10px 16px 0"></div>
    <div id="contador-banco" role="status" class="contagem-banco"></div>
    <ul class="questoes-apta" id="lista-banco"></ul>
    <div class="acoes" style="justify-content:center"><button type="button" class="btn-apta claro pequeno" id="b-mais" hidden>Mostrar mais</button></div>
    <input type="file" id="importar" accept=".json,application/json" hidden /></div>`;

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
    const nConf = filtradas.filter((q) => ['minha', 'revisada'].includes(q.origem)).length;
    main.querySelector('#contador-banco').textContent = `${plural(filtradas.length, 'questão', 'questões')} · ${nConf} ${nConf === 1 ? 'conferida' : 'conferidas'}`.toUpperCase();
    main.querySelector('#lista-banco').innerHTML = filtradas.length ? filtradas.slice(0, filtroBanco.limite).map((q) => {
      const confiavel = q.origem === 'minha' || q.origem === 'revisada';
      const fonte = q.origem === 'ia' ? `<span class="fonte ia">${ic('brilho', 'p')} Criada com IA</span>`
        : q.fonte?.nome ? `<span class="fonte">${ic('livro', 'p')} ${esc(q.fonte.nome)}</span>` : q.origem === 'exemplo' ? '<span class="fonte">Exemplo do app</span>' : '';
      return `<li class="cartao-apta questao-apta">
      <p class="enun">${md(q.enunciado)}</p>
      ${figuraHTML(q)}
      <div class="meta">${icMateria(q.materia)} ${esc(q.materia)} · ${esc(q.serie.replace(' (Ensino Médio)', ' EM'))} · ${esc(DIFICULDADES[q.dificuldade] || 'Médio')} ${fonte}</div>
      <div class="rodape">
        ${confiavel ? `<span class="q-chip ok">${ic('certo', 'p')} Conferida</span>` : `<button type="button" class="q-chip conferir" data-conferir="${q.id}">${ic('alerta', 'p')} Conferir</button>`}
        <button type="button" class="texto-btn resp-btn" data-resp="${q.id}" aria-expanded="false">Resposta</button>
        <button type="button" class="btn-usar" data-usar="${q.id}">Usar</button>
        <button type="button" class="q-icone cinza" data-menu-q="${q.id}" aria-label="Editar ou apagar a questão">${ic('pontos')}</button>
      </div>
      <div class="resposta" id="resp-${q.id}" hidden>
        ${q.tipo === 'multipla' || q.tipo === 'vf' ? `<ol>${q.alternativas.map((a, j) => `<li class="${j === q.correta ? 'certa' : ''}">${q.tipo === 'multipla' ? letra(j) + ') ' : '• '}${md(a)}${j === q.correta ? ' ✓' : ''}</li>`).join('')}</ol>` : ''}
        <strong>Gabarito:</strong> ${esc(textoGabarito(q))}${q.justificativa ? ` · ${esc(q.justificativa)}` : ''}</div></li>`;
    }).join('')
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
    const resp = e.target.closest('[data-resp]');
    if (resp) { const caixa = main.querySelector(`#resp-${resp.dataset.resp}`); caixa.hidden = !caixa.hidden; resp.setAttribute('aria-expanded', String(!caixa.hidden)); return; }
    const usar = e.target.closest('[data-usar]')?.dataset.usar;
    if (usar) { gavetaUsar(getBanco().find((x) => x.id === usar)); return; }
    if (mq) {
      const q = getBanco().find((x) => x.id === mq);
      const confiavel = q.origem === 'minha' || q.origem === 'revisada';
      void confiavel;
      abrirGaveta('Questão', menu([
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
    if (conf) { b.find((q) => q.id === conf).origem = 'revisada'; salvarBanco(b); desenharLista(); vibrar(10); aviso('Conferida. Ela passa a ser usada primeiro nas provas.'); }
    if (apg) {
      const i = b.findIndex((q) => q.id === apg);
      const [rem] = b.splice(i, 1); salvarBanco(b); desenharLista();
      aviso('Questão apagada.', { rotulo: 'Desfazer', fn: () => { const b2 = getBanco(); b2.splice(i, 0, rem); salvarBanco(b2); if (location.hash === '#/banco') desenharLista(); } });
    }
  };
  main.querySelector('#b-banco-mais').onclick = () => abrirGaveta('Adicionar questões', `<div class="pilha">
    <button type="button" class="btn-apta" data-op="escrever">Criar questão</button>
    <ul class="lista-apta">${itemLink('#/livro', 'camera', 'Importar do livro', 'Fotografe a página: as questões entram já conferidas')}</ul>
    <details><summary class="texto-btn" style="list-style:none;text-align:center">Mais formas de adicionar</summary><div style="margin-top:8px">${menu([
    ...(temIA ? [{ op: 'web', icone: 'brilho', rotulo: 'Buscar na internet com IA', dica: 'Traz o link de onde veio cada questão' }] : []),
    { op: 'pdf', icone: 'doc', rotulo: 'Livros e apostilas (PDF)', dica: listarMateriais().length ? plural(listarMateriais().length, 'material guardado', 'materiais guardados') : 'A IA consulta o livro para tirar questões' },
    '-',
    { op: 'importar', icone: 'baixar', rotulo: 'Importar pacote de questões', dica: 'Arquivo recebido de um colega' },
    { op: 'exportar', icone: 'enviar', rotulo: 'Exportar meu banco', dica: 'Gera um arquivo para enviar a colegas' },
  ])}</div></details></div>`, (c) => c.addEventListener('click', (e) => {
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
  }), { centro: true });
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
let sairDosAjustes = null;
function telaAjustesEscola(ancora) {
  titulo(ancora === 'ia' ? 'Criação automática' : 'Minha escola');
  const cfg = getConfig();
  const e = cfg.escola;
  const pronta = iaDisponivel(cfg);
  main.innerHTML = `<div class="sub-tela">${ceu({ esquerda: voltarBtn('#/ajustes', 'Ajustes'), titulo: ancora === 'ia' ? 'Criação automática' : 'Minha escola', baixo: true })}<div class="folha-branca">
    <form id="form-escola" novalidate>
    <section id="escola" class="cartao-ajuste" aria-labelledby="t-escola">
      <header class="ca-cabeca"><div><h2 id="t-escola"><span class="aj-ic">${ic('escola')}</span>Minha escola</h2><p>Aparece no topo de todas as provas.</p></div></header>
      <div class="campo"><label for="e-nome">Nome da escola</label><input type="text" id="e-nome" name="nome" value="${esc(e.nome)}" autocomplete="organization" placeholder="Ex.: Escola Municipal Monteiro Lobato" /></div>
      <div class="campo"><label for="e-prof">Seu nome</label><input type="text" id="e-prof" name="professora" value="${esc(e.professora)}" autocomplete="name" placeholder="Ex.: Maria Souza" /></div>
      <div class="campo"><label for="e-cidade">Cidade <span class="opcional">(opcional)</span></label><input type="text" id="e-cidade" name="cidade" value="${esc(e.cidade)}" placeholder="Ex.: Fortaleza" /></div>
      <div class="campo"><span class="rotulo">Logotipo da escola <span class="opcional">(opcional)</span></span>
        <div class="logo-linha"><span class="logo-amostra" id="logo-amostra"></span>
          <label class="botao" for="e-logo" id="rot-logo">${ic('imagem', 'p')} ${e.logo ? 'Trocar' : 'Escolher imagem'}</label>
          <button type="button" class="botao perigo" id="b-tirar-logo" ${e.logo ? '' : 'hidden'}>Remover</button>
          <input type="file" id="e-logo" accept="image/png,image/jpeg" class="sr" /></div></div>
    </section>

    <section id="topo-prova" class="cartao-ajuste" aria-labelledby="t-topo">
      <header class="ca-cabeca"><div><h2 id="t-topo"><span class="aj-ic">${ic('doc')}</span>Topo da prova</h2><p>É assim que o cabeçalho sai no papel.</p></div></header>
      <div class="previa-cabecalho" id="previa"></div>
      <p class="dica modelo-nome" id="modelo-nome" hidden></p>
      <div class="importar-cab">
        <label class="botao cheio" for="e-word">${ic('enviar', 'p')} Copiar o topo de uma prova antiga (Word)</label>
        <input type="file" id="e-word" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="sr" />
        <p class="dica" id="importar-resultado" role="status">O app copia o cabeçalho do arquivo do jeito que ele está.</p>
        <button type="button" class="botao fantasma cheio" id="b-campos-padrao" ${e.campos?.length || e.modelo ? '' : 'hidden'}>Voltar ao topo padrão do app</button>
      </div>
    </section>

    <section id="instrucoes" class="cartao-ajuste" aria-labelledby="t-instr">
      <header class="ca-cabeca"><div><h2 id="t-instr"><span class="aj-ic">${ic('tipo')}</span>Instruções padrão</h2><p>Saem abaixo do topo em toda prova nova.</p></div></header>
      <div class="campo"><label for="e-instr" class="visualmente-oculto">Instruções padrão</label>
        <textarea id="e-instr" name="instrucoes" style="min-height:110px" placeholder="Ex.: Você tem 50 minutos para fazer a prova.">${esc(e.instrucoes || '')}</textarea>
        <span class="dica" style="margin:8px 0 0">Uma instrução por linha.</span></div>
    </section>

    <div class="selo-salvo" id="selo-salvo" role="status" aria-live="polite"></div>
    </form>

    <section id="ia" class="cartao-ajuste" aria-labelledby="t-ia">
      <header class="ca-cabeca"><div><h2 id="t-ia"><span class="aj-ic">${ic('brilho')}</span>Criação automática</h2></div></header>
      ${pronta ? `<div class="aviso-bloco sucesso">${ic('certo')}<div><strong>Ligada</strong>Cria e confere questões novas quando há internet. Não precisa configurar nada.</div></div>`
        : `<div class="aviso-bloco alerta">${ic('alerta')}<div><strong>Desligada</strong>O app funciona normalmente com o seu banco de questões. Peça para quem instalou o app ligar.</div></div>`}
      <form id="form-ia">
        <label class="alternar" style="margin-bottom:16px"><input type="checkbox" name="revisora" ${cfg.ia.revisora ? 'checked' : ''}/>
          <span><strong>Conferir questões novas automaticamente</strong><small>Recomendado. Uma segunda verificação resolve cada questão sem ver o gabarito e avisa quando discorda.</small></span></label>
        <details class="revelar"><summary>Sobre o Apta<span class="chevron">${ic('seta')}</span></summary>
          <div class="conteudo"><p style="margin:0 0 8px"><img src="/apta-marca.svg" alt="Apta" width="88" height="48" class="marca-clara" /><img src="/apta-marca-escuro.svg" alt="Apta" width="88" height="48" class="marca-escura" /></p>
            <p style="margin:0 0 8px">Prova, versão adaptada e gabarito prontos para imprimir, com questões conferidas.</p>
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

    <section class="cartao-ajuste" aria-labelledby="t-tema">
      <header class="ca-cabeca"><div><h2 id="t-tema"><span class="aj-ic">${ic('aparencia')}</span>Aparência</h2></div></header>
      <div>
        <fieldset style="border:0;padding:0;margin:0"><legend class="rotulo">Tema do app</legend>
          <span class="dica">Recomendado: Claro. A tela fica parecida com a folha que os alunos recebem.</span>
          ${fichas('tema', TEMAS, temaAtual())}</fieldset>
      </div>
    </section></div></div>`;

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
    main.querySelector('#logo-amostra').innerHTML = logo ? `<img src="${logo}" alt="Logotipo atual" />` : ic('imagem');
    main.querySelector('#rot-logo').lastChild.textContent = logo ? ' Trocar' : ' Escolher imagem';
    main.querySelector('#b-campos-padrao').hidden = !campos.length && !modelo;
    main.querySelector('#modelo-nome').hidden = !modelo;
    main.querySelector('#modelo-nome').innerHTML = modelo ? `${ic('doc', 'p')} Cabeçalho do arquivo “${esc(modelo.nome)}”, do jeito que está no Word.` : '';
  };
  // Salva sozinho, como os Ajustes do iPhone: não existe botão para a professora esquecer.
  // Cada mudança é gravada logo depois de parar de digitar, e um selo "Salvo" confirma.
  const selo = main.querySelector('#selo-salvo');
  let alterado = false;
  let timerEscola;
  let timerSelo;
  const salvarEscola = () => {
    const fd = new FormData(form);
    try {
      salvarConfig({ ...getConfig(), escola: { nome: fd.get('nome').trim(), cidade: fd.get('cidade').trim(), professora: fd.get('professora').trim(), instrucoes: fd.get('instrucoes').replace(/\r/g, '').trim(), logo, campos, modelo } });
      alterado = false;
      selo.innerHTML = `${ic('certo', 'p')} Salvo`;
      selo.classList.add('visivel');
      clearTimeout(timerSelo); timerSelo = setTimeout(() => selo.classList.remove('visivel'), 1400);
      return true;
    } catch (err) { aviso(err.message); return false; }
  };
  const marcar = () => { alterado = true; clearTimeout(timerEscola); timerEscola = setTimeout(salvarEscola, 600); };
  // Saiu da tela antes de o salvamento rodar? Salva na hora.
  sairDosAjustes = () => { clearTimeout(timerEscola); if (alterado) salvarEscola(); };
  previa();
  form.oninput = () => { previa(); marcar(); };
  main.querySelector('#e-logo').onchange = async (ev) => { const arq = ev.target.files[0]; if (arq) { logo = await reduzirImagem(arq, 240); previa(); marcar(); } };
  main.querySelector('#b-tirar-logo').onclick = () => { logo = ''; previa(); marcar(); };
  main.querySelector('#b-campos-padrao').onclick = () => {
    const antes = { campos, modelo }; campos = []; modelo = null; previa(); marcar();
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
      previa(); marcar();
      res.innerHTML = r.modelo ? `<strong>${ic('certo', 'p')} Cabeçalho importado como está no Word.</strong> Confira a prévia e salve.`
        : `<strong>${ic('certo', 'p')} Importei os dados do cabeçalho.</strong> Confira a prévia e salve.`;
      main.querySelector('#previa').scrollIntoView({ behavior: menosMovimento() ? 'auto' : 'smooth', block: 'center' });
      aviso('Cabeçalho importado.', { rotulo: 'Desfazer', fn: () => {
        form.nome.value = antes.nome; form.cidade.value = antes.cidade; form.professora.value = antes.professora; form.instrucoes.value = antes.instrucoes;
        logo = antes.logo; campos = antes.campos; modelo = antes.modelo; previa(); res.textContent = 'Importação desfeita.';
      } });
    } catch (err) { console.error(err); res.textContent = err.message || 'Não consegui ler esse arquivo.'; }
  };
  form.onsubmit = (ev) => { ev.preventDefault(); salvarEscola(); };

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

/* =========================================================
   Revisão do Figma ("Refazendo", nov/2026): peças comuns e telas novas
   Céu azul + folha branca, etapas 1 a 5, semana de provas, versões
   adaptadas, exportar com moldura, importar do livro e Ajustes em lista.
   ========================================================= */
const lerJ = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const gravarJ = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const VISTO = (cls = 'visto') => `<svg class="${cls}" viewBox="0 0 70 58" aria-hidden="true"><path d="M8 30 L26 47 L63 7" stroke="#d2352b" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Topo azul: ação à esquerda, título no meio, ações à direita e, na criação, as 5 etapas. */
function ceu({ esquerda = '', titulo: t = '', direita = '', etapa = 0, baixo = false } = {}) {
  return `<header class="ceu ${baixo ? 'baixo' : ''}"><div class="ceu-barra"><div>${esquerda}</div><div class="ceu-titulo">${t}</div><div>${direita}</div></div>${etapa ? etapasHTML(etapa) : ''}</header>`;
}
const voltarBtn = (href, rotulo) => `<a class="ceu-botao" href="${href}">${ic('voltar')} ${esc(rotulo)}</a>`;
const ETAPAS = ['Turma', 'Ajustes', 'Questões', 'Adaptadas', 'Revisão'];
function etapasHTML(atual) {
  return `<ol class="etapas-apta" aria-label="Etapa ${atual} de 5">${ETAPAS.map((n, i) => {
    const k = i + 1;
    const cls = k < atual ? 'feita' : k === atual ? 'agora' : '';
    return `<li class="${cls}" ${k === atual ? 'aria-current="step"' : ''}><span class="bola">${k < atual ? ic('certo') : k}</span>${n}</li>`;
  }).join('')}</ol>`;
}
const itemLink = (href, icone, t, sub = '', destaque = false) => `<li><a class="item-apta ${destaque ? 'destaque' : ''}" href="${href}">${ic(icone)}<span class="txt"><strong>${esc(t)}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="chev">${ic('seta')}</span></a></li>`;

/** Alerta no padrão do iOS (Cancelar à esquerda, ação à direita). Devolve true/false. */
function alertaIOS({ titulo: t, texto, ok = 'OK', cancelar = 'Cancelar', perigo = false }) {
  return new Promise((resolver) => {
    const el = document.createElement('div');
    el.className = 'alerta-ios';
    el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'al-t');
    el.innerHTML = `<div class="caixa"><h2 id="al-t">${esc(t)}</h2><p>${esc(texto)}</p>
      <div class="botoes"><button type="button" data-r="0" class="forte">${esc(cancelar)}</button><button type="button" data-r="1" class="${perigo ? 'perigo' : ''}">${esc(ok)}</button></div></div>`;
    const fim = (v) => { el.remove(); resolver(v); };
    el.onclick = (e) => { const b = e.target.closest('[data-r]'); if (b) fim(b.dataset.r === '1'); else if (e.target === el) fim(false); };
    el.onkeydown = (e) => { if (e.key === 'Escape') fim(false); };
    document.body.append(el);
    el.querySelector('[data-r="0"]').focus();
  });
}

/* ---------- Turmas ---------- */
function getTurmas() {
  const salvas = lerJ('apta.turmas', null);
  if (Array.isArray(salvas)) return salvas;
  return turmasRecentes().map((t) => ({ id: uid(), nome: t.turma || t.serie, serie: t.serie, descricao: t.materia, alunos: 0 }));
}
const salvarTurmas = (l) => gravarJ('apta.turmas', l);
const descTurma = (t) => [t.descricao, t.alunos ? `${t.alunos} alunos` : ''].filter(Boolean).join(' · ') || t.serie;

function gavetaTurma(depois, existente = null) {
  const t = existente || { nome: '', serie: '4º ano', descricao: '', alunos: '' };
  abrirGaveta(existente ? 'Editar turma' : 'Nova turma', `<p class="gaveta-texto">A turma aparece na hora de criar a prova e no cabeçalho.</p>
    <form id="f-turma">
      <label class="campo-apta"><span>Nome da turma</span><input name="nome" value="${esc(t.nome)}" placeholder="Ex.: 5º ano A" required autocomplete="off" /></label>
      <label class="campo-apta"><span>Ano</span><select name="serie">${SERIES.map((s) => `<option ${s === t.serie ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="campo-apta"><span>Matéria ou descrição (opcional)</span><input name="descricao" value="${esc(t.descricao || '')}" placeholder="Ex.: Multidisciplinar" autocomplete="off" /></label>
      <label class="campo-apta"><span>Alunos (opcional)</span><input name="alunos" type="number" min="0" inputmode="numeric" value="${esc(String(t.alunos || ''))}" placeholder="Ex.: 28" /></label>
      <button class="btn-apta">${existente ? 'Salvar turma' : 'Adicionar turma'}</button>
      <div style="text-align:center"><button type="button" class="texto-btn" data-cancelar>Cancelar</button></div>
    </form>`, (g) => {
    const f = g.querySelector('form');
    g.querySelector('[data-cancelar]').onclick = fecharGaveta;
    f.nome.focus();
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const nova = { id: t.id || uid(), nome: f.nome.value.trim(), serie: f.serie.value, descricao: f.descricao.value.trim(), alunos: Number(f.alunos.value) || 0 };
      if (!nova.nome) { f.nome.focus(); return; }
      const lista = getTurmas().filter((x) => x.id !== nova.id);
      salvarTurmas(existente ? getTurmas().map((x) => (x.id === nova.id ? nova : x)) : [...lista, nova]);
      fecharGaveta();
      depois?.(nova);
    };
  }, { centro: true });
}

/* ---------- Perfis de adaptação e versões ---------- */
const AJUSTES_VERSAO = [
  ['letraMaior', 'Letra maior', '16 pt, espaço entre linhas', 'texto'],
  ['frasesCurtas', 'Frases curtas', '', 'lista'],
  ['dicas', 'Dica em cada questão', '', 'lapis'],
  ['tresAlternativas', 'Só 3 alternativas', '', 'certoCirc'],
  ['negrito', 'Palavras-chave em negrito', '', 'negrito'],
  ['imagens', 'Questões com imagens', 'Usa as figuras quando houver', 'imagem'],
];
const PERFIS_PADRAO = [
  { nome: 'Leitura simplificada', icone: 'texto', cfg: { letraMaior: true, frasesCurtas: true, dicas: true, tresAlternativas: true, negrito: true, imagens: false } },
  { nome: 'Sem leitura, com imagens', icone: 'imagem', cfg: { letraMaior: true, frasesCurtas: true, dicas: false, tresAlternativas: true, negrito: true, imagens: true } },
];
const getPerfis = () => lerJ('apta.perfis', PERFIS_PADRAO);
const salvarPerfis = (l) => gravarJ('apta.perfis', l);
function resumoCfg(c = {}) {
  const partes = [];
  if (c.imagens) partes.push('questões com imagens');
  if (c.letraMaior) partes.push('letra maior');
  if (c.frasesCurtas) partes.push('frases curtas');
  if (c.dicas) partes.push('dicas');
  if (c.imagens && !c.dicas) { const t = 'Questões com imagens · sem leitura'; return t; }
  if (!c.imagens && c.tresAlternativas && partes.length < 3) partes.push('3 alternativas');
  const t = partes.slice(0, 3).join(' · ');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Igual à original';
}
const novaVersao = (perfil) => ({ id: uid(), nome: perfil.nome, icone: perfil.icone || (perfil.cfg?.imagens ? 'imagem' : 'texto'), cfg: { ...perfil.cfg } });
/** Versões adaptadas de uma prova (as provas antigas tinham uma só, a "adaptada"). */
function versoesDa(p) {
  if (Array.isArray(p.versoes)) return p.versoes;
  if (p.temAdaptada === false) return [];
  const ca = cfgAdaptada(p);
  return [{ id: 'v1', nome: 'Leitura simplificada', icone: 'texto', cfg: { letraMaior: ca.letraMaior, frasesCurtas: true, dicas: ca.dicas, tresAlternativas: true, negrito: ca.negrito, imagens: false } }];
}
/** A prova vista por uma versão: os ajustes ligados mudam as questões adaptadas. */
function provaDaVersao(p, v) {
  const c = v.cfg;
  return {
    ...p,
    adaptadaCfg: { letraMaior: c.letraMaior, dicas: c.dicas, negrito: c.negrito },
    questoes: p.questoes.map((q) => {
      const ad = q.adaptada?.enunciado ? q.adaptada : adaptarSemIA(q);
      return {
        ...q,
        adaptada: {
          ...ad,
          enunciado: c.frasesCurtas ? ad.enunciado : q.enunciado,
          alternativas: c.tresAlternativas ? ad.alternativas : [...(q.alternativas || [])],
          correta: c.tresAlternativas ? ad.correta : q.correta,
          dica: c.dicas ? ad.dica : '',
        },
      };
    }),
  };
}
function gavetaAjustesVersao(v, depois, { tituloG = 'Ajustes da versão' } = {}) {
  abrirGaveta(tituloG, `<form id="f-versao">
    <label class="campo-apta"><span>Nome</span><input name="nome" value="${esc(v.nome)}" autocomplete="off" /></label>
    <ul class="lista-apta">${AJUSTES_VERSAO.map(([k, rot, sub, icn]) => `<li><label class="opcao-linha">${ic(icn)}<span class="txt">${rot}${sub ? `<small>${sub}</small>` : ''}</span>
      <input type="checkbox" class="switch-apta" name="${k}" ${v.cfg[k] ? 'checked' : ''}/></label></li>`).join('')}</ul>
    <button class="btn-apta" style="margin-top:16px">Salvar ajustes</button></form>`, (g) => {
    const f = g.querySelector('form');
    f.onsubmit = (ev) => {
      ev.preventDefault();
      v.nome = f.nome.value.trim() || v.nome;
      AJUSTES_VERSAO.forEach(([k]) => { v.cfg[k] = f[k].checked; });
      v.icone = v.cfg.imagens ? 'imagem' : 'texto';
      fecharGaveta(); depois?.(v);
    };
  });
}
/** Escolher de qual perfil nasce a versão nova. */
function escolherPerfil(depois) {
  const perfis = getPerfis();
  abrirGaveta('Nova versão adaptada', `${menu([
    ...perfis.map((p, k) => ({ op: `p${k}`, icone: p.cfg?.imagens ? 'imagem' : 'texto', rotulo: p.nome, dica: resumoCfg(p.cfg) })),
    { op: 'branco', icone: 'mais', rotulo: 'Começar do zero', dica: 'Você escolhe cada ajuste' },
  ])}`, (g) => g.addEventListener('click', (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op; if (!op) return;
    fecharGaveta();
    if (op === 'branco') {
      const v = novaVersao({ nome: 'Nova versão', cfg: { letraMaior: true, frasesCurtas: false, dicas: false, tresAlternativas: false, negrito: false, imagens: false } });
      setTimeout(() => gavetaAjustesVersao(v, depois, { tituloG: 'Nova versão' }), 220);
      return;
    }
    depois(novaVersao(perfis[Number(op.slice(1))]));
  }));
}

/* ---------- Folha: moldura e apresentação ---------- */
const getFolhaCfg = () => ({ moldura: 'simples', instrucoes: true, ...lerJ('apta.folha', {}) });
const MOLDURAS = [['nenhuma', 'Nenhuma'], ['simples', 'Simples'], ['dupla', 'Dupla'], ['escolar', 'Escolar'], ['escola', 'Da escola']];
const molduraPicker = (atual) => `<div class="molduras" role="radiogroup" aria-label="Moldura">${MOLDURAS.map(([v, r]) => `<button type="button" class="moldura-op" data-m="${v}" role="radio" aria-checked="${v === atual}" aria-pressed="${v === atual}">
  <span class="amostra">${v === 'escola' ? ic('mais') : v === 'nenhuma' ? '' : '<i></i>'}</span>${r}</button>`).join('')}</div>`;
function ligarMolduras(raiz, aoEscolher) {
  raiz.querySelectorAll('.moldura-op').forEach((b) => (b.onclick = () => {
    raiz.querySelectorAll('.moldura-op').forEach((x) => { x.setAttribute('aria-pressed', String(x === b)); x.setAttribute('aria-checked', String(x === b)); });
    aoEscolher(b.dataset.m); vibrar(4);
  }));
}

/* ---------- Datas ---------- */
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const deIso = (iso) => { const [a, m, d] = String(iso).split('-').map(Number); return new Date(a, m - 1, d, 12); };
const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isoHoje = (k = 0) => { const d = new Date(); d.setDate(d.getDate() + k); return isoDe(d); };
const isoParaBR = (iso) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };
function dataLonga(iso, comDia = false) { const d = deIso(iso); return `${comDia ? `${DIAS[d.getDay()]}, ` : ''}${d.getDate()} de ${MESES[d.getMonth()]}`; }
function periodoTexto(s) {
  const a = deIso(s.inicio), b = deIso(s.fim);
  return a.getMonth() === b.getMonth() ? `${a.getDate()} a ${b.getDate()} de ${MESES[b.getMonth()]}` : `${dataLonga(s.inicio)} a ${dataLonga(s.fim)}`;
}
function faltamDias(s) {
  const n = Math.round((deIso(s.entrega || s.fim) - deIso(isoHoje())) / 864e5);
  return n > 1 ? `faltam ${n} dias` : n === 1 ? 'falta 1 dia' : n === 0 ? 'entrega hoje' : 'prazo encerrado';
}

/* ---------- Semana de provas ---------- */
const getSemana = () => lerJ('apta.semana', null);
const salvarSemana = (s) => gravarJ('apta.semana', s);
/** Itens da semana: as provas planejadas (feitas ou não) e as provas com data no período. */
function itensSemana(s) {
  if (!s) return [];
  const provas = getProvas();
  const usadas = new Set();
  const itens = (s.planejadas || []).map((pl) => {
    const p = pl.provaId ? provas.find((x) => x.id === pl.provaId) : null;
    if (p) usadas.add(p.id);
    return { pl, prova: p, data: pl.data, materia: p?.materia || pl.materia, turma: p ? turmaDe(p) : pl.turma, titulo: p ? tituloCurto(p) : pl.tema };
  });
  provas.forEach((p) => {
    const iso = dataParaInput(p.data);
    if (!usadas.has(p.id) && iso && iso >= s.inicio && iso <= s.fim) itens.push({ pl: null, prova: p, data: iso, materia: p.materia, turma: turmaDe(p), titulo: tituloCurto(p) });
  });
  return itens.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
}
const estadoItem = (it) => (!it.prova ? 'falta' : statusProva(it.prova).pendentes ? 'rev' : 'ok');
function contarSemana(itens) { const c = { ok: 0, rev: 0, falta: 0 }; itens.forEach((it) => { c[estadoItem(it)]++; }); return c; }
const barraProgresso = (c) => `<div class="barra-progresso" aria-hidden="true">${c.ok ? `<i class="ok" style="flex:${c.ok}"></i>` : ''}${c.rev ? `<i class="rev" style="flex:${c.rev}"></i>` : ''}${c.falta ? `<i style="flex:${c.falta}"></i>` : ''}</div>`;
const legendaProgresso = (c) => `<div class="legenda-progresso"><span class="ok">${c.ok} ${c.ok === 1 ? 'pronta' : 'prontas'}</span><span class="rev">${c.rev} para revisar</span><span>${c.falta} ${c.falta === 1 ? 'falta' : 'faltam'}</span></div>`;

let semanaModo = 'data';
function telaSemana() {
  titulo('Semana de provas');
  const s = getSemana();
  const itens = itensSemana(s);
  const c = contarSemana(itens);
  const grupos = new Map();
  itens.forEach((it) => { const k = semanaModo === 'data' ? (it.data || '') : (it.turma || ''); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(it); });
  const itemHTML = (it) => {
    const e = estadoItem(it);
    const dentro = `${icMateria(it.materia)}<span class="txt"><strong>${esc(it.titulo || it.materia)}</strong><small>${esc(it.materia)} · ${esc(it.turma || '')}</small></span>
      <span class="estado-apta ${e}">${e === 'ok' ? `${ic('certo')} Pronta` : e === 'rev' ? `${ic('alerta')} ${statusProva(it.prova).pendentes} para revisar` : 'Falta criar'}</span>`;
    return `<li>${it.prova ? `<a class="item-semana" href="#/prova/${it.prova.id}">${dentro}</a>` : `<button type="button" class="item-semana" data-planejada="${it.pl.id}">${dentro}</button>`}</li>`;
  };
  main.innerHTML = `${ceu({ esquerda: voltarBtn('#/', 'Provas'), titulo: 'Semana de provas', direita: s ? `<button type="button" class="ceu-botao icone" id="b-planejar" aria-label="Planejar uma prova">${ic('mais')}</button>` : '', baixo: true })}
    <div class="folha-branca">
    ${s ? `<div class="semana-resumo"><div class="num"><b>${c.ok}</b> de ${itens.length} ${itens.length === 1 ? 'prova pronta' : 'provas prontas'}</div>
        ${barraProgresso(c)}
        <p>Entrega na coordenação até ${dataLonga(s.entrega || s.fim)} · cada prova com a versão adaptada e o gabarito</p>
        <button type="button" class="texto-btn" id="b-periodo" style="padding:0">Mudar o período</button></div>
      <div class="seg-apta" role="tablist" aria-label="Agrupar" style="margin:12px 0 0">
        <button role="tab" data-modo="data" aria-selected="${semanaModo === 'data'}">Por data</button>
        <button role="tab" data-modo="turma" aria-selected="${semanaModo === 'turma'}">Por turma</button></div>
      ${itens.length ? [...grupos].map(([k, lista]) => `<h2 class="dia-titulo">${semanaModo === 'data' ? (k ? dataLonga(k, true) : 'Sem data') : esc(k || 'Sem turma')}</h2>
        <ul class="lista-apta">${lista.map(itemHTML).join('')}</ul>`).join('')
        : '<div class="cartao-apta vazio-apta" style="margin:16px 0"><strong>Nada planejado ainda</strong>Toque em + para planejar as provas de cada turma.</div>'}`
    : `<div class="cartao-apta vazio-apta" style="margin:0"><strong>Planeje a semana de provas</strong>Escolha o período e a data de entrega. Depois, adicione as provas de cada turma e acompanhe o que falta.
        <div style="margin-top:16px"><button type="button" class="btn-apta" id="b-periodo">Escolher o período</button></div></div>`}
    </div>
    ${c.falta ? `<div class="barra-acoes"><span class="nota-barra">Cada prova sai com a versão adaptada e o gabarito.</span>
      <button type="button" class="btn-apta" id="b-criar-faltam">${ic('brilho')} ${c.falta === 1 ? 'Criar a que falta' : `Criar as ${c.falta} que faltam`}</button></div>` : ''}`;
  main.querySelectorAll('[data-modo]').forEach((b) => (b.onclick = () => { semanaModo = b.dataset.modo; transicao(telaSemana, 'segmento'); }));
  main.querySelector('#b-periodo').onclick = () => gavetaPeriodo();
  main.querySelector('#b-planejar')?.addEventListener('click', () => gavetaPlanejar());
  main.querySelectorAll('[data-planejada]').forEach((b) => (b.onclick = () => {
    const pl = getSemana().planejadas.find((x) => x.id === b.dataset.planejada);
    abrirGaveta(pl.tema, menu([
      { op: 'criar', icone: 'brilho', rotulo: 'Criar esta prova agora', dica: `${pl.materia} · ${pl.turma} · ${dataLonga(pl.data, true)}` },
      { op: 'editar', icone: 'editar', rotulo: 'Mudar o planejamento' },
      '-',
      { op: 'tirar', icone: 'lixo', rotulo: 'Tirar da semana', perigo: true },
    ]), (g) => g.addEventListener('click', (e) => {
      const op = e.target.closest('[data-op]')?.dataset.op; if (!op) return;
      if (op === 'criar') {
        fecharGaveta();
        rascunho = novoRascunho();
        Object.assign(rascunho, { materia: pl.materia, serie: pl.serie, turma: pl.turma, tema: pl.tema, planejadaId: pl.id, passo: 2 });
        location.hash = '#/nova';
      }
      if (op === 'editar') { fecharGaveta(); setTimeout(() => gavetaPlanejar(pl), 220); }
      if (op === 'tirar') {
        const s2 = getSemana(); s2.planejadas = s2.planejadas.filter((x) => x.id !== pl.id); salvarSemana(s2);
        fecharGaveta(); telaSemana(); aviso('Prova tirada da semana.');
      }
    }));
  }));
  main.querySelector('#b-criar-faltam')?.addEventListener('click', () => {
    const faltando = itens.filter((it) => !it.prova);
    const base = novoRascunho();
    criarLote({
      linhas: faltando.map((it) => ({ materia: it.pl.materia, serie: it.pl.serie, turma: it.pl.turma, tema: it.pl.tema, planejadaId: it.pl.id })),
      dificuldade: base.dificuldade, quantidade: base.quantidade, tipos: base.tipos, adaptada: true, figuras: base.figuras, modo: base.modo,
      versoes: getPerfis().map(novaVersao),
    });
  });
}
function gavetaPeriodo() {
  const s = getSemana() || { inicio: isoHoje(), fim: isoHoje(14), entrega: isoHoje(14), planejadas: [] };
  abrirGaveta('Semana de provas', `<form id="f-periodo">
    <label class="campo-apta"><span>Começa em</span><input type="date" name="inicio" value="${s.inicio}" required /></label>
    <label class="campo-apta"><span>Termina em</span><input type="date" name="fim" value="${s.fim}" required /></label>
    <label class="campo-apta"><span>Entrega na coordenação</span><input type="date" name="entrega" value="${s.entrega || s.fim}" /></label>
    <button class="btn-apta">Salvar período</button></form>`, (g) => {
    const f = g.querySelector('form');
    f.onsubmit = (ev) => {
      ev.preventDefault();
      if (f.fim.value < f.inicio.value) { aviso('O fim precisa ser depois do começo.'); return; }
      salvarSemana({ ...s, inicio: f.inicio.value, fim: f.fim.value, entrega: f.entrega.value || f.fim.value });
      fecharGaveta(); telaSemana();
    };
  });
}
function gavetaPlanejar(existente = null) {
  const s = getSemana();
  const turmas = getTurmas();
  const pl = existente || { materia: 'Matemática', turma: turmas[0]?.nome || '', serie: turmas[0]?.serie || '5º ano', tema: '', data: s.inicio };
  abrirGaveta(existente ? 'Mudar o planejamento' : 'Planejar uma prova', `<form id="f-plan">
    <label class="campo-apta"><span>Turma</span><select name="turma">${turmas.map((t) => `<option value="${esc(t.id)}" ${t.nome === pl.turma ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}<option value="__nova">+ Nova turma…</option></select></label>
    <label class="campo-apta"><span>Matéria</span><select name="materia">${todasMaterias().map((m) => `<option ${m === pl.materia ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
    <label class="campo-apta"><span>Conteúdo</span><input name="tema" value="${esc(pl.tema)}" placeholder="Ex.: frações" required autocomplete="off" /></label>
    <label class="campo-apta"><span>Dia da prova</span><input type="date" name="data" value="${pl.data}" min="${s.inicio}" max="${s.fim}" required /></label>
    <button class="btn-apta">${existente ? 'Salvar' : 'Adicionar à semana'}</button></form>`, (g) => {
    const f = g.querySelector('form');
    f.turma.onchange = () => { if (f.turma.value === '__nova') { fecharGaveta(); setTimeout(() => gavetaTurma(() => setTimeout(() => gavetaPlanejar(existente), 220)), 220); } };
    f.onsubmit = (ev) => {
      ev.preventDefault();
      const t = turmas.find((x) => x.id === f.turma.value);
      if (!t || !f.tema.value.trim()) { aviso('Escolha a turma e escreva o conteúdo.'); return; }
      const novo = { id: pl.id || uid(), materia: f.materia.value, turma: t.nome, serie: t.serie, tema: f.tema.value.trim(), data: f.data.value, provaId: pl.provaId || null };
      const s2 = getSemana();
      s2.planejadas = existente ? s2.planejadas.map((x) => (x.id === novo.id ? novo : x)) : [...(s2.planejadas || []), novo];
      salvarSemana(s2); fecharGaveta(); telaSemana();
    };
  });
}

/* ---------- Prova: versões adaptadas, refazer, exportar ---------- */
function painelVersaoHTML(p, v) {
  const vs = p.versoes;
  return `<div class="versoes-chips">${vs.map((x, k) => `<button type="button" class="chip-apta" data-ver="${k}" aria-pressed="${k === estado.versao}">${ic(x.icone === 'imagem' ? 'imagem' : 'texto')} Versão ${k + 1}</button>`).join('')}
      <button type="button" class="chip-apta mais" id="b-nova-versao">${ic('mais')} Nova versão</button></div>
    ${v ? `<div class="editando-cartao"><div class="rot">EDITANDO A VERSÃO ${estado.versao + 1} DE ${vs.length}</div>
        <div class="ed-linha"><strong>${esc(v.nome)}</strong><button type="button" class="texto-btn" id="b-renomear-versao">Renomear</button></div>
        <small>Da prova ${esc(tituloCurto(p))}${turmaDe(p) ? ` · ${esc(turmaDe(p))}` : ''}</small></div>
      <ul class="lista-apta">${AJUSTES_VERSAO.map(([k, rot, sub, icn]) => `<li><label class="opcao-linha">${ic(icn)}<span class="txt">${rot}${sub ? `<small>${sub}</small>` : ''}</span>
        <input type="checkbox" class="switch-apta" data-cfg="${k}" ${v.cfg[k] ? 'checked' : ''}/></label></li>`).join('')}</ul>
      <div class="acoes" style="margin:12px 0 0;gap:8px"><button type="button" class="btn-apta suave pequeno" id="b-dup-versao">${ic('copiar', 'p')} Duplicar versão</button>
        <button type="button" class="btn-apta claro pequeno" id="b-apagar-versao" style="color:var(--vermelho)">${ic('lixo', 'p')} Tirar esta versão</button></div>
      <h3 class="previa-titulo">Como fica no papel</h3>`
    : '<div class="cartao-apta vazio-apta" style="margin:0 0 12px"><strong>Nenhuma versão adaptada</strong>Toque em Nova versão para criar uma a partir dos seus perfis de adaptação.</div>'}`;
}
function atualizarContagemVersoes() {
  const b = document.querySelector('.seg-apta [data-aba="adaptada"]');
  if (b) b.textContent = `Adaptadas (${estado.prova.versoes.length})`;
}
function ligarPainelVersao(el) {
  const p = estado.prova;
  const v = p.versoes[estado.versao];
  el.querySelectorAll('[data-ver]').forEach((b) => (b.onclick = () => { estado.versao = Number(b.dataset.ver); transicao(desenharFolha, 'segmento'); }));
  el.querySelector('#b-nova-versao').onclick = () => escolherPerfil((nova) => {
    p.questoes.forEach((q) => { if (!q.adaptada?.enunciado) q.adaptada = adaptarSemIA(q); });
    p.versoes.push(nova); p.temAdaptada = true; estado.versao = p.versoes.length - 1;
    salvarDepois(); atualizarContagemVersoes(); desenharFolha(); aviso(`Versão ${p.versoes.length} criada: ${nova.nome}.`);
  });
  if (!v) return;
  el.querySelectorAll('[data-cfg]').forEach((inp) => (inp.onchange = () => {
    v.cfg[inp.dataset.cfg] = inp.checked;
    if (inp.dataset.cfg === 'imagens') v.icone = inp.checked ? 'imagem' : 'texto';
    salvarDepois(); desenharFolha();
  }));
  el.querySelector('#b-renomear-versao').onclick = () => abrirGaveta('Nome da versão', `<form><label class="campo-apta"><span>Nome</span><input name="nome" value="${esc(v.nome)}" autocomplete="off" /></label>
    <button class="btn-apta">Salvar nome</button></form>`, (g) => {
    const f = g.querySelector('form'); f.nome.focus(); f.nome.select();
    f.onsubmit = (ev) => { ev.preventDefault(); v.nome = f.nome.value.trim() || v.nome; salvarDepois(); fecharGaveta(); desenharFolha(); };
  });
  el.querySelector('#b-dup-versao').onclick = () => {
    p.versoes.splice(estado.versao + 1, 0, { ...structuredClone(v), id: uid(), nome: `${v.nome} (cópia)` });
    estado.versao++; salvarDepois(); atualizarContagemVersoes(); desenharFolha();
  };
  el.querySelector('#b-apagar-versao').onclick = async () => {
    if (!(await alertaIOS({ titulo: `Tirar a versão ${estado.versao + 1}?`, texto: `“${v.nome}” deixa de sair junto com esta prova. A original não muda.`, ok: 'Tirar', perigo: true }))) return;
    p.versoes.splice(estado.versao, 1); p.temAdaptada = p.versoes.length > 0; estado.versao = Math.max(0, estado.versao - 1);
    salvarDepois(); atualizarContagemVersoes(); desenharFolha();
  };
}

const MOTIVOS_REFAZER = ['Resposta errada', 'Óbvia demais', 'Muito literal', 'Fácil demais', 'Difícil demais', 'Fora do conteúdo'];
function gavetaRefazer(i) {
  const q = estado.prova.questoes[i];
  const temIA = iaDisponivel(getConfig());
  abrirGaveta(`Refazer a questão ${i + 1}`, `<p class="cartao-apta" style="margin:0 0 16px;padding:12px 14px;box-shadow:none;border:0;background:var(--cinza-fill);font-size:.9rem;color:var(--texto-2)">${md(q.enunciado.slice(0, 240))}</p>
    <h3 class="secao-azul" style="margin-top:0">O que não ficou bom?</h3>
    <div class="chips-apta" role="group" aria-label="O que não ficou bom">${MOTIVOS_REFAZER.map((m) => `<button type="button" class="chip-apta" data-motivo="${esc(m)}" aria-pressed="false">${esc(m)}</button>`).join('')}</div>
    <label class="campo-apta" style="margin-top:16px"><span class="visualmente-oculto">Explique melhor</span><textarea id="refazer-txt" placeholder="Quer explicar melhor? (opcional)"></textarea></label>
    <button type="button" class="btn-apta" id="b-refazer">${ic('brilho')} Refazer questão</button>
    <p class="ajuda" style="text-align:center">${temIA ? 'A nova questão é conferida antes de entrar na prova.' : 'Sem a criação automática, trocamos por outra do seu banco.'}</p>`, (g) => {
    g.querySelectorAll('[data-motivo]').forEach((b) => (b.onclick = () => { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); vibrar(4); }));
    g.querySelector('#b-refazer').onclick = () => {
      const motivos = [...g.querySelectorAll('[data-motivo][aria-pressed="true"]')].map((b) => b.dataset.motivo);
      const texto = g.querySelector('#refazer-txt').value.trim();
      fecharGaveta();
      if (!temIA) { trocarQuestao(i); return; }
      novaQuestaoIA(i, `Refaça esta questão, que a professora não aprovou: "${q.enunciado.slice(0, 400)}". O que não ficou bom: ${motivos.join(', ') || 'ela pediu outra versão'}.${texto ? ` Explicação dela: ${texto}` : ''} Mantenha o mesmo conteúdo e tipo de questão.`);
    };
  });
}

function gavetaExportar() {
  const p = estado.prova;
  const escola = getConfig().escola;
  let formato = 'word';
  let moldura = getFolhaCfg().moldura;
  const itens = [{ k: 'normal', rot: 'Original' }, ...p.versoes.map((v, k) => ({ k: `v${k}`, rot: `V${k + 1} · ${v.nome}`, versao: true })), { k: 'gabarito', rot: 'Gabarito', sub: 'Só para você' }];
  const marcados = new Set(itens.map((i) => i.k));
  abrirGaveta('Exportar', `<div class="seg-apta cinza" role="tablist" aria-label="Formato"><button type="button" role="tab" data-fmt="word" aria-selected="true">Word (.docx)</button><button type="button" role="tab" data-fmt="pdf" aria-selected="false">PDF</button></div>
    <h3 class="secao-azul">O que vai junto</h3>
    <ul class="lista-apta">${itens.map((it) => `<li><button type="button" class="item-apta exp-item ${it.versao ? 'marcado' : ''}" data-exp="${it.k}" aria-pressed="true">
      <span class="txt"><strong>${esc(it.rot)}</strong>${it.sub ? `<small>${it.sub}</small>` : ''}</span><span class="marca-circ">${ic('certo')}</span></button></li>`).join('')}</ul>
    <h3 class="secao-azul">Moldura</h3>${molduraPicker(moldura)}
    <ul class="lista-apta" style="margin-top:16px">${itemLink('#/ajustes/modelo', 'escola', 'Cabeçalho', `${escola.nome || 'Sua escola'} · ${escola.modelo ? 'trazido do seu Word' : 'padrão do app'}`)}</ul>
    <button type="button" class="btn-apta" id="b-exp-ir" style="margin-top:16px"></button>`, (g) => {
    const botao = g.querySelector('#b-exp-ir');
    const rotulo = () => { const n = marcados.size; botao.textContent = formato === 'pdf' ? (n ? `Imprimir ou salvar ${plural(n, 'página', 'páginas')} em PDF` : 'Marque o que vai junto') : n ? `Exportar ${plural(n, 'arquivo', 'arquivos')}` : 'Marque o que vai junto'; botao.disabled = !n; };
    rotulo();
    g.querySelectorAll('[data-fmt]').forEach((b) => (b.onclick = () => { formato = b.dataset.fmt; g.querySelectorAll('[data-fmt]').forEach((x) => x.setAttribute('aria-selected', String(x === b))); rotulo(); }));
    g.querySelectorAll('[data-exp]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.exp; if (marcados.has(k)) marcados.delete(k); else marcados.add(k);
      b.setAttribute('aria-pressed', String(marcados.has(k))); if (b.dataset.exp.startsWith('v')) b.classList.toggle('marcado', marcados.has(k));
      rotulo(); vibrar(4);
    }));
    ligarMolduras(g, (m) => { moldura = m; if (m === 'escola' && !escola.modelo) { fecharGaveta(); location.hash = '#/ajustes/modelo'; } });
    botao.onclick = async () => {
      const sel = itens.filter((i) => marcados.has(i.k));
      gravarJ('apta.folha', { ...getFolhaCfg(), moldura });
      fecharGaveta();
      if (formato === 'pdf') { imprimirLote(sel.map((i) => i.k)); return; }
      let ok = 0;
      for (const it of sel) {
        try {
          if (it.k === 'normal' || it.k === 'gabarito') await baixarWord(p, escola, it.k, { moldura });
          else { const v = p.versoes[Number(it.k.slice(1))]; await baixarWord({ ...provaDaVersao(p, v), titulo: `${p.titulo} - ${v.nome}` }, escola, 'adaptada', { moldura }); }
          ok++;
        } catch (e) { console.error(e); }
      }
      aviso(ok === sel.length ? `${plural(ok, 'arquivo baixado', 'arquivos baixados')}. Abra no Word para editar.` : `Baixei ${ok} de ${sel.length}. Tente de novo os que faltaram.`);
    };
  });
}
/** PDF: monta as folhas escolhidas uma depois da outra e abre a impressão (Salvar como PDF). */
function imprimirLote(chaves) {
  const p = estado.prova;
  const escola = getConfig().escola;
  const m = getFolhaCfg().moldura;
  let cont = document.getElementById('lote-impressao');
  if (!cont) { cont = document.createElement('div'); cont.id = 'lote-impressao'; document.body.append(cont); }
  cont.innerHTML = chaves.map((k) => {
    if (k === 'gabarito') return `<div class="folha moldura-${m}">${cabecalhoHTML(p, escola, false)}${gabaritoHTML(p)}</div>`;
    const v = k === 'normal' ? null : p.versoes[Number(k.slice(1))];
    const vista = v ? provaDaVersao(p, v) : p;
    const versao = v ? 'adaptada' : 'normal';
    const c = v?.cfg || {};
    return `<div class="folha moldura-${m} ${v ? `adaptada ${c.letraMaior ? '' : 'sem-letra-maior'} ${c.dicas ? '' : 'sem-dicas'} ${c.negrito ? '' : 'sem-negrito'}` : ''}">${cabecalhoHTML(vista, escola, false)}
      <div class="titulo-prova">${esc(p.titulo)}</div>${p.instrucoes ? `<div class="instrucoes"><strong>Instruções:</strong><div>${md(p.instrucoes)}</div></div>` : ''}
      ${vista.questoes.map((q, i) => questaoHTML(q, i, versao)).join('')}</div>`;
  }).join('').replace(/contenteditable="true"/g, '');
  document.body.classList.add('imprimindo-lote');
  const fim = () => { document.body.classList.remove('imprimindo-lote'); removeEventListener('afterprint', fim); };
  addEventListener('afterprint', fim);
  setTimeout(() => window.print(), 60);
}

/** "Usar" no Banco: põe a questão numa prova existente ou começa uma prova com ela. */
function gavetaUsar(q) {
  const provas = getProvas().sort((a, b) => (b.materia === q.materia) - (a.materia === q.materia)).slice(0, 6);
  abrirGaveta('Usar esta questão', `${menu([
    { op: 'nova', icone: 'mais', rotulo: 'Começar uma prova com ela', dica: `${q.materia} · ${q.serie}` },
    ...(provas.length ? ['-'] : []),
    ...provas.map((p) => ({ op: `p:${p.id}`, icone: 'doc', rotulo: `Pôr em “${tituloCurto(p)}”`, dica: `${p.materia} · ${turmaDe(p)} · ${plural(p.questoes.length, 'questão', 'questões')}` })),
  ])}`, (g) => g.addEventListener('click', (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op; if (!op) return;
    fecharGaveta();
    if (op === 'nova') {
      const cfg = getConfig();
      const pedido = { materia: q.materia, serie: q.serie, turma: '', tema: q.tema || q.materia, dificuldade: q.dificuldade || 'medio', quantidade: 1, tipos: [q.tipo], adaptada: true, modo: 'banco' };
      const prova = { id: uid(), titulo: `Avaliação de ${q.materia} — ${(q.tema || q.materia).slice(0, 60)}`, materia: q.materia, serie: q.serie, turma: '', tema: q.tema, dificuldade: pedido.dificuldade,
        data: new Date().toLocaleDateString('pt-BR'), instrucoes: getFolhaCfg().instrucoes ? cfg.escola.instrucoes || '' : '', temAdaptada: true, versoes: getPerfis().map(novaVersao), pedido, questoes: [prepararParaProva(q, pedido)], criadaEm: Date.now() };
      salvarProva(prova); location.hash = `#/prova/${prova.id}`; aviso('Prova começada com esta questão. Use + Questão para completar.');
      return;
    }
    const p = getProva(op.slice(2));
    p.questoes.push(prepararParaProva(q, p)); salvarProva(p);
    aviso(`Questão posta no fim de “${tituloCurto(p)}”.`, { rotulo: 'Abrir', fn: () => { location.hash = `#/prova/${p.id}`; } });
  }));
}

/* ---------- Importar do livro (câmera) ---------- */
function reduzirFoto(arquivo, max = 1600) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      ok({ src: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height });
    };
    img.onerror = falha;
    img.src = URL.createObjectURL(arquivo);
  });
}
function telaLivro() {
  titulo('Importar do livro');
  const cfg = getConfig();
  const temIA = iaDisponivel(cfg);
  const info = { livro: lerJ('apta.ultimoLivro', ''), materia: filtroBanco.materia || lerJ('apta.ultimaMateriaLivro', 'Matemática'), serie: lerJ('apta.ultimaSerieLivro', '4º ano'), pagina: '' };
  let foto = null;
  let achadas = [];
  const marcadas = new Set();
  let ctrl = null;
  main.innerHTML = `<div class="livro-apta">
    <div class="ceu-barra"><a class="ceu-botao" href="#/banco">Cancelar</a><div class="ceu-titulo" id="livro-titulo">Página do livro</div>
      <div><label class="ceu-botao icone" for="livro-galeria" aria-label="Escolher uma foto da galeria">${ic('imagem')}</label></div></div>
    <div class="livro-foto" id="livro-foto"><div class="livro-vazio">${ic('camera')}<strong>Fotografe a página com as questões</strong>
      <span style="opacity:.8;font-size:.9rem">A IA encontra cada questão e a resposta. Você escolhe quais entram no banco.</span>
      <label class="btn-apta" for="livro-camera" style="width:auto;margin-top:6px">${ic('camera')} Tirar foto</label></div></div>
    <input type="file" id="livro-camera" accept="image/*" capture="environment" class="sr" />
    <input type="file" id="livro-galeria" accept="image/*" class="sr" />
    <div class="livro-folha" id="livro-folha">
      <form id="f-livro" class="pilha" style="gap:0">
        <label class="campo-apta"><span>Livro</span><input name="livro" value="${esc(info.livro)}" placeholder="Ex.: Livro Ápis" autocomplete="off" /></label>
        <div class="duas-colunas" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <label class="campo-apta"><span>Matéria</span><select name="materia">${todasMaterias().map((m) => `<option ${m === info.materia ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
          <label class="campo-apta"><span>Ano</span><select name="serie">${SERIES.map((s) => `<option ${s === info.serie ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label></div>
      </form>
      ${temIA ? '' : '<p class="ajuda">Para ler a foto, a criação automática precisa estar ligada em Ajustes.</p>'}
    </div></div>`;
  const folha = main.querySelector('#livro-folha');
  const area = main.querySelector('#livro-foto');
  const form = main.querySelector('#f-livro');
  const lerInfo = () => { info.livro = form.livro.value.trim(); info.materia = form.materia.value; info.serie = form.serie.value; };
  const desenharCaixas = () => {
    if (!foto) return;
    const W = area.clientWidth, H = area.clientHeight;
    const k = Math.min(W / foto.w, H / foto.h);
    const w = foto.w * k, h = foto.h * k;
    area.innerHTML = `<div class="quadro" style="position:relative;width:${w}px;height:${h}px"><img src="${foto.src}" alt="Foto da página" style="width:100%;height:100%" />
      ${achadas.map((q, j) => q.caixa ? `<div class="caixa-q" style="left:${q.caixa.x}%;top:${q.caixa.y}%;width:${q.caixa.w}%;height:${q.caixa.h}%"><span>${marcadas.has(j) ? ic('certo') : ''} Questão ${q.numero || j + 1}</span></div>` : '').join('')}</div>`;
  };
  const desenharLista = () => {
    lerInfo();
    const n = marcadas.size;
    folha.innerHTML = `<h2>${plural(achadas.length, 'questão nesta página', 'questões nesta página')}</h2>
      <p class="meta-livro">${esc(info.livro || 'Livro')} · ${esc(info.materia)} ${esc(info.serie)}</p>
      <ul class="lista-apta">${achadas.map((q, j) => `<li><button type="button" class="item-apta" data-q="${j}" aria-pressed="${marcadas.has(j)}">
        <span class="txt"><strong>${q.numero ? `${q.numero}. ` : ''}${esc(q.enunciado.replace(/\*\*/g, '').slice(0, 70))}</strong><small>${q.precisaFigura ? 'Conferida · com imagem' : `Conferida · resposta ${esc(textoGabarito(q).replace(/^[a-e]\)\s*/, '').slice(0, 30))}`}</small></span>
        <span class="marca-circ">${ic('certo')}</span></button></li>`).join('')}</ul>
      <button type="button" class="btn-apta" id="b-livro-add" style="margin-top:14px" ${n ? '' : 'disabled'}>${n ? `Adicionar ${n} ao banco` : 'Marque as questões'}</button>
      <div style="text-align:center"><label class="texto-btn" for="livro-camera" style="display:inline-flex;align-items:center">Fotografar outra página</label></div>`;
    folha.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { const j = Number(b.dataset.q); if (marcadas.has(j)) marcadas.delete(j); else marcadas.add(j); desenharLista(); desenharCaixas(); vibrar(4); }));
    folha.querySelector('#b-livro-add').onclick = () => {
      const fonte = { nome: `${info.livro || 'Livro'}${info.pagina ? `, p. ${info.pagina}` : ''}`, pagina: Number(info.pagina) || 0, material: info.livro };
      const sel = [...marcadas].map((j) => achadas[j]).map(({ caixa, numero, precisaFigura, ...q }) => ({ ...q, materia: info.materia, serie: info.serie, tema: q.tema || info.livro || info.materia, dificuldade: 'medio', fonte }));
      const n2 = adicionarAoBanco(sel, 'revisada');
      gravarJ('apta.ultimoLivro', info.livro); gravarJ('apta.ultimaMateriaLivro', info.materia); gravarJ('apta.ultimaSerieLivro', info.serie);
      location.hash = '#/banco';
      setTimeout(() => aviso(`${plural(n2, 'questão entrou', 'questões entraram')} no banco como conferidas.`), 300);
    };
  };
  const ler = async (arq) => {
    if (!arq) return;
    if (!temIA) { aviso('Ligue a criação automática em Ajustes para ler a foto.'); return; }
    lerInfo();
    foto = await reduzirFoto(arq);
    achadas = []; marcadas.clear();
    desenharCaixas();
    const formHTML = form.outerHTML;
    folha.innerHTML = `${formHTML}<div class="carregando" role="status">Lendo a página e conferindo as respostas…</div>`;
    ctrl?.abort(); ctrl = new AbortController();
    try {
      const r = await questoesDaFoto(cfg, foto.src, info, ctrl.signal);
      achadas = r.questoes;
      info.pagina = r.pagina || '';
      main.querySelector('#livro-titulo').textContent = info.pagina ? `Página ${info.pagina}` : 'Página do livro';
      achadas.forEach((_, j) => marcadas.add(j));
      if (!achadas.length) { folha.innerHTML = `${formHTML}<p class="ajuda">Não achei questões nesta foto. Tente com a página inteira e boa luz.</p>`; return; }
      desenharLista(); desenharCaixas();
    } catch (e) {
      if (e.name === 'AbortError') return;
      console.error(e);
      folha.innerHTML = `${formHTML}<p class="erro-apta">${ic('alerta', 'p')} ${esc(e instanceof ErroIA ? e.message : 'Não consegui ler a foto agora. Tente de novo.')}</p>`;
    }
  };
  main.querySelector('#livro-camera').onchange = (e) => { ler(e.target.files[0]); e.target.value = ''; };
  main.querySelector('#livro-galeria').onchange = (e) => { ler(e.target.files[0]); e.target.value = ''; };
  addEventListener('resize', desenharCaixas);
}

/* ---------- Ajustes em lista (como os Ajustes do iPhone) ---------- */
function telaAjustes(sub) {
  if (sub === 'escola' || sub === 'ia') return telaAjustesEscola(sub);
  if (sub === 'modelo') return telaModelo();
  if (sub === 'turmas') return telaTurmas();
  if (sub === 'perfis') return telaPerfis();
  titulo('Ajustes');
  const cfg = getConfig();
  const e = cfg.escola;
  const turmas = getTurmas();
  const nomeMold = (Object.fromEntries(MOLDURAS)[getFolhaCfg().moldura] || 'Simples').toLowerCase();
  const instr = (e.instrucoes || '').split('\n')[0];
  main.innerHTML = `<div class="ajustes-apta"><header class="ceu">
      <div class="ceu-grande"><div><h1>Apta do seu jeito</h1><p>Escola, turmas e preferências de criação.</p></div>${VISTO()}</div>
      <h2 class="grupo-titulo">${ic('escola')} Escola</h2>
      <div class="pilha-cartao"><ul class="lista-apta">
        ${itemLink('#/ajustes/escola', 'escola', 'Minha escola', [e.nome, e.cidade].filter(Boolean).join(' · ') || 'Nome, cidade e logotipo')}
        ${itemLink('#/ajustes/modelo', 'doc', 'Modelo da prova', `${e.modelo ? 'Cabeçalho do seu Word' : 'Cabeçalho padrão'} · Moldura ${nomeMold}`)}
        ${itemLink('#/ajustes/turmas', 'turma', 'Turmas', turmas.map((t) => t.nome).join(' · ') || 'Cadastre suas turmas')}
      </ul></div>
      <h2 class="grupo-titulo">${ic('brilho')} Criação</h2>
      <div class="pilha-cartao"><ul class="lista-apta">
        ${itemLink('#/ajustes/perfis', 'inclusao', 'Perfis de adaptação', getPerfis().map((p) => p.nome).join(' · ') || 'Nenhum perfil', true)}
        <li><label class="item-apta">${ic('certoCirc')}<span class="txt"><strong>Conferência automática</strong><small>Revisa cada resposta antes de você ver</small></span>
          <input type="checkbox" class="switch-apta" id="sw-revisora" ${cfg.ia.revisora ? 'checked' : ''} /></label></li>
        ${itemLink('#/ajustes/escola', 'lista', 'Instruções padrão', instr ? `${instr.slice(0, 38)}${instr.length > 38 ? '…' : ''}` : 'Saem abaixo do cabeçalho')}
      </ul></div>
    </header>
    <div class="depois-ceu">
      <h2 class="grupo-titulo">${ic('aparencia')} Aplicativo</h2>
      <ul class="lista-apta">
        <li><div class="item-apta">${ic('aparencia')}<span class="txt"><strong>Aparência</strong></span></div>
          <div style="padding:0 16px 14px"><div class="seg-apta cinza" role="radiogroup" aria-label="Tema">${TEMAS.map(([v, r]) => `<button type="button" role="radio" data-tema="${v}" aria-selected="${temaAtual() === v}" aria-checked="${temaAtual() === v}">${r}</button>`).join('')}</div></div></li>
        ${itemLink('#/ajustes/ia', 'brilho', 'Criação automática', iaDisponivel(cfg) ? 'Ligada' : 'Desligada')}
        <li><button type="button" class="item-apta" id="b-exemplo">${ic('doc')}<span class="txt"><strong>Preencher com um exemplo</strong><small>Turmas, semana de provas e provas prontas para ver o app funcionando</small></span></button></li>
      </ul>
      <p class="ajuda" style="text-align:center;margin:20px 0">Apta · desenhado seguindo as Human Interface Guidelines da Apple</p>
    </div></div>`;
  main.querySelector('#sw-revisora').onchange = (ev) => { const c = getConfig(); salvarConfig({ ...c, ia: { ...c.ia, revisora: ev.target.checked } }); aviso(ev.target.checked ? 'Conferência automática ligada.' : 'Conferência automática desligada.'); };
  main.querySelectorAll('[data-tema]').forEach((b) => (b.onclick = () => {
    try { localStorage.setItem('pf.tema', b.dataset.tema); } catch {}
    main.querySelectorAll('[data-tema]').forEach((x) => { x.setAttribute('aria-selected', String(x === b)); x.setAttribute('aria-checked', String(x === b)); });
    transicao(() => aplicarTema(b.dataset.tema), 'segmento');
  }));
  main.querySelector('#b-exemplo').onclick = preencherExemplo;
}
function telaTurmas() {
  titulo('Turmas');
  const turmas = getTurmas();
  main.innerHTML = `<div class="sub-tela">${ceu({ esquerda: voltarBtn('#/ajustes', 'Ajustes'), titulo: 'Turmas', baixo: true })}
    <div class="folha-branca"><div class="cabeca-folha"><h1>Suas turmas</h1><p>Aparecem na hora de criar a prova.</p></div>
    ${turmas.length ? `<ul class="lista-apta">${turmas.map((t) => `<li><button type="button" class="item-apta" data-turma="${t.id}">${ic('turma')}<span class="txt"><strong>${esc(t.nome)}</strong><small>${esc(descTurma(t))}</small></span><span class="chev">${ic('seta')}</span></button></li>`).join('')}</ul>`
      : '<div class="cartao-apta vazio-apta" style="margin:0"><strong>Nenhuma turma ainda</strong>Adicione as turmas em que você dá aula.</div>'}
    <button type="button" class="link-apta" id="b-nova-turma" style="margin-top:8px">${ic('mais')} Nova turma</button></div></div>`;
  main.querySelector('#b-nova-turma').onclick = () => gavetaTurma(() => telaTurmas());
  main.querySelectorAll('[data-turma]').forEach((b) => (b.onclick = () => {
    const t = turmas.find((x) => x.id === b.dataset.turma);
    abrirGaveta(t.nome, menu([{ op: 'editar', icone: 'editar', rotulo: 'Editar turma' }, '-', { op: 'apagar', icone: 'lixo', rotulo: 'Apagar turma', perigo: true }]), (g) => g.addEventListener('click', (e) => {
      const op = e.target.closest('[data-op]')?.dataset.op; if (!op) return;
      fecharGaveta();
      if (op === 'editar') setTimeout(() => gavetaTurma(() => telaTurmas(), t), 220);
      if (op === 'apagar') { salvarTurmas(getTurmas().filter((x) => x.id !== t.id)); telaTurmas(); aviso('Turma apagada.', { rotulo: 'Desfazer', fn: () => { salvarTurmas([...getTurmas(), t]); telaTurmas(); } }); }
    }));
  }));
}
function telaPerfis() {
  titulo('Perfis de adaptação');
  const perfis = getPerfis();
  main.innerHTML = `<div class="sub-tela">${ceu({ esquerda: voltarBtn('#/ajustes', 'Ajustes'), titulo: 'Perfis de adaptação', baixo: true })}
    <div class="folha-branca"><div class="cabeca-folha"><h1>Uma prova, vários jeitos</h1><p>Cada perfil vira uma versão adaptada nas provas novas.</p></div>
    ${perfis.map((p, k) => `<div class="cartao-apta versao-cartao" style="box-shadow:none"><div class="topo-v"><span class="tag-v">V${k + 1}</span><strong>${esc(p.nome)}</strong></div>
      <p>${esc(resumoCfg(p.cfg))}</p><div class="duas"><button type="button" class="btn-apta suave pequeno" style="width:100%" data-editar="${k}">Editar ajustes</button>
      <button type="button" class="btn-apta claro pequeno" style="width:100%;color:var(--vermelho)" data-apagar="${k}">Apagar</button></div></div>`).join('')}
    <button type="button" class="link-apta" id="b-novo-perfil">${ic('mais')} Novo perfil</button>
    <p class="ajuda">Sem rótulos no papel: nada na folha identifica o aluno que recebe a versão adaptada.</p></div></div>`;
  main.querySelectorAll('[data-editar]').forEach((b) => (b.onclick = () => {
    const k = Number(b.dataset.editar); const v = structuredClone(perfis[k]);
    gavetaAjustesVersao(v, (nv) => { perfis[k] = { nome: nv.nome, icone: nv.icone, cfg: nv.cfg }; salvarPerfis(perfis); telaPerfis(); }, { tituloG: 'Editar perfil' });
  }));
  main.querySelectorAll('[data-apagar]').forEach((b) => (b.onclick = () => { perfis.splice(Number(b.dataset.apagar), 1); salvarPerfis(perfis); telaPerfis(); }));
  main.querySelector('#b-novo-perfil').onclick = () => gavetaAjustesVersao({ nome: 'Novo perfil', cfg: { letraMaior: true, frasesCurtas: true, dicas: false, tresAlternativas: false, negrito: false, imagens: false } },
    (nv) => { perfis.push({ nome: nv.nome, icone: nv.icone, cfg: nv.cfg }); salvarPerfis(perfis); telaPerfis(); }, { tituloG: 'Novo perfil' });
}
function telaModelo() {
  titulo('Modelo da prova');
  const cfg = getConfig();
  const e = cfg.escola;
  const fcfg = getFolhaCfg();
  let moldura = fcfg.moldura;
  main.innerHTML = `<div class="sub-tela">${ceu({ esquerda: voltarBtn('#/ajustes', 'Ajustes'), titulo: 'Modelo da prova', baixo: true })}
    <div class="folha-branca"><div class="cabeca-folha"><h1>A prova com a sua escola</h1><p>Personalize o cabeçalho e a apresentação.</p></div>
    <div class="previa-modelo" id="previa-modelo"></div>
    <p class="status-ok" id="modelo-status"></p>
    <label class="btn-apta claro" for="m-word">${e.modelo ? 'Trocar arquivo do cabeçalho' : 'Trazer o cabeçalho do seu Word'}</label>
    <input type="file" id="m-word" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="sr" />
    ${e.modelo ? '<div style="text-align:center"><button type="button" class="texto-btn" id="b-modelo-padrao">Voltar ao cabeçalho padrão do app</button></div>' : ''}
    <h2 class="secao-azul">${ic('moldura')} Moldura</h2>${molduraPicker(moldura)}
    <h2 class="secao-azul">${ic('doc')} Na folha</h2>
    <ul class="lista-apta">
      <li><label class="opcao-linha">${ic('lista')}<span class="txt">Instruções padrão no topo<small>${esc((e.instrucoes || 'Nenhuma ainda').split('\n')[0].slice(0, 48))}</small></span><input type="checkbox" class="switch-apta" id="m-instr" ${fcfg.instrucoes ? 'checked' : ''} /></label></li>
      ${itemLink('#/ajustes/escola', 'escola', 'Nome, cidade e logotipo', e.nome || 'Minha escola')}
    </ul></div>
    <div class="barra-acoes"><button type="button" class="btn-apta" id="b-salvar-modelo">Salvar modelo</button></div></div>`;
  const previa = () => {
    const e2 = getConfig().escola;
    main.querySelector('#previa-modelo').innerHTML = cabecalhoHTML({ materia: 'Matemática', serie: '4º ano', turma: getTurmas()[0]?.nome || '', data: '' }, e2, false);
    main.querySelector('#modelo-status').innerHTML = e2.modelo ? `${ic('certoCirc')} Trazido de “${esc(e2.modelo.nome)}.docx”, igual ao original.` : `${ic('certoCirc')} Cabeçalho padrão do app, com os dados da sua escola.`;
  };
  previa();
  ligarMolduras(main, (m) => { moldura = m; if (m === 'escola' && !getConfig().escola.modelo) main.querySelector('#m-word').click(); });
  main.querySelector('#b-modelo-padrao')?.addEventListener('click', () => { const c = getConfig(); salvarConfig({ ...c, escola: { ...c.escola, modelo: null, campos: [] } }); telaModelo(); aviso('O cabeçalho voltou ao padrão do app.'); });
  main.querySelector('#m-word').onchange = async (ev) => {
    const arq = ev.target.files[0]; ev.target.value = '';
    if (!arq) return;
    try {
      const r = await lerCabecalhoWord(arq);
      if (!r.modelo && !r.achou) { aviso('Não achei um cabeçalho nesse arquivo.'); return; }
      const c = getConfig();
      const esc2 = { ...c.escola };
      if (r.modelo) { const id = uid(); await guardarArquivo({ id, nome: arq.name, bytes: r.modelo, criadoEm: Date.now() }); esc2.modelo = { id, nome: arq.name.replace(/\.docx$/i, '') }; esc2.campos = []; }
      if (r.nome) esc2.nome = r.nome;
      if (r.cidade) esc2.cidade = r.cidade;
      if (r.professora) esc2.professora = r.professora;
      if (r.instrucoes) esc2.instrucoes = r.instrucoes;
      if (r.logo) esc2.logo = await reduzirImagem(r.logo, 240);
      if (!r.modelo && r.campos?.length) esc2.campos = r.campos;
      salvarConfig({ ...c, escola: esc2 });
      previa(); aviso('Cabeçalho trazido do seu Word.');
    } catch (err) { console.error(err); aviso(err.message || 'Não consegui ler esse arquivo.'); }
  };
  main.querySelector('#b-salvar-modelo').onclick = () => {
    gravarJ('apta.folha', { ...getFolhaCfg(), moldura, instrucoes: main.querySelector('#m-instr').checked });
    aviso('Modelo salvo. Vale para as próximas provas e exportações.');
    location.hash = '#/ajustes';
  };
}

/** Dados de exemplo para ver o app como no protótipo (turmas, semana e provas). */
async function preencherExemplo() {
  if (!(await alertaIOS({ titulo: 'Preencher com um exemplo?', texto: 'Cria duas turmas, uma semana de provas e algumas provas com as questões de exemplo. Nada do que você já tem é apagado.', ok: 'Preencher' }))) return;
  const cfg = getConfig();
  salvarConfig({ ...cfg, escola: { ...cfg.escola, nome: cfg.escola.nome || 'E.M. Vila Velha', professora: cfg.escola.professora || 'Caroline', cidade: cfg.escola.cidade || 'Vila Velha, ES' } });
  const atuais = lerJ('apta.turmas', []) || [];
  const novas = [{ id: uid(), nome: '4º ano B', serie: '4º ano', descricao: 'Multidisciplinar', alunos: 28 }, { id: uid(), nome: '5º ano A', serie: '5º ano', descricao: 'Matemática', alunos: 31 }]
    .filter((t) => !atuais.some((a) => a.nome === t.nome));
  salvarTurmas([...novas, ...atuais]);
  const hoje = deIso(isoHoje());
  const seg = new Date(hoje); seg.setDate(hoje.getDate() + ((8 - hoje.getDay()) % 7 || 7));
  const dia = (k) => { const d = new Date(seg); d.setDate(seg.getDate() + k); return isoDe(d); };
  const plano = [
    ['Matemática', '4º ano B', '4º ano', 'Frações', 0], ['Matemática', '5º ano A', '5º ano', 'Frações e decimais', 0],
    ['Português', '4º ano B', '4º ano', 'Fábulas', 1], ['Ciências', '4º ano B', '4º ano', 'Seres vivos', 1],
    ['História', '4º ano B', '4º ano', 'Povos indígenas', 2], ['Geografia', '5º ano A', '5º ano', 'Regiões do Brasil', 3],
    ['Português', '5º ano A', '5º ano', 'Interpretação de texto', 4], ['Ciências', '5º ano A', '5º ano', 'Ciclo da água', 7],
  ].map(([materia, turma, serie, tema, k]) => ({ id: uid(), materia, turma, serie, tema, data: dia(k), provaId: null }));
  salvarSemana({ inicio: dia(0), fim: dia(11), entrega: dia(11), planejadas: plano });
  const base = novoRascunho();
  for (const [k, pl] of plano.slice(0, 4).entries()) {
    try {
      const r = await montarProva({ ...base, materia: pl.materia, serie: pl.serie, turma: pl.turma, tema: pl.tema, modo: 'banco', quantidade: 5, tipos: Object.keys(TIPOS), adaptada: true, versoes: getPerfis().map(novaVersao), planejadaId: pl.id });
      if (r.prova && k < 3) { r.prova.questoes.forEach((q) => { q.revisada = true; }); salvarProva(r.prova); }
    } catch (e) { console.warn(e); }
  }
  location.hash = '#/';
  rotear();
  setTimeout(() => aviso('Exemplo pronto: turmas, semana de provas e provas.'), 300);
}

Promise.allSettled([carregarImagens(), carregarMateriais()]).finally(rotear);
