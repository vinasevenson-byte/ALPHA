# QA — Critérios de aceite e matrizes de teste do Pacote 02

## Gate de entrada
- [ ] P01 login, workspace RBAC, ledger e lançamentos funcionais e testados.
- [ ] P01 saldo real e projeção base conciliam com os lançamentos persistidos.
- [ ] Schema e migrações do P02 harmonizados com nomes reais do P01.
- [ ] Feature flags off por padrão e ambiente Preview isolado de produção.

## Funcionais (PF/PJ)
- [ ] Incluir compromisso de pagar e receber com 1 e N parcelas; somatório exato com centavos.
- [ ] Recorrência não gera duplicidade após reinício/retry do job.
- [ ] Registrar baixa parcial e integral, com vínculo explícito a uma transação P01.
- [ ] Tentar baixa acima do restante gera 409 e nenhum lançamento parcial persistido.
- [ ] Repetir baixa com mesma Idempotency-Key retorna mesma operação, sem duplicar saldo.
- [ ] Marcar conta vencida não altera o vencimento original.
- [ ] Calendário agrega eventos na data local do workspace (virada de fuso/horário de verão histórico).
- [ ] Simulação de cenário muda somente projeção; saldo real permanece igual.
- [ ] Alocação virtual em cofre reduz livre planejado mas não gera transferência/receita/despesa.
- [ ] Transferir entre cofres movimenta duas pernas atômicas com total alocado constante.
- [ ] Gastar saldo real após alocar sinaliza déficit sem apagar a alocação histórica.
- [ ] Metas e orçamento não contam duas vezes o mesmo compromisso e sua liquidação.
- [ ] Alerta 7/3/1 dias não duplica em reprocessamento; dispensar é persistido.
- [ ] Dashboard começa zerado e vazio sem contas cadastradas.
- [ ] Filtros e deep links levam ao conteúdo esperado; nenhum submenu pede novo login.

## Matemática e consistência
- [ ] Valores exatos: 0,01, 0,03, 999999999,99; limites de Decimal e tolerância 0 centavos.
- [ ] `headroom` não é positivo quando o menor saldo conservador fica abaixo de buffer+alocação.
- [ ] Receita já liquidada não entra novamente como prevista.
- [ ] Pagamento parcial usa apenas valor aberto na projeção.
- [ ] Vencidos excluídos/incluídos uma única vez conforme explicação de cálculo.
- [ ] Categorias pai/filho não geram dupla contagem.
- [ ] Multiusuário: dois requests simultâneos de alocação não excedem saldo elegível.

## Segurança, privacidade e resiliência
- [ ] Usuário de workspace A não lê ou grava dados de B mesmo com IDs válidos (IDOR).
- [ ] VIEWER não cria compromisso, liquida, edita cofre nem altera política.
- [ ] CSRF bloqueado quando cookies são autenticação; sessão expirada retorna 401.
- [ ] Anexos privados, limite de tamanho, content-type validado, URL expira e audita acesso.
- [ ] Logs não guardam credenciais nem dados financeiros completos.
- [ ] Falha no banco após criar transação e antes de criar settlement provoca rollback total.
- [ ] Retry de fila/outbox e failover não produzem liquidações/alertas duplicados.
- [ ] API 500 nunca retorna saldo estimado como se fosse confirmado.
- [ ] Navegação teclado, contraste WCAG AA, leitor de telas e gráfico com alternativa tabular.

## Performance e release
- [ ] Lista 10 mil compromissos paginada sem carregar tudo em memória do browser.
- [ ] Projeção de 365 dias em dataset de teste atende SLO definido e monitorado.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, E2E, integrações reais PostgreSQL e build verdes.
- [ ] Smoke test Preview em PF e PJ, rollback testado com flags off.
- [ ] Aprovação explícita para ativar produção; nenhum dinheiro real foi movimentado.

## Dados de teste
Fixtures **somente em banco de testes**: contas PF/PJ, 100 compromissos, meses com atraso, baixa parcial, cenários e dois usuários simultâneos. Limpar automaticamente fixtures após os testes. Jamais pré-preencher dados demo no banco produtivo.
