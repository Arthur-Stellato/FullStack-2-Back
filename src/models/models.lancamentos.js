const db = require('../config/connection');

// Corpo da tabela. Categoria e fonte/destino são FOREIGN KEY: o banco não deixa apagar uma
// categoria que tenha lançamentos.
const TABELA = `
    CREATE TABLE IF NOT EXISTS lancamentos (
        id                  SERIAL PRIMARY KEY,       -- inteiro com auto incremento
        usuario_id          INTEGER        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        tipo                VARCHAR(7)     NOT NULL CHECK (tipo IN ('entrada', 'saida')),
        descricao           VARCHAR(120)   NOT NULL,
        valor               NUMERIC(12, 2) NOT NULL CHECK (valor > 0),   -- dinheiro nunca em float; o sinal vem do tipo
        data                DATE           NOT NULL,
        categoria_id        INTEGER        NOT NULL REFERENCES categorias(id),
        fonte_destino_id    INTEGER        NOT NULL REFERENCES fontes_destinos(id),
        parcela_atual       SMALLINT       NOT NULL DEFAULT 1,
        total_parcelas      SMALLINT       NOT NULL DEFAULT 1 CHECK (total_parcelas BETWEEN 1 AND 48),
        grupo_parcelamento  UUID,                     -- igual em todas as parcelas de uma mesma compra
        criado_em           TIMESTAMP      NOT NULL DEFAULT NOW()
    )`;

// Acelera a listagem e os relatórios, que sempre filtram por usuário e período.
const INDICE = 'CREATE INDEX IF NOT EXISTS idx_lancamentos_usuario_data ON lancamentos (usuario_id, data)';

const Lancamento = {

    async criarTabela() {
        await db.query(TABELA);
        await db.query(INDICE);
    },
};

module.exports = Lancamento;
