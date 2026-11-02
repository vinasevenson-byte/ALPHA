# 05 — Implantação, observabilidade, rollback e governança

## Sequência recomendada
**Etapa A — Preparação P01:** auditoria do schema e dos serviços P01; testar autorização e saldo; congelar contratos base e inventariar migrações. Critério: baseline de testes P01 verde.

**Etapa B — Dados:** migrações expansivas para obligations/installments/settlements/reserves/movements/goals/scenarios/alerts/policies; índices e relações; backfill de compromissos P01 com mapas de origem deduplicados, transações, checksum e relatório. Critério: zero duplicatas e conciliação P01×P02.

**Etapa C — Núcleo de obrigações:** CRUD, parcelas, recorrências sem motor paralelo, registro de baixa atomizado e histórico. Critério: pagamento parcial, cancelamento e duplicidade testados com PostgreSQL real.

**Etapa D — Projeção/orçamentos:** motor determinístico com explicações; cenários isolados; calendário, limites e KPIs. Critério: o saldo real jamais muda ao simular.

**Etapa E — Cofres/metas:** alocação virtual, transferências atômicas, concorrência serializável, metas e diagnóstico de cobertura. Critério: nenhum saldo contábil dobrado, dois requests simultâneos não superalocam.

**Etapa F — Inteligência e relatórios:** alertas deduplicados, preferências, jobs, relatórios, eventos e dashboards. Critério: alertas explicáveis e sem notificações repetidas.

**Etapa G — Homologação:** teste E2E PF/PJ, acessibilidade, performance, segurança, dados vazios, monitoramento e rollback; publicar em Preview sob flags, depois produção somente após aceite formal.

## Migração de dados em produção
Executar `expand → deploy compatível → backfill idempotente → validação e auditoria → ativar flags → contract` (remoção de campos velhos apenas em versão futura). Tirar backup/PITR antes; ensaiar restauração. Evitar migrações destrutivas. Se P01 já contém compromissos como transactions pendentes, criar mapeamento `sourceTransactionId` único; futuras consultas P01 devem excluir envelopes P02 duplicados. Jamais migrar saldo com 'ajuste silencioso'.

## Flags
- `planning_v2`: páginas e endpoints de cenários e orçamentos.
- `obligations_v2`: novas telas e liquidação integrada.
- `reserves_v2`: cofres e alocação virtual.
- `alerts_v2`: varredura de alerta e centro de notificações.
- `email_alerts_v2`: **OFF** até configuração de consentimento e provedor.
Toda flag é checada servidor e cliente; OFF devolve estado e mensagem corretos.

## Métricas mínimas
`api_latency_ms{route}`, `api_error_rate`, `settlement_conflicts`, `idempotency_replays`, `reserve_allocation_conflicts`, `projection_compute_ms`, `alerts_generated`, `alerts_deduped`, `job_failures`, `outbox_pending`, `database_pool_usage`. Não usar `workspaceId` em labels de alta cardinalidade, preferir tracing protegido. Logs com requestId, actorId pseudonimizado e contexto mínimo.

## Backup e recuperação
PITR PostgreSQL, testes de restore trimestrais, retenção conforme política e legislação aplicável, exportação auditável, rollback por feature flags primeiro. Se falha em endpoint de baixa, transação rollback completa e nenhuma confirmação de sucesso. Se falha em projeção, exibir 'indisponível' sem inventar saldo. Rollback de código não deve apagar eventos P02; usar migrações compatíveis e suspender jobs.

## Qualidade de entrega
`pnpm lint`, `pnpm typecheck`, `pnpm test`, testes de integração com banco real, testes E2E Playwright nos dois ambientes, `pnpm build` e smoke em Preview. Auditar dependências, validação de anexos, controle de permissões e CSRF. Checklist de segurança contra IDOR, CSRF, injeção, race conditions e exposição de dados no cache.

## Riscos e respostas
| Risco | Mitigação |
|---|---|
| Duplicar compromissos P01 | migração por referência única, reconciliação e dual-read temporário |
| Duplicar baixa em retry | chave idempotente e transação SQL |
| Exibir saldo superestimado | separar saldo real, saldo previsto e alocação virtual, reportar qualidade dos dados |
| Dois usuários alocarem mesmo saldo | serialização por workspace e cálculo atualizado no commit |
| Alertas excessivos | fingerprint, debounce, preferência e limites |
| Cruzamento de dados PF/PJ | autorização e FK por workspace + testes de isolamento |
| Simulação alterando lançamento real | domínio separado e contrato read-only para cenários |
| Dependência indevida de regulador | não ofertar investimento, pagamento ou recomendação regulada neste pacote |

## Não incluso (explicitamente)
PIX e boletos operacionais, ordem de investimento, cotação de mercado em tempo real, consultoria CVM, Open Finance conectado, emissão de nota fiscal, automação de transferência entre bancos, conciliação automática bancária, cartão próprio e rendimentos reais por cofre. Esses recursos exigem projetos e controles próprios.
