// Teste das regras puras (sem banco, sem framework):  npm test
// Serve de especificação: cada bloco indica a pessoa dona da função e falha até ela ficar pronta.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cpfValido, dividirParcelas, calcularFatura, periodoAnterior, mesCorrente, dataValida, validarPeriodo, ErroApi } = require('./models.regras');

test('cpfValido (Pessoa 1)', () => {
    assert.equal(cpfValido('529.982.247-25'), true);
    assert.equal(cpfValido('52998224725'), true);
    assert.equal(cpfValido('529.982.247-24'), false);    // dígito verificador errado
    assert.equal(cpfValido('111.111.111-11'), false);    // todos iguais
});

test('datas e períodos (Pessoa 1)', () => {
    assert.deepEqual(mesCorrente('2026-02-15'), { inicio: '2026-02-01', fim: '2026-02-28' });

    // mês inteiro compara com o mês inteiro anterior
    assert.deepEqual(periodoAnterior('2026-11-01', '2026-11-30'), { inicio: '2026-10-01', fim: '2026-10-31' });
    assert.deepEqual(periodoAnterior('2026-01-01', '2026-01-31'), { inicio: '2025-12-01', fim: '2025-12-31' });
    // outro intervalo compara com a janela de mesma duração logo antes
    assert.deepEqual(periodoAnterior('2026-11-10', '2026-11-19'), { inicio: '2026-10-31', fim: '2026-11-09' });

    assert.equal(dataValida('2026-02-28'), true);
    assert.equal(dataValida('2026-02-31'), false);
    assert.equal(dataValida('28/02/2026'), false);

    assert.throws(() => validarPeriodo('2026-11-30', '2026-11-01'), (e) => e instanceof ErroApi && e.status === 400);
});

test('dividirParcelas (Pessoa 2): a soma sempre fecha e a sobra vai para a primeira', () => {
    assert.deepEqual(dividirParcelas(100, 3), [33.34, 33.33, 33.33]);
    for (const [valor, n] of [[100, 3], [0.1, 3], [99.99, 7], [1000, 48], [50, 1]]) {
        const soma = dividirParcelas(valor, n).reduce((s, p) => s + Math.round(p * 100), 0);
        assert.equal(soma, Math.round(valor * 100));
    }
});

test('calcularFatura (Pessoa 3): tabela 10.3 do enunciado', () => {
    const nubank = { diaFechamento: 3, diaVencimento: 10 };
    const visa = { diaFechamento: 25, diaVencimento: 5 };
    assert.deepEqual(calcularFatura('2026-11-02', nubank), { referencia: '2026-11', fechamento: '2026-11-03', vencimento: '2026-11-10' });
    assert.deepEqual(calcularFatura('2026-11-03', nubank), { referencia: '2026-12', fechamento: '2026-12-03', vencimento: '2026-12-10' });
    assert.deepEqual(calcularFatura('2026-12-28', visa), { referencia: '2027-02', fechamento: '2027-01-25', vencimento: '2027-02-05' });
    assert.deepEqual(calcularFatura('2026-12-20', visa, 3), { referencia: '2027-03', fechamento: '2027-02-25', vencimento: '2027-03-05' });
});

test('calcularFatura (Pessoa 3): fechamento no dia 31 em mês curto', () => {
    const dia31 = { diaFechamento: 31, diaVencimento: 10 };
    assert.deepEqual(calcularFatura('2027-02-10', dia31), { referencia: '2027-03', fechamento: '2027-02-28', vencimento: '2027-03-10' });
    // compra no dia do fechamento vai para a fatura seguinte
    assert.deepEqual(calcularFatura('2027-02-28', dia31), { referencia: '2027-04', fechamento: '2027-03-31', vencimento: '2027-04-10' });
});
