// DONO: Pessoa 2 (Fontes e lançamentos). Veja DIVISAO.md, seção 5 (RF5).
// Montada em /api/fontes-destinos, já protegida pelo autenticar.
//   GET /   POST /   PUT /:id   DELETE /:id (409 se houver lançamentos)

const express = require('express');
const router = express.Router();

const connection = require('../config/connection');
const { ErroApi } = require('../models/models.regras');
const { validar, validarId, ehDinheiro, ehInteiro } = require('../middlewares/validar');

// Se o :id da URL não for número, responde 404 antes de entrar na rota
router.param('id', validarId);

// Colunas devolvidas ao front, já em camelCase. Nos tipos que não são cartão, os 3 últimos vêm null.
const COLUNAS = `id, nome, tipo,
        dia_fechamento AS "diaFechamento", dia_vencimento AS "diaVencimento", limite`;

const TIPOS = ['renda', 'conta', 'cartao_credito'];

// Valida o corpo (serve para POST e PUT) e devolve os valores prontos para o INSERT/UPDATE.
// Só cartão de crédito exige fechamento, vencimento e limite; nos outros tipos eles viram null.
function lerFonte(corpo) {
    const campos = {};

    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
    if (!nome) {
        campos.nome = 'Informe o nome.';
    } else if (nome.length > 60) {
        campos.nome = 'O nome deve ter no máximo 60 caracteres.';
    }

    const { tipo, diaFechamento, diaVencimento, limite } = corpo;
    if (!TIPOS.includes(tipo)) {
        campos.tipo = 'O tipo deve ser renda, conta ou cartao_credito.';
    }

    if (tipo === 'cartao_credito') {
        if (!ehInteiro(diaFechamento, 1, 31)) {
            campos.diaFechamento = 'Informe o dia de fechamento (1 a 31).';
        }
        if (!ehInteiro(diaVencimento, 1, 31)) {
            campos.diaVencimento = 'Informe o dia de vencimento (1 a 31).';
        }
        if (!ehDinheiro(limite) || Number(limite) <= 0) {
            campos.limite = 'Informe um limite maior que zero, com até 2 casas decimais.';
        }
    }
    validar(campos);

    const cartao = tipo === 'cartao_credito';
    return {
        nome,
        tipo,
        diaFechamento: cartao ? Number(diaFechamento) : null,
        diaVencimento: cartao ? Number(diaVencimento) : null,
        limite: cartao ? Number(limite) : null,
    };
}

// UNIQUE (usuario_id, nome) do banco: o mesmo nome não pode se repetir para o mesmo usuário
const duplicada = () => new ErroApi(409, 'Fonte ou destino duplicado.', { nome: 'Você já tem uma fonte ou destino com esse nome.' });

// GET /api/fontes-destinos: lista só as fontes e destinos do usuário logado
router.get('/', async (req, res) => {
    const sql = `
        SELECT ${COLUNAS}
          FROM fontes_destinos
         WHERE usuario_id = $1
         ORDER BY nome`;
    const { rows } = await connection.query(sql, [req.usuarioId]);
    res.json(rows);
});

// POST /api/fontes-destinos: cria { nome, tipo, diaFechamento?, diaVencimento?, limite? }
router.post('/', async (req, res) => {
    const f = lerFonte(req.body ?? {});    // req.body pode ser undefined

    const sql = `
        INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING ${COLUNAS}`;
    try {
        const { rows } = await connection.query(sql, [req.usuarioId, f.nome, f.tipo, f.diaFechamento, f.diaVencimento, f.limite]);
        res.status(201).json(rows[0]);
    } catch (erro) {
        if (erro.code === '23505') {
            throw duplicada();
        }
        throw erro;
    }
});

// PUT /api/fontes-destinos/:id: troca todos os campos (mesmo corpo do POST)
router.put('/:id', async (req, res) => {
    const f = lerFonte(req.body ?? {});

    const sql = `
        UPDATE fontes_destinos
           SET nome = $1, tipo = $2, dia_fechamento = $3, dia_vencimento = $4, limite = $5
         WHERE id = $6 AND usuario_id = $7
        RETURNING ${COLUNAS}`;
    try {
        const { rows, rowCount } = await connection.query(sql, [f.nome, f.tipo, f.diaFechamento, f.diaVencimento, f.limite, req.params.id, req.usuarioId]);
        if (rowCount === 0) {
            throw new ErroApi(404, 'Fonte ou destino não encontrado.');   // não existe ou é de outro usuário
        }
        res.json(rows[0]);
    } catch (erro) {
        if (erro.code === '23505') {
            throw duplicada();
        }
        throw erro;
    }
});

// DELETE /api/fontes-destinos/:id: 204 se apagou, 409 se ainda há lançamentos nela
router.delete('/:id', async (req, res) => {
    const sql = 'DELETE FROM fontes_destinos WHERE id = $1 AND usuario_id = $2';
    try {
        const { rowCount } = await connection.query(sql, [req.params.id, req.usuarioId]);
        if (rowCount === 0) {
            throw new ErroApi(404, 'Fonte ou destino não encontrado.');
        }
        res.status(204).end();
    } catch (erro) {
        if (erro.code === '23503') {   // FOREIGN KEY: lancamentos.fonte_destino_id ainda aponta para ela
            throw new ErroApi(409, 'Não é possível excluir: existem lançamentos nesta fonte ou destino.');
        }
        throw erro;
    }
});

module.exports = router;
