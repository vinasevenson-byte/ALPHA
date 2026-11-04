# NOVA — Pacote 09 (ALPHA) | Autenticação real, RBAC e Preview protegido

**Status:** overlay técnico para integração com o repositório GitHub `vinasevenson-byte/ALPHA`. Não publicado. **Não é homologação de produção.**

## Problemas da base ALPHA identificados antes da geração

- `src/app/entrar/page.tsx` permite acessar o painel sem validar senha.
- `src/app/api/platform/route.ts` registra `actorId = "usr-nova-owner"` em vez do usuário autenticado.
- `src/lib/nova-service.ts` cria usuário/ambientes fictícios automaticamente e aceita usuário padrão.
- `prisma/schema.prisma` está com provider SQLite, incompatível com banco PostgreSQL pretendido na Vercel.
- `/v1/workspaces/...` e páginas do painel precisam verificar autenticação e titularidade.
- `.env` está versionado na branch principal; não publicar credenciais!

## Conteúdo

`overlay/` contém código completo das telas de cadastro/entrada/recuperação, API de autenticação, sessão persistente em PostgreSQL e ferramenta incremental para ajustar os arquivos do ALPHA existente.

**Autenticação:** hash de senhas scrypt com sal aleatório, token de sessão aleatório (256 bits) guardado apenas como SHA-256 no banco, cookie HttpOnly Secure (produção) SameSite=Lax, sessões revogáveis com expiração em 7 dias, reset por link de uso único válido por 20 minutos, revogação de sessões ao redefinir senha, limite persistente de tentativas por IP/e-mail, origem validada nas operações de escrita.

**Acesso:** proprietário, administrador, editor e leitor. A autorização é feita no servidor; ambiente pessoal e empresarial são isolados por `Membership`. A API de autenticação permite registrar usuário, entrar, sair, recuperar senha, consultar perfil e criar ambiente. Ambientes iniciam sem movimentos financeiros e com saldos zerados.

**Segurança de Preview:** ações de fixtures, mudança de perfil por API e zerar dados permanecem desativadas. As demais escritas financeiras **ficam bloqueadas por padrão** até revisão específica de segurança/isolamento: `NOVA_ENABLE_FINANCIAL_WRITES=false`. O código permanece para futura integração, mas não deve ser ativado só porque o login funciona.

## Aplicação no projeto existente (Windows/VS Code)

1. Faça backup e crie branch: `git checkout -b homologacao/p09-auth`.
2. Extraia o ZIP **fora** da pasta do ALPHA; navegue até ele no terminal.
3. Rode `python overlay/scripts/apply-p09.py --root "D:/PROJETOS VS CODE/ALPHA"` (ajuste o caminho).
4. Confira `git diff` **antes de qualquer commit**. A ferramenta procura trechos exatos do ALPHA e aborta se não encontrar. Não aplique o Pacote 07 ou 08 por cima às cegas.
5. Não versionar `.env`: se rastreado, execute `git rm --cached .env` e rotacione quaisquer segredos reais anteriormente expostos. Mantenha `.env.example` no repositório.
6. Configure um **PostgreSQL novo e vazio** no ambiente de Preview, usando `DATABASE_URL` com pooling/SSL. **Não aponte para seu banco de produção ou SQLite antigo.**
7. Execute `npm ci`, `npm run db:generate`, `npx prisma validate` e `npx prisma migrate dev --name p09_postgres_initial` no banco de desenvolvimento novo. **Revise** os arquivos de migração gerados, adicione-os ao Git, e só então use `npm run db:deploy` no PostgreSQL de Preview.
8. Execute `npm run p09:check`, `npm run typecheck`, `npm test`, `npm run build`. Corrija eventuais falhas e reexecute. Estas verificações são obrigatórias antes de qualquer deploy.
9. Na Vercel: `Framework = Next.js`, `Root = ./`, `Install = npm ci`, `Build = npm run build`, `Output = padrão Next.js`. Configure `DATABASE_URL`, `NOVA_ALLOW_REGISTRATION`, `NOVA_ENABLE_FINANCIAL_WRITES`, `NOVA_PUBLIC_URL` em Preview. O Preview deverá estar protegido via Vercel Deployment Protection.
10. Crie um cadastro **apenas em ambiente privado de homologação** definindo temporariamente `NOVA_ALLOW_REGISTRATION=true`. Retorne a `false` depois. A recuperação por e-mail requer `RESEND_API_KEY` e `NOVA_EMAIL_FROM` configurados (domínio autorizado).

## Testes de aceitação obrigatórios

- Novo cadastro cria usuário e somente o próprio ambiente pessoal, iniciando zerado; login inválido não entra; logout revoga sessão.
- Cookies HttpOnly e Secure em produção; acesso sem sessão ao dashboard redireciona ao login; API retorna 401.
- Usuário A não pode ver ou alterar workspace do usuário B, nem forjando `workspaceId` na URL/JSON.
- Leitor não cria, edita, deleta, importa nem confirma operações; editor não executa ações administrativas.
- O reset de senha consome token uma única vez, revoga sessões anteriores; respostas não revelam se email existe.
- `RESET_TO_ZERO`, `LOAD_P02_FIXTURE`, `LOAD_P03_FIXTURE`, `SWITCH_ROLE`, `CHANGE_MEMBER_ROLE` bloqueadas na API.
- Sem `NOVA_ENABLE_FINANCIAL_WRITES=true`, todas as escritas financeiras retornam indisponível; **não ativar sem auditoria transacional, verificação das relações entre entidades e cobertura de testes**.
- Avaliar conexão PostgreSQL do Preview e build Vercel sem expor credenciais ou dados.

## Limites explícitos

- Não implementa convite/membro por e-mail ou autenticação multifator; ficam para revisão antes de uma liberação pública.
- Não migra dados SQLite antigos automaticamente. Exportação/importação deve ser planejada com validação e backup.
- Não integra banco, corretora ou pagamentos reais; não é uma autorização para movimentar dinheiro.
- A proteção `requireSameOrigin` considera `Origin` e host de proxy; em Preview validar `x-forwarded-host` e políticas de proxy da implantação.
- O limitador persistente é um controle inicial, não substitui WAF e rate limiting de borda.
- Ainda requer auditoria de **todas as relações entre IDs** nas mutações herdadas do ALPHA antes de permitir operações financeiras. O bloqueio por padrão existe precisamente para evitar exposição prematura.

## Arquivos e comandos

- `overlay/scripts/apply-p09.py`: atualiza arquivos existentes, instala novos componentes e define comandos do package.json.
- `overlay/scripts/p09-check.mjs`: validações estáticas da configuração depois de aplicar.
- `overlay/src/lib/nova-auth.ts`: autenticação, autorização, sessões, limitação de tentativas.
- `overlay/src/app/api/auth/[...action]/route.ts`: cadastro/login/logout/recuperação/perfil/criar workspace.
- `overlay/src/app/{entrar,cadastro,recuperar-senha,redefinir-senha}/page.tsx`: telas reais com interface NOVA.
- `overlay/.env.example` e `overlay/vercel.json`: exemplos seguros para Preview.

**Não grave diretamente na branch `main`**. Crie Pull Request e faça uma revisão dos arquivos alterados.
