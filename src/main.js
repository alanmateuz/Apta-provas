// =========================================================
// Prova Izi — telas do app (mobile primeiro)
// Rotas: #/  #/nova  #/prova/ID  #/provas  #/banco  #/ajustes
// =========================================================
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
import { gerarQuestoes, revisarQuestoes, iaDisponivel, testarConexao, buscarNaInternet, gerarIlustracao, conferirFigura, baixarImagemInternet, ErroIA } from './ia.js';
import { carregarImagens, obterImagem, guardarImagem, rasterizar, svgSeguro, imagensDasQuestoes, importarImagens } from './imagens.js';
import { baixarWord } from './word.js';

registerSW({ immediate: true });

const main = document.getElementById('conteudo');

/* =================== Ícones (traço simples, 24px) =================== */
const ICONES = {
  casa: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h4"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  banco: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
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
};
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
    b.onclick = () => { acao.fn(); el.remove(); };
    el.append(b);
  }
  caixa.append(el);
  setTimeout(() => el.remove(), acao ? 9000 : 4500);
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
function abrirGaveta(titulo, corpo, aoMontar) {
  gavetaEl.innerHTML = `<div class="gaveta-cabeca"><h2 id="gaveta-titulo">${esc(titulo)}</h2>
    <button class="botao fantasma icone" data-fechar aria-label="Fechar">${ic('fechar')}</button></div>
    <div class="gaveta-corpo">${corpo}</div>`;
  gavetaEl.querySelector('[data-fechar]').onclick = fecharGaveta;
  aoMontar?.(gavetaEl.querySelector('.gaveta-corpo'));
  if (!gavetaEl.open) gavetaEl.showModal();
}
function fecharGaveta() { if (gavetaEl.open) gavetaEl.close(); }
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
function atualizarConexao() {
  const el = document.getElementById('conexao');
  const on = navigator.onLine;
  el.textContent = on ? 'Online' : 'Sem internet';
  el.title = on ? 'Com internet' : 'Sem internet: o app continua funcionando com o banco de questões';
  el.classList.toggle('offline', !on);
}
addEventListener('online', atualizarConexao);
addEventListener('offline', atualizarConexao);
atualizarConexao();

