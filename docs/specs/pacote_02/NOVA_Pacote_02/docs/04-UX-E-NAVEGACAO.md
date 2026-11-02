# 04 — Layout, componentes e jornadas UX

## Design system NOVA
Fundo `#F4F7FA`, marca `#142D43`, destaque `#69E2C0`, atenção `#F2B766`; cores de saldo/erro com semântica e contraste testado WCAG 2.2 AA. Tipografia Inter ou equivalente; escala 12/14/16/20/24/32; raio 12 a 18 px, espaçamento múltiplos de 4; dark mode não é requisito P02. Números `tabular-nums`, valores monetários alinhados e nunca truncados sem tooltip.

## Layout desktop
Sidebar expansível (240-280 px) e recolhida (64-72 px), topbar com contexto do workspace (PF/PJ), pesquisa, alertas e perfil. Área central `max-width: 1440px`; colunas responsivas. Cada submenu expande no clique com estado persistido localmente; o item ativo traz título, breadcrumb e descrição acessível. Um clique abre rota verdadeira; não exigir novo login por submenu.

## Layout mobile
Drawer de navegação, cards empilhados, tabela em cartões detalhados, CTA 'Novo lançamento' com opções contextualizadas, ações destrutivas com confirmação. Formulários com teclado numérico para valores e data local com seletor acessível. Evitar hover como única forma de revelar informação. Foco de teclado visível e labels completos.

## Wireframe textual — Planejamento
```
[Título Planejamento] [Workspace PF/PJ] [Período] [Cenário]
[Saldo efetivo] [Menor saldo previsto] [Contas 30 dias] [Livre p/ reserva]
[Gráfico saldo dia a dia: real/previsto] [Alertas do horizonte]
[Calendário de vencimentos: mês/semana/lista]
[Orçamento por categoria] [Metas e cofres]
[Explicação do cálculo] [Ações: Novo compromisso / Simular reserva]
```

## Wireframe textual — Cofre
```
[Minhas Reservas] [Criar cofre]
[Saldo financeiro] [Total alocado] [Livre não alocado] [Risco de cobertura]
[Cofre Emergência] [Cofre Objetivos] [Cofre Tributos (PJ)]
[Detalhe: alvo / prazo / progresso / regras / histórico]
[Alocar (virtual)] [Liberar] [Transferir entre cofres]
[Texto: valores reservados não saem da conta bancária]
```

## Wireframe textual — Obrigações
```
[Contas a Pagar/Receber] [Nova conta] [Filtros] [Exportar]
[Em aberto] [Vencidas] [Liquidadas no mês] [Próximos 7 dias]
[Tabela: título, pessoa, vencimento, aberto, status, ações]
[Detalhe -> parcelas -> histórico de baixas -> anexos -> auditoria]
[Modal Baixa: conta, data real, valor, saldo remanescente, confirmar]
```

## Modais e ações
1. `Criar obrigação`: 3 blocos (descrição/partes, recorrência/parcelas, previsão e anexos), prévia de parcelas antes de salvar. Validação detalhada.
2. `Registrar baixa`: resumo do devido, valor pago, conta, data, indicação 'registro de pagamento externo', idempotência e histórico; confirmação única e botão bloqueado durante request.
3. `Criar cofre`: título, finalidade, meta, prazo, prioridade, valores opcionais; versão mínima só com nome e objetivo.
4. `Alocar em cofre`: valor, headroom calculado e data do snapshot; alerta de recalcular se snapshot desatualizado; confirmação esclarece que não haverá transferência bancária.
5. `Liberar alocação`: justificativa e valor, nunca acima do alocado.
6. `Simular cenário`: interface isolada dos dados reais; premissas com badges 'hipotético'.
7. `Revisar conflito`: comparação entre dados no formulário e nova versão no servidor, opções revisar ou cancelar (não sobrescrever automaticamente).

## Notificações
Central persistente no app, contador de não lidas, filtros e 'Ver compromisso'; e-mail/push somente após preferências e consentimento necessários, com conteúdo minimizado, quiet hours, processamento retry e unsubscribe. Não enviar saldos por email por padrão.

## Acessibilidade, localidade e suporte
WCAG 2.2 AA, navegação teclado, leitores de tela com `aria-live` apenas para mensagens relevantes, contraste adequado e gráficos com descrição/tabela alternativa; pt-BR em todos os rótulos, timezone por workspace, formatos `dd/MM/yyyy`, moeda BRL e números em locale. Empty states objetivos: 'Cadastre sua primeira conta', 'Nenhum vencimento registrado', 'Crie seu primeiro cofre'. Não usar dados reais no ambiente de demonstração pública.
