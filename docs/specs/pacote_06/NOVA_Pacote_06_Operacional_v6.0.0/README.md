# NOVA — Pacote 06 | Operação Persistente e Controle de Acesso

Versão 6.0.0. Projeto independente. Base executável para homologação **após instalação de dependências e banco PostgreSQL**.

## Entregas
- Interface preservada e adaptada do Pacote 05: dashboard roxo, menus, contas, movimentações, compromissos, fluxo de caixa, reservas, investimentos manuais, inteligência e auditoria.
- API HTTP Node.js 22 com autenticação, sessões HttpOnly SameSite=Strict, senhas scrypt com salt, validação de origem, escopo por ambiente, permissões de escrita, idempotência e transações com isolamento serializável.
- Banco PostgreSQL + Prisma: usuários, sessões, ambientes PF/PJ, participações, contas, operações, reservas virtuais, posições manuais, auditoria e chaves de idempotência.
- Núcleo de cálculo com BigInt em centavos, sem ponto flutuante no backend.
- Testes automáticos de domínio; a suíte ponta a ponta com banco requer homologação adicional.

## Instalação local
1. Instale Node.js 22+, npm e Docker com Compose.
2. Copie `.env.example` para `.env`. Altere `POSTGRES_PASSWORD` e a senha correspondente em `DATABASE_URL` (sem colocar a senha em repositório).
3. Execute `docker compose --env-file .env up -d db`.
4. Execute `npm install` na raiz do pacote.
5. Execute `npm run db:generate`, depois `npm run db:migrate` (aplicará o esquema inicial por Prisma Migrate).
6. Execute `npm test` e `npm run dev`.
7. Acesse `http://127.0.0.1:4173` e crie o primeiro usuário. O sistema cria um ambiente pessoal e um empresarial, ambos vinculados ao usuário cadastrado.

**Variáveis:** scripts Node não carregam `.env` automaticamente neste projeto; use `node --env-file=.env apps/api/src/server.mjs` para iniciar o servidor ou exporte as variáveis no terminal antes de executar `npm run dev`. Prisma CLI carrega `.env` da raiz se disponível.

## Limites da entrega
- Implementação de referência local, não auditada nem homologada para produção, sem publicação na nuvem.
- Não realiza pagamentos, transferências bancárias, ordens ou recomendações personalizadas.
- Reservas são classificações virtuais; investimentos são posições informadas manualmente.
- Uma das limitações deliberadas: não há convite de novos membros na interface. O modelo de membership e RBAC está pronto para a fase administrativa.
- Antes de produção: testes com banco real, análise de ameaças, proteção contra força bruta em login, 2FA, troca/recuperação de senha, backups testados, observabilidade, deploy HTTPS, trilha de auditoria endurecida, revisão de integridade da carteira e LGPD.

## Segurança
Não use dados bancários reais nesta versão de desenvolvimento. Nunca publique porta de PostgreSQL aberta, arquivos `.env`, credenciais ou dados de clientes.

## Histórico
O Pacote 05 foi a referência funcional da UI. O Pacote 06 introduz estrutura persistente e segurança básica; os arquivos originais 01–05 não são sobrescritos.