/* =================== Navegação =================== */
const NAV = [
  { rota: '', rotulo: 'Início', icone: 'casa' },
  { rota: 'provas', rotulo: 'Provas', icone: 'doc' },
  { rota: 'nova', rotulo: 'Criar', icone: 'mais', classe: 'criar', longo: 'Criar prova' },
  { rota: 'banco', rotulo: 'Banco', icone: 'banco', longo: 'Banco de questões' },
  { rota: 'ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
];
document.getElementById('nav').innerHTML = NAV.map((n) => `<a href="#/${n.rota}" class="${n.classe || ''}" data-rota="${n.rota}">
  <span class="pilula">${ic(n.icone)}</span><span>${n.rotulo}</span></a>`).join('');

function rotear() {
  const [rotaBruta = '', id] = location.hash.replace(/^#\/?/, '').split('/');
  const rota = ['escola', 'ia'].includes(rotaBruta) ? 'ajustes' : rotaBruta;
  const ativa = rota === 'prova' ? 'provas' : rota;
  document.querySelectorAll('.nav a').forEach((a) => {
    if (a.dataset.rota === ativa) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  fecharGaveta();
  document.body.classList.toggle('foco', rota === 'nova' || rota === 'prova');
  main.classList.toggle('largo', rota === 'prova');
  main.onclick = null;
  main.classList.remove('entrar'); void main.offsetWidth; main.classList.add('entrar');
  const telas = { '': telaInicio, nova: telaNova, prova: () => telaProva(id), provas: telaProvas, banco: telaBanco, ajustes: () => telaAjustes(rotaBruta) };
  (telas[rota] || telaInicio)();
  window.scrollTo(0, 0);
}
addEventListener('hashchange', rotear);

function titulo(t) { document.title = `${t} · Prova Izi`; }
/** Leva o foco para o título da tela (bom para leitor de tela). */
function focarTitulo() { main.querySelector('h1')?.setAttribute('tabindex', '-1'); main.querySelector('h1')?.focus({ preventScroll: true }); }

/* =================== INÍCIO =================== */
function telaInicio() {
  titulo('Início');
  const cfg = getConfig();
  const provas = getProvas();
  const banco = getBanco();
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const nome = cfg.escola.professora ? `, ${esc(cfg.escola.professora.split(' ')[0])}` : '';
  const dataHoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hoje = dataHoje.charAt(0).toUpperCase() + dataHoje.slice(1);

  const passos = [
    { feito: Boolean(cfg.escola.nome), txt: 'Cadastre sua escola', link: '#/ajustes', acao: 'Cadastrar' },
    { feito: provas.length > 0, txt: 'Crie sua primeira prova', link: '#/nova', acao: 'Criar' },
    { feito: banco.some((q) => q.origem === 'revisada' || q.origem === 'minha'), txt: 'Confira uma questão', link: provas[0] ? `#/prova/${provas[0].id}` : '#/banco', acao: 'Conferir' },
  ];
  const faltam = passos.filter((p) => !p.feito).length;
  const confiaveis = banco.filter((q) => q.origem === 'minha' || q.origem === 'revisada').length;

  main.innerHTML = `
    <p class="sub" style="margin:0">${hoje}</p>
    <h1>${saudacao}${nome}</h1>

    <a class="heroi" href="#/nova">
      <span class="heroi-icone">${ic('lapis')}</span>
      <h2>Criar prova nova</h2>
      <p>Escolha a turma e o conteúdo. A prova, a versão adaptada e o gabarito ficam prontos em minutos.</p>
      <span class="botao">Começar ${ic('seta', 'p')}</span>
    </a>

    ${faltam ? `<div class="cabeca-secao">Primeiros passos · ${3 - faltam} de 3</div>
      <ul class="grupo passos">${passos.map((p, i) => `<li class="${p.feito ? 'feito' : ''}">${p.feito
        ? `<div class="linha"><span class="bolinha" aria-hidden="true">✓</span><span class="texto-linha"><span class="titulo-linha">${p.txt}<span class="sr"> (feito)</span></span></span></div>`
        : `<a class="linha" href="${p.link}"><span class="bolinha" aria-hidden="true">${i + 1}</span><span class="texto-linha"><span class="titulo-linha">${p.txt}</span></span><span class="valor">${p.acao}</span><span class="chevron">${ic('seta')}</span></a>`}</li>`).join('')}</ul>` : ''}

    <div class="cabeca-secao">Últimas provas</div>
    ${provas.length ? `<ul class="grupo">${provas.slice(0, 3).map(itemProva).join('')}
        ${provas.length > 3 ? linha({ href: '#/provas', titulo: `Ver todas as ${provas.length} provas` }) : ''}</ul>`
      : `<div class="vazio">${ic('doc')}<strong>Nenhuma prova ainda</strong>Suas provas aparecem aqui.</div>`}

    <div class="cabeca-secao">Atalhos</div>
    <ul class="grupo">
      ${linha({ href: '#/banco', icone: 'banco', titulo: 'Banco de questões', meta: `${plural(banco.length, 'questão', 'questões')} · ${confiaveis} conferidas` })}
      ${linha({ href: '#/ajustes', icone: 'escola', cor: 'cinza', titulo: 'Minha escola', meta: cfg.escola.nome ? esc(cfg.escola.nome) : 'Cabeçalho das provas' })}
    </ul>`;
}

function itemProva(p) {
  return linha({
    href: `#/prova/${p.id}`, icone: 'doc', titulo: esc(p.titulo),
    meta: `${esc(p.turma || p.serie)} · ${plural(p.questoes.length, 'questão', 'questões')} · ${new Date(p.atualizadaEm).toLocaleDateString('pt-BR')}`,
  });
}

/* =================== CRIAR PROVA (assistente em 4 passos) =================== */
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

function desenharPasso() {
  const r = rascunho;
  const cfg = getConfig();
  const temIA = iaDisponivel(cfg);
  const opcaoLista = (tipo, nome, valor, marcado, titulo, sub, desabilitado = false) => `<label class="ficha"><input type="${tipo}" name="${nome}" value="${valor}" ${marcado ? 'checked' : ''} ${desabilitado ? 'disabled' : ''}/>
    <span><span class="op-texto"><strong>${titulo}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="marca-op" aria-hidden="true">${ic('certo')}</span></span></label>`;
  let corpo = '';
  if (r.passo === 1) {
    corpo = `<h1>Para qual turma?</h1>
      <p class="sub">Escolha a matéria e o ano.</p>
      <div class="cartao-form">
        <fieldset style="border:0;padding:0;margin:0 0 20px"><legend class="rotulo">Matéria</legend>${fichas('materia', MATERIAS.map((m) => [m, m]), r.materia)}</fieldset>
        <fieldset style="border:0;padding:0;margin:0 0 20px"><legend class="rotulo">Ano / série</legend>${fichas('serie', SERIES.map((s) => [s, s.replace(' (Ensino Médio)', ' EM')]), r.serie)}</fieldset>
        <div class="campo"><label for="turma">Nome da turma <span class="opcional">(opcional)</span></label>
          <input type="text" id="turma" name="turma" value="${esc(r.turma)}" placeholder="Ex.: 5º ano A" autocomplete="off" /></div>
      </div>`;
  }
  if (r.passo === 2) {
    const sugs = SUGESTOES[r.materia] || [];
    corpo = `<h1>O que vai cair?</h1>
      <p class="sub">Escreva o conteúdo como você falaria para um colega.</p>
      <div class="cartao-form">
        <div class="campo"><label for="tema">Conteúdo da prova</label>
          <span class="dica" id="tema-dica">Quanto mais específico, melhor o resultado. Em vez de só “frações”, escreva algo como “frações: comparar e somar frações com o mesmo denominador”.</span>
          <textarea id="tema" name="tema" aria-describedby="tema-dica tema-erro" placeholder="Ex.: frações: comparar e somar frações com o mesmo denominador">${esc(r.tema)}</textarea>
          <div class="erro-campo" id="tema-erro" hidden>${ic('alerta', 'p')} Escreva o conteúdo para continuar.</div>
          ${sugs.length ? `<span class="dica" style="margin:14px 0 0">Ou toque numa sugestão:</span><div class="sugestoes">${sugs.map((s) => `<button type="button" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
        </div>
      </div>
      <div class="cartao-form">
        <div class="campo"><label for="obs">Algum pedido especial? <span class="opcional">(opcional)</span></label>
          <span class="dica">Por exemplo: usar situações do dia a dia ou incluir uma questão com tabela.</span>
          <textarea id="obs" name="observacoes" style="min-height:84px" placeholder="Ex.: usar situações de mercado e dinheiro">${esc(r.observacoes)}</textarea></div>
      </div>`;
  }
  if (r.passo === 3) {
    corpo = `<h1>Como vai ser?</h1>
      <p class="sub">Dá para mudar tudo depois.</p>
      <div class="cartao-form">
        <fieldset style="border:0;padding:0;margin:0 0 20px"><legend class="rotulo">Dificuldade</legend>${fichas('dificuldade', Object.entries(DIFICULDADES), r.dificuldade)}</fieldset>
        <div class="campo"><span class="rotulo" id="qtd-rot">Quantas questões?</span>
          <div class="contador" role="group" aria-labelledby="qtd-rot">
            <button type="button" class="botao" data-passo="-1" aria-label="Uma questão a menos">−</button>
            <output id="qtd" aria-live="polite">${r.quantidade}</output>
            <button type="button" class="botao" data-passo="1" aria-label="Uma questão a mais">+</button>
          </div></div>
      </div>
      ${temIA ? `<label class="alternar" style="margin-bottom:16px"><input type="checkbox" name="figuras" ${r.figuras ? 'checked' : ''}/>
        <span><strong>Incluir figuras quando ajudarem</strong><small>Gráficos, frações, formas e ilustrações. Cada figura é conferida antes de entrar na prova.</small></span></label>` : ''}
      <div class="cabeca-secao" id="tipos-rot">Tipos de questão · marque um ou mais</div>
      <div class="fichas lista" role="group" aria-labelledby="tipos-rot">${Object.entries(TIPOS).map(([v, rot]) => opcaoLista('checkbox', 'tipos', v, r.tipos.includes(v), rot, EXEMPLO_TIPO[v])).join('')}</div>
      <div class="erro-campo" id="tipos-erro" hidden>${ic('alerta', 'p')} Marque pelo menos um tipo.</div>`;
  }
  if (r.passo === 4) {
    const origens = [
      ['misto', 'Meu banco + questões novas', 'Recomendado. Usa primeiro as suas questões e cria só as que faltarem.'],
      ['banco', 'Só do meu banco', 'Funciona sem internet.'],
      ['ia', 'Só questões novas', 'Todas criadas na hora. Precisa de internet.'],
    ];
    const itemResumo = (rotulo, valor, passo) => `<li><div class="linha"><span class="texto-linha"><span class="meta">${rotulo}</span><span class="titulo-linha">${valor}</span></span>
      <button type="button" class="botao fantasma pequeno" data-ir="${passo}">Alterar</button></div></li>`;
    corpo = `<h1>Tudo certo?</h1>
      <p class="sub">Confira antes de criar.</p>
      <ul class="grupo resumo">
        ${itemResumo('Turma', `${esc(r.materia)} · ${esc(r.turma || r.serie)}`, 1)}
        ${itemResumo('Conteúdo', esc(r.tema), 2)}
        ${itemResumo('Formato', `${plural(r.quantidade, 'questão', 'questões')} · ${DIFICULDADES[r.dificuldade]} · ${r.tipos.map((t) => TIPOS[t].split(' (')[0]).join(', ')}${r.figuras && temIA ? ' · com figuras' : ''}`, 3)}
      </ul>
      <div class="cabeca-secao">Versão adaptada</div>
      <label class="alternar"><input type="checkbox" name="adaptada" ${r.adaptada ? 'checked' : ''}/>
        <span><strong>Criar também a versão adaptada</strong><small>Para alunos com TDAH, autismo, dislexia ou deficiência intelectual: frases curtas, letra maior, palavras-chave em negrito e dicas.</small></span></label>
      <div class="cabeca-secao" id="origem-rot">De onde vêm as questões?</div>
      <div class="fichas lista" role="radiogroup" aria-labelledby="origem-rot">${origens.map(([v, rot, d]) => {
        const off = v !== 'banco' && !temIA;
        return opcaoLista('radio', 'modo', v, r.modo === v, rot, off ? 'Precisa ligar a criação automática em Ajustes.' : d, off);
      }).join('')}</div>`;
  }

  main.innerHTML = `
    <div class="progresso">
      <div class="progresso-trilho" role="progressbar" aria-valuemin="1" aria-valuemax="${TOTAL_PASSOS}" aria-valuenow="${r.passo}" aria-label="Passo ${r.passo} de ${TOTAL_PASSOS}">${[1, 2, 3, 4].map((n) => `<span class="${n <= r.passo ? 'feito' : ''}"></span>`).join('')}</div>
      <span class="progresso-rotulo">${r.passo} de ${TOTAL_PASSOS}</span>
    </div>
    <form id="form-passo" novalidate>${corpo}</form>
    <div class="barra-acoes">
      <button type="button" class="botao" id="b-voltar">${r.passo === 1 ? 'Cancelar' : `${ic('voltar', 'p')} Voltar`}</button>
      <button type="button" class="botao principal grande" id="b-seguir">${r.passo === TOTAL_PASSOS ? 'Criar prova' : `Continuar ${ic('seta', 'p')}`}</button>
    </div>`;

  const form = main.querySelector('#form-passo');
  form.addEventListener('submit', (e) => { e.preventDefault(); seguir(); });
  form.addEventListener('change', () => lerPasso(form));
  form.addEventListener('input', () => lerPasso(form));
  form.querySelectorAll('[data-sug]').forEach((b) => (b.onclick = () => {
    form.tema.value = b.dataset.sug; lerPasso(form); form.tema.focus();
  }));
  form.querySelectorAll('[data-passo]').forEach((b) => (b.onclick = () => {
    r.quantidade = Math.min(20, Math.max(1, r.quantidade + Number(b.dataset.passo)));
    form.querySelector('#qtd').textContent = r.quantidade;
  }));
  form.querySelectorAll('[data-ir]').forEach((b) => (b.onclick = () => { r.passo = Number(b.dataset.ir); desenharPasso(); }));
  main.querySelector('#b-voltar').onclick = () => {
    if (r.passo === 1) { rascunho = null; location.hash = '#/'; return; }
    r.passo--; desenharPasso();
  };
  main.querySelector('#b-seguir').onclick = seguir;
  main.classList.remove('entrar'); void main.offsetWidth; main.classList.add('entrar');
  window.scrollTo(0, 0);
  focarTitulo();
}

function lerPasso(form) {
  const r = rascunho;
  const fd = new FormData(form);
  if (r.passo === 1) { r.materia = fd.get('materia'); r.serie = fd.get('serie'); r.turma = fd.get('turma').trim(); }
  if (r.passo === 2) { r.tema = fd.get('tema').trim(); r.observacoes = (fd.get('observacoes') || '').trim(); if (r.tema) form.querySelector('#tema-erro').hidden = true; }
  if (r.passo === 3) { r.dificuldade = fd.get('dificuldade'); r.tipos = fd.getAll('tipos'); r.figuras = fd.get('figuras') === 'on'; if (r.tipos.length) form.querySelector('#tipos-erro').hidden = true; }
  if (r.passo === 4) { r.adaptada = fd.get('adaptada') === 'on'; r.modo = fd.get('modo') || 'banco'; }
}

async function seguir() {
  const r = rascunho;
  const form = main.querySelector('#form-passo');
  lerPasso(form);
  if (r.passo === 2 && !r.tema) { form.querySelector('#tema-erro').hidden = false; form.tema.focus(); return; }
  if (r.passo === 3 && !r.tipos.length) { form.querySelector('#tipos-erro').hidden = false; form.querySelector('[name=tipos]').focus(); return; }
  if (r.passo < TOTAL_PASSOS) { r.passo++; desenharPasso(); return; }
  const pedido = { ...r };
  delete pedido.passo;
  try { localStorage.setItem('pf.ultimoPedido', JSON.stringify(pedido)); } catch {}
  const ok = await criarProva(pedido);
  if (ok) rascunho = null;
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
    <img src="/icon.svg" alt="" width="64" height="64" style="border-radius:16px" />
    <h1 id="criando-titulo" style="margin-top:16px">Preparando sua prova</h1>
    <p class="sub">Leva cerca de 1 minuto. Pode deixar esta tela aberta.</p>
    <ol class="etapas" aria-live="polite">${etapas.map((t) => `<li><span class="estado" aria-hidden="true"></span><span>${esc(t)}</span></li>`).join('')}</ol>
    <button class="botao cheio" id="b-cancelar">Cancelar</button></div>`;
  el.querySelector('#b-cancelar').onclick = () => ctrl.abort();
  document.body.append(el);
  const lis = el.querySelectorAll('.etapas li');
  return {
    signal: ctrl.signal,
    etapa(i, texto) {
      lis.forEach((li, j) => {
        li.classList.toggle('feita', j < i); li.classList.toggle('agora', j === i);
        li.querySelector('.estado').textContent = j < i ? '✓' : '';
      });
      if (texto && lis[i]) lis[i].lastElementChild.textContent = texto;
    },
    fechar: () => el.remove(),
  };
}

async function criarProva(pedido) {
  const cfg = getConfig();
  const recados = [];
  const doBanco = pedido.modo === 'ia' ? [] : escolherDoBanco(getBanco(), pedido, pedido.quantidade);
  let questoes = doBanco.map((q) => prepararParaProva(q, pedido));
  const faltam = pedido.quantidade - questoes.length;
  const usarIA = faltam > 0 && pedido.modo !== 'banco' && iaDisponivel(cfg);

  if (usarIA) {
    const etapas = [
      pedido.modo === 'ia' ? 'Preparando o pedido' : `Encontrei ${plural(questoes.length, 'questão', 'questões')} no seu banco`,
      `Criando ${plural(faltam, 'questão nova', 'questões novas')}`,
    ];
    if (cfg.ia.revisora) etapas.push('Conferindo as respostas');
    if (pedido.figuras) etapas.push('Criando e conferindo as figuras');
    etapas.push('Montando a prova e a versão adaptada');
    const tela = telaCriando(etapas);
    tela.etapa(1);
    try {
      const novas = await gerarQuestoes(cfg, pedido, faltam, questoes.map((q) => q.enunciado.slice(0, 120)), tela.signal);
      let preparadas = novas.map((q) => embaralharAlternativas(prepararParaProva(q, pedido)));
      if (cfg.ia.revisora) {
        tela.etapa(2);
        try {
          const revisoes = await revisarQuestoes(cfg, preparadas, tela.signal);
          preparadas = preparadas.map((q, i) => ({ ...q, alertas: [...q.alertas, ...(revisoes[i] || [])] }));
        } catch (e) {
          if (e.name === 'AbortError') throw e;
          recados.push('A conferência automática não pôde ser feita agora. Confira as questões novas com atenção.');
        }
      }
      if (preparadas.some((q) => q.figura)) {
        tela.etapa(etapas.indexOf('Criando e conferindo as figuras'));
        await prepararFiguras(cfg, preparadas, tela.signal);
      }
      preparadas.forEach((q) => delete q.figura);
      tela.etapa(etapas.length - 1);
      adicionarAoBanco(preparadas.filter((q) => !q.alertas.some((a) => a.nivel === 'erro')), 'ia');
      questoes = [...questoes, ...preparadas];
    } catch (e) {
      tela.fechar();
      if (e.name === 'AbortError') { aviso('Criação cancelada. Suas escolhas foram mantidas.'); return false; }
      console.error(e);
      recados.push(e instanceof ErroIA ? e.message : 'Não foi possível criar questões novas agora.');
    }
    tela.fechar();
  }

  if (!questoes.length) {
    abrirGaveta('Não encontrei questões', `<p>${esc(recados[0] || 'Seu banco ainda não tem questões desse conteúdo para essa série.')}</p>
      <p>Você pode:</p><ul><li>escrever o conteúdo de outro jeito;</li><li>escolher outra série;</li><li>${iaDisponivel(cfg) ? 'escolher “Meu banco + questões novas” no último passo.' : 'adicionar questões no Banco.'}</li></ul>
      <button class="botao principal cheio" data-fechar-ok>Entendi</button>`, (c) => { c.querySelector('[data-fechar-ok]').onclick = fecharGaveta; });
    return false;
  }
  if (questoes.length < pedido.quantidade) recados.push(`A prova ficou com ${questoes.length} de ${pedido.quantidade} questões. Use “+ Questão” no rodapé para completar.`);

  const prova = {
    id: uid(),
    titulo: `Avaliação de ${pedido.materia} — ${pedido.tema.split(/[:.\n]/)[0].slice(0, 60)}`,
    materia: pedido.materia, serie: pedido.serie, turma: pedido.turma, tema: pedido.tema,
    dificuldade: pedido.dificuldade, data: new Date().toLocaleDateString('pt-BR'),
    instrucoes: getConfig().escola.instrucoes || '',
    temAdaptada: pedido.adaptada, pedido, questoes, criadaEm: Date.now(),
  };
  salvarProva(prova);
  sessionStorage.setItem('pf.recados', JSON.stringify(recados));
  location.hash = `#/prova/${prova.id}`;
  return true;
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
    <p class="dica-editar">${ic('editar', 'p')} Toque em qualquer texto da folha para editar.</p>
    <div id="recados" class="nao-imprimir"></div>
    <div id="painel-revisao" class="nao-imprimir"></div>
    <div role="tabpanel"><div id="folha" class="folha"></div></div>
    <div class="barra-acoes nao-imprimir">
      <button class="botao encolhe" id="b-add">${ic('mais', 'p')} Questão</button>
      <button class="botao encolhe" id="b-word">${ic('baixar', 'p')} Word</button>
      <button class="botao principal" id="b-imprimir">${ic('imprimir', 'p')} Imprimir</button>
    </div>`;

  const recados = JSON.parse(sessionStorage.getItem('pf.recados') || '[]');
  sessionStorage.removeItem('pf.recados');
  if (recados.length) main.querySelector('#recados').innerHTML = `<div class="aviso-bloco alerta" role="status">${recados.map((t) => `<p>${esc(t)}</p>`).join('')}</div>`.replace('class="aviso-bloco alerta" role="status">', `class="aviso-bloco alerta" role="status">${ic('alerta')}<div>`).replace(/<\/div>$/, '</div></div>');

  main.querySelectorAll('.segmentos button').forEach((b) => (b.onclick = () => { estado.aba = b.dataset.aba; desenharFolha(); }));
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
  desenharFolha();
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
  const alvo = estado.aba === 'adaptada' ? q.adaptada : q;
  alvo.correta = Number(e.target.value);
  if (estado.aba !== 'adaptada') q.resposta = q.alternativas[q.correta] || '';
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
  if (b.dataset.acao === 'conferi') {
    q.revisada = !q.revisada;
    if (q.revisada) { adicionarAoBanco([q], 'revisada'); aviso('Conferida! Ela agora é uma questão confiável do seu banco.'); }
    salvarDepois(); desenharFolha();
  }
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
  return `<div class="cabecalho">
    <div class="cabecalho-topo">
      ${escola.logo ? `<img src="${escola.logo}" alt="Logotipo da escola" />` : ''}
      <div class="escola">${esc(escola.nome || 'Nome da escola')}${escola.cidade ? `<div style="font-weight:400;font-size:.8em">${esc(escola.cidade)}</div>` : ''}</div>
    </div>
    <div class="linhas">
      <div class="inteira">Aluno(a): ______________________________ Nº: ____</div>
      <div>Professor(a): ${esc(escola.professora || '__________________')}</div>
      <div>Disciplina: ${esc(p.materia)}</div>
      <div>Turma: <span ${ce} data-cab="turma" aria-label="Turma">${esc(p.turma || p.serie)}</span></div>
      <div>Data: <span ${ce} data-cab="data" aria-label="Data">${esc(p.data || '___/___/_____')}</span> &nbsp; Nota: _____</div>
    </div>
  </div>`;
}

function seloOrigem(q) {
  if (q.revisada) return `<span class="selo revisada">${ic('certo', 'p')} Conferida</span>`;
  if (q.origem === 'minha' || q.origem === 'revisada') return `<span class="selo revisada">${ic('certo', 'p')} Confiável</span>`;
  if (q.origem === 'ia') return '<span class="selo ia">Nova · confira</span>';
  if (q.origem === 'exemplo') return '<span class="selo exemplo">Exemplo · confira</span>';
  if (q.origem === 'importada') return '<span class="selo exemplo">Importada</span>';
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
  if (q.tipo === 'multipla') {
    corpo += `<ol class="q-alts">${(d.alternativas || []).map((a, j) => `<li>(&nbsp;&nbsp;) ${letra(j)}) <span ${ce} data-campo="alt" data-j="${j}" aria-label="Alternativa ${letra(j)}">${md(a)}</span></li>`).join('')}</ol>`;
  } else if (q.tipo === 'vf') {
    corpo += `<ol class="q-alts">${(d.alternativas || []).map((a, j) => `<li>(&nbsp;&nbsp;&nbsp;) <span ${ce} data-campo="alt" data-j="${j}" aria-label="Afirmação ${j + 1}">${md(a)}</span></li>`).join('')}</ol>`;
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
    ${p.questoes.map((q, i) => `<tr class="q" data-i="${i}"><td>${i + 1}</td>
      <td>${q.tipo === 'multipla' ? esc(textoGabarito(q, versao)) : `<span contenteditable="true" data-campo="resposta" aria-label="Resposta da questão ${i + 1}">${esc(q.resposta || '')}</span>`}
      ${q.justificativa ? `<div class="nao-imprimir" style="color:#555;font-size:.85em;margin-top:2px">Por quê: ${esc(q.justificativa)}</div>` : ''}</td></tr>`).join('')}</tbody></table>`;
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

function desenharPainelRevisao() {
  const p = estado.prova;
  const el = document.getElementById('painel-revisao');
  if (!el) return;
  const comErro = p.questoes.map((q, i) => ({ q, i })).filter(({ q }) => q.alertas?.some((a) => a.nivel === 'erro'));
  const naoConferidas = p.questoes.map((q, i) => ({ q, i })).filter(({ q }) => !q.revisada && ['ia', 'exemplo', 'internet'].includes(q.origem));
  const geral = validarProva(p.questoes);
  if (!comErro.length && !naoConferidas.length && !geral.length) {
    el.innerHTML = `<div class="revisao-resumo ok">${ic('certo')}<span class="txt"><strong>Pronta para imprimir</strong>Nenhum problema encontrado.</span></div>`;
    return;
  }
  const alvo = (comErro[0] || naoConferidas[0])?.i;
  el.innerHTML = `<div class="revisao-resumo ${comErro.length ? 'erro' : ''}">
    ${ic('alerta')}
    <span class="txt"><strong>${comErro.length ? plural(comErro.length, 'questão com possível erro', 'questões com possível erro') : plural(naoConferidas.length, 'questão para conferir', 'questões para conferir')}</strong>
    ${comErro.length && naoConferidas.length ? `e ${plural(naoConferidas.length, 'para conferir', 'para conferir')}. ` : ''}${geral.map(esc).join(' ')}${!geral.length && !comErro.length ? 'Questões novas e de exemplo precisam do seu ok.' : ''}</span>
    ${alvo !== undefined ? `<button class="botao pequeno" id="b-ver-prob">Ver</button>` : ''}</div>`;
  el.querySelector('#b-ver-prob')?.addEventListener('click', () => {
    if (estado.aba === 'gabarito') { estado.aba = 'normal'; desenharFolha(); }
    const qEl = document.querySelector(`.q[data-i="${alvo}"]`);
    qEl?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    qEl?.querySelector('[data-acao=conferi]')?.focus({ preventScroll: true });
  });
}

function imprimir() {
  const problemas = estado.prova.questoes.filter((q) => q.alertas?.some((a) => a.nivel === 'erro')).length;
  if (problemas) aviso(`Lembrete: ${plural(problemas, 'questão tem', 'questões têm')} possível erro.`);
  window.print();
}

/* =================== MINHAS PROVAS =================== */
function telaProvas() {
  titulo('Minhas provas');
  const provas = getProvas();
  main.innerHTML = `<h1>Provas</h1>
    <p class="sub">${provas.length ? plural(provas.length, 'prova salva neste aparelho', 'provas salvas neste aparelho') : 'Tudo o que você criar fica salvo aqui, mesmo sem internet.'}</p>
    ${provas.length ? `<ul class="grupo">${provas.map(itemProva).join('')}</ul>`
      : `<div class="vazio">${ic('doc')}<strong>Crie sua primeira prova</strong>Leva poucos minutos.<div class="acoes" style="justify-content:center"><a class="botao principal" href="#/nova">Criar prova</a></div></div>`}`;
}

/* =================== BANCO DE QUESTÕES =================== */
let filtroBanco = { materia: '', serie: '', busca: '', origem: '', limite: 25 };
const ORIGENS = [['confiavel', 'Conferidas'], ['internet', 'Da internet'], ['importada', 'Importadas'], ['exemplo', 'Exemplos do app'], ['ia', 'Novas, para conferir']];

function telaBanco() {
  titulo('Banco de questões');
  const banco = getBanco();
  const temIA = iaDisponivel(getConfig());
  const nConf = banco.filter((q) => q.origem === 'minha' || q.origem === 'revisada').length;
  main.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px"><h1 style="flex:1">Banco</h1>
      <button class="botao fantasma icone" id="b-banco-mais" aria-label="Importar ou exportar questões">${ic('pontos')}</button></div>
    <p class="sub">Suas questões ficam guardadas neste aparelho e funcionam sem internet.</p>
    <div class="contagem">
      <div><strong>${nConf}</strong><span>conferidas</span></div>
      <div><strong>${banco.filter((q) => ['exemplo', 'importada', 'internet'].includes(q.origem)).length}</strong><span>exemplos e da internet</span></div>
      <div><strong>${banco.filter((q) => q.origem === 'ia').length}</strong><span>novas para conferir</span></div>
    </div>
    <button class="cartao-busca" id="b-buscar-web" ${temIA ? '' : 'disabled'}>
      <span class="icone-app">${ic('brilho')}</span>
      <span class="texto-linha"><strong>Buscar questões na internet com IA</strong>
        <small>${temIA ? 'A IA procura em provas públicas como Saeb e OBMEP e traz o link da fonte.' : 'Precisa ligar a criação automática em Ajustes.'}</small></span>
      <span class="chevron">${ic('seta')}</span>
    </button>
    <div style="display:flex;gap:8px;align-items:center">
      <div class="busca" style="flex:1">${ic('busca')}<label class="sr" for="f-busca">Procurar questões</label>
        <input type="search" id="f-busca" value="${esc(filtroBanco.busca)}" placeholder="Procurar" /></div>
      <button class="botao pequeno" id="b-filtros">${ic('filtro', 'p')} Filtros</button>
    </div>
    <div class="filtros-ativos" id="filtros-ativos"></div>
    <div id="contador-banco" role="status" class="cabeca-secao" style="margin-left:4px"></div>
    <ul class="lista-cartoes" id="lista-banco"></ul>
    <div class="acoes" style="justify-content:center"><button class="botao" id="b-mais" hidden>Mostrar mais</button></div>
    <button class="botao escuro grande fab" id="b-nova-q">${ic('editar', 'p')} Escrever questão</button>
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
      <div class="meta"><span>${esc(q.materia)} · ${esc(q.serie)} · ${esc(q.tema)}</span>${seloOrigem(q)}</div>
      <p class="enun">${md(q.enunciado)}</p>
      ${figuraHTML(q)}
      <details class="ver-resposta"><summary>Ver resposta ${ic('seta')}</summary>
        ${q.tipo === 'multipla' || q.tipo === 'vf' ? `<ol>${q.alternativas.map((a, j) => `<li class="${j === q.correta ? 'certa' : ''}">${q.tipo === 'multipla' ? letra(j) + ') ' : '• '}${md(a)}${j === q.correta ? ' ✓' : ''}</li>`).join('')}</ol>` : ''}
        <p class="dica" style="margin:0 0 4px"><strong>Gabarito:</strong> ${esc(textoGabarito(q))}${q.justificativa ? ` — ${esc(q.justificativa)}` : ''}</p>
      </details>
      <div class="rodape-q">
        ${q.origem !== 'minha' && q.origem !== 'revisada' ? `<button class="botao pequeno" data-conferir="${q.id}">${ic('certo', 'p')} Marcar como conferida</button>` : ''}
        <button class="botao pequeno perigo" data-apagar-q="${q.id}" style="margin-left:auto">${ic('lixo', 'p')} Apagar</button>
      </div></li>`).join('')
      : `<li class="vazio">${ic('busca')}<strong>Nenhuma questão aqui</strong>Tire algum filtro ou escreva uma questão nova.</li>`;
    main.querySelector('#b-mais').hidden = filtradas.length <= filtroBanco.limite;
  };
  desenharLista();

  main.querySelector('#f-busca').oninput = (e) => { filtroBanco.busca = e.target.value; filtroBanco.limite = 25; desenharLista(); };
  main.querySelector('#filtros-ativos').onclick = (e) => { const k = e.target.closest('[data-limpa]')?.dataset.limpa; if (k) { filtroBanco[k] = ''; desenharLista(); } };
  main.querySelector('#b-mais').onclick = () => { filtroBanco.limite += 25; desenharLista(); };
  main.querySelector('#b-filtros').onclick = () => abrirGaveta('Filtrar questões', `<form id="f-filtros"><div class="cartao-form">
      <div class="campo"><label for="ff-materia">Matéria</label><select id="ff-materia" name="materia"><option value="">Todas</option>${MATERIAS.map((m) => `<option ${m === filtroBanco.materia ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
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
    const b = getBanco();
    if (conf) { b.find((q) => q.id === conf).origem = 'revisada'; salvarBanco(b); desenharLista(); aviso('Marcada como conferida.'); }
    if (apg) {
      const i = b.findIndex((q) => q.id === apg);
      const [rem] = b.splice(i, 1); salvarBanco(b); desenharLista();
      aviso('Questão apagada.', { rotulo: 'Desfazer', fn: () => { const b2 = getBanco(); b2.splice(i, 0, rem); salvarBanco(b2); if (location.hash === '#/banco') desenharLista(); } });
    }
  };
  main.querySelector('#b-banco-mais').onclick = () => abrirGaveta('Compartilhar questões', menu([
    { op: 'importar', icone: 'baixar', rotulo: 'Importar pacote de questões', dica: 'Arquivo recebido de um colega' },
    { op: 'exportar', icone: 'enviar', rotulo: 'Exportar meu banco', dica: 'Gera um arquivo para enviar a colegas' },
  ]), (c) => c.addEventListener('click', (e) => {
    const op = e.target.closest('[data-op]')?.dataset.op;
    if (op === 'importar') { fecharGaveta(); main.querySelector('#importar').click(); }
    if (op === 'exportar') {
      fecharGaveta();
      baixarArquivo(`banco-prova-izi-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ app: 'prova-izi', versao: 2, questoes: getBanco(), imagens: imagensDasQuestoes(getBanco()) }));
      aviso('Arquivo do banco baixado.');
    }
  }));
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
  main.querySelector('#b-nova-q').onclick = () => formQuestao(desenharLista);
  main.querySelector('#b-buscar-web').onclick = () => formBuscaInternet(() => telaBanco());
}

/* ---------- Buscar questões na internet ---------- */
function formBuscaInternet(depois) {
  let ultimo = {};
  try { ultimo = JSON.parse(localStorage.getItem('pf.ultimoPedido')) || {}; } catch {}
  abrirGaveta('Buscar na internet com IA', `<form id="form-busca" novalidate>
    <p class="dica" style="margin:0 0 16px">A IA procura questões que já existem e traz o link de onde vieram. Você escolhe quais guardar.</p>
    <div class="duas-colunas">
      <div class="campo"><label for="b-materia">Matéria</label><select id="b-materia" name="materia">${MATERIAS.map((m) => `<option ${m === (filtroBanco.materia || ultimo.materia || 'Matemática') ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
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

function mostrarResultadosBusca(achadas, depois) {
  const comErro = achadas.filter((q) => q.alertas.some((a) => a.nivel === 'erro')).length;
  const resumo = comErro === 0 ? 'Todas passaram na conferência automática.'
    : `${plural(comErro, 'questão tem', 'questões têm')} possível problema e ${comErro === 1 ? 'ficou desmarcada' : 'ficaram desmarcadas'}.`;
  abrirGaveta(`Achei ${plural(achadas.length, 'questão', 'questões')}`, `
    <p class="dica" style="margin:0 0 12px">${resumo} Toque no nome da fonte para ver a página original.</p>
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
      const novas = adicionarAoBanco(sel, 'internet');
      fecharGaveta();
      aviso(novas ? `${plural(novas, 'questão guardada', 'questões guardadas')} no banco, com o link da fonte.` : 'Essas questões já estavam no seu banco.');
      depois?.();
    };
  });
}

function formQuestao(depois) {
  abrirGaveta('Escrever questão', `<form id="form-q" novalidate>
    <div class="duas-colunas">
      <div class="campo"><label for="q-materia">Matéria</label><select id="q-materia" name="materia">${MATERIAS.map((m) => `<option ${m === (filtroBanco.materia || 'Matemática') ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="campo"><label for="q-serie">Ano / série</label><select id="q-serie" name="serie">${SERIES.map((s) => `<option ${s === (filtroBanco.serie || '5º ano') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="campo"><label for="q-tema">Conteúdo</label><input type="text" id="q-tema" name="tema" placeholder="Frações" /></div>
    <fieldset style="border:0;padding:0;margin:0 0 24px"><legend class="rotulo">Dificuldade</legend>${fichas('dificuldade', Object.entries(DIFICULDADES), 'medio')}</fieldset>
    <div class="campo"><label for="q-tipo">Tipo</label><select id="q-tipo" name="tipo">${Object.entries(TIPOS).map(([v, r]) => `<option value="${v}">${r}</option>`).join('')}</select></div>
    <div class="campo"><label for="q-enunciado">Pergunta</label>
      <span class="dica">Para destacar uma palavra, escreva entre dois asteriscos: **palavra**</span>
      <textarea id="q-enunciado" name="enunciado"></textarea></div>
    <fieldset id="q-alts" style="border:0;padding:0;margin:0 0 24px"><legend class="rotulo">Alternativas</legend><span class="dica">Toque no círculo da alternativa certa.</span>
      ${[0, 1, 2, 3].map((j) => `<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
        <input type="radio" name="correta" value="${j}" ${j === 0 ? 'checked' : ''} aria-label="A alternativa ${letra(j)} é a certa" style="width:28px;height:28px;flex:none;accent-color:var(--sucesso)"/>
        <input type="text" name="alt" aria-label="Alternativa ${letra(j)}" placeholder="Alternativa ${letra(j)}" /></div>`).join('')}</fieldset>
    <div class="campo"><span class="rotulo">Imagem <span class="opcional">(opcional)</span></span>
      <div class="acoes" style="margin:0"><label class="botao pequeno" for="q-img">${ic('imagem', 'p')} Escolher imagem</label>
      <input type="file" id="q-img" accept="image/*" class="sr" /><span class="dica" id="q-img-nome" style="margin:0"></span></div></div>
    <div class="campo" id="q-resp"><label for="q-resposta">Resposta esperada</label>
      <span class="dica">Para V/F escreva assim: V, F, V</span>
      <input type="text" id="q-resposta" name="resposta" /></div>
    <div class="aviso-bloco erro" id="q-erros" role="alert" hidden></div>
    <button class="botao principal grande cheio">${ic('certo', 'p')} Salvar no banco</button></form>`, (c) => {
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
        resposta: tipo === 'multipla' ? (alternativas[correta] || '') : fd.get('resposta').trim(), justificativa: '',
      };
      const arqImg = c.querySelector('#q-img').files[0];
      if (arqImg) {
        try { const reg = await guardarImagem(await rasterizar(arqImg)); q.imagem = { id: reg.id, tipo: 'professora', descricao: '', credito: '' }; }
        catch (err) { aviso(err.message); return; }
      }
      const erros = validarQuestao(q).filter((p) => p.nivel === 'erro').map((p) => p.msg);
      if (!q.tema) erros.unshift('Escreva o conteúdo.');
      const caixa = c.querySelector('#q-erros');
      if (erros.length) { caixa.hidden = false; caixa.innerHTML = `<strong>Falta corrigir:</strong><ul>${erros.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>`; caixa.scrollIntoView({ block: 'nearest' }); return; }
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
    <p class="sub">Preencha uma vez. Vale para todas as provas.</p>

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
        <div class="cabeca-secao">Como fica o topo da prova</div>
        <div class="previa-cabecalho" id="previa"></div>
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
        <details class="revelar"><summary>Como o Prova Izi evita erros<span class="chevron">${ic('seta')}</span></summary>
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
    </section>`;

  if (ancora === 'ia' || ancora === 'escola') document.getElementById(ancora)?.scrollIntoView();

  const form = main.querySelector('#form-escola');
  let logo = e.logo;
  const previa = () => {
    const fd = new FormData(form);
    const instr = (fd.get('instrucoes') || '').trim();
    main.querySelector('#previa').innerHTML = cabecalhoHTML({ materia: 'Matemática', serie: '5º ano', data: new Date().toLocaleDateString('pt-BR') },
      { nome: fd.get('nome'), cidade: fd.get('cidade'), professora: fd.get('professora'), logo }, false)
      + (instr ? `<div class="instrucoes" style="margin-top:10px"><strong>Instruções:</strong><div>${md(instr)}</div></div>` : '');
    main.querySelector('#b-tirar-logo').hidden = !logo;
  };
  previa();
  form.oninput = previa;
  main.querySelector('#e-logo').onchange = async (ev) => { const arq = ev.target.files[0]; if (arq) { logo = await reduzirImagem(arq, 240); previa(); } };
  main.querySelector('#b-tirar-logo').onclick = () => { logo = ''; previa(); };
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    try {
      salvarConfig({ ...getConfig(), escola: { nome: fd.get('nome').trim(), cidade: fd.get('cidade').trim(), professora: fd.get('professora').trim(), instrucoes: fd.get('instrucoes').replace(/\r/g, '').trim(), logo } });
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

carregarImagens().finally(rotear);
