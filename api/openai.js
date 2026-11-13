// =========================================================
// Servidor intermediário (Vercel Function)
// Guarda a chave da OpenAI NO SERVIDOR (variável OPENAI_API_KEY).
// O app publicado chama /api/openai?p=... e nunca vê a chave.
//
// Proteções:
// - só repassa os caminhos que o app usa;
// - o modelo é sempre o definido aqui (ninguém usa sua chave com outro modelo);
// - imagens: 1 por pedido, tamanho e qualidade travados;
// - limita o tamanho do pedido.
// =========================================================
const MODELO_TEXTO = process.env.OPENAI_MODEL || 'gpt-6.1-sol';
const MODELO_IMAGEM = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
const CAMINHOS = {
  'v1/chat/completions': (c) => ({ ...c, model: MODELO_TEXTO }),
  'v1/responses': (c) => ({ ...c, model: MODELO_TEXTO }),
  'v1/images/generations': (c) => ({
    model: MODELO_IMAGEM,
    prompt: String(c.prompt || '').slice(0, 4000),
    size: '1024x1024',
    quality: c.quality === 'medium' ? 'medium' : 'low',
    output_format: 'jpeg',
    n: 1,
  }),
};
const LIMITE_BYTES = 3_000_000; // conferência de figura envia a imagem junto

export default async function handler(req, res) {
  const caminho = String(req.query?.p || '');
  const ajustar = CAMINHOS[caminho];
  if (!ajustar) return res.status(404).json({ error: { message: 'Caminho não permitido.' } });
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Use POST.' } });

  const chave = process.env.OPENAI_API_KEY;
  if (!chave) return res.status(500).json({ error: { message: 'O servidor ainda não tem a chave configurada.' } });

  let corpo;
  try {
    corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: { message: 'Pedido inválido.' } });
  }
  const texto = JSON.stringify(ajustar(corpo));
  if (texto.length > LIMITE_BYTES) return res.status(413).json({ error: { message: 'Pedido grande demais.' } });

  try {
    const r = await fetch(`https://api.openai.com/${caminho}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: texto,
    });
    res.status(r.status).setHeader('Content-Type', 'application/json').send(await r.text());
  } catch {
    res.status(502).json({ error: { message: 'Não foi possível falar com a OpenAI agora.' } });
  }
}
