// Testes do validador (rode com: npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarQuestao, validarProva } from '../src/validador.js';
import { embaralharAlternativas, adaptarSemIA } from '../src/montador.js';
import { QUESTOES_EXEMPLO } from '../src/banco-exemplo.js';

const base = { materia: 'Matemática', serie: '5º ano', tipo: 'multipla', enunciado: 'Quanto é 2 + 2 na conta de somar?', alternativas: ['3', '4', '5', '6'], correta: 1, resposta: '4' };
const erros = (q) => validarQuestao(q).filter((p) => p.nivel === 'erro').map((p) => p.msg);
const avisos = (q) => validarQuestao(q).filter((p) => p.nivel === 'aviso').map((p) => p.msg);

test('questão boa passa sem erros', () => assert.deepEqual(erros(base), []));
test('gabarito fora das alternativas', () => assert.ok(erros({ ...base, correta: 7 }).length));
test('gabarito que não confere', () => assert.match(erros({ ...base, resposta: '5' }).join(), /não confere/));
test('alternativas repetidas', () => assert.match(erros({ ...base, alternativas: ['4', '4', '5', '6'] }).join(), /repetidas/));
test('todas as anteriores', () => assert.match(avisos({ ...base, alternativas: ['3', '4', '5', 'Todas as anteriores'] }).join(), /anteriores/));
test('alternativa certa muito longa', () => assert.match(avisos({ ...base, alternativas: ['Sim', 'É o resultado correto da soma de dois mais dois', 'Não', 'Talvez'], resposta: 'É o resultado correto da soma de dois mais dois' }).join(), /longa/));
test('V/F com gabarito incompleto', () => assert.ok(erros({ ...base, tipo: 'vf', alternativas: ['a é a', 'b é b', 'c é c'], correta: -1, resposta: 'V, F' }).length));
test('completar sem lacuna', () => assert.ok(erros({ ...base, tipo: 'completar', alternativas: [], correta: -1 }).length));
test('texto de máquina', () => assert.ok(erros({ ...base, enunciado: 'Como modelo de linguagem, responda quanto é 2+2' }).length));
test('adaptada mais longa que a original', () => assert.match(avisos({ ...base, adaptada: { enunciado: base.enunciado + ' ' + 'palavra '.repeat(20), alternativas: ['4', '3', '5'], correta: 0, dica: '' } }).join(), /mais longa/));

test('embaralhar mantém a resposta certa', () => {
  for (let k = 0; k < 50; k++) {
    const q = embaralharAlternativas(structuredClone({ ...base, adaptada: adaptarSemIA(base) }));
    assert.equal(q.alternativas[q.correta], '4');
    assert.equal(q.adaptada.alternativas[q.adaptada.correta], '4');
  }
});
test('adaptação sem IA deixa 3 alternativas com a certa', () => {
  const ad = adaptarSemIA(base);
  assert.equal(ad.alternativas.length, 3);
  assert.equal(ad.alternativas[ad.correta], '4');
});
test('prova com respostas concentradas numa letra', () => {
  assert.ok(validarProva([base, { ...base, enunciado: 'Quanto vale 3+1 somando?' }, { ...base, enunciado: 'Quanto dá 1+3 em soma?' }, { ...base, enunciado: 'Resultado de 0+4 no total?' }]).length);
});
test('banco de exemplo não tem erros', () => {
  for (const q of QUESTOES_EXEMPLO) assert.deepEqual(erros(q), [], q.enunciado);
});

test('questão que cita figura sem imagem é erro', () => {
  assert.match(erros({ ...base, enunciado: 'Observe a figura e responda: quanto é 2 + 2?' }).join(), /figura/);
  assert.match(erros({ ...base, enunciado: 'O gráfico abaixo mostra as vendas. Quanto é 2 + 2?' }).join(), /figura/);
});
test('questão com imagem não acusa falta de figura', () => {
  assert.doesNotMatch(erros({ ...base, enunciado: 'Observe a figura e responda: quanto é 2 + 2?', imagem: { id: 'x' } }).join(), /figura/);
});
