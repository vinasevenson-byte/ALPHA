# 01 — Especificação funcional integral

## Objetivo
Tornar o organizador financeiro NOVA proativo: mostrar obrigações com antecedência, projetar caixa por cenário, separar reservas por objetivos, administrar orçamentos e sugerir ações de planejamento verificáveis. Atender pessoa física e empresas com os mesmos mecanismos centrais e detalhes próprios para cada público.

## Taxonomia de navegação (P02)

```
Visão Geral
Contas e Carteiras             [P01]
Movimentações                  [P01]
Planejamento                   [expansível]
  ├─ Visão de Planejamento
  ├─ Orçamento e Categorias
  ├─ Calendário Financeiro
  ├─ Cenários de Fluxo de Caixa
  └─ Metas Financeiras
Contas a Pagar                 [P01 aprimorado]
  ├─ Em Aberto / Vencidas
  ├─ Recorrências
  └─ Histórico de Pagamentos
Contas a Receber               [P01 aprimorado]
  ├─ A Receber / Em Atraso
  ├─ Recorrências
  └─ Histórico de Recebimentos
Reservas                       [novo]
  ├─ Visão Geral
  ├─ Cofres / Objetivos
  ├─ Regras de Alocação
  └─ Movimentos de Alocação
Inteligência Financeira        [novo]
  ├─ Central de Alertas
  ├─ Diagnóstico do Mês
  └─ Recomendações de Organização
Relatórios                     [P01 ampliado]
Configurações / Permissões     [P01 ampliado]
```

Menus inacessíveis por permissão não são exibidos; digitar a URL não deve ultrapassar autorização no backend. Nenhum submenu requer um segundo login quando a sessão do workspace está válida.

## Tela A — Planejamento / Visão Geral (`/app/:workspaceId/planejamento`)
**Topo:** seletor do workspace; horizonte 7/30/90/365 dias; período customizado; seletor Base/Conservador/Otimista; indicador de última atualização e legenda realizado/previsto.
**KPIs:** saldo financeiro efetivo, compromissos a pagar, recebimentos previstos, menor saldo diário no horizonte, sobra conservadora projetada, valor alocado em reservas e valor livre estimado (não igual ao saldo bancário).
**Widgets:** gráfico de saldo diário, timeline de contas críticas, categorias acima do orçamento, metas atrasadas, sugestões de planejamento e CTA para registrar vencimento.
**Drill-down:** clique em compromisso abre detalhes; clique em menor saldo abre dia correspondente; clique em orçamento filtra categoria. Sem dados: cartão zero e explicação de como cadastrar conta/lançamento. Não mostrar rentabilidade nem 'investimento recomendado' antes de fontes reais.

## Tela B — Contas a Pagar (`/app/:workspaceId/contas-a-pagar`)
Filtros por status (rascunho, em aberto, vencida, parcialmente paga, paga, cancelada), competência, vencimento, categoria, contraparte, conta prevista, centro de custo (PJ), pesquisa e valor. Visões tabela, calendário e agrupada por semana. Colunas: descrição, fornecedor/beneficiário, parcela, valor total, saldo em aberto, vencimento, atraso, recorrência, status, categoria, conta e ações.
**Ações:** cadastrar obrigação, salvar rascunho, programar, editar antes da liquidação, registrar pagamento parcial ou integral, adiar vencimento com justificativa, cancelar com motivo, anexar comprovante e exportar. Baixa é **registro contábil de pagamento efetuado fora do sistema**; nunca dispara pagamento bancário.
**Formulário:** descrição, valor, categoria, contraparte, frequência, número de parcelas e datas, conta de liquidação, competência, vencimento, observações, anexo (tipo/tamanho permitido), tags, centro de custo PJ; confirmação das alterações em série com opção 'somente esta / esta e futuras'.
**Regras:** obrigatoriedade de valor positivo; nenhuma parcela vence antes da data mínima definida sem aviso; não permitir baixa maior que saldo aberto; não aplicar atraso automaticamente em dias feriados sem calendário oficial; pagamentos parciais geram liquidações ligadas ao compromisso sem duplicar débito; cancelar item parcialmente pago exige regra especial de reversão e auditoria.

