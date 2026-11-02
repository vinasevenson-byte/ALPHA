# 03 — Contratos API P02

## Convenções
Base `/v1/workspaces/{workspaceId}`, sessão HTTP segura conforme P01. Todos os comandos de gravação financeira exigem `Idempotency-Key` quando especificado e `If-Match`/`version` nas edições concorrentes. Montantes trafegam como **strings decimais** (`"150.00"`), jamais float. Datas de vencimento são `YYYY-MM-DD` na zona do workspace. Erro uniforme: `{ "code": "...", "message": "...", "details": {}, "requestId": "..." }`.

## Planejamento
- `GET /planning/overview?from=YYYY-MM-DD&to=YYYY-MM-DD&scenario=BASE` → KPIs e séries, `calculationVersion`, `asOf`, `confidence`, `warnings`.
- `GET /planning/calendar?from=&to=&type=` → eventos e saldo projetado por dia.
- `GET /planning/cashflow?from=&to=&scenarioId=` → array `{date, startBalance, inForecast, outForecast, endBalance, isCritical}`.
- `GET /planning/reserve-capacity?horizonDays=90` → `{eligibleBalance, minForecastBalance, safetyBuffer, alreadyAllocated, overdueUncounted, headroom, confidence, explanations[]}`.
- `GET|POST /planning/scenarios`; `GET|PATCH|DELETE /planning/scenarios/:id` (delete lógico; não apaga auditoria).

## Obrigações
- `GET|POST /obligations?direction=PAYABLE|RECEIVABLE&status=&dueFrom=&dueTo=&cursor=&limit=50`.
- `GET|PATCH /obligations/:id` e `POST /obligations/:id/cancel` com motivo.
- `GET /obligations/:id/installments`.
- `POST /obligations/:id/installments/:installmentId/settlements` com `Idempotency-Key`:

```json
{
  "accountId": "<uuid-da-conta>",
  "amount": "150.00",
  "settledOn": "2026-11-15",
  "note": "Pagamento registrado após confirmação externa"
}
```

Resposta `201` com `{settlementId, transactionId, outstanding, installmentStatus, auditId}`. Repetição idempotente pode retornar `200` com mesmos identificadores. Pagamento parcial acima de aberto retorna `409 OVER_SETTLEMENT`; conta sem permissão retorna `403`.

## Orçamento
- `GET|POST /planning/budget-policies`, `GET|PATCH /planning/budget-policies/:id`, `GET /planning/budget-usage?period=YYYY-MM`.
- Limites existentes em `budgets` P01; política aponta para aquele registro. Não permitir dois limites ativos com mesma combinação workspace/categoria/centro de custo/período sem regra explícita de precedência.

## Reservas e metas
- `GET|POST /reserves`, `GET|PATCH /reserves/:id`, `POST /reserves/:id/archive`.
- `GET /reserves/:id/movements?cursor=&limit=`.
- `POST /reserves/:id/allocations` body `{amount: "300.00", note: "...", expectedWorkspaceVersion: 17}` com `Idempotency-Key`.
- `POST /reserves/:id/releases` body `{amount: "75.00", reason: "...", expectedWorkspaceVersion: 18}` com `Idempotency-Key`.
- `POST /reserves/transfers` body `{sourceReserveId, destinationReserveId, amount: "20.00", expectedWorkspaceVersion: 19}` com `Idempotency-Key`.
- `GET|POST /goals`, `GET|PATCH /goals/:id`, `POST /goals/:id/complete`.

**Reserva não gera transação bancária e não altera saldo disponível da conta P01:** muda somente `allocatedBalance` e `freeCash` no planejamento. Confirmação UI deve repetir esse fato.

## Inteligência / alertas
- `GET /insights/diagnosis?month=YYYY-MM`, `GET /insights/alerts?state=&severity=&cursor=`.
- `POST /insights/alerts/:id/read`, `/dismiss` e `POST /insights/alerts/:id/resolve` (resolve somente quando condição resolvida no backend, senão 409).
- `GET|PUT /insights/alert-preferences` (por usuário e workspace).

## Exemplos de respostas
`GET /planning/reserve-capacity`:
```json
{
  "eligibleBalance": "10000.00",
  "minForecastBalance": "7000.00",
  "safetyBuffer": "2000.00",
  "alreadyAllocated": "1000.00",
  "overdueUncounted": "0.00",
  "headroom": "4000.00",
  "confidence": "MEDIUM",
  "explanations": ["Contas vencidas já consideradas na projeção", "Horizonte utilizado: 90 dias"],
  "asOf": "2026-11-01T12:00:00Z",
  "calculationVersion": "2.0.0"
}
```

`GET /planning/overview` inclui `dataQuality` para identificar contas não conciliadas, vencimentos ausentes e receitas incertas; não retorna taxa de investimentos, produto 'melhor' ou promessa de rentabilidade.

## Padrões adicionais
Paginação de lista: `limit` 1..100, cursor opaco escopado por workspace, ordenação estável `(dueOn,id)`; filtros de data até 366 dias no padrão, intervalo maior via exportação assíncrona; `ETag` em GET e `If-Match` em PATCH. Toda resposta contém `requestId` em header e logs correlacionados. OpenAPI de referência adicional em `contracts/openapi-pacote02.yaml`; implementar schemas completos no monorepo após harmonizar com P01.

## Catálogo de erros
`WORKSPACE_FORBIDDEN` 403; `VALIDATION_ERROR` 422; `NOT_FOUND` 404; `STALE_VERSION` 409; `IDEMPOTENCY_CONFLICT` 409; `OVER_SETTLEMENT` 409; `INSUFFICIENT_FREE_BALANCE` 409; `RESERVE_COVERAGE_RISK` 409; `P01_NOT_READY` 503; `RATE_LIMITED` 429; `INTERNAL_ERROR` 500. Não revelar existência de objetos de outro workspace.
