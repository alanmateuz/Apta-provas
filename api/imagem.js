// =========================================================
// Baixa a imagem ORIGINAL de uma questão achada na internet.
// (O navegador não consegue baixar direto de outros sites por segurança.)
//
// Proteções:
// - só http/https, só nomes de site (sem IP, sem localhost/rede interna);
// - segue no máximo 3 redirecionamentos, conferindo cada endereço;
// - só PNG, JPEG, GIF ou WEBP, até 5 MB.
// =========================================================
const TIPOS = /^image\/(png|jpe?g|gif|webp)$/i;
const MAX_BYTES = 5 * 1024 * 1024;

function enderecoPermitido(texto) {
  let u;
  try { u = new URL(texto); } catch { return null; }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
  if (/(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return null;
  return u;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Use GET.' });
  let alvo = enderecoPermitido(String(req.query?.url || ''));
  if (!alvo) return res.status(400).json({ error: 'Endereço não permitido.' });

  try {
    let r;
    for (let i = 0; i < 4; i++) {
      r = await fetch(alvo, { redirect: 'manual', headers: { 'User-Agent': 'ProvaIzi/1.0 (imagem de questao)' } });
      if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
        alvo = enderecoPermitido(new URL(r.headers.get('location'), alvo).toString());
        if (!alvo) return res.status(400).json({ error: 'Redirecionamento não permitido.' });
        continue;
      }
      break;
    }
    const tipo = (r.headers.get('content-type') || '').split(';')[0].trim();
    if (!r.ok || !TIPOS.test(tipo)) return res.status(415).json({ error: 'Não é uma imagem válida.' });
    if (Number(r.headers.get('content-length') || 0) > MAX_BYTES) return res.status(413).json({ error: 'Imagem grande demais.' });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'Imagem grande demais.' });
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.status(200).json({ src: `data:${tipo};base64,${buf.toString('base64')}` });
  } catch {
    return res.status(502).json({ error: 'Não foi possível baixar a imagem.' });
  }
}
