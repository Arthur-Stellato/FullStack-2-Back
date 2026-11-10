// install express, pg, bcrypt, jsonwebtoken, dotenv, cors, express-rate-limit
// install nodemon --save-dev

require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');
const app = express();

const autenticar = require('./middlewares/autenticar');
const tratarErros = require('./middlewares/erros');

if (!process.env.JWT_SECRET) {
    console.log('Defina JWT_SECRET no arquivo .env (veja o .env.example)');
    process.exit(1);
}

app.use(cors({ origin: process.env.FRONT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Só cadastro e login ficam abertos. As outras rotas passam antes pelo autenticar.
app.use('/api/auth', require('./routes/routes.auth'));
app.use('/api/categorias', autenticar, require('./routes/routes.categorias'));
app.use('/api/fontes-destinos', autenticar, require('./routes/routes.fontesDestinos'));
app.use('/api/lancamentos', autenticar, require('./routes/routes.lancamentos'));
app.use('/api/relatorios', autenticar, require('./routes/routes.relatorios'));

app.use((req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.' });
});

app.use(tratarErros);

// require.main === module: só abre a porta quando rodamos "node server.js" (e não quando outro arquivo importa o app)
if (require.main === module) {
    const porta = process.env.PORT || 3000;
    app.listen(porta, () => {
        console.log('Servidor rodando na porta ' + porta);
    });
}

module.exports = app;
