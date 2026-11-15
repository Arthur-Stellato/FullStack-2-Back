// DONO: Pessoa 2 (Fontes e lançamentos). Veja DIVISAO.md, seção 5 (RF6).
// Montada em /api/lancamentos, já protegida pelo autenticar.
//   GET / (filtros, paginação, totais)   POST / (com parcelas, em transação)
//   GET /:id   PUT /:id   DELETE /:id (?todasParcelas=true)

const { randomUUID } = require('node:crypto');
const express = require('express');
const router = express.Router();

const connection = require('../config/connection');
const { ErroApi, dataValida, dividirParcelas, emCentavos, emReais, mesCorrente, validarPeriodo } = require('../models/models.regras');
const { validar, validarId, ehDinheiro, ehInteiro } = require('../middlewares/validar');

// Se o :id da URL não for número, responde 404 antes de entrar na rota
router.param('id', validarId);

const ID_MAXIMO = 999999999;

// Item completo do contrato (com o nome da categoria e da fonte), já em camelCase
const SELECT_ITEM = `
    SELECT l.id, l.tipo, l.descricao, l.valor, l.data,
           l.categoria_id AS "categoriaId", c.nome AS "categoriaNome",
           l.fonte_destino_id AS "fonteDestinoId", f.nome AS "fonteDestinoNome",
           l.parcela_atual AS "parcelaAtual", l.total_parcelas AS "totalParcelas",
           l.grupo_parcelamento AS "grupoParcelamento"
      FROM lancamentos l
      JOIN categorias c ON c.id = l.categoria_id
      JOIN fontes_destinos f ON f.id = l.fonte_destino_id`;

// Um SQL só para todos os filtros: filtro não informado chega como NULL e a condição passa.
const FILTRO = `
     WHERE l.usuario_id = $1
       AND l.data BETWEEN $2::date AND $3::date
       AND ($4::text IS NULL OR l.tipo = $4)
       AND ($5::int IS NULL OR l.categoria_id = $5)
       AND ($6::int IS NULL OR l.fonte_destino_id = $6)`;

// Colunas devolvidas por INSERT/UPDATE; o nome da categoria e da fonte a gente já tem em mãos (montarItem)
const RETORNO = `id, tipo, descricao, valor, data,
        categoria_id AS "categoriaId", fonte_destino_id AS "fonteDestinoId",
        parcela_atual AS "parcelaAtual", total_parcelas AS "totalParcelas",
        grupo_parcelamento AS "grupoParcelamento"`;

const vazio = (v) => v === undefined || v === '';

// Lê e valida a query string da listagem. Sem inicio/fim usa o mês corrente.
function lerConsulta(query) {
    const campos = {};
    const padrao = mesCorrente();
    const inicio = vazio(query.inicio) ? padrao.inicio : query.inicio;
    const fim = vazio(query.fim) ? padrao.fim : query.fim;
    if (typeof inicio !== 'string') campos.inicio = 'Data inválida.';
    if (typeof fim !== 'string') campos.fim = 'Data inválida.';

    if (!vazio(query.tipo) && query.tipo !== 'entrada' && query.tipo !== 'saida') {
        campos.tipo = 'O tipo deve ser entrada ou saida.';
    }
    if (!vazio(query.categoriaId) && !ehInteiro(query.categoriaId, 1, ID_MAXIMO)) {
        campos.categoriaId = 'Categoria inválida.';
    }
    if (!vazio(query.fonteDestinoId) && !ehInteiro(query.fonteDestinoId, 1, ID_MAXIMO)) {
        campos.fonteDestinoId = 'Fonte ou destino inválido.';
    }
    if (!vazio(query.pagina) && !ehInteiro(query.pagina, 1, 1000000)) {
        campos.pagina = 'A página deve ser um número a partir de 1.';
    }
    if (!vazio(query.porPagina) && !ehInteiro(query.porPagina, 1, 100)) {
        campos.porPagina = 'Itens por página: de 1 a 100.';
    }
    validar(campos);
    validarPeriodo(inicio, fim);     // data inexistente ou inicio > fim: 400

    return {
        inicio,
        fim,
        tipo: vazio(query.tipo) ? null : query.tipo,
        categoriaId: vazio(query.categoriaId) ? null : Number(query.categoriaId),
        fonteDestinoId: vazio(query.fonteDestinoId) ? null : Number(query.fonteDestinoId),
        pagina: vazio(query.pagina) ? 1 : Number(query.pagina),
        porPagina: vazio(query.porPagina) ? 10 : Number(query.porPagina),
    };
}

