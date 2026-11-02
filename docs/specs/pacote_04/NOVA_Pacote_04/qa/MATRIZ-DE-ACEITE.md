# Critérios de aceite

- [ ] Menu lateral e topbar seguem referência oficial em desktop e mobile, com todas as rotas navegáveis.
- [ ] Novo workspace sem dados mostra R$ 0,00 ou indisponível com texto honesto, nunca números demonstrativos.
- [ ] Conta pessoal não lê dados empresariais; usuário sem membership recebe 403.
- [ ] Insights possuem hipótese, evidência, intervalo, fonte e freshness; score nulo quando insuficiente.
- [ ] Fluxo de caixa não duplica liquidações e não conta transferência como receita.
- [ ] Capacidade de reserva não ultrapassa menor saldo seguro do horizonte e indisponibilidade é tratada.
- [ ] Importação idempotente por provedor, conta e ID externo; duplicatas não regravam ledger.
- [ ] Reimportar CSV não gera movimentação duplicada; revisão é obrigatória.
- [ ] Nenhum segredo de integração aparece em logs, payloads frontend ou relatórios.
- [ ] Consentimento revogado impede nova sincronização; expiração leva a aviso.
- [ ] Falha externa gera status degradado, nunca inventa saldo ou cotação.
- [ ] Alertas deduplicados, configuráveis, respeitam opt-in; registros auditáveis.
- [ ] Assistente não executa movimentações ou recomendações reguladas personalizadas.
- [ ] Comparadores informam tributos, riscos, liquidez e atualizações de fonte.
- [ ] Exportações respeitam autorização e minimização.
- [ ] Typecheck, testes unitários, API, integração, E2E, acessibilidade e restore executados e documentados.
- [ ] Preview aprovado com checklist antes de qualquer produção.
