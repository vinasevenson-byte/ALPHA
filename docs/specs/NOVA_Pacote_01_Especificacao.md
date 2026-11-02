# NOVA — Pacote 01 | Fundação e Operação Financeira

Versão: 1.0 • Data: 2026-11-01 • Status: especificação para implementação

## 1. Identidade e limites
Produto independente, nome NOVA provisório (validar marca e domínio). Público: pessoas físicas e empresas. Interface integralmente pt-BR, BRL por padrão, timezone configurável e datas dd/mm/aaaa. Não reutilizar sistemas, dados, bancos de dados, dependências de domínio, componentes protegidos ou repositórios de projetos anteriores.

**Objetivo do pacote:** entregar um organizador financeiro funcional com contas, receitas, despesas, transferências, categorias, compromissos e projeção de fluxo de caixa, login, perfis, autorização e dashboard calculado de dados persistidos. Dados começam vazios/zero. Não há integração bancária real, pagamento real, recomendação personalizada ou execução de investimento neste pacote.

## 2. Stack proposta
- Monorepo TypeScript: pnpm workspaces + Turborepo.
- `apps/web`: Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Recharts, React Hook Form, Zod.
- `apps/api`: NestJS (Fastify) TypeScript, OpenAPI, validação Zod ou class-validator em padrão único.
- `packages/domain`: regras puras financeiras; `packages/ui`: design system; `packages/contracts`: contratos e schemas compartilhados; `packages/config`: lint, tsconfig.
- Persistência: PostgreSQL + Prisma migrations. Redis opcional em etapas posteriores, sem dependência inicial.
- Autenticação: sessão segura com cookie HttpOnly, Secure, SameSite; Argon2id para senhas, MFA planejado e rate limiting. Logs estruturados sem credenciais.
- Testes: Vitest (domínio), Playwright (E2E), Testcontainers (integração PostgreSQL), CI com lint, typecheck, test, build, migrations em banco descartável.
- Observabilidade: logs correlacionados, erros normalizados e métricas sem dados financeiros sensíveis.

## 3. Navegação e rotas
`/entrar`, `/cadastro`, `/onboarding`, `/app/[workspaceId]/visao-geral`, `/app/[workspaceId]/contas`, `/app/[workspaceId]/movimentacoes`, `/app/[workspaceId]/receitas`, `/app/[workspaceId]/despesas`, `/app/[workspaceId]/transferencias`, `/app/[workspaceId]/compromissos`, `/app/[workspaceId]/fluxo-de-caixa`, `/app/[workspaceId]/categorias`, `/app/[workspaceId]/relatorios`, `/app/[workspaceId]/configuracoes`.

Menu futuro, sinalizado *em desenvolvimento* e sem botões enganosos: Reservas, Investimentos e Inteligência Avançada. Alternância de workspace no topo; PF e PJ mantêm isolamento lógico e de autorização. Administrador da empresa pode convidar membros; pessoa física começa com usuário proprietário.

## 4. Dashboard (estado inicial em zero)
Topo: seletor de workspace, período, pesquisa, notificações e usuário. Cartões: Saldo disponível consolidado, Receitas realizadas no período, Despesas realizadas no período, Saldo projetado até data de referência. Gráfico temporal: entradas vs saídas reais e previstas, exibidas em séries distintas. Seções: próximas contas, maiores categorias de despesas, atividade recente e espaço reservado para reservas. Cada cartão tem drill-down filtrado. Estado vazio orienta primeiro cadastro de conta e lançamento, sem exemplos fictícios.

No modo PJ, rotular receitas como recebimentos e inserir dimensões opcionais cliente, fornecedor e centro de custo, sem misturar pessoas e empresas. Indicadores devem ser calculados na API, nunca apenas em componentes locais.

