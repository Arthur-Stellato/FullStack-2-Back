// DONO: Pessoa 3 (Categorias e relatórios). Veja DIVISAO.md, seção 5 (RF4).
// Montada em /api/categorias, já protegida pelo autenticar.
//   GET /   POST /   PUT /:id (só o nome)   DELETE /:id (409 se houver lançamentos)

const express = require('express');
const router = express.Router();

const connection = require('../config/connection');
const { ErroApi } = require('../models/models.regras');
const { validar, validarId } = require('../middlewares/validar');

// Se o :id da URL não for número, responde 404 antes de entrar na rota
router.param('id', validarId);

// Valida o nome (obrigatório, até 60 caracteres) e devolve já sem espaços nas pontas
function nomeValido(corpo, campos) {
    const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
    if (!nome) {
        campos.nome = 'Informe o nome da categoria.';
    } else if (nome.length > 60) {
        campos.nome = 'O nome deve ter no máximo 60 caracteres.';
    }
    return nome;
}

// GET /api/categorias: lista só as categorias do usuário logado
router.get('/', async (req, res) => {
    const sql = `
        SELECT id, nome, tipo
          FROM categorias
         WHERE usuario_id = $1
         ORDER BY tipo, nome`;
    const { rows } = await connection.query(sql, [req.usuarioId]);
    res.json(rows);
});

// POST /api/categorias: cria uma categoria { nome, tipo }
router.post('/', async (req, res) => {
    const campos = {};
    const nome = nomeValido(req.body, campos);
    const tipo = req.body.tipo;
    if (tipo !== 'entrada' && tipo !== 'saida') {
        campos.tipo = 'O tipo deve ser entrada ou saida.';
    }
    validar(campos);

    const sql = `
        INSERT INTO categorias (usuario_id, nome, tipo)
        VALUES ($1, $2, $3)
        RETURNING id, nome, tipo`;
    try {
        const { rows } = await connection.query(sql, [req.usuarioId, nome, tipo]);
        res.status(201).json(rows[0]);
    } catch (erro) {
        if (erro.code === '23505') {   // UNIQUE (usuario_id, nome, tipo) do banco
            throw new ErroApi(409, 'Categoria duplicada.', { nome: 'Você já tem uma categoria com esse nome nesse tipo.' });
        }
        throw erro;
    }
});

// PUT /api/categorias/:id: só o nome muda (trocar o tipo quebraria os lançamentos)
router.put('/:id', async (req, res) => {
    const campos = {};
    const nome = nomeValido(req.body, campos);
    validar(campos);

    const sql = `
        UPDATE categorias
           SET nome = $1
         WHERE id = $2 AND usuario_id = $3
        RETURNING id, nome, tipo`;
    try {
        const { rows, rowCount } = await connection.query(sql, [nome, req.params.id, req.usuarioId]);
        if (rowCount === 0) {
            throw new ErroApi(404, 'Categoria não encontrada.');   // não existe ou é de outro usuário
        }
        res.json(rows[0]);
    } catch (erro) {
        if (erro.code === '23505') {
            throw new ErroApi(409, 'Categoria duplicada.', { nome: 'Você já tem uma categoria com esse nome nesse tipo.' });
        }
        throw erro;
    }
});

// DELETE /api/categorias/:id: 204 se apagou, 409 se ainda há lançamentos nela
router.delete('/:id', async (req, res) => {
    const sql = 'DELETE FROM categorias WHERE id = $1 AND usuario_id = $2';
    try {
        const { rowCount } = await connection.query(sql, [req.params.id, req.usuarioId]);
        if (rowCount === 0) {
            throw new ErroApi(404, 'Categoria não encontrada.');
        }
        res.status(204).end();
    } catch (erro) {
        if (erro.code === '23503') {   // FOREIGN KEY: lancamentos.categoria_id ainda aponta para ela
            throw new ErroApi(409, 'Não é possível excluir: existem lançamentos nesta categoria.');
        }
        throw erro;
    }
});

module.exports = router;

