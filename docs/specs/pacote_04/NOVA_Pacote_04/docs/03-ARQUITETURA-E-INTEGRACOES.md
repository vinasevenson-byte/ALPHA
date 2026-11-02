# Arquitetura e integrações

## Serviços
`apps/web` Next.js, `apps/api` NestJS Fastify, `packages/domain`, `packages/contracts`, `packages/ui`; PostgreSQL Prisma; fila opcional para ingestão e relatórios; worker idempotente, cron de sincronização com backoff e circuit breaker. Nenhum microserviço obrigatório inicialmente.

## Pipeline de dados
Usuário autoriza -> conexão autorizada recebe token em vault seguro -> job solicita dados conforme escopo -> normalização com provenance -> staging -> validação/anti-duplicação -> conciliação -> aprovação (quando necessária) -> registro no ledger -> atualização de projeção -> insights/alertas.

- Persistir IDs externos apenas com escopo provedor+conta; UNIQUE(workspace, provider, account, external_id).
- Nunca escrever diretamente em saldo agregado: recalcular de lançamentos; registrar ajustes no ledger.
- Sincronizações são idempotentes e incrementais, com checkpoints.
- Tokens sensíveis cifrados com KMS/vault, não em logs ou no cliente; rotação e revogação.
- Webhooks: verificar assinatura, replay window, deduplicação; payload externo tratado como não confiável.
- Integradores Open Finance precisam atender requisitos e convênios aplicáveis. Sem provedor contratado, disponibilizar importação manual e tela 'não integrado'.

## APIs
`/api/v1/workspaces/:workspaceId/...`; exigir autenticação e verificação membership em toda chamada, inclusive jobs e exports. Utilizar cursor pagination, filtros de data, idempotency-key para mutações e request-id. Erros padronizados com código sem informações sensíveis.

## Segurança
RBAC: OWNER, ADMIN, EDITOR, VIEWER, adicional ANALYST somente leitura quando definido; permissões específicas `connections.manage`, `imports.approve`, `insights.read`, `reports.export`, `audit.read`. Audit log append-only.
LGPD: inventário de dados, minimização, consentimento específico onde aplicável, retenção definida, exclusão/anonimização quando legalmente possível, portabilidade, DPA com fornecedores e análise de riscos. MFA recomendado para administradores.

## Indicadores e fonte
Cada snapshot inclui `asOf`, `source`, `status` VERIFIED/ESTIMATED/STALE/UNAVAILABLE e conjunto de premissas. Taxas e preços não podem ser apresentados como atualizados sem consulta confirmada. Dados bancários e cotações são trilhas separadas.

## Observabilidade
Métricas por workspace em agregação sem dados identificáveis: ingestões, atrasos, conciliações pendentes, erro por conector, tempo de resposta, idempotência, alertas gerados e notificações entregues. Alarmes operacionais de fallback e fila parada.
