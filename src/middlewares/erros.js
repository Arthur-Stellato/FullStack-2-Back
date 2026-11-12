// src/middlewares/erros.js
const { ErroApi } = require('../models/models.regras');

module.exports = (erro, req, res, next) => {
    if (erro instanceof ErroApi) {
        res.status(erro.status).json({ erro: erro.message, campos: erro.campos });
        return;
    }

    if (erro.status >= 400 && erro.status < 500) {
        res.status(erro.status).json({ erro: 'Requisição inválida.' });
        return;
    }
    res.status(500).json({ erro: 'Erro interno do servidor.' });
};