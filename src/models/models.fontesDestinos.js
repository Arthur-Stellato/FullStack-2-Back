const db = require('../config/connection');

// Corpo da tabela. Os três campos de cartão só são obrigatórios quando tipo = 'cartao_credito'.
const TABELA = `
    CREATE TABLE IF NOT EXISTS fontes_destinos (
        id              SERIAL PRIMARY KEY,           -- inteiro com auto incremento
        usuario_id      INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        nome            VARCHAR(60) NOT NULL,
        tipo            VARCHAR(14) NOT NULL CHECK (tipo IN ('renda', 'conta', 'cartao_credito')),
        dia_fechamento  SMALLINT CHECK (dia_fechamento BETWEEN 1 AND 31),   -- só cartão
        dia_vencimento  SMALLINT CHECK (dia_vencimento BETWEEN 1 AND 31),   -- só cartão
        limite          NUMERIC(12, 2),                                     -- só cartão
        UNIQUE (usuario_id, nome),
        CHECK (tipo <> 'cartao_credito'
               OR (dia_fechamento IS NOT NULL AND dia_vencimento IS NOT NULL AND limite IS NOT NULL))
    )`;

const FonteDestino = {

    async criarTabela() {
        await db.query(TABELA);
    },
};

module.exports = FonteDestino;