## 5. Modelo de dados mínimo
- `users`: id UUID, email único, password_hash, nome, estado, created_at.
- `workspaces`: id UUID, tipo `PERSONAL|BUSINESS`, nome, moeda_base `BRL`, timezone, created_at.
- `memberships`: workspace_id, user_id, role `OWNER|ADMIN|EDITOR|VIEWER`, status.
- `accounts`: id, workspace_id, nome, tipo `CHECKING|SAVINGS|CASH|OTHER`, instituição opcional, moeda, saldo_inicial_decimal, data_saldo_inicial, status, created_at.
- `categories`: id, workspace_id, tipo `INCOME|EXPENSE`, nome, parent_id opcional, archived_at.
- `counterparties`: id, workspace_id, tipo `PERSON|COMPANY`, nome, documento opcional protegido.
- `transactions`: id, workspace_id, account_id, category_id opcional, counterparty_id opcional, kind `INCOME|EXPENSE|TRANSFER_IN|TRANSFER_OUT|OPENING_BALANCE|ADJUSTMENT`, status `PENDING|SETTLED|CANCELED`, amount_decimal positivo, occurred_on, due_on opcional, settled_on opcional, description, transfer_group_id opcional, created_by, created_at, updated_at, version, idempotency_key.
- `recurrences`: id, workspace_id, modelo de lançamento, periodicidade, próxima_data, fim opcional, ativo.
- `budgets`: id, workspace_id, categoria, período, valor_limite.
- `audit_events`: id, workspace_id, actor_id, action, entity_type, entity_id, timestamp, metadata sem segredos, request_id.

Índices por `(workspace_id, occurred_on)`, `(workspace_id, status, due_on)`, `(workspace_id, account_id, settled_on)`. Chaves estrangeiras incluem workspace quando necessário para impedir referências entre tenants. Usar Decimal(19,4) ou estratégia equivalente, jamais `float` para dinheiro. API envia decimais como strings. Todos os horários armazenados em UTC; datas financeiras como DATE no calendário local do workspace.

## 6. Invariantes financeiras
1. Lançamentos de despesa e receita guardam montante positivo; sinal deriva de `kind`.
2. Saldo atual da conta = saldo inicial + receitas liquidadas − despesas liquidadas + transferências recebidas liquidadas − transferências enviadas liquidadas + ajustes auditados.
3. Transferência interna consiste em duas pernas atômicas na mesma transação de banco; não compõe receita nem despesa consolidadas.
4. Lançamento pendente não altera saldo atual; altera apenas projeção conforme vencimento previsto.
5. Projeção diária = saldo atual + receitas pendentes previstas até D − despesas pendentes previstas até D, evitando contar lançamentos já liquidados.
6. Cancelamento preserva histórico; operações financeiras relevantes têm usuário, motivo, data e auditoria. Não apagar fisicamente lançamentos liquidados.
7. Uma `idempotency_key` não pode produzir a mesma operação duas vezes no workspace.
8. Todo endpoint faz autorização por workspace na API, inclusive buscas, relatórios, exportações e ações indiretas. O seletor visual nunca concede permissão.
9. Filtros e indicadores respeitam período e timezone; zero lançamentos significa R$ 0,00 ou listas vazias.
10. Diferenças entre saldo bancário declarado e saldo calculado usam ajuste identificado e auditado, não sobrescrevem o histórico.

## 7. Interfaces e operações
### Login e onboarding
Cadastro com email, senha e confirmação; verificação de email; criação do primeiro workspace PF ou PJ; convite por email para PJ; seleção de moeda BRL e timezone. Recuperação de senha com token de uso único.

### Contas
Listar, criar, editar nome, arquivar; saldo por conta, consolidação; saldo inicial com data de referência, alterações posteriores via ajuste auditado. Não excluir conta com movimentos liquidados.

### Movimentações
Listar com busca, filtros, paginação, criar receita, despesa e transferência; editar pendentes; corrigir liquidados por estorno/reversão contábil de registro (sem movimentação bancária) ou ajuste auditado. Categoria obrigatória para receitas/despesas. Exportação CSV opcional na fase final do pacote.

### Compromissos
Receitas/despesas futuras com vencimento, marcação como pagas/recebidas que gera liquidação sem duplicação. Parcelamento gera compromissos individuais. Recorrência gera ocorrências idempotentes.

### Fluxo de caixa
Períodos 7, 30, 90 e 365 dias, saldo diário, entradas e saídas realizadas vs previstas, indicação de menor saldo previsto e alertas de saldo negativo, sem recomendações de investimento neste pacote.

### Relatórios
Receitas x despesas por período e categorias, saldos por conta e compromissos vencidos. Filtros persistidos na URL.

