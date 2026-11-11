// Regras de negócio puras (nada aqui acessa o banco). Teste: npm test
// As funções com TODO têm dono e o teste delas falha até ficarem prontas. O resto já vem pronto.

// Erro com status HTTP. O middleware de erros responde { erro: mensagem, campos }.
class ErroApi extends Error {
    constructor(status, mensagem, campos) {
        super(mensagem);
        this.status = status;
        this.campos = campos;
    }
}

// ---------- Dinheiro ----------
// Contas sempre em centavos (inteiros): 0.1 + 0.2 !== 0.3 em JavaScript.
const emCentavos = (valor) => Math.round(Number(valor) * 100);
const emReais = (centavos) => centavos / 100;

// ---------- Datas (sempre UTC, formato 'AAAA-MM-DD') ----------
// Peças prontas para as funções abaixo.
const UM_DIA = 86400000;
const iso = (data) => data.toISOString().slice(0, 10);
const paraData = (texto) => new Date(`${texto}T00:00:00Z`);

// Hoje no fuso de Brasília. toISOString() usa UTC e viraria o dia às 21h.
const hojeISO = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

function ultimoDiaDoMes(ano, mes) {                      // mes: 0 a 11
    return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
}

function dataSegura(ano, mes, dia) {                     // aceita mes > 11 e ajusta dia 31 em meses curtos
    const a = ano + Math.floor(mes / 12);
    const m = ((mes % 12) + 12) % 12;
    return new Date(Date.UTC(a, m, Math.min(dia, ultimoDiaDoMes(a, m))));
}

// ---------- TODO Pessoa 1 ----------

// Os 2 dígitos verificadores batem. Aceita com ou sem pontuação; rejeita tamanho diferente de 11
// e todos os dígitos iguais (111.111.111-11). Enunciado 10.5.1.
function cpfValido(cpf) {

    cpf = String(cpf).replace(/\D/g, '');  // só números
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) {
        return false;
    }

    const calcDigito = (pos) => {
        let soma = 0;
        for (let i = 0; i < pos - 1; i++) {
            soma += parseInt(cpf.charAt(i)) * (pos - i);
        }
        const resto = soma % 11;
        return resto < 2 ? 0 : 11 - resto;
    };

    const digito1 = calcDigito(10);
    const digito2 = calcDigito(11);


    return digito1 === Number(cpf[9]) && digito2 === Number(cpf[10]);
}

// true só para 'AAAA-MM-DD' que é uma data real ('2026-02-31' e '28/02/2026' são false).
function dataValida(texto) {
    throw new Error('TODO (Pessoa 1): dataValida');
}

// { inicio, fim } do mês de `hoje`: o período padrão da listagem e dos relatórios.
function mesCorrente(hoje = hojeISO()) {
    throw new Error('TODO (Pessoa 1): mesCorrente');
}

// Período anterior de mesmo tamanho. Mês inteiro (novembro) compara com o mês inteiro anterior (outubro);
// qualquer outro intervalo compara com a janela de mesma duração logo antes.
function periodoAnterior(inicio, fim) {
    throw new Error('TODO (Pessoa 1): periodoAnterior');
}

// Lança ErroApi(400, 'Dados inválidos.', { inicio: ..., fim: ... }) se uma data for inválida ou inicio > fim.
function validarPeriodo(inicio, fim) {
    throw new Error('TODO (Pessoa 1): validarPeriodo');
}

// ---------- TODO Pessoa 2 ----------

// n valores (em reais) que somam exatamente `valor`. A sobra de centavos vai para a primeira parcela:
// dividirParcelas(100, 3) => [33.34, 33.33, 33.33]
function dividirParcelas(valor, n) {
    throw new Error('TODO (Pessoa 2): dividirParcelas');
}

// ---------- TODO Pessoa 3 ----------

// dataCompra: 'AAAA-MM-DD'; cartao: { diaFechamento, diaVencimento }; numeroParcela: 1 para a primeira.
// Devolve { referencia: 'AAAA-MM' (mês do vencimento), fechamento, vencimento }. Regra no enunciado 10.5.9:
// compra antes do dia de fechamento entra na fatura deste mês; no dia ou depois, na do mês seguinte;
// a parcela k cai k-1 meses depois; dia inexistente (31 em fevereiro) vira o último dia do mês.
function calcularFatura(dataCompra, cartao, numeroParcela = 1) {
    throw new Error('TODO (Pessoa 3): calcularFatura');
}

module.exports = {
    ErroApi, cpfValido, emCentavos, emReais, dividirParcelas,
    hojeISO, dataValida, mesCorrente, periodoAnterior, validarPeriodo, calcularFatura,
};
