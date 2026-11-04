const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'api_financeira'
});

connection.connect((erro) => {

    if (erro){
        console.log('Erro ao conectar no banco: ', erro);
        return;
    }

    console.log('Conectado ao MySql');

});


module.exports = connection;