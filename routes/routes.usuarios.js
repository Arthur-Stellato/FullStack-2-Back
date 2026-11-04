const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const connection = require('../database/connection');

router.get('/', (req, res) => {

    connection.query('SELECT * FROM usuarios', (erro, resultados) => {
        if (erro) {
            console.log('Erro ao buscar usuários: ', erro);
            res.status(500).json({ 
                erro: 'Erro ao buscar usuários'
            });
            return;
        }

        res.status(200).json(resultados);
    });

});

router.get('/:id', (req, res) => {

    const id = req.params.id;

    const sql = 'SELECT * FROM usuarios WHERE id = ?';

    connection.query(sql, [id], (erro, resultados) => {
        if (erro) {
            console.log('Erro ao buscar usuário: ', erro);
            res.status(500).json({ 
                erro: 'Erro ao buscar usuário'
            });
            return;
        }

        if(resultados.length === 0)
        {
            res.status(404).json({ 
                erro: 'Usuário não encontrado'
            });
            return;
        }

        res.status(200).json(resultados[0]);
    });

});

router.post('/', (req, res) => {

    const {nome, email, cpf, senha_hash} = req.body;

    const senhaCriptografada = bcrypt.hashSync(senha_hash, 10);

    const sql = 'INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES (?, ?, ?, ?)';

    connection.query(sql, [nome, email, cpf, senhaCriptografada], (erro, resultados) => {
        if (erro) {
                console.log('Erro ao cadastrar usuário: ', erro);
                res.status(500).json({ 
                    erro: 'Erro ao cadastrar usuário'
                });
                return;
            }
            res.status(201).json({ 
                mensagem: 'Usuário cadastrado com sucesso',
                idInsert: resultados.insertId
            });

        });

});

module.exports = router;