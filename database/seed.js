const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const connection = require('../src/config/connection');
const { hojeISO } = require('../src/models/models.regras');

const SENHA = 'demo12345';
const USUARIOS = [
    { nome: 'Ana Demo', email: 'ana@demo.com', cpf: '52998224725' },
    { nome: 'Bruno Demo', email: 'bruno@demo.com', cpf: '11144477735' },
];

const CATEGORIAS = [
    ['Salário', 'entrada'], ['Outros', 'entrada'],
    ['Alimentação', 'saida'], ['Moradia', 'saida'], ['Saúde', 'saida'],
    ['Mobilidade', 'saida'], ['Lazer', 'saida'], ['Educação', 'saida'], ['Outros', 'saida'],
];
const FONTES = [['Conta corrente', 'conta'], ['Salário', 'renda']];

function data(mesesAtras, dia) {
    const [ano, mes] = hojeISO().split('-').map(Number);
    return new Date(Date.UTC(ano, mes - 1 - mesesAtras, dia)).toISOString().slice(0, 10);
}

(async () => {
    const hash = await bcrypt.hash(SENHA, 10);

    await connection.transacao(async (conn) => {
        await conn.query('DELETE FROM usuarios WHERE email = ANY($1)', [USUARIOS.map((u) => u.email)]);

        const ids = {};
        for (const u of USUARIOS) {
            const { rows } = await conn.query(
                'INSERT INTO usuarios (nome, email, cpf, senha_hash) VALUES ($1, $2, $3, $4) RETURNING id',
                [u.nome, u.email, u.cpf, hash]
            );
            const usuario = rows[0].id;

            const categorias = {};
            for (const [nome, tipo] of CATEGORIAS) {
                const r = await conn.query(
                    'INSERT INTO categorias (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id',
                    [usuario, nome, tipo]
                );
                categorias[`${tipo}:${nome}`] = r.rows[0].id;
            }

            const fontes = {};
            for (const [nome, tipo] of FONTES) {
                const r = await conn.query(
                    'INSERT INTO fontes_destinos (usuario_id, nome, tipo) VALUES ($1, $2, $3) RETURNING id',
                    [usuario, nome, tipo]
                );
                fontes[nome] = r.rows[0].id;
            }

            ids[u.email] = { usuario, categorias, fontes };
        }

        const ana = ids['ana@demo.com'];

        // [tipo, descricao, valor, dia, categoria, fonte]
        const base = [
            ['entrada', 'Salário', 5000, 5, 'entrada:Salário', 'Salário'],
            ['saida', 'Aluguel', 1500, 10, 'saida:Moradia', 'Conta corrente'],
            ['saida', 'Mercado', 600, 12, 'saida:Alimentação', 'Conta corrente'],
            ['saida', 'Uber', 180, 15, 'saida:Mobilidade', 'Conta corrente'],
            ['saida', 'Cinema', 120, 20, 'saida:Lazer', 'Conta corrente'],
            ['saida', 'Farmácia', 90, 22, 'saida:Saúde', 'Conta corrente'],
        ];
        for (const mesesAtras of [0, 1, 2]) {
            for (const [tipo, descricao, valor, dia, cat, fonte] of base) {
                await conn.query(
                    `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [ana.usuario, tipo, descricao, cat === 'saida:Lazer' ? valor + mesesAtras * 50 : valor,
                        data(mesesAtras, dia), ana.categorias[cat], ana.fontes[fonte]]
                );
            }
        }

        const { rows: [cartao] } = await conn.query(
            `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [ana.usuario, 'Cartão de crédito', 'cartao_credito', 5, 25, 3000]
        );

        const grupo = randomUUID();
        for (let i = 1; i <= 3; i++) {
            await conn.query(
                `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
                                          parcela_atual, total_parcelas, grupo_parcelamento)
                 VALUES ($1, 'saida', 'Notebook', $2, $3, $4, $5, $6, 3, $7)`,
                [ana.usuario, 400, data(1, 5), ana.categorias['saida:Educação'], cartao.id, i, grupo]
            );
        }

        const bruno = ids['bruno@demo.com'];
        await conn.query(
            `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id)
             VALUES ($1, 'saida', 'Mercado', 350, $2, $3, $4)`,
            [bruno.usuario, data(0, 8), bruno.categorias['saida:Alimentação'], bruno.fontes['Conta corrente']]
        );
    });

    console.log(`Seed pronto. Logins: ana@demo.com / bruno@demo.com, senha ${SENHA}`);
})()
    .catch((erro) => {
        console.error('Erro no seed:', erro);
        process.exitCode = 1;
    })
    .finally(() => connection.end());