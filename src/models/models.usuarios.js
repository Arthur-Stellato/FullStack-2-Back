const db = require('../config/connection');

// Corpo da tabela: cada linha é uma coluna. Quem garante e-mail e CPF únicos é o UNIQUE do banco.
const TABELA = `
    CREATE TABLE IF NOT EXISTS usuarios (
        id          SERIAL PRIMARY KEY,               -- inteiro com auto incremento
        nome        VARCHAR(120) NOT NULL,
        email       VARCHAR(160) NOT NULL UNIQUE,     -- gravado em minúsculas
        cpf         CHAR(11)     NOT NULL UNIQUE,     -- gravado só com dígitos
        senha_hash  VARCHAR(100) NOT NULL,            -- nunca a senha pura
        criado_em   TIMESTAMP    NOT NULL DEFAULT NOW()
    )`;

const Usuario = {

    async criarTabela() {
        await db.query(TABELA);
    },
};

module.exports = Usuario;
