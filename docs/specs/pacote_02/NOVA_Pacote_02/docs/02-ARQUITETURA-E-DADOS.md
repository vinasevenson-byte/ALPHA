# 02 — Arquitetura, modelo de dados e regras críticas

## Integração com o Pacote 01
P01 já define `transactions`, `recurrences`, `budgets`, `accounts`, `workspaces`, `memberships`, `categories`, `audit_events`. O P02 usa estes registros como **fonte de verdade** do saldo e mantém tabelas próprias apenas para dimensões de planejamento.

**Mapeamento de evolução:**
- `obligations` é envelope descritivo de dívida/direito a receber; `obligation_installments` representa vencimento de uma ocorrência; `obligation_settlements` referencia uma `transaction` liquidada do P01. Um compromisso pendente do P01 deve ser migrado/ligado a um installment sem criar duplicata. Na implantação, implementar índice único de referência de origem para impedir migração duplicada.
- `recurrences` de P01 seguem como motor padrão. A nova tabela `obligation_schedules` só mantém definições detalhadas e vincula à recorrência P01, não inicia job concorrente.
- `budgets` de P01 serão estendidos via migração aditiva (`budget_policies`) em vez de dois totais de orçamento; cada política aponta para `budget_id` existente.
- `reserve_allocations` são **ledger virtual** com eventos imutáveis e somatórios; não entram em `transactions` do saldo real. Não há tabela de 'saldo físico' do cofre.
- `goals` vinculadas a `reserves` sem duplicar valor alocado.

## Tabelas novas e atributos

| Entidade | Chave / escopo | Campos fundamentais |
|---|---|---|
| `obligations` | UUID + workspaceId | direction, title, counterpartyId, categoryId, status, metadata, version |
| `obligation_installments` | UUID + obligationId + workspaceId | number, dueOn DATE, amount DECIMAL(19,4), status, originTransactionId? |
| `obligation_settlements` | UUID + installmentId + transactionId | amount DECIMAL, settledOn DATE, idempotencyKey; unique txnId |
| `budget_policies` | budgetId + workspaceId | carryOver, thresholds, warnOnly, costCenterId? |
| `planning_scenarios` | UUID + workspaceId | kind, assumptions JSON validated, createdBy, expiresAt, version |
| `reserves` | UUID + workspaceId | name, kind, targetAmount, targetOn, priority, status, version |
| `reserve_movements` | UUID + workspaceId + reserveId | `ALLOCATE|RELEASE|TRANSFER_IN|TRANSFER_OUT`, amount, transferGroupId, idempotencyKey |
| `goals` | UUID + workspaceId | reserveId?, targetAmount, targetOn, status, ownerId, version |
| `alerts` | UUID + workspaceId | type, severity, fingerprint, sourceRef, state, occurrenceOn, resolvedAt |
| `alert_preferences` | workspaceId + userId + type | active, leadDays[], quietHours, channels |
| `planning_snapshots` | workspaceId + asOf + scenario | explanation JSON, available, confidence, calculationVersion |

Todas as entidades têm `createdAt`, `updatedAt`; ações de alto impacto possuem `actorId` no log. Indexar workspaceId junto com estado e vencimento. Em todas as relações internas cruzadas verificar workspace também na aplicação e, quando viável, com chaves compostas no banco. CPF/CNPJ opcional protegido e com finalidade explícita.

## Regras do contas a pagar/receber
1. Valores positivos e exatos. Valores de parcela somam valor total original; distribuir centavos para que não haja resíduo.
2. `amountPaid = SUM(settlements.amount)`; `outstanding = max(0, amount - amountPaid)`; uma parcela será `PAID` somente se outstanding=0, `PARTIAL` quando 0 < amountPaid < amount, `OPEN` quando zero, `OVERDUE` derivado de dueOn < data local e outstanding > 0.
3. Liquidação deve ocorrer em transação SQL única: lock do installment, validar saldo aberto, criar `transactions` P01 liquidada, criar `obligation_settlement` e `audit_event`, commit; rollback integral em erro. A criação do lançamento deve reutilizar o motor P01 (nunca criar nova regra de saldo).
4. Toda baixa precisa `Idempotency-Key`; índice único `(workspaceId, idempotencyKey)` no settlement; resposta repetida devolve operação anterior. `transactionId` único em settlement.
5. Estorno/reversão: não excluir registros; acrescentar evento reversor no ledger P01 e settlement reversor de sinal oposto ou status `REVERSED` com rastreabilidade e materialização recalculada. Evitar alteração silenciosa da liquidação.
6. `OVERDUE` é um estado derivado e não um job necessário para alterar uma coluna; status armazenado preferencialmente `OPEN|PARTIAL|PAID|CANCELED` e vencimento calculado para a data consultada.
7. Uma recorrência não gera dois compromissos para mesmo `scheduleId` + `occurrenceDate` + `installmentNo`.

