// DONO: Pessoa 3 (Categorias e relatórios). Veja DIVISAO.md, seção 5 (RF7, RF8 e RF9).
// Montada em /api/relatorios, já protegida pelo autenticar.
//   GET /categorias   GET /fontes-destinos   GET /faturas

const express = require('express');
const router = express.Router();

const connection = require('../config/connection');
const { ErroApi, emCentavos, emReais, hojeISO, mesCorrente, periodoAnterior, validarPeriodo, calcularFatura } = require('../models/models.regras');
const { ehInteiro } = require('../middlewares/validar');

// Lê ?inicio=&fim= da URL. Sem nenhum dos dois, usa o mês corrente. Período inválido: 400.
function lerPeriodo(query) {
    const inicio = typeof query.inicio === 'string' ? query.inicio : undefined;
    const fim = typeof query.fim === 'string' ? query.fim : undefined;
    if (inicio === undefined && fim === undefined) {
        return mesCorrente();
    }
    validarPeriodo(inicio, fim);
    return { inicio, fim };
}

// Soma uma lista de valores em centavos (inteiros), para não errar nos centavos
function somar(lista, campo) {
    return emReais(lista.reduce((soma, item) => soma + emCentavos(item[campo]), 0));
}

// GET /api/relatorios/categorias?inicio=&fim=
// Saídas por categoria (com percentual e comparação com o período anterior) e entradas por categoria.
router.get('/categorias', async (req, res) => {
    const periodo = lerPeriodo(req.query);
    const comparado = periodoAnterior(periodo.inicio, periodo.fim);

    // Quem soma é o banco (SUM + GROUP BY). O FILTER separa o período atual do anterior numa consulta só.
    // $1 = usuário, $2/$3 = período atual, $4/$5 = período anterior, $6 = tipo da categoria.
    const sql = `
        SELECT c.id,
               c.nome,
               COALESCE(SUM(l.valor) FILTER (WHERE l.data BETWEEN $2::date AND $3::date), 0) AS total,
               COALESCE(SUM(l.valor) FILTER (WHERE l.data BETWEEN $4::date AND $5::date), 0) AS "periodoAnterior"
          FROM categorias c
          LEFT JOIN lancamentos l
                 ON l.categoria_id = c.id
                AND l.usuario_id = c.usuario_id
                AND l.data BETWEEN $4::date AND $3::date
         WHERE c.usuario_id = $1
           AND c.tipo = $6
         GROUP BY c.id, c.nome
        HAVING SUM(l.valor) > 0
         ORDER BY total DESC, c.nome`;
    const base = [req.usuarioId, periodo.inicio, periodo.fim, comparado.inicio, comparado.fim];

    const saidas = (await connection.query(sql, [...base, 'saida'])).rows;
    const entradas = (await connection.query(sql, [...base, 'entrada'])).rows;

    const totalSaidas = somar(saidas, 'total');
    const totalSaidasAnterior = somar(saidas, 'periodoAnterior');

    res.json({
        periodo,
        periodoComparado: comparado,
        totalSaidas,
        totalSaidasAnterior,
        categorias: saidas.map((c) => ({
            id: c.id,
            nome: c.nome,
            total: c.total,
            // % do total de saídas, com 1 casa decimal (0 se não houve saída nenhuma)
            percentual: totalSaidas > 0 ? Math.round((emCentavos(c.total) / emCentavos(totalSaidas)) * 1000) / 10 : 0,
            periodoAnterior: c.periodoAnterior,
        })),
        totalEntradas: somar(entradas, 'total'),
        entradas: entradas.map((c) => ({ id: c.id, nome: c.nome, total: c.total })),
    });
});

// GET /api/relatorios/fontes-destinos?inicio=&fim=
// Entradas e saídas de cada fonte/destino no período. Saldo só para tipo 'conta'.
router.get('/fontes-destinos', async (req, res) => {
    const periodo = lerPeriodo(req.query);

    // LEFT JOIN: fonte sem movimento no período continua na lista, com 0 (o COALESCE troca NULL por 0).
    // O período vai dentro do ON (e não no WHERE) justamente para a fonte sem lançamento não sumir.
    const sql = `
        SELECT f.id,
               f.nome,
               f.tipo,
               COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
               COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0)   AS saidas
          FROM fontes_destinos f
          LEFT JOIN lancamentos l
                 ON l.fonte_destino_id = f.id
                AND l.usuario_id = f.usuario_id
                AND l.data BETWEEN $2::date AND $3::date
         WHERE f.usuario_id = $1
         GROUP BY f.id, f.nome, f.tipo
         ORDER BY f.nome`;
    const { rows } = await connection.query(sql, [req.usuarioId, periodo.inicio, periodo.fim]);

    res.json({
        periodo,
        totalEntradas: somar(rows, 'entradas'),
        totalSaidas: somar(rows, 'saidas'),
        fontes: rows.map((f) => ({
            id: f.id,
            nome: f.nome,
            tipo: f.tipo,
            entradas: f.entradas,
            saidas: f.saidas,
            // Só conta corrente tem saldo (renda e cartão não "guardam" dinheiro)
            saldo: f.tipo === 'conta' ? emReais(emCentavos(f.entradas) - emCentavos(f.saidas)) : null,
        })),
    });
});

