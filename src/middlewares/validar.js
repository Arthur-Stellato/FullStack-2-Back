const { ErroApi } = require('../models/models.regras');

function validar(campos) {
    if (Object.keys(campos).length > 0) {
        throw new ErroApi(400, 'Dados inválidos.', campos);
    }
}

function validarId(req, res, next, id) {
    if (!/^\d{1,9}$/.test(id)) {
        throw new ErroApi(404, 'Registro não encontrado.');
    }
    next();
}

function ehDinheiro(valor) {
    return (typeof valor === 'number' || typeof valor === 'string') && /^\d{1,10}(\.\d{1,2})?$/.test(String(valor));
}

function ehInteiro(valor, min, max) {
    if (typeof valor !== 'number' && typeof valor !== 'string') {
        return false;
    }
    if (!/^\d{1,9}$/.test(String(valor))) {
        return false;
    }
    return Number(valor) >= min && Number(valor) <= max;
}

module.exports = { validar, validarId, ehDinheiro, ehInteiro };
