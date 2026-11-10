// DONO: Pessoa 1 (Acesso e base). Contrato em DIVISAO.md, seção 3.
//
// TODO: ler  Authorization: Bearer <token>  e validar com jwt.verify (JWT_SECRET, algoritmo HS256).
//  - válido: req.usuarioId = Number(payload.sub) e next()
//  - ausente, inválido ou expirado: next(new ErroApi(401, 'Token não informado.' / 'Token inválido ou expirado.'))
module.exports = (req, res, next) => {
    throw new Error('TODO (Pessoa 1): middlewares/autenticar');
};