// GET /api/relatorios/faturas?meses=3
// Um item por cartão: fatura fechada (se ainda não venceu), a aberta e as próximas `meses`.
router.get('/faturas', async (req, res) => {
    // ?meses= é opcional (padrão 3); aceita de 1 a 12
    let meses = 3;
    if (req.query.meses !== undefined) {
        if (!ehInteiro(req.query.meses, 1, 12)) {
            throw new ErroApi(400, 'Dados inválidos.', { meses: 'Informe um número de 1 a 12.' });
        }
        meses = Number(req.query.meses);
    }
    const hoje = hojeISO();

    const sqlCartoes = `
        SELECT id, nome,
               dia_fechamento AS "diaFechamento", dia_vencimento AS "diaVencimento", limite
          FROM fontes_destinos
         WHERE usuario_id = $1 AND tipo = 'cartao_credito'
         ORDER BY nome`;
    const cartoes = (await connection.query(sqlCartoes, [req.usuarioId])).rows;

    // Todas as compras (saídas) nos cartões do usuário. Cada parcela é um lançamento com a data da compra.
    const sqlCompras = `
        SELECT id, descricao, valor, data,
               fonte_destino_id AS "cartaoId",
               parcela_atual AS "parcelaAtual", total_parcelas AS "totalParcelas"
          FROM lancamentos
         WHERE usuario_id = $1
           AND tipo = 'saida'
           AND fonte_destino_id = ANY($2::int[])
         ORDER BY data, id`;
    const compras = cartoes.length
        ? (await connection.query(sqlCompras, [req.usuarioId, cartoes.map((c) => c.id)])).rows
        : [];

    const resultado = cartoes.map((cartao) => {
        // Em qual fatura cai cada parcela deste cartão (regra de fechamento: calcularFatura)
        const doCartao = compras
            .filter((c) => c.cartaoId === cartao.id)
            .map((c) => ({ ...c, fatura: calcularFatura(c.data, cartao, c.parcelaAtual) }));

        // Faturas que vamos mostrar. A parcela k de uma compra feita hoje cai k-1 meses depois, então
        // calcularFatura(hoje, cartao, k) dá a fatura de cada mês: 1 = aberta, 2.. = futuras, 0 = anterior.
        const aberta = calcularFatura(hoje, cartao, 1);
        const anterior = calcularFatura(hoje, cartao, 0);
        const lista = [];
        if (anterior.vencimento >= hoje) {          // já fechou, mas ainda não venceu
            lista.push({ ...anterior, situacao: 'fechada' });
        }
        lista.push({ ...aberta, situacao: 'aberta' });
        for (let k = 2; k <= meses + 1; k++) {
            lista.push({ ...calcularFatura(hoje, cartao, k), situacao: 'futura' });
        }

        const faturas = lista.map((f) => {
            const itens = doCartao.filter((c) => c.fatura.referencia === f.referencia);
            return {
                referencia: f.referencia,
                fechamento: f.fechamento,
                vencimento: f.vencimento,
                situacao: f.situacao,
                total: somar(itens, 'valor'),
                lancamentos: itens.map((c) => ({
                    id: c.id,
                    descricao: c.descricao,
                    valor: c.valor,
                    data: c.data,
                    parcela: `${c.parcelaAtual}/${c.totalParcelas}`,
                })),
            };
        });

        // Limite usado = todas as parcelas cuja fatura ainda não venceu (inclusive as de meses mais distantes)
        const pendentes = doCartao.filter((c) => c.fatura.vencimento >= hoje);
        const limiteUtilizado = somar(pendentes, 'valor');

        return {
            id: cartao.id,
            nome: cartao.nome,
            diaFechamento: cartao.diaFechamento,
            diaVencimento: cartao.diaVencimento,
            limite: cartao.limite,
            limiteUtilizado,
            limiteDisponivel: emReais(emCentavos(cartao.limite) - emCentavos(limiteUtilizado)),
            faturas,
        };
    });

    res.json(resultado);
});

module.exports = router;