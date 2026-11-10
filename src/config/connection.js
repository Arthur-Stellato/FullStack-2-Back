// DONO: Pessoa 1 (Acesso e base). Contrato em DIVISAO.md, seção 3.
//
// TODO: Pool do pg usando DATABASE_URL (dotenv).
//  - NUMERIC (tipo 1700) chega como number e DATE (tipo 1082) como texto 'AAAA-MM-DD' (types.setTypeParser)
//  - pool.transacao(async (conn) => { ... }): BEGIN, roda a função com uma conexão do pool, COMMIT;
//    se der erro, ROLLBACK e relança; sempre devolve a conexão ao pool
// Quem usa: toda rota e todo model fazem  const connection = require('../config/connection')

const falta = (nome) => () => { throw new Error(`TODO (Pessoa 1): config/connection.${nome}`); };

module.exports = { query: falta('query'), transacao: falta('transacao'), end: falta('end') };
