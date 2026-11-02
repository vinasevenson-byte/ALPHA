# 03 — Arquitetura, API, persistência e segurança

## Bounded contexts
`portfolio` (carteiras, contas de custódia, ativos, lotes, operações); `market-data` (instrumentos, preços, séries, provedores); `analytics` (valoração, retornos, comparador); `scenarios` (simulações e premissas); `compliance` (regras tributárias vigentes, consentimento, auditoria). APIs `/api/v1/workspaces/:workspaceId/investments/...`; sessão e autorização herdadas do Pacote 01.

## Integração Pacote 01
Consumo de `Workspace`, `Account`, `LedgerEntry` por interfaces `WorkspaceAccess`, `CashLedger`; nenhuma escrita direta em tabelas de contas fora da transação de serviço. Operações de investimento geram movimentos contábeis/transferências por comando idempotente, com outbox de eventos para evitar inconsistência. Saldo e patrimônio reconciliados por data.

## Integração Pacote 02
Consumo de `ReserveGoal`, `CashForecast`, `Budget` por interfaces `GoalReader` e `CashAvailability`; vinculação de objetivo sem transferir dinheiro. Só usar saldo aplicável após compromissos/margem de segurança; cenário de investimento não altera o fluxo de caixa real.

## Pipeline de mercado
Provider adapter com contrato `fetchQuotes(symbols, asOf)`, `fetchBenchmarks(range)`, `fetchOffers(filters)`; versionar schema do provedor, registrar `retrievedAt`, `quoteAsOf`, licença, timezone, unidade, moeda, latência e erro. Cache com TTL por tipo; stale-while-revalidate com aviso 'defasado'; filas com backoff e rate limit; não substituir erro de fonte por preço anterior sem alertar. Ofertas negociáveis diferem de cotações públicas e exigem autorização do distribuidor.

## Segurança
`workspace_id` obrigatório em todas consultas, índices compostos e RLS opcional como defesa adicional. RBAC: `owner`, `admin`, `finance_manager`, `analyst`, `viewer`; concessão diferenciada de exportação/importação e edição de posições. Aprovação opcional PJ com segregação de quem cria e quem aprova ajustes relevantes. Logs append-only, requestId, ator, diff redigido, motivo, IP tratado com política LGPD. Criptografia em trânsito e em repouso; segredos em vault; mascaramento de identificadores financeiros; rate-limit/CSRF; backup e restore testados.

## Consistência
Identificação externa única `(workspaceId, provider, externalId)`; import em duas fases (preview, commit) com hash do arquivo, deduplicação, rollback seguro e lista de rejeições. Retificações não removem história. Outbox para efeitos no ledger e reconciliador diário com alerta, sem alteração automática de saldo divergente.

## Operação
Métricas de cotações desatualizadas, erros de comparação, latência p95, falhas de conciliação, duplicatas, mismatches contábeis, filas; alarmes por severidade; feature flags `investments.read`, `investments.write`, `comparison.live`, `fiscal.estimate`, `simulator`; migrações aditivas antes de ativar escrita.
