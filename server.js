// install express
// install mysql2
// install nodemon --save-dev

const express = require('express');
const app = express();

const usuariosRoutes = require('./routes/routes.usuarios');

app.use(express.json());
app.use('/usuarios', usuariosRoutes);

app.listen(3000, () => {
    console.log('Servidor rodando na porta 3000');
});