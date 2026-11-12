const express = require('express');
const bcrypt = require('bcrypt');
const connection = require('../config/connection');
const { ErroApi, cpfValido } = require('../models/models.regras');
const { validar } = require('../middlewares/validar');

const router = express.Router();

router.post('/cadastro', async (req, res) => {
    const { nome, email, cpf, senha } = req.body ?? {};
    const nomeNormalizado = typeof nome === 'string' ? nome.trim() : '';
    const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cpfNormalizado = typeof cpf === 'string' ? cpf.replace(/\D/g, '') : '';
    const campos = {};

    if (nomeNormalizado === '') {
        campos.nome = 'Informe o nome.';
    } else if (nomeNormalizado.length > 120) {
        campos.nome = 'O nome pode ter no máximo 120 caracteres.';
    }

    if (emailNormalizado === '') {
        campos.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado) || emailNormalizado.length > 160) {
        campos.email = 'E-mail inválido';
    }

    if (cpfNormalizado === '') {
        campos.cpf = 'CPF é obrigatório';
    } else if (!cpfValido(cpfNormalizado)) {
        campos.cpf = 'CPF inválido';
    }

    if (typeof senha !== 'string' || senha === '') {
        campos.senha = 'Informe a senha.';
    } else if (senha.length < 8 || senha.length > 72) {
        campos.senha = 'A senha deve ter de 8 a 72 caracteres.';
    } else if (!/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
        campos.senha = 'A senha deve ter letras e números.';
    }

    validar(campos);

    const senhaHash = await bcrypt.hash(senha, 10);

    try {
        const usuario = await connection.transacao(async (conn) => {
            const { rows } = await conn.query(
                'INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id, nome, email',
                [nomeNormalizado, emailNormalizado, cpfNormalizado, senhaHash]
            );
            const novo = rows[0];

            const categorias = [
                ['Salário', 'entrada'], ['Outros', 'entrada'],
                ['Alimentação', 'saida'], ['Moradia', 'saida'], ['Saúde', 'saida'],
                ['Mobilidade', 'saida'], ['Lazer', 'saida'], ['Educação', 'saida'], ['Outros', 'saida'],
            ];
            for (const [nomeCategoria, tipo] of categorias) {
                await conn.query(
                    'INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3)',
                    [novo.id, nomeCategoria, tipo]
                );
            }

            for (const [nomeFonte, tipo] of [['Conta corrente', 'conta'], ['Salário', 'renda']]) {
                await conn.query(
                    'INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, $2, $3)',
                    [novo.id, nomeFonte, tipo]
                );
            }

            return novo;
        });

        res.status(201).json(usuario);
    } catch (erro) {
        if (erro.code === '23505') {
            if (erro.constraint.includes('cpf')) {
                throw new ErroApi(409, 'Dados já cadastrados.', { cpf: 'CPF já cadastrado.' });
            }
            if (erro.constraint.includes('email')) {
                throw new ErroApi(409, 'Dados já cadastrados.', { email: 'E-mail já cadastrado.' });
            }
        }
        throw erro;
    }
});


module.exports = router;