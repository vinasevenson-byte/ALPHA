# NOVA — implantação na Vercel (Preview primeiro)

## Arquitetura
- Root Directory do projeto Vercel: raiz desta pasta (não `apps/web` nem `apps/api`).
- Frontend estático: `public/index.html`, `public/app.js`, `public/styles.css`.
- API: `api/index.mjs`, que importa a função `handler` de `apps/api/src/server.mjs`.
- Rewrites: `/api/*` para função `/api/index`, sem redirecionar o navegador.
- Banco de dados: PostgreSQL hospedado externamente, com TLS e pool de conexões; nunca use Docker nem `localhost` como DATABASE_URL na Vercel.
- Sem pagamentos nem ordens de investimento reais.

## Preparação em um repositório Git
1. Extraia o ZIP. Envie **o conteúdo da pasta do pacote** para a raiz de um repositório privado no GitHub.
2. Não envie `.env` nem segredos. Confirme que `.gitignore` está ativo.
3. Use Node.js 22 na máquina local e em Settings → General → Node.js Version (se disponível).
4. Configure um banco PostgreSQL para **Preview**, separado do banco de produção.
5. Configure `DATABASE_URL` na Vercel em Settings → Environment Variables (Preview): conexão PostgreSQL pooled, protegida por TLS. Configure uma URL distinta para Production antes de publicar produção.
6. `DIRECT_URL` é usada apenas no computador/CI com acesso ao banco para manutenção e migrações; não é necessária no runtime. Evite incluir credenciais diretas nos logs.
7. Selecione: Framework Preset = Other; Root Directory = `./`; Build Command = `npm run vercel-build`; Output Directory = `public`; Install Command = `npm install`.
8. Como o schema do Pacote 06 **não tinha migração inicial versionada**, para uma base **nova e vazia apenas de Preview**, execute no seu terminal confiável com `DATABASE_URL` apontando para o banco Preview: `npm install`, `npm run db:generate` e `npx prisma db push --schema apps/api/prisma/schema.prisma`. **Não use `db push` em produção ou banco com dados**. Antes da produção, gere/revise e versione migração SQL usando Prisma migrate e execute `migrate deploy` num passo controlado de CI.
9. Faça o deploy pelo GitHub integrado à Vercel. O projeto deve abrir `/` e responder GET `/api/health` com status `ok`.
10. Execute testes na URL do Preview com contas de teste, sem dados financeiros reais: registro, login, ambientes, lançamento, transferência, reserva, sessão, logout.

## Variáveis
| Chave | Preview | Production | Notas |
|---|---|---|---|
| `DATABASE_URL` | obrigatório | obrigatório | URL pooled do PostgreSQL com TLS. **Bancos separados**. |
| `NODE_ENV` | omitido | omitido | A Vercel define `production` em funções. |
| `POSTGRES_PASSWORD` | não | não | Somente Docker local. |
| `HOST` / `PORT` | não | não | Sem `listen` em serverless. |
| `DIRECT_URL` | opcional | opcional | Apenas se seu fluxo de migrações usar essa variável. |

## Comportamento e limites
- API e frontend compartilham origem; a cookie `nova_session` usa `HttpOnly`, `SameSite=Strict` e `Secure` em produção.
- POST exige `Origin` correspondente à URL pública. Caso a URL da função seja customizada através de proxy, valide os cabeçalhos de host/proxy e acrescente testes antes de disponibilizar usuários.
- `GET /api/health` verifica execução do processo **não** conectividade ao banco. Teste `/api/auth/me` após login e consulte logs do deployment.
- Cadastro público está aberto no protótipo. Antes de produção: habilitar rate limit, confirmação de e-mail, recuperação de acesso, monitoramento, CSRF robusto e auditoria de segurança.
- Para produção também faltam: backups/restore testados, política de retenção LGPD, migrações versionadas, teste integrado PostgreSQL, observabilidade e proteção contra abuso de rotas.
- `npm run vercel-build` gera o Prisma Client; não altera schema do banco durante build.

## Solução de problemas
- **500 Prisma Client not initialized:** execute `npm run vercel-build` e confira logs de build e `DATABASE_URL`.
- **500 P1001/P1002:** credenciais, TLS, DNS, firewall, pool ou instância pausada.
- **404 /api/*:** confira Root Directory, `api/index.mjs` e `vercel.json` na mesma raiz.
- **403 Origem não permitida:** confirme que o frontend chama a própria URL Vercel (same-origin) e que Origin e Host correspondem.
- **Tabelas inexistentes:** confirme schema aplicado no banco Preview; não migre o banco de Production por engano.
- **Erros de conexão em concorrência:** ative o pooler do provedor e monitore conexões de funções serverless.
