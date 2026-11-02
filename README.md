# NOVA — Inteligência Financeira (Pacote 01 & Pacote 02)

> *"Seu dinheiro organizado. Seu futuro planejado."*

Implementação completa e integrada das especificações **[NOVA_Pacote_01_Especificacao.md](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/NOVA_Pacote_01_Especificacao.md)** (Fundação e Operação Financeira) e **[NOVA_Pacote_02](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/pacote_02/NOVA_Pacote_02/README.md)** (Planejamento Financeiro Inteligente) para **Pessoas Físicas (`PERSONAL`)** e **Empresas (`BUSINESS`)**.

## 1. Identidade Visual NOVA (WCAG 2.2 AA)
- **Azul Profundo (`#142D43`)**: Marca, navegação lateral e cabeçalhos principais.
- **Verde Menta (`#69E2C0`)**: Destaques de capacidade de reserva, confirmações e progresso.
- **Cinza Claro (`#F4F7FA`)**: Superfície principal limpa e sofisticada.
- **Âmbar (`#F2B766`)**: Indicadores de atenção, compromissos próximos e margens.
- **Tipografia Numérica**: Alinhamento `tabular-nums`, moeda `BRL` (`R$`) e datas no padrão brasileiro (`dd/mm/aaaa`).

## 2. Invariantes Financeiras Implementadas e Testadas (P01 + P02)
1. **Estado Inicial Zerado (`R$ 0,00`)**: Novos workspaces começam sem dados fictícios (*"Aguardando lançamentos"*). Um botão de homologação na barra superior permite alternar instantaneamente entre o estado `R$ 0,00` e a fixture canônica de testes do Pacote 02.
2. **Fórmula de Saldo por Conta (P01)**:
   $$\text{Saldo Atual} = \text{Saldo Inicial} + \text{Receitas Liquidadas} - \text{Despesas Liquidadas} + \text{Transferências Recebidas} - \text{Transferências Enviadas} \pm \text{Ajustes}$$
3. **Transferências Internas Atômicas (P01)**: Geram duas pernas (`TRANSFER_OUT` e `TRANSFER_IN`) na mesma transação de banco de dados, preservando o saldo consolidado do workspace e sem inflar receitas ou despesas.
4. **Obrigações, Parcelas e Baixas Parciais/Integrais (P02)**: Divisão exata em centavos (`splitInstallmentsExact`), impedimento de baixa acima do saldo aberto (`409 OVER_SETTLEMENT`) e vínculo atômico entre `NovaSettlement` e `Transaction` P01 com `Idempotency-Key`.
5. **Motor Conservador de Capacidade de Reserva (`headroom` — P02)**:
   $$\text{headroom} = \max(0, \min(S, P_{\min}) - B - R - U)$$
   Reproduz com exatidão o caso canônico: Saldo atual $S = \text{R\$ } 10.000,00$, Menor saldo projetado $P_{\min} = \text{R\$ } 7.000,00$, Margem de segurança $B = \text{R\$ } 2.000,00$, Reservas alocadas $R = \text{R\$ } 1.000,00 \implies \text{Capacidade adicional para reservar} = \text{R\$ } 4.000,00$.
6. **Cofres Virtuais de Planejamento (P02)**: Movimentos `ALLOCATE`, `RELEASE` e `TRANSFER_IN`/`TRANSFER_OUT` operam em um livro virtual de planejamento sem criar transações bancárias fictícias.

## 3. Como Executar e Testar

```bash
# Executar suíte de testes unitários e de integração (Vitest)
npm.cmd test

# Iniciar servidor de desenvolvimento
npm.cmd run dev

# Build de produção
npm.cmd run build
```
