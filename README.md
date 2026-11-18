# FullStack-2-Back

API REST do Projeto 2 (Full Stack): controle financeiro pessoal. Cadastro e login com JWT, categorias,
fontes/destinos, lançamentos (com parcelas no cartão de crédito) e relatórios.

O front-end fica em outro repositório: [FullStack-2-Front](https://github.com/Arthur-Stellato/FullStack-2-Front).

## Tecnologias

Node.js, Express 5, PostgreSQL (driver `pg`), bcrypt, jsonwebtoken, dotenv, cors, express-rate-limit.

## Como rodar

Pré-requisitos: Node.js 20 ou superior e um banco PostgreSQL (local ou no Supabase).

1. Instalar as dependências:

   ```bash
   npm install
   ```

2. Preparar o banco. Escolha uma das opções:

   - **PostgreSQL local:** `createdb api_financeira`.
   - **Supabase:** crie um projeto e use a string de conexão do **Session pooler** (host `...pooler.supabase.com`,
     porta 5432). A "Direct connection" só tem IPv6 no plano gratuito e costuma falhar com `ECONNABORTED`. Se a senha
     tiver caracteres especiais (`@`, `#`, `/`), ela precisa estar codificada na URL (`@` vira `%40`).

3. Criar o `.env` a partir do exemplo (`cp .env.example .env` no Linux/macOS, `copy .env.example .env` no Windows) e
   preencher:

   | Variável | Para que serve |
   | --- | --- |
   | `PORT` | Porta da API (padrão 3000) |
   | `DATABASE_URL` | String de conexão do PostgreSQL (o nome é com underscore). O SSL liga sozinho quando a URL não é `localhost` |
   | `JWT_SECRET` | Segredo para assinar os tokens. Use um texto longo e aleatório |
   | `FRONT_URL` | Endereço do front liberado no CORS (padrão `http://localhost:5173`) |

   O `.env` não vai para o Git; apenas o `.env.example`.

4. Criar as tabelas:

   ```bash
   npm run db:criar
   ```

5. Popular com dados de demonstração (pode rodar quantas vezes quiser, ele recria os dois usuários de demonstração):

   ```bash
   npm run seed
   ```

6. Subir a API em <http://localhost:3000>:

   ```bash
   npm run dev
   ```

Testes das regras puras: `npm test`

### Usuários de demonstração (seed)

| E-mail | Senha | Dados |
| --- | --- | --- |
| `ana@demo.com` | `demo12345` | 3 meses de lançamentos, um cartão de crédito e uma compra parcelada em 3x |
| `bruno@demo.com` | `demo12345` | Um lançamento (serve para mostrar que cada usuário só vê os próprios dados) |

### Autenticação

O login devolve um token JWT (HS256, validade de 1 hora). Todas as rotas, exceto cadastro e login, exigem o cabeçalho
`Authorization: Bearer <token>`. O login tem limite de 10 tentativas a cada 15 minutos por IP (o contador fica em
memória e zera quando o servidor reinicia).

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
| --- | --- | --- |
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

## Uso de inteligência artificial

O enunciado (item 10.10) permite o uso de assistentes de IA como apoio, desde que cada integrante consiga explicar
qualquer trecho do projeto. Aqui está como cada pessoa do grupo usou IA.

### Pessoa 1 (Acesso e base): [Arthur Stellato], com Claude (Anthropic)

- **Planejamento:** a IA ajudou a ler o enunciado, a dividir o trabalho em três fatias, com os contratos da API entre
  elas, e a montar o esqueleto de pastas do back e do front (arquivos com o dono e o que falta fazer). [Confirme e
  complete: models do back.]
- **Escrito pelo integrante, com orientação da IA:** no front, `services/api.js`, `contexts/AuthContext.jsx`,
  `RotaProtegida`, `Login`, `Cadastro`, `Layout` e `Dashboard`, e no back o `database/seed.js`. A IA explicou os
  conceitos antes de cada parte (comportamento do `fetch` com erros e com resposta 204, token no `localStorage` em vez
  de cookie, redirecionamento no 401, estados de carregando, vazio e erro), entregou esqueletos com lacunas e revisou o
  código escrito, apontando erros que o integrante corrigiu (por exemplo `api.getItem` no lugar de `api.get`, nomes de
  campo diferentes dos da API e uma função solta que nunca era chamada no login).
- **Gerado pela IA e ajustado pelo integrante:** o CSS base (`index.css`) e os READMEs.
- **Base do back** (conexão, middlewares, rotas de autenticação, validação de CPF e datas): IA gerou apenas os arquivos como base da estrutural visando economizar tempo e melhor a organização do grupo.
- **Outros usos:** diagnóstico de erros do terminal (conflito de merge no Git, erro de CPF duplicado no seed)

### Pessoa 2 (Fontes e lançamentos): Conrado, com Claude (Anthropic)

- **Planejamento:** A IA ajudou a analisar a seção da Pessoa 2 no DIVISAO.md e no enunciado, organizando o desenvolvimento
  do back-end em 10 commits pequenos, seguindo a ordem de dependência: fontes e destinos, listagem, criação, parcelamento e
  exclusão de lançamentos. Também trabalhamos juntos na definição dos contratos das respostas, como o POST /lancamentos 
  sempre devolver uma lista e o DELETE aceitar ?todasParcelas=true.
- **Desenvolvimento com apoio da IA:** Trabalhei junto com a IA na implementação de routes.fontesDestinos.js 
  e routes.lancamentos.js, além dos testes de borda de dividirParcelas em models.regras.test.js. A IA auxiliou na estruturação
  e apresentou sugestões para as validações, consultas SQL, paginação, cálculo dos totais e parcelamento em transação, enquanto
  participei das decisões, análise e ajustes durante o desenvolvimento.
- **Escrito ou feito pelo integrante, com orientação da IA:** Participei da implementação das rotas, acompanhei as explicações 
  sobre as consultas SQL, validações e transações, revisei o código durante o desenvolvimento e realizei ajustes conforme os
  problemas identificados. Também acompanhei a organização dos commits e a integração das funcionalidades com a estrutura do projeto.
- **Base utilizada (feita pela Pessoa 1): ** Foram reaproveitados a conexão com o banco, os middlewares (autenticar, validar e erros),
  ErroApi e as funções de data (dataValida, mesCorrente e validarPeriodo), sem alterações. As rotas da Pessoa 2 seguiram o padrão do 
  grupo, utilizando usuario_id = req.usuarioId nas consultas, erros com ErroApi e tradução de erros do banco (23505 e 23503 para 409).
- **Outros usos:** A IA também foi utilizada como apoio para analisar possíveis erros, compreender mensagens do terminal 
  e orientar correções durante o desenvolvimento.

### Pessoa 3 (Categorias e relatórios): [nome], com [ferramenta]

- [Descreva o que a IA gerou, o que você escreveu e como revisou.]
