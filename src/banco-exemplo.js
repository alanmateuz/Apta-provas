// =========================================================
// Questões de EXEMPLO que acompanham o app.
// Servem para o app funcionar sem internet desde o primeiro dia.
// Ficam marcadas como "exemplo": a professora deve conferir antes
// de usar e pode marcar como "revisada". O ideal é substituir/ampliar
// com questões próprias ou pacotes importados (Banco → Importar).
//
// Formato de cada questão:
//   tipo: 'multipla' | 'vf' | 'aberta' | 'completar'
//   alternativas: opções (múltipla) ou afirmações (V/F)
//   correta: índice da alternativa certa (só múltipla; senão -1)
//   resposta: gabarito em texto (V/F: "V, F, V"; aberta: resposta esperada)
//   adaptada: versão para alunos neurodivergentes (opcional)
// =========================================================

export const QUESTOES_EXEMPLO = [
  // ---------------- MATEMÁTICA ----------------
  {
    materia: 'Matemática', serie: '3º ano', tema: 'adição e subtração', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'Ana tinha 25 figurinhas e ganhou mais 14 da sua prima. Com quantas figurinhas Ana ficou?',
    alternativas: ['29', '39', '41', '11'], correta: 1, resposta: '39',
    justificativa: '25 + 14 = 39.',
    adaptada: {
      enunciado: 'Ana tinha **25** figurinhas. Ela **ganhou** mais **14**. Quantas figurinhas Ana tem **agora**?',
      alternativas: ['39', '29', '11'], correta: 0,
      dica: 'Ganhar é juntar. Faça a conta de mais: 25 + 14.',
    },
  },
  {
    materia: 'Matemática', serie: '3º ano', tema: 'adição e subtração', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Uma escola tinha 132 livros na biblioteca. Foram emprestados 47 livros. Quantos livros ficaram na biblioteca?',
    alternativas: ['85', '95', '179', '75'], correta: 0, resposta: '85',
    justificativa: '132 − 47 = 85.',
  },
  {
    materia: 'Matemática', serie: '4º ano', tema: 'multiplicação', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'Em uma caixa cabem 6 ovos. Quantos ovos há em 4 caixas cheias?',
    alternativas: ['10', '18', '24', '28'], correta: 2, resposta: '24',
    justificativa: '4 × 6 = 24.',
    adaptada: {
      enunciado: 'Cada caixa tem **6 ovos**. Temos **4 caixas**. Quantos ovos temos **ao todo**?',
      alternativas: ['10', '24', '18'], correta: 1,
      dica: 'Você pode somar: 6 + 6 + 6 + 6.',
    },
  },
  {
    materia: 'Matemática', serie: '4º ano', tema: 'divisão', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'A professora vai dividir 36 lápis igualmente entre 4 grupos. Quantos lápis cada grupo vai receber?',
    alternativas: ['8', '9', '12', '32'], correta: 1, resposta: '9',
    justificativa: '36 ÷ 4 = 9.',
  },
  {
    materia: 'Matemática', serie: '5º ano', tema: 'frações', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'Uma pizza foi cortada em 8 pedaços iguais. João comeu 3 pedaços. Que fração da pizza João comeu?',
    alternativas: ['3/5', '5/8', '3/8', '8/3'], correta: 2, resposta: '3/8',
    justificativa: 'São 3 partes de um total de 8 partes iguais: 3/8.',
    adaptada: {
      enunciado: 'A pizza tem **8 pedaços**. João comeu **3 pedaços**. Qual fração mostra o que João comeu?',
      alternativas: ['3/8', '8/3', '5/8'], correta: 0,
      dica: 'Em cima vai o que ele comeu. Embaixo vai o total de pedaços.',
    },
  },
  {
    materia: 'Matemática', serie: '5º ano', tema: 'frações', dificuldade: 'medio', tipo: 'vf',
    enunciado: 'Marque V para verdadeiro e F para falso.',
    alternativas: ['1/2 é maior que 1/4.', '2/4 é igual a 1/2.', '1/3 é maior que 1/2.'],
    correta: -1, resposta: 'V, V, F',
    justificativa: '1/2 = 0,5; 1/4 = 0,25; 2/4 = 1/2; 1/3 ≈ 0,33 é menor que 1/2.',
  },
  {
    materia: 'Matemática', serie: '5º ano', tema: 'números decimais e dinheiro', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Pedro comprou um caderno de R$ 12,50 e pagou com uma nota de R$ 20,00. Quanto ele recebeu de troco?',
    alternativas: ['R$ 7,50', 'R$ 8,50', 'R$ 32,50', 'R$ 8,00'], correta: 0, resposta: 'R$ 7,50',
    justificativa: '20,00 − 12,50 = 7,50.',
  },
  {
    materia: 'Matemática', serie: '6º ano', tema: 'perímetro e área', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Um terreno retangular mede 10 metros de comprimento e 6 metros de largura. Qual é a área desse terreno?',
    alternativas: ['16 m²', '32 m²', '60 m²', '600 m²'], correta: 2, resposta: '60 m²',
    justificativa: 'Área do retângulo = comprimento × largura = 10 × 6 = 60 m².',
  },
  {
    materia: 'Matemática', serie: '6º ano', tema: 'perímetro e área', dificuldade: 'facil', tipo: 'aberta',
    enunciado: 'Um quadrado tem 5 cm de lado. Qual é o perímetro desse quadrado? Mostre como você calculou.',
    alternativas: [], correta: -1, resposta: '20 cm (5 + 5 + 5 + 5 ou 4 × 5).',
    justificativa: 'Perímetro é a soma dos lados: 4 lados de 5 cm.',
  },
  {
    materia: 'Matemática', serie: '7º ano', tema: 'números inteiros', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Pela manhã a temperatura era de −3 °C. À tarde, subiu 8 °C. Qual era a temperatura à tarde?',
    alternativas: ['−11 °C', '5 °C', '11 °C', '−5 °C'], correta: 1, resposta: '5 °C',
    justificativa: '−3 + 8 = 5.',
  },
  {
    materia: 'Matemática', serie: '7º ano', tema: 'porcentagem', dificuldade: 'dificil', tipo: 'multipla',
    enunciado: 'Uma camiseta custava R$ 80,00 e teve um desconto de 25%. Qual é o novo preço da camiseta?',
    alternativas: ['R$ 20,00', 'R$ 55,00', 'R$ 60,00', 'R$ 65,00'], correta: 2, resposta: 'R$ 60,00',
    justificativa: '25% de 80 = 20; 80 − 20 = 60.',
  },

  // ---------------- PORTUGUÊS ----------------
  {
    materia: 'Português', serie: '3º ano', tema: 'substantivos', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'Na frase "O cachorro correu pelo jardim", qual palavra é um substantivo?',
    alternativas: ['correu', 'cachorro', 'pelo', 'o'], correta: 1, resposta: 'cachorro',
    justificativa: 'Substantivo dá nome a seres e coisas: "cachorro" (e também "jardim").',
  },
  {
    materia: 'Português', serie: '3º ano', tema: 'ortografia', dificuldade: 'facil', tipo: 'completar',
    enunciado: 'Complete as palavras com R ou RR: ca__o, ba__ata, gi__afa.',
    alternativas: [], correta: -1, resposta: 'carro, barata, girafa',
    justificativa: 'RR aparece entre vogais com som forte (carro); R entre vogais tem som fraco (barata, girafa).',
  },
  {
    materia: 'Português', serie: '4º ano', tema: 'adjetivos', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'Qual palavra é um adjetivo na frase "A menina comprou uma bola colorida"?',
    alternativas: ['menina', 'comprou', 'bola', 'colorida'], correta: 3, resposta: 'colorida',
    justificativa: 'Adjetivo indica característica do substantivo: "colorida" caracteriza "bola".',
  },
  {
    materia: 'Português', serie: '4º ano', tema: 'sinônimos e antônimos', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'Qual é o antônimo (o contrário) da palavra "alegre"?',
    alternativas: ['contente', 'triste', 'feliz', 'animado'], correta: 1, resposta: 'triste',
    justificativa: 'Antônimo é a palavra de sentido contrário. As outras são sinônimos de "alegre".',
  },
  {
    materia: 'Português', serie: '5º ano', tema: 'interpretação de texto', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Leia: "Lucas acordou atrasado, pegou a mochila correndo e esqueceu o lanche em cima da mesa." Por que Lucas esqueceu o lanche?',
    alternativas: ['Porque não gostava do lanche.', 'Porque estava com pressa.', 'Porque a mochila estava cheia.', 'Porque a mãe guardou o lanche.'],
    correta: 1, resposta: 'Porque estava com pressa.',
    justificativa: 'O texto diz que ele acordou atrasado e pegou a mochila correndo.',
  },
  {
    materia: 'Português', serie: '5º ano', tema: 'pontuação', dificuldade: 'medio', tipo: 'aberta',
    enunciado: 'Reescreva a frase usando a pontuação correta: "que dia lindo vamos à praia"',
    alternativas: [], correta: -1, resposta: 'Que dia lindo! Vamos à praia? (ou: Vamos à praia!)',
    justificativa: 'Exclamação para expressar emoção; letra maiúscula no início das frases.',
  },
  {
    materia: 'Português', serie: '6º ano', tema: 'verbos', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Em "Amanhã nós viajaremos para a casa da vovó", o verbo está em qual tempo?',
    alternativas: ['Presente', 'Pretérito perfeito', 'Futuro do presente', 'Pretérito imperfeito'],
    correta: 2, resposta: 'Futuro do presente',
    justificativa: '"Viajaremos" indica uma ação que ainda vai acontecer.',
  },
  {
    materia: 'Português', serie: '7º ano', tema: 'gêneros textuais', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Um texto que ensina a preparar um bolo, com lista de ingredientes e modo de fazer, pertence a qual gênero textual?',
    alternativas: ['Notícia', 'Receita', 'Poema', 'Carta'], correta: 1, resposta: 'Receita',
    justificativa: 'A receita é um texto instrucional com ingredientes e passos.',
  },

  // ---------------- CIÊNCIAS ----------------
  {
    materia: 'Ciências', serie: '3º ano', tema: 'animais', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'Qual destes animais é um mamífero?',
    alternativas: ['Galinha', 'Sapo', 'Cachorro', 'Peixe'], correta: 2, resposta: 'Cachorro',
    justificativa: 'Mamíferos têm pelos e as fêmeas amamentam os filhotes.',
  },
  {
    materia: 'Ciências', serie: '4º ano', tema: 'cadeia alimentar', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Na cadeia alimentar "capim → gafanhoto → sapo → cobra", quem é o produtor?',
    alternativas: ['Capim', 'Gafanhoto', 'Sapo', 'Cobra'], correta: 0, resposta: 'Capim',
    justificativa: 'Produtores fazem o próprio alimento pela fotossíntese: as plantas.',
    adaptada: {
      enunciado: 'Veja a cadeia: **capim → gafanhoto → sapo → cobra**. Quem **faz o próprio alimento**?',
      alternativas: ['Capim', 'Sapo', 'Cobra'], correta: 0,
      dica: 'As plantas fazem o próprio alimento com a luz do sol.',
    },
  },
  {
    materia: 'Ciências', serie: '5º ano', tema: 'ciclo da água', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'No ciclo da água, como se chama a passagem da água do estado líquido para o estado gasoso?',
    alternativas: ['Condensação', 'Evaporação', 'Solidificação', 'Precipitação'], correta: 1, resposta: 'Evaporação',
    justificativa: 'Evaporação: líquido → vapor. Condensação é o caminho inverso.',
  },
  {
    materia: 'Ciências', serie: '5º ano', tema: 'corpo humano', dificuldade: 'facil', tipo: 'vf',
    enunciado: 'Marque V para verdadeiro e F para falso.',
    alternativas: ['O coração bombeia o sangue pelo corpo.', 'Os pulmões fazem a digestão dos alimentos.', 'O esqueleto ajuda a sustentar o corpo.'],
    correta: -1, resposta: 'V, F, V',
    justificativa: 'Os pulmões fazem as trocas gasosas (respiração); a digestão ocorre no sistema digestório.',
  },
  {
    materia: 'Ciências', serie: '6º ano', tema: 'sistema solar', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Qual é o planeta mais próximo do Sol?',
    alternativas: ['Vênus', 'Terra', 'Mercúrio', 'Marte'], correta: 2, resposta: 'Mercúrio',
    justificativa: 'A ordem a partir do Sol é Mercúrio, Vênus, Terra, Marte...',
  },
  {
    materia: 'Ciências', serie: '7º ano', tema: 'ecossistemas', dificuldade: 'dificil', tipo: 'aberta',
    enunciado: 'Explique o que pode acontecer com uma cadeia alimentar se os predadores de uma espécie forem caçados até desaparecerem.',
    alternativas: [], correta: -1,
    resposta: 'A população das presas tende a crescer demais, consumindo mais alimento (plantas), o que desequilibra o ecossistema.',
    justificativa: 'Os predadores controlam o tamanho das populações das presas.',
  },

  // ---------------- HISTÓRIA ----------------
  {
    materia: 'História', serie: '4º ano', tema: 'povos indígenas', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'Antes da chegada dos portugueses, em 1500, quem já vivia nas terras que hoje formam o Brasil?',
    alternativas: ['Ninguém', 'Povos indígenas', 'Espanhóis', 'Holandeses'], correta: 1, resposta: 'Povos indígenas',
    justificativa: 'Milhões de indígenas, de muitos povos diferentes, já viviam no território.',
  },
  {
    materia: 'História', serie: '5º ano', tema: 'independência do Brasil', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Em que ano foi proclamada a Independência do Brasil?',
    alternativas: ['1500', '1822', '1888', '1889'], correta: 1, resposta: '1822',
    justificativa: '7 de setembro de 1822. (1888: abolição; 1889: República.)',
  },
  {
    materia: 'História', serie: '5º ano', tema: 'abolição da escravatura', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Qual lei, assinada em 1888, aboliu a escravidão no Brasil?',
    alternativas: ['Lei do Ventre Livre', 'Lei Áurea', 'Lei dos Sexagenários', 'Lei Eusébio de Queirós'], correta: 1, resposta: 'Lei Áurea',
    justificativa: 'A Lei Áurea foi assinada em 13 de maio de 1888.',
  },
  {
    materia: 'História', serie: '6º ano', tema: 'Egito Antigo', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Qual rio foi fundamental para o desenvolvimento da civilização do Egito Antigo?',
    alternativas: ['Rio Amazonas', 'Rio Nilo', 'Rio Tigre', 'Rio São Francisco'], correta: 1, resposta: 'Rio Nilo',
    justificativa: 'As cheias do Nilo fertilizavam as terras para a agricultura.',
  },

  // ---------------- GEOGRAFIA ----------------
  {
    materia: 'Geografia', serie: '4º ano', tema: 'regiões do Brasil', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'Em quantas regiões o IBGE divide o Brasil?',
    alternativas: ['3', '4', '5', '7'], correta: 2, resposta: '5',
    justificativa: 'Norte, Nordeste, Centro-Oeste, Sudeste e Sul.',
  },
  {
    materia: 'Geografia', serie: '5º ano', tema: 'pontos cardeais', dificuldade: 'facil', tipo: 'multipla',
    enunciado: 'De que lado o Sol aparece no começo da manhã?',
    alternativas: ['Leste', 'Oeste', 'Norte', 'Sul'], correta: 0, resposta: 'Leste',
    justificativa: 'O Sol nasce aproximadamente no Leste e se põe no Oeste.',
  },
  {
    materia: 'Geografia', serie: '6º ano', tema: 'relevo e hidrografia', dificuldade: 'medio', tipo: 'vf',
    enunciado: 'Marque V para verdadeiro e F para falso.',
    alternativas: ['O Rio Amazonas fica na Região Norte do Brasil.', 'Planície é uma forma de relevo plana.', 'O Brasil não possui nenhuma bacia hidrográfica.'],
    correta: -1, resposta: 'V, V, F',
    justificativa: 'O Brasil tem várias bacias hidrográficas, como a Amazônica e a do São Francisco.',
  },
  {
    materia: 'Geografia', serie: '7º ano', tema: 'biomas brasileiros', dificuldade: 'medio', tipo: 'multipla',
    enunciado: 'Qual bioma brasileiro é típico do Nordeste e tem vegetação adaptada a longos períodos de seca?',
    alternativas: ['Pampa', 'Caatinga', 'Mata Atlântica', 'Pantanal'], correta: 1, resposta: 'Caatinga',
    justificativa: 'A Caatinga tem clima semiárido e plantas adaptadas à falta de água.',
  },
];