## Tela C — Contas a Receber (`/app/:workspaceId/contas-a-receber`)
Mesmo comportamento de pagar, com cliente/pagador e método de recebimento esperado. Status incluindo recebido parcialmente e vencido. Ao confirmar recebimento real, registrar lançamento de entrada uma única vez, vinculado ao compromisso; data de crédito efetivo pode divergir do vencimento. PJ inclui identificador externo de cobrança e centro de receita, mas **não** gera nota fiscal ou boleto neste pacote.

## Tela D — Calendário Financeiro (`/app/:workspaceId/planejamento/calendario`)
Visualizações mês/semana/lista; cada data mostra entradas/saídas previstas, saldo projetado no fechamento diário, dias críticos em destaque e agrupamento por workspace. Filtros por compromissos, recorrências, categorias, conta e alertas. Contas em atraso aparecem com data de vencimento original e sinalização 'vencida'; nunca são deslocadas silenciosamente para hoje. Clique no dia abre painel com itens, total líquido e ações. Fusos aplicados na data local financeira, eventos técnicos mantidos em UTC.

## Tela E — Orçamento Inteligente (`/app/:workspaceId/planejamento/orcamentos`)
Criar teto por categoria, por mês, por centro de custo PJ ou orçamento geral. Campos: valor, moeda, início/fim, tipo rígido/informativo, regra de transposição opcional para mês seguinte e notificações em 70/90/100% configuráveis. Exibir planejado, realizado, comprometido ainda não liquidado, saldo de orçamento e previsão até fim do mês.
Orçamento 'rígido' **alerta**, mas não bloqueia baixa/registro de despesa já feita; bloqueio de ações críticas seria escopo futuro com política explícita. A mesma despesa não pode contar duas vezes (valor de compromisso + lançamento de quitação). Percentual = realizado ÷ teto quando teto > 0; teto zero mostra 'sem limite definido'. Suportar categorias hierárquicas sem dupla contagem pai/filho.

## Tela F — Cenários (`/app/:workspaceId/planejamento/cenarios`)
Cenários Base, Conservador e Otimista; edição de premissas sem alterar dados reais. Componentes: entradas incertas ponderadas, despesas não obrigatórias, despesas extras futuras, adiamento hipotético e mudança de vencimento hipotética. Premissas pertencem a um `scenario_id`, têm autor e podem expirar. Cenário base usa valores conhecidos sem probabilidade fictícia. Conservador subtrai contingência parametrizada e inclui apenas recebimentos marcados 'alta confiança' (critério explícito); otimista inclui recebimentos de confiança média, marcado como não garantido. Visualizar três linhas de saldo e tabela das premissas; nunca gravar simulações como transações.

## Tela G — Reservas (`/app/:workspaceId/reservas`)
**Resumo:** saldo financeiro real, valor total alocado, valor ainda não alocado, metas por prazo, dias até vencimento das metas e indicador 'cobertura de despesas essenciais'. Não mostrar reserva como saldo adicional ao caixa.
**Cofre:** criar objetivo com nome, tipo (emergência, viagem, impostos, educação, capital de giro, customizado), valor-alvo, data-alvo opcional, prioridade, conta de referência opcional, aporte desejado, risco desejado apenas como campo de planejamento (não ordem de investimento), cor/ícone e status.
**Ações:** alocar dinheiro virtual do saldo disponível, retirar alocação, transferir alocação entre cofres, suspender meta, concluir/arquivar e adicionar notas; permitir autoalocação apenas em modo 'sugestão' por padrão. Ao usar valor reservado para pagar algo, reduzir a alocação com operação explícita; o pagamento em si ocorre no módulo financeiro P01. Não prometer segregação bancária.
**Restrições:** total alocado em todos os cofres ≤ saldo elegível positivo do workspace definido pela política de cálculo; se uma despesa posterior reduzir saldo elegível, sinalizar déficit de cobertura, não modificar reservas em silêncio; uma meta pode receber aportes menores que o sugerido. PJ permite cofre 'tributos' e 'capital de giro'.

