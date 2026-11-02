# 04 — Entregas, dependências e rollout

Fase A: contratos com pacotes anteriores, workspace guard, entidades, migração aditiva, fixtures de teste isoladas. Fase B: carteira, operações e importação com preview/idempotência, integração de ledger e reconciliação. Fase C: dados de mercado com provedores habilitados, observabilidade, painel de fontes e política de preço defasado. Fase D: indicadores e retornos corretos com testes unitários de lote/custos/corporate actions, comparar ofertas com impostos e elegibilidade configuráveis. Fase E: riscos, liquidez, concentração e relatórios com contexto PF/PJ. Fase F: simulador, metas e projeções financeiras conectadas; homologação de usabilidade e acessibilidade.

## Rollout
1. Banco backup/snapshot e migrations revisadas. 2. API em Preview com escrita desativada. 3. Smoke E2E read-only. 4. Habilitar cadastro em workspace de homologação. 5. Importações e reconciliação. 6. Medir performance e segurança. 7. Produção após aprovação formal; ativação gradual e telemetria.

## Rollback
Desativar `feature flags`, interromper importações e jobs, preservar log e trilha de auditoria, restaurar versão API/WEB anterior; não realizar downgrade destrutivo de tabelas. Correções financeiras por operações compensatórias auditadas, não por edição direta silenciosa.

## DoD
`lint/typecheck/test/build` verde, migrations aplicadas em banco descartável, testes E2E em PF/PJ, sem cross-tenant leak, zero saldo fabricado, casos de cálculos confrontados com planilha independente, contrato de mercado com SLA/licença/limitação documentados, telas de erro e fonte expostas. Sem produção neste pacote entregue.