## Projeção do fluxo de caixa
Para o horizonte [D0,Dn] no fuso do workspace:
- `S0` = saldo atual consolidado das contas elegíveis em D0, calculado pelo ledger P01.
- Entradas e saídas liquidadas já integram `S0`, e nunca são somadas novamente.
- `Forecast(D) = S0 + Σ recebíveis ainda em aberto atribuídos até D - Σ pagáveis ainda em aberto atribuídos até D + Σ ajustes hipotéticos do cenário até D`.
- Para parcela parcialmente liquidada, usar somente outstanding futuro, não o valor original.
- Entradas atrasadas não são tratadas como caixa confirmado: padrão Base usa data de recebimento reestimada informada ou as exclui se não houver estimativa válida, com indicador de incerteza.
- Cenário Conservador: entradas apenas de confiança alta explicitamente marcadas, despesas todas + buffer parametrizado. Otimista inclui receitas adicionais prováveis, devidamente rotuladas. Nunca aplicar 'percentual médio' oculto.
- Valores são convertidos para formato de cálculo decimal; exibição em BRL arredondada a centavos.
- Dia crítico é qualquer `Forecast(D) < minimumBuffer`; 'saldo negativo' apenas se < 0.

## Capacidade para reserva (método conservador)
Variáveis: `S` saldo atual de contas elegíveis; `R` total líquido alocado em cofres; `B` colchão mínimo configurado; `Pmin` menor saldo projetado em todo o horizonte de segurança (30/60/90 dias), após pagamentos e recebimentos com confiança declarada; `U` compromissos vencidos não cobertos na projeção (evitar descontá-los duas vezes).

`headroom = max(0, min(S, Pmin) - B - R - U)`.

Observação essencial: em uma implementação com vencidos já deduzidos de `Pmin`, `U=0`; a fórmula exige **desconto único** das obrigações. O relatório de cálculo explicará exatamente quais parcelas foram consideradas. Nenhum headroom positivo é apresentado como investimento garantido; é apenas estimativa de possibilidade de alocação virtual.

`allocatedBalance = Σ reserve_movements assinados` (`ALLOCATE` e `TRANSFER_IN` positivos, `RELEASE` e `TRANSFER_OUT` negativos); transferência entre cofres em duas pernas atômicas de igual montante; `freeCash = S - allocatedBalance` (podendo ser negativo após novos gastos: nesse caso indicar cobertura insuficiente, não alterar movimento histórico).

**Exemplo ilustrativo, sem persistência:** S=10.000, Pmin=7.000, B=2.000, R=1.000, U=0 → headroom=4.000. Nenhum produto de investimento é recomendado por esse cálculo.

Se houver dados incompletos (conta sem reconciliação recente, vencimentos ausentes, valor negativo inesperado, fuso inconsistente), `confidence=LOW|INSUFFICIENT_DATA` e resultado não pode ser anunciado como disponibilidade segura. Um alerta explica os fatores.

## Desempenho
Consultar por workspace e intervalos com índices; montar série diária O(n lançamentos + n dias), paginação para listas, no máximo 366 pontos no gráfico padrão. Cache por workspace + versão dos dados por até 60 s, invalidado por mudanças financeiras, reservas e cenário; saldos/liquidações críticos nunca dependem de cache potencialmente desatualizado.

## Jobs e mensageria
- `generate-recurring-obligations` diariamente no fuso do workspace, com deduplicação persistente e lock; roda conforme engine P01 existente.
- `recompute-planning-snapshot` assíncrono após eventos; recálculo síncrono se snapshot estiver desatualizado na ação de alocar.
- `scan-due-alerts` diário e incremental; deduplicação fingerprint; respeita preferências para comunicação externa.
- Outbox transacional para eventos: persistir evento na mesma transação, publicar após commit, consumidores idempotentes, retry com backoff e fila de falhas; não executar jobs por múltiplas réplicas sem lock/distributed ownership.

## Controle de concorrência
`version` inteiro por entidade para edições otimistas. Movimentos de reserva serializados por workspace (transação serializable, advisory lock ou lock de linha única), recalculam saldo elegível e alocado dentro da mesma transação para evitar duas alocações simultâneas. Se a condição muda, devolver HTTP 409 com saldo atualizado e sugestão de revisão.

## Segurança
Autenticar usuário; autorizar membership ativo de workspace em cada request; validar todas as referências pertencentes ao mesmo workspace; operações sensíveis exigem CSRF conforme estratégia de cookies, rate limit, trilha auditável; anexos em storage privado com URL temporária, antivírus, MIME real validado, limites de tamanho; dados minimizados e retenção configurada. Alertas não devem conter informações financeiras em notificações externas sem preferência e consentimento apropriados. Jobs usam identidade de serviço e escopo explícito.

## Matriz de permissões
| Operação | OWNER | ADMIN | EDITOR | VIEWER |
|---|---|---|---|---|
| Consultar planejamento e reservas | ✓ | ✓ | ✓ | ✓* |
| Cadastrar compromisso/orçamento | ✓ | ✓ | ✓ | — |
| Registrar baixa externa de obrigação | ✓ | ✓ | ✓ | — |
| Criar meta/cofre | ✓ | ✓ | ✓ | — |
| Alocar / liberar reservas | ✓ | ✓ | ✓ | — |
| Alterar regras globais de alertas | ✓ | ✓ | — | — |
| Gerenciar usuários e política de retenção | ✓ | ✓** | — | — |
| Exportar dados | ✓ | ✓ | mediante permissão | mediante permissão |

`*` VIEWER recebe acesso apenas a dados do workspace explicitamente autorizados; dados sensíveis adicionais podem requerer escopo de leitura. `**` ADMIN não pode remover OWNER ou elevar a si próprio de forma indevida.
