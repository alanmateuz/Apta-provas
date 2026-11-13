// =========================================================
// Mostra na tela o cabeçalho do modelo em Word da escola,
// do jeito que está no arquivo (docx-preview desenha o Word em HTML).
// =========================================================
import { obterArquivo } from './materiais.js';

const cache = new Map(); // id do modelo → HTML pronto

export const temModelo = (escola) => Boolean(escola?.modelo?.id && obterArquivo(escola.modelo.id));
export const modeloEmCache = (id) => cache.get(id) || '';

async function htmlDoModelo(id) {
  if (cache.has(id)) return cache.get(id);
  const arq = obterArquivo(id);
  if (!arq) return '';
  const { renderAsync } = await import('docx-preview');
  const corpo = document.createElement('div');
  const estilos = document.createElement('div');
  await renderAsync(arq.bytes, corpo, estilos, {
    className: 'docxm', inWrapper: false, ignoreWidth: true, ignoreHeight: true, breakPages: false,
    renderHeaders: true, renderFooters: false, renderFootnotes: false, renderEndnotes: false, useBase64URL: true,
  });
  const html = estilos.innerHTML + corpo.innerHTML;
  cache.set(id, html);
  return html;
}

/** Cabe na largura da tela: o Word é desenhado no tamanho da folha e reduzido. */
function encaixar(el) {
  const sec = el.querySelector('section');
  if (!sec) return;
  el.style.zoom = '';
  const natural = sec.scrollWidth;
  const disponivel = el.clientWidth;
  if (natural > disponivel + 1) el.style.zoom = String(disponivel / natural);
}

/** Preenche os lugares marcados com data-modelo (chamado depois de desenhar a tela). */
export function preencherModelos(raiz = document) {
  raiz.querySelectorAll('[data-modelo]').forEach(async (el) => {
    try {
      if (!el.dataset.pronto) { el.innerHTML = await htmlDoModelo(el.dataset.modelo); el.dataset.pronto = '1'; }
      requestAnimationFrame(() => encaixar(el));
    } catch (e) {
      console.warn('Não deu para mostrar o modelo', e);
      el.innerHTML = '<p class="dica" style="margin:0">Não deu para mostrar o cabeçalho aqui, mas ele vai no Word.</p>';
    }
  });
}
