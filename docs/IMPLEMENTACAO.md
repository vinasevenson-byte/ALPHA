# NOVA / ALPHA — Pacote 08 — Homologação segura na Vercel

## Diagnóstico confirmado no repositório (02/11/2026)
- Next.js 15, React 19, Prisma 6; branch main.
- `prisma/schema.prisma` usa SQLite.
- `src/app/entrar/page.tsx` apenas redireciona; não autentica.
- `src/app/api/platform/route.ts` utiliza `actorId = 'usr-nova-owner'` e contém `RESET_TO_ZERO`.
- `ensureBaseWorkspaces()` cria usuário demonstrativo e workspaces fixos.
- `.env` está versionado no GitHub; não expor senhas de produção.
- Conexão GitHub disponível tem `push: false` — este ZIP não altera remotamente o repositório.

## Objetivo desta entrega
Bloquear acesso não autorizado ao Preview enquanto o aplicativo legado ainda não tem autenticação funcional. É uma barreira TEMPORÁRIA de projeto, NÃO autenticação multiusuário. Bloquear POST em rotas financeiras durante homologação. Preparar esquema candidato PostgreSQL e documentação de implantação.

## Aplicação sem sobrescrever código existente
1. Crie branch `homologacao/p08-vercel` partindo de `main`.
2. Copie `overlay/middleware.ts` e `overlay/vercel.json` para a RAIZ do ALPHA.
3. Acrescente `overlay/.gitignore.additions` ao `.gitignore`, sem remover as regras existentes.
4. Crie `.env.example` a partir de `overlay/.env.example`. NUNCA faça commit de `.env` real.
5. Ajuste `package.json` scripts, mantendo scripts existentes:
   - `"build": "prisma generate && next build"`
   - `"db:migrate:deploy": "prisma migrate deploy"`
   - `"preflight:p08": "node tools/preflight.mjs"`
6. Copie pasta `tools/` para a raiz do projeto. Rode `node tools/prepare-postgres.mjs`, que cria um **schema candidato**, sem modificar o original.
7. Valide `npx prisma validate --schema prisma/schema.postgres.preview.prisma`; analise diferenças e escolha migrações versionadas. Depois de revisado, passe a utilizar PostgreSQL no schema oficial.
8. Crie um banco PostgreSQL exclusivo para Preview e configure o `DATABASE_URL` em Vercel.
9. **Remova `.env` do controle de versão** com `git rm --cached .env` e faça rotação de qualquer segredo que tenha sido exposto.
10. Configure `NOVA_PREVIEW_USER` e `NOVA_PREVIEW_PASSWORD` (32+ caracteres aleatórios) nas variáveis Preview da Vercel, somente no lado do servidor.
11. Execute `npm ci`, `npx prisma generate`, `npx prisma validate`, `npm run build`, `npm test` e `npm run preflight:p08`. Só faça deploy se todas verificações passarem.
12. Vercel: Framework Next.js; Root `./`; Install `npm ci`; Build `npm run build`; Output Directory **sem override**; Node 22.x; Preview primeiro.

## Condições obrigatórias antes de publicar em produção
- Implementar sessões verificadas no servidor e fluxo de cadastro/login/recuperação seguros.
- Remover IDs globais/fixos e aplicar RBAC com sujeito autenticado em todas as rotas e consultas.
- Remover ou isolar `RESET_TO_ZERO` atrás de autorização explícita, auditar e exigir confirmação operacional.
- Introduzir migrações PostgreSQL versionadas e validar em banco novo; planejar migração dos dados SQLite se houver dados relevantes.
- Revisar CORS, CSRF, rate limit, logging, retenção e permissões no banco.
- Escrever testes de integração com banco e E2E multiusuário (isolamento de workspaces), incluindo tentativas não autorizadas.
- Remover gate temporário somente após entrada em produção por arquitetura revisada.

## Limites
- Bloqueio de rotas POST é intencional: dashboard pode ser inspecionado, mas cadastro e movimentações são desabilitados. Alguns GETs atuais podem escrever registros de inicialização por design legado; conectar apenas a banco descartável sem dados sensíveis.
- **Este overlay NÃO torna o ALPHA seguro para produção.**
- A geração de schema candidato NÃO é migração de dados nem prova de compatibilidade PostgreSQL.
- O middleware não substitui política de autenticação e autorização por usuário no servidor.
