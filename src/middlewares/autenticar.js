const jwt = require('jsonwebtoken');
const { ErroApi } = require('../models/models.regras');

module.exports = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        next(new ErroApi(401, 'Token não informado.'));
        return;
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
        next(new ErroApi(401, 'Formato de token inválido.'));
        return;
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        req.usuarioId = Number(payload.sub);
        next();
    } catch (erro) {
        next(new ErroApi(401, 'Token inválido ou expirado.'));
    }
};