## 8. API v1 (resumo)
- `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/logout`, `POST /v1/auth/refresh`, `POST /v1/auth/forgot-password`, `POST /v1/auth/reset-password`.
- `GET|POST /v1/workspaces`, `GET|PATCH /v1/workspaces/:id`, `GET|POST /v1/workspaces/:id/members`.
- `GET|POST /v1/workspaces/:id/accounts`, `GET|PATCH /v1/workspaces/:id/accounts/:accountId`.
- `GET|POST /v1/workspaces/:id/categories`.
- `GET|POST /v1/workspaces/:id/transactions`, `GET|PATCH /v1/workspaces/:id/transactions/:transactionId`.
- `POST /v1/workspaces/:id/transfers`.
- `POST /v1/workspaces/:id/transactions/:transactionId/settle`.
- `POST /v1/workspaces/:id/transactions/:transactionId/cancel` (somente quando permitido).
- `GET|POST /v1/workspaces/:id/recurrences`, `GET|POST /v1/workspaces/:id/budgets`.
- `GET /v1/workspaces/:id/dashboard?from=&to=`, `GET /v1/workspaces/:id/cash-flow?from=&to=`, `GET /v1/workspaces/:id/reports/summary?from=&to=`.

Response de erro padronizada: `{code, message, details, requestId}`; idempotência via cabeçalho `Idempotency-Key` em gravações críticas; paginação cursor ou offset consistente; contrato OpenAPI gerado e testado.

## 9. Papéis e segurança
- `OWNER`: tudo, incluindo gestão de membros e exclusão/encerramento do workspace sujeito a regras de retenção.
- `ADMIN`: gestão de contas, categorias, lançamentos e membros com restrições para transferir propriedade.
- `EDITOR`: criar/editar registros operacionais, sem administrar membros.
- `VIEWER`: consultar e exportar dados autorizados, sem criar/editar/excluir.

Segregar tenants em TODAS as queries; usar trilha de auditoria e revalidação de acesso no servidor. Tratar LGPD (consentimentos/finalidades, minimização, exportação/eliminação aplicáveis), backups criptografados, plano de restauração, rotacionamento de segredos, rate limiting e proteção CSRF. Abrir ambiente de homologação isolado antes da produção.

## 10. Organização sugerida de repositório
```text
nova/
  apps/
    web/
    api/
  packages/
    domain/
    contracts/
    ui/
    config/
  infra/
    docker/
    migrations/
  docs/
    architecture/
    api/
    decisions/
  .github/workflows/
  pnpm-workspace.yaml
  turbo.json
```

## 11. Testes e critérios de aceite
- Cadastro, login, recuperação de senha, isolamento de workspaces PF/PJ.
- Uma conta recém-criada sem saldo inicial aparece em R$ 0,00, sem dados de exemplo.
- Receita liquidada de R$ 1.000 e despesa liquidada de R$ 250 resultam em saldo R$ 750; transferências internas preservam consolidado.
- Despesa pendente de R$ 100 não altera saldo atual, mas reduz projeção em sua data de vencimento.
- Liquidação repetida ou retry com chave idempotente não duplica saldo.
- Consulta por usuário sem vínculo com workspace devolve acesso negado sem vazamento de informações.
- Edição e reversão mantêm trilha de auditoria; reconciliação do saldo após operações.
- Menus, botões, formulários, estados de loading/erro/vazio, navegação por teclado e responsividade validados em Playwright.
- Lint, typecheck, testes unitários, integração, E2E principal, build e migrations passam no CI.
- Zero dados fictícios em produção, logs sem senhas/tokens, documentação API gerada.

## 12. Fora do Pacote 01
Open Finance real, iniciação de pagamentos, reservas automáticas, recomendações individualizadas de valores mobiliários, execução de ordens, cotações ao vivo, IA conectada a produtos financeiros e contabilização empresarial completa. Essas frentes dependem de parceiros, fontes autorizadas e análises regulatórias próprias.

## 13. Entregáveis técnicos da implementação
Aplicação web, API, banco versionado, scripts de provisionamento, variáveis de ambiente de exemplo sem segredos, OpenAPI, testes, pipeline CI, ambiente de Preview, instruções de operação e checklist de segurança. Esta especificação não significa que tais itens já tenham sido implementados.
