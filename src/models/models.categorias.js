const db = require('../config/connection');

// Corpo da tabela. Cada categoria pertence a um usuário (FOREIGN KEY) e some junto com ele (CASCADE).
const TABELA = `
    CREATE TABLE IF NOT EXISTS categorias (
        id          SERIAL PRIMARY KEY,               -- inteiro com auto incremento
        usuario_id  INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        nome        VARCHAR(60) NOT NULL,
        tipo        VARCHAR(7)  NOT NULL CHECK (tipo IN ('entrada', 'saida')),
        UNIQUE (usuario_id, nome, tipo)               -- mesmo nome só uma vez por tipo e usuário
    )`;

const Categoria = {

    async criarTabela() {
        await db.query(TABELA);
    },
};

module.exports = Categoria;
