# NOVA — Pacote 07: configuração para Vercel

Este pacote adapta o Pacote 06 para **frontend estático + Vercel Node.js Function + PostgreSQL externo**. Não é um deploy publicado.

## Subir para Vercel
Leia **`docs/VERCEL-DEPLOY.md`**. Use Root Directory `./`, preset **Other**, build `npm run vercel-build`, saída `public`. O `vercel.json` já contém essa configuração e o rewrite de `/api/*`.

## Desenvolvimento local
1. `cp .env.example .env` e edite a URL para o PostgreSQL local.
2. `docker compose --env-file .env up -d db` (se usar o Docker local do pacote).
3. `npm install`.
4. Banco novo **somente desenvolvimento**: `npx prisma db push --schema apps/api/prisma/schema.prisma`.
5. `npm test`.
6. `npm run dev` e abra `http://127.0.0.1:4173`.

> Não execute `db push` em produção; o schema do Pacote 06 ainda não inclui migração inicial versionada. Migrações revisadas são um requisito antes de produção.

## Testes feitos na preparação
Sintaxe das entradas Node validada; 6 testes de regras financeiras aprovados. **Build remoto Vercel, PostgreSQL real e homologação integrada ainda não testados**.