## Tela H — Motor de sugestões de reserva
**Entradas:** saldo liquidado, contas vencidas, obrigações nos 30/60/90 dias, recebimentos confirmados e incertos, categoria essencial, despesas essenciais históricas, margem de segurança, dívidas caras cadastradas e alocações existentes.
**Saídas:** capacidade de reserva conservadora, justificativa item a item, nível de confiança, avisos e botão 'Simular' / 'Alocar' (registro virtual com confirmação, jamais movimentação de dinheiro). Fórmula e exemplos no documento de arquitetura.
**Critérios:** não propor capacidade positiva se o saldo projetado conservador ficar negativo; não tratar recebimento provável como realizado; indicar dados insuficientes em vez de concluir que é seguro investir; alertar sobre dívidas de custo alto sem recomendação financeira individualizada.

## Tela I — Metas (`/app/:workspaceId/planejamento/metas`)
Metas com valor objetivo, data, prioridade, regra de aporte, tags, status e histórico. Progresso = total de alocações vinculadas / alvo; simulação da necessidade mensal = (objetivo - alocado) / meses restantes, sem assumir retorno; metas vencidas mantêm histórico. Pode vincular meta a cofre (preferencial) e evitar duplicidade. Ações: criar, pausar, editar, mudar prazo e concluir.

## Tela J — Central de Alertas (`/app/:workspaceId/inteligencia/alertas`)
Tipos: `DUE_SOON`, `OVERDUE`, `CASH_SHORTFALL`, `BUDGET_THRESHOLD`, `RESERVE_UNDERFUNDED`, `RESERVE_OVERALLOCATED`, `DUPLICATE_SUSPECTED`, `UNUSUAL_OUTFLOW`. Severidade info/aviso/crítico. Inbox de alertas com filtros, estado novo/lido/dispensado/resolvido, 'ver origem', opção silenciar tipo por período e preferências por usuário.
Alertas de prazo de vencimento com 7/3/1 dia configuráveis; saldo negativo projetado só é disparado se dados mínimos presentes e cenário identificado; evitar duplicatas com fingerprint estável (tipo + workspace + origem + período + severidade). Não expor descrição financeira em push externo sem consentimento.

## Tela K — Diagnóstico mensal (`/app/:workspaceId/inteligencia/diagnostico`)
Resumo auditável: variação de despesas por categoria, recorrências novas, meses de cobertura de emergência, contas atrasadas, risco projetado de caixa, metas comprometidas e ações recomendadas de organização. Linguagem não alarmista, explicações rastreáveis e aviso de limitação quando faltam dados. Nenhuma indicação nominal de produto de investimento no P02.

## Tela L — Relatórios P02
Relatórios: previsão vs realizado; compromissos por vencimento; aging de contas a receber (PJ: 0-30/31-60/61-90/>90 dias); histórico de alocação de reservas; metas e orçamentos; cenário de liquidez. Exportar CSV com controle por permissão, identificação de workspace, período e horário de geração. Não exportar CPF/CNPJ desnecessariamente. PDF opcional futuro.

## Diferenças PF / PJ
- PF: categorias domésticas, salário, metas pessoais, reserva de emergência, despesas essenciais e visão por família só se participação autorizada.
- PJ: clientes/fornecedores, centro de custo, competência, aging de recebíveis, reserva de tributos e capital de giro, relatórios por unidade, aprovação **opcional** de alterações de regras de autoalocação (sem pagamentos).
- Não converter dados PF→PJ automaticamente; mudar workspace exige autorização, e toda consulta preserva escopo.

## Estados de UX para cada tela
Carregando com skeleton; vazio com CTA; sem permissão com 403 localizável; erro de servidor com código e 'tentar novamente'; conflitos com dados atualizados e pedido de revisão; offline com leitura em cache explicitamente marcada como não atualizada (sem gravar financeiramente offline); sucesso com confirmação só após resposta do backend; formulário com erros por campo e proteção contra clique duplo.

## Eventos de domínio
`obligation.created|updated|due_changed|settled_partially|settled|canceled`, `budget.limit_changed|threshold_crossed`, `reserve.created|allocated|released|transfer_allocated|coverage_warning`, `goal.created|updated|completed`, `scenario.created|recalculated`, `alert.raised|resolved|dismissed`. Registrar requestId, actorId, workspaceId, entityId e timestamp, nunca segredos, sem eventos financeiros 'fantasma'.
