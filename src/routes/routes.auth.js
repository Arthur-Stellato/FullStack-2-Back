// DONO: Pessoa 1 (Acesso e base). Veja DIVISAO.md, seção 5 (RF1 e RF2).
// Montada em /api/auth. É a única que NÃO passa pelo autenticar (o /me usa o autenticar direto).
//   POST /cadastro   POST /login (com limite de tentativas)   GET /me

const express = require('express');
const router = express.Router();

// TODO

module.exports = router;
