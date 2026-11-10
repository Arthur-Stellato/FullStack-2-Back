// DONO: Pessoa 1 (Acesso e base). Contrato em DIVISAO.md, seção 3.
//
// TODO: último middleware do app (4 parâmetros). Toda resposta de erro sai no formato { erro, campos }.
//  - ErroApi => res.status(erro.status).json({ erro: erro.message, campos: erro.campos })
//  - erro do próprio Express com status 4xx (ex.: JSON malformado) => esse status + { erro: 'Requisição inválida.' }
//  - qualquer outro => console.log do erro e 500 { erro: 'Erro interno do servidor.' }
module.exports = (erro, req, res, next) => {
    throw new Error('TODO (Pessoa 1): middlewares/erros');
};
