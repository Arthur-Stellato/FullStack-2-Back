// DONO: Pessoa 3 (Categorias e relatórios). Veja DIVISAO.md, seção 5 (RF7, RF8 e RF9).
// Montada em /api/relatorios, já protegida pelo autenticar.
//   GET /categorias   GET /fontes-destinos   GET /faturas

const express = require('express');
const router = express.Router();

const connection = require('../config/connection');
const { emCentavos, emReais, mesCorrente, periodoAnterior, validarPeriodo } = require('../models/models.regras');

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

// TODO: GET /fontes-destinos (RF8)
// TODO: GET /faturas (RF9)

module.exports = router;
