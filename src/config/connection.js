require('dotenv').config({quiet: true});

const { Pool, types } = require('pg');

types.setTypeParser(1700, (valor) => parseFloat(valor));  // "150.50" vira o número 150.5
types.setTypeParser(1082, (valor) => valor);              // "2026-11-10" continua texto, como no contrato da API

const ehLocal = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: ehLocal ? false : { rejectUnauthorized: false },
});

pool.transacao = async (fn) => {
    const conexao = await pool.connect();     // pega UMA conexão do pool só pra mim
    try {
        await conexao.query('BEGIN');         // começa a transação
        const resultado = await fn(conexao);  // roda o código que a rota mandou, nessa conexão
        await conexao.query('COMMIT');        // deu tudo certo: confirma
        return resultado;
    } catch (erro) {
        await conexao.query('ROLLBACK');      // deu erro: desfaz tudo
        throw erro;                           // e repassa o erro pra rota tratar
    } finally {
        conexao.release();                    // devolve a conexão ao pool, de qualquer jeito
    }
};



const falta = (nome) => () => { throw new Error(`TODO (Pessoa 1): config/connection.${nome}`); };

module.exports = pool
