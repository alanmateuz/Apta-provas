# Apta (antes Prova Izi)

> **Apta** é a evolução do MVP Prova Izi: mesma base funcional, com nova marca e interface redesenhada
> seguindo as **Human Interface Guidelines da Apple** (barra de abas flutuante em Liquid Glass, sheets,
> listas agrupadas, controle segmentado, tipografia SF Pro / SF Pro Rounded pela fonte do sistema).
> Pesquisa, marca, style guide e protótipo no Figma: pasta `../apta` (veja `apta/apple.md`).
> No ar: https://aptaprovas.vercel.app


App para professores montarem provas em minutos: cabeçalho da escola, **versão adaptada**
(TDAH, autismo, dislexia, deficiência intelectual), gabarito, impressão/PDF e Word.
Funciona **sem internet** (com o banco de questões). A IA entra só para completar.

## Rodando

```bash
npm install
cp .env.example .env.local   # coloque sua chave da OpenAI aqui
npm run dev                  # desenvolvimento: http://localhost:5173
npm test                     # testes do validador de questões
npm run build && npm run preview   # versão "de verdade", que funciona offline
```

Para instalar no computador/celular dela: abra a versão publicada no Chrome/Edge e clique em
**"Instalar app"** (ícone na barra de endereço). Depois disso abre sem internet.

## Como o projeto está organizado

| Arquivo | O que faz |
|---|---|
| `src/main.js` | Todas as telas (início, criar prova, editor, banco, escola, IA) |
| `src/montador.js` | **Banco primeiro**: escolhe questões do banco, cria a versão adaptada sem IA, embaralha alternativas |
| `src/validador.js` | **Camada antierro**: regras fixas que pegam os erros típicos de questões (e da IA) |
| `src/ia.js` | Chamadas à IA (OpenAI padrão, Claude opcional), prompts e a **IA revisora** |
| `src/word.js` | Gera o `.docx` editável (prova, adaptada e gabarito) |
| `src/store.js` | Salva tudo no aparelho (localStorage) |
| `src/banco-exemplo.js` | Questões de exemplo para funcionar offline desde o 1º dia |
| `test/validador.test.js` | Testes automáticos do validador |

## Como combatemos os erros da IA

1. **Banco primeiro.** A prova é montada com questões do banco (as da professora, as conferidas e as importadas têm prioridade). A IA só cria as que faltarem.
2. **Prompt com regras de elaboração de itens** (no padrão dos guias do INEP/Saeb): uma alternativa correta, distratores plausíveis, nada de "todas as anteriores", resolver cálculos passo a passo.
3. **Saída em JSON com esquema obrigatório.** Nada de texto solto para "adivinhar".
4. **Validador determinístico** (`validador.js`, funciona offline): gabarito inexistente ou que não confere, alternativas repetidas, V/F com gabarito incompleto, lacuna ausente, resposta escrita no enunciado, alternativa certa muito mais longa, pergunta negativa, adaptada que não ficou mais simples, questões repetidas na prova, respostas concentradas numa letra.
5. **IA revisora.** Uma segunda chamada resolve as questões **sem ver o gabarito**. Se discordar, a questão ganha ❗.
6. **Embaralhamento no código.** A IA tende a pôr a certa sempre na mesma letra.
7. **A professora tem a palavra final.** Questões da IA ficam "⚠ confira" até ela marcar **Conferida**. Só aí viram questões confiáveis no banco. Questões com erro grave nem entram no banco.

## ⚠️ Sobre a chave da OpenAI (importante)

No MVP a chave fica no `.env.local` e **vai junto no código do app** (é um app de navegador).
Qualquer pessoa com o app instalado consegue extraí-la. Por isso:

- use só nos aparelhos de quem você confia;
- **não publique o link aberto na internet**;
- coloque um **limite de gasto** na conta da OpenAI (Settings → Limits).

**Próximo passo (para abrir para mais professores):** um servidor intermediário (ex.: Cloudflare
Worker ou Vercel Function) que guarda a chave e repassa os pedidos, com login simples
(e-mail ou Google). Assim a chave nunca sai do servidor e você controla o uso por professora.

## Próximos passos sugeridos

- Servidor/proxy com login (ver acima).
- Pacotes de questões **revisadas por humanos** para importar (ex.: itens públicos do Saeb/OBMEP, bancos de redes municipais), em vez de depender da IA.
- Imagens nas questões (figuras, gráficos).
- Código da habilidade BNCC em cada questão (com conferência; a IA costuma errar códigos).
- Sincronizar o banco entre aparelhos.
