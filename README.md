# FullStack-2-Back

API REST do Projeto 2 (Full Stack): controle financeiro pessoal. Cadastro e login com JWT, categorias,
fontes/destinos, lançamentos (com parcelas no cartão de crédito) e relatórios.

> Divisão do trabalho do grupo, regras e contratos: [DIVISAO.md](DIVISAO.md)

## Tecnologias

Node.js, Express 5, PostgreSQL (driver `pg`), bcrypt, jsonwebtoken, dotenv, cors, express-rate-limit.

## Como rodar

1. `npm install`
2. Criar o banco: `createdb api_financeira`
3. `cp .env.example .env` e ajustar `DATABASE_URL` e `JWT_SECRET`
4. `npm run db:criar` (cria as tabelas a partir dos models)
5. `npm run seed` (2 usuários e 3 meses de lançamentos para a demonstração)
6. `npm run dev` (API em http://localhost:3000)

Testes das regras puras: `npm test`

## Estrutura

```
database/
  criarTabelas.js       cria as tabelas (npm run db:criar)
  seed.js               dados de demonstração (npm run seed)
src/
  server.js             cria o app, registra middlewares e rotas
  config/connection.js  pool do banco e transacao()
  middlewares/          autenticar (JWT), validar, erros
  models/               corpo das tabelas (CREATE TABLE) e regras puras
  routes/               rotas + controllers
```

## Rotas

Tudo em `/api`. Só cadastro e login são abertos; as demais exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/cadastro` | Cadastra usuário |
| POST | `/auth/login` | Autentica e devolve o JWT |
| GET | `/auth/me` | Dados do usuário logado |
| GET POST | `/categorias` | Lista / cria categorias |
| PUT DELETE | `/categorias/:id` | Edita / exclui categoria |
| GET POST | `/fontes-destinos` | Lista / cria fontes e destinos |
| PUT DELETE | `/fontes-destinos/:id` | Edita / exclui fonte/destino |
| GET POST | `/lancamentos` | Lista com filtros e paginação / cria (com parcelas) |
| GET PUT DELETE | `/lancamentos/:id` | Detalha / edita / exclui (`?todasParcelas=true`) |
| GET | `/relatorios/categorias` | Saídas e entradas por categoria |
| GET | `/relatorios/fontes-destinos` | Entradas e saídas por fonte/destino |
| GET | `/relatorios/faturas` | Faturas dos cartões (aberta e próximas) |

## Decisões do grupo

- Controllers ficam dentro dos arquivos de `routes/` (sem pasta `controllers`), como pede o enunciado.
- `models/` guarda o corpo das tabelas; as consultas (`const sql`) ficam nas rotas.
- Compra parcelada: cada parcela é um lançamento que guarda a **data da compra**; a fatura de cada uma é
  calculada com `calcularFatura(data, cartão, parcelaAtual)`.
- Banco: PostgreSQL. Back e front em repositórios separados (liberado pelo professor, para subir na Vercel).