// Valida os campos comuns ao POST e ao PUT. Os erros entram em `campos`; quem chama faz validar(campos).
// Só olha o formato: se a categoria e a fonte existem (e são do usuário) é conferido no banco, depois.
function lerLancamento(corpo, campos) {
    const { tipo, descricao, valor, data, categoriaId, fonteDestinoId } = corpo;

    if (tipo !== 'entrada' && tipo !== 'saida') {
        campos.tipo = 'O tipo deve ser entrada ou saida.';
    }

    const texto = typeof descricao === 'string' ? descricao.trim() : '';
    if (!texto) {
        campos.descricao = 'Informe a descrição.';
    } else if (texto.length > 120) {
        campos.descricao = 'A descrição deve ter no máximo 120 caracteres.';
    }

    if (!ehDinheiro(valor) || Number(valor) <= 0) {
        campos.valor = 'O valor deve ser maior que zero, com até 2 casas decimais.';
    }
    if (typeof data !== 'string' || !dataValida(data)) {
        campos.data = 'Informe uma data válida (AAAA-MM-DD).';
    }
    if (!ehInteiro(categoriaId, 1, ID_MAXIMO)) {
        campos.categoriaId = 'Escolha uma categoria.';
    }
    if (!ehInteiro(fonteDestinoId, 1, ID_MAXIMO)) {
        campos.fonteDestinoId = 'Escolha a fonte ou o destino.';
    }

    return { tipo, descricao: texto, valor: Number(valor), data, categoriaId: Number(categoriaId), fonteDestinoId: Number(fonteDestinoId) };
}

// Confere que a categoria e a fonte existem E são do usuário (senão 404) e devolve as duas.
async function buscarReferencias(usuarioId, categoriaId, fonteDestinoId) {
    const cat = await connection.query('SELECT id, nome, tipo FROM categorias WHERE id = $1 AND usuario_id = $2', [categoriaId, usuarioId]);
    if (cat.rowCount === 0) {
        throw new ErroApi(404, 'Categoria não encontrada.');
    }
    const fonte = await connection.query('SELECT id, nome, tipo FROM fontes_destinos WHERE id = $1 AND usuario_id = $2', [fonteDestinoId, usuarioId]);
    if (fonte.rowCount === 0) {
        throw new ErroApi(404, 'Fonte ou destino não encontrado.');
    }
    return { categoria: cat.rows[0], fonte: fonte.rows[0] };
}

// O tipo da categoria precisa ser o mesmo do lançamento (saída não aceita categoria de entrada)
function conferirTipoDaCategoria(tipo, categoria) {
    if (categoria.tipo !== tipo) {
        throw new ErroApi(400, 'Dados inválidos.', { categoriaId: `Esta categoria é de ${categoria.tipo === 'entrada' ? 'entrada' : 'saída'}; escolha uma de ${tipo === 'entrada' ? 'entrada' : 'saída'}.` });
    }
}

// `parcelas` é opcional: sem ele, é à vista (1). Aceita de 1 a 48.
function lerParcelas(valor, campos) {
    if (vazio(valor) || valor === null) {
        return 1;
    }
    if (!ehInteiro(valor, 1, 48)) {
        campos.parcelas = 'As parcelas devem ser de 1 a 48.';
        return 1;
    }
    return Number(valor);
}

const montarItem = (linha, categoria, fonte) => ({ ...linha, categoriaNome: categoria.nome, fonteDestinoNome: fonte.nome });

// GET /api/lancamentos: { periodo, itens, paginacao, totais }
router.get('/', async (req, res) => {
    const f = lerConsulta(req.query);
    const params = [req.usuarioId, f.inicio, f.fim, f.tipo, f.categoriaId, f.fonteDestinoId];

    const sqlItens = `${SELECT_ITEM}${FILTRO}
         ORDER BY l.data DESC, l.id DESC
         LIMIT $7 OFFSET $8`;
    // Totais do filtro INTEIRO (não só da página), somados no banco
    const sqlTotais = `
        SELECT COUNT(*)::int AS total,
               COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'entrada'), 0) AS entradas,
               COALESCE(SUM(l.valor) FILTER (WHERE l.tipo = 'saida'), 0) AS saidas
          FROM lancamentos l${FILTRO}`;

    const [itens, resumo] = await Promise.all([
        connection.query(sqlItens, [...params, f.porPagina, (f.pagina - 1) * f.porPagina]),
        connection.query(sqlTotais, params),
    ]);

    const { total, entradas, saidas } = resumo.rows[0];
    res.json({
        periodo: { inicio: f.inicio, fim: f.fim },
        itens: itens.rows,
        paginacao: { pagina: f.pagina, porPagina: f.porPagina, total, totalPaginas: Math.ceil(total / f.porPagina) },
        totais: { entradas, saidas, saldo: emReais(emCentavos(entradas) - emCentavos(saidas)) },   // saldo em centavos para não errar a conta
    });
});

