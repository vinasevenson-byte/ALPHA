# NOVA v9.0.0 — Registro de mudanças

## Mudanças entregues no overlay
- Cadastro de usuário com senha real, sessão persistente, logout revogável.
- Portal de acesso, cadastro, onboarding autenticado e recuperação de senha.
- Restrições de segurança em `/api/platform` e `/v1/workspaces/...`.
- Bloqueio de ações destrutivas, fixtures e alteração de papel por API legada.
- Migração **proposta** do provider Prisma SQLite para PostgreSQL, com entidades de sessão, token de recuperação e limitador de tentativas.
- Configuração básica Vercel para Next.js e documentação de Preview protegido.

## Necessita execução externa
- Aplicação sobre clone real do ALPHA, revisão do diff, Prisma generate, migrations, build e testes de integração.
- Revisão de referências de IDs por ambiente em TODAS as mutações antes de permitir gravações.
- Integração de provedores de e-mail, proteção de borda e MFA antes do uso público.
- Nenhum commit, PR ou deploy realizado.
