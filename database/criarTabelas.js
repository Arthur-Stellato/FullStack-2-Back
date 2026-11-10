// Cria as tabelas a partir do corpo definido em cada model:  npm run db:criar
// O banco em si precisa existir antes:  createdb api_financeira
const db = require('../src/config/connection');
const Usuario = require('../src/models/models.usuarios');
const Categoria = require('../src/models/models.categorias');
const FonteDestino = require('../src/models/models.fontesDestinos');
const Lancamento = require('../src/models/models.lancamentos');

(async () => {
    // A ordem importa: quem tem FOREIGN KEY vem depois da tabela que ele referencia.
    for (const model of [Usuario, Categoria, FonteDestino, Lancamento]) {
        await model.criarTabela();
    }
    console.log('Tabelas criadas');
})()
    .catch((erro) => {
        console.log('Erro ao criar tabelas: ', erro);
        process.exitCode = 1;
    })
    .finally(() => db.end());
