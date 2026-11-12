const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const connection = require('../config/connection');
const rateLimit = require('express-rate-limit');
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

const limitarLogin = rateLimit({
    windowMs: 15 * 60 * 1000,    // janela de 15 minutos, em milissegundos
    limit: 10,                   // no máximo 10 tentativas por IP nessa janela
    message: { erro: 'Muitas tentativas de login. Tente novamente em alguns minutos.' }
});

const HASH_FALSO = bcrypt.hashSync('senha-falsa', 10);

router.post('/login', limitarLogin, async (req, res) => {

    const { email, senha } = req.body ?? {};
    const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const campos = {};

    if (emailNormalizado === '') {
        campos.email = 'E-mail é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado) || emailNormalizado.length > 160) {
        campos.email = 'E-mail inválido';
    }

    if (typeof senha !== 'string' || senha === '') {
        campos.senha = 'Informe a senha.';
    }

    validar(campos);

    const { rows } = await connection.query(
        'SELECT id, nome, email, senha_hash FROM usuarios WHERE email = $1',
        [emailNormalizado]
    );

    const usuario = rows[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_FALSO);

    if (!usuario || !senhaCorreta) {
        throw new ErroApi(401, 'E-mail ou senha inválidos.');
    }

    const token = jwt.sign({ sub: String(usuario.id) }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });

    res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
});

module.exports = router;