// POST /api/lancamentos: cria o lançamento e responde SEMPRE uma lista (1 item à vista, N se parcelado)
router.post('/', async (req, res) => {
    const corpo = req.body ?? {};      // req.body pode ser undefined
    const campos = {};
    const l = lerLancamento(corpo, campos);
    const parcelas = lerParcelas(corpo.parcelas, campos);
    validar(campos);

    const { categoria, fonte } = await buscarReferencias(req.usuarioId, l.categoriaId, l.fonteDestinoId);
    conferirTipoDaCategoria(l.tipo, categoria);

    if (parcelas > 1 && fonte.tipo !== 'cartao_credito') {
        throw new ErroApi(400, 'Dados inválidos.', { parcelas: 'Só é possível parcelar em uma fonte do tipo cartão de crédito.' });
    }
    if (emCentavos(l.valor) < parcelas) {   // senão alguma parcela ficaria com R$ 0,00
        throw new ErroApi(400, 'Dados inválidos.', { valor: 'O valor é pequeno demais para esse número de parcelas.' });
    }

    const valores = dividirParcelas(l.valor, parcelas);      // a soma fecha exata, com a sobra na primeira
    const grupo = parcelas > 1 ? randomUUID() : null;        // liga as parcelas da mesma compra

    const sql = `
        INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
                                 parcela_atual, total_parcelas, grupo_parcelamento)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING ${RETORNO}`;

    // Todas as parcelas numa transação: ou grava a compra inteira ou não grava nada.
    // Dentro dela usa só `conn`, nunca `connection`.
    const itens = await connection.transacao(async (conn) => {
        const criados = [];
        for (let i = 0; i < parcelas; i++) {
            const { rows } = await conn.query(sql, [req.usuarioId, l.tipo, l.descricao, valores[i], l.data, categoria.id, fonte.id, i + 1, parcelas, grupo]);
            criados.push(montarItem(rows[0], categoria, fonte));
        }
        return criados;
    });
    res.status(201).json(itens);
});

// GET /api/lancamentos/:id: um lançamento do usuário (404 se não existe ou é de outro)
router.get('/:id', async (req, res) => {
    const sql = `${SELECT_ITEM} WHERE l.id = $1 AND l.usuario_id = $2`;
    const { rows, rowCount } = await connection.query(sql, [req.params.id, req.usuarioId]);
    if (rowCount === 0) {
        throw new ErroApi(404, 'Lançamento não encontrado.');
    }
    res.json(rows[0]);
});

// PUT /api/lancamentos/:id: corpo do POST sem `parcelas`. Muda só aquela linha, mesmo se for uma parcela.
router.put('/:id', async (req, res) => {
    const campos = {};
    const l = lerLancamento(req.body ?? {}, campos);
    validar(campos);

    const { categoria, fonte } = await buscarReferencias(req.usuarioId, l.categoriaId, l.fonteDestinoId);
    conferirTipoDaCategoria(l.tipo, categoria);

    const sql = `
        UPDATE lancamentos
           SET tipo = $1, descricao = $2, valor = $3, data = $4, categoria_id = $5, fonte_destino_id = $6
         WHERE id = $7 AND usuario_id = $8
        RETURNING ${RETORNO}`;
    const { rows, rowCount } = await connection.query(sql, [l.tipo, l.descricao, l.valor, l.data, categoria.id, fonte.id, req.params.id, req.usuarioId]);
    if (rowCount === 0) {
        throw new ErroApi(404, 'Lançamento não encontrado.');
    }
    res.json(montarItem(rows[0], categoria, fonte));
});

// DELETE /api/lancamentos/:id: apaga uma linha; com ?todasParcelas=true apaga a compra parcelada inteira
router.delete('/:id', async (req, res) => {
    let sql = 'DELETE FROM lancamentos WHERE id = $1 AND usuario_id = $2';
    if (req.query.todasParcelas === 'true') {
        // Apaga a linha pedida e todas do mesmo grupo (do mesmo usuário). Se não for parcelado, o grupo é NULL
        // e só a própria linha sai.
        sql = `
            DELETE FROM lancamentos
             WHERE usuario_id = $2
               AND (id = $1
                    OR (grupo_parcelamento IS NOT NULL
                        AND grupo_parcelamento = (SELECT grupo_parcelamento FROM lancamentos WHERE id = $1 AND usuario_id = $2)))`;
    }
    const { rowCount } = await connection.query(sql, [req.params.id, req.usuarioId]);
    if (rowCount === 0) {
        throw new ErroApi(404, 'Lançamento não encontrado.');
    }
    res.status(204).end();
});

module.exports = router;
