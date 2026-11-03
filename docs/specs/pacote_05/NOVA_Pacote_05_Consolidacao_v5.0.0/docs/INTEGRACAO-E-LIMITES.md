# Plano de convergência P01–P04

## Matriz de integração

| Origem | Núcleo canônico | Status na prévia local | Próxima integração de produção |
|---|---|---|---|
| P01 Contas, movimentos, fluxo | Contas + tx | Fluxos locais funcionais | Prisma/PostgreSQL, autenticação e ledger |
| P02 Compromissos e reservas | tx pendente + reserva virtual | Funcional simplificado | Parcelas, recorrências e metas completas |
| P03 Investimentos | Posições manuais | Cadastro e patrimônio manual | Provedores de preço, tributação e liquidez |
| P04 IA / alertas / integrações | Projeção + risco | Alertas explicáveis básicos | Consentimento Open Finance e assistente seguro |

## Padronização monetária
Os arquivos anteriores usam `bigint` e `number` para centavos. O serviço canônico utilizará centavos inteiros exatos (`bigint`) no domínio e representação decimal string na API. A prévia usa a mesma regra em cálculos, mas o gráfico de interface converte para número para exibir, o que NÃO deve ser usado para dados financeiros ou valores muito altos.

## Backlog de produção P05
1. Migrações Prisma transacionais com FKs compostas por workspace.
2. Sessão autenticada, RBAC, CSRF e checagem de participação em cada endpoint.
3. Ledger de dupla entrada para movimentos, reservas e posições.
4. Recorrências e parcelas idempotentes, calendários por timezone e projeção dia a dia.
5. Conciliação banco/ledger com diferenças auditadas.
6. Preços históricos e atuais, tributos versionados por tipo de produto e titular.
7. Alertas/IA com evidências rastreáveis e separação de simulação versus execução.
8. E2E, integração em PostgreSQL, build Next/Nest, Preview seguro, revisão de segurança e publicação.
