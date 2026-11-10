// DONO: Pessoa 1 (Acesso e base). Contrato em DIVISAO.md, seção 3.
//
// TODO: quatro funções, usadas por todas as rotas.
//  validar(campos)             recebe { campo: 'mensagem' }; se tiver alguma chave, lança ErroApi(400, 'Dados inválidos.', campos)
//  validarId(req, res, next, id)  para  router.param('id', validarId): só dígitos (até 9) segue; senão next(ErroApi 404)
//  ehDinheiro(v)               número ou texto com até 10 dígitos inteiros e no máximo 2 casas: 80, '10.5' (não: 10.999, 'abc')
//  ehInteiro(v, min, max)      número ou texto inteiro entre min e max (aceita '25')

const falta = (nome) => () => { throw new Error(`TODO (Pessoa 1): middlewares/validar.${nome}`); };

module.exports = {
    validar: falta('validar'),
    validarId: falta('validarId'),
    ehDinheiro: falta('ehDinheiro'),
    ehInteiro: falta('ehInteiro'),
};
