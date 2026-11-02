# 02 — Regras financeiras e matemáticas

## Invariantes
1. Escrituração de investimentos por operações imutáveis + correções compensatórias, com `workspaceId`, origem, idempotencyKey e precisão decimal.
2. Posição = soma de quantidades por operações efetivadas; lotes por compras, vendas abatendo lotes conforme regra por produto e jurisdição. Nunca permitir quantidade negativa sem instrumento explicitamente suportado.
3. Custo de aquisição deve seguir política de lote específica; primeiro recorte usa custo médio para simples ações/cotas e identificação de lote para renda fixa, sem confundir regimes tributários.
4. Valor de mercado = unidades × preço válido em data; preço ausente resulta valor de mercado 'indisponível', nunca valor inventado; PU tem moeda, fonte, timestamp, método (observado/estimado), validade.
5. P&L não realizado = valor atual − custo remanescente; realizado = contrapartida de alienação − base de custo baixada − custos e tributos atribuíveis; proventos em rubrica independente.
6. Patrimônio total = saldos de contas + posições de investimento com tratamento explícito de liquidação/caixa de corretora e sem dupla contagem. Reserva virtual não soma patrimônio.
7. Nas aplicações, fazer transferência da conta corrente para conta de investimentos/clearing; resgate faz o inverso, reconhecendo ganho/perda separadamente. Não somar aporte como despesa operacional.
8. Obrigações futuras do Pacote 02 podem limitar quantia livre para aplicar; um simulador não deve autorizar movimentação real.

## Indicadores
- `retornoBruto = valorBrutoResgate − principal`, após taxas capitalizadas conforme instrumento.
- `retornoLiquidoEstimado = retornoBruto − impostosEstimados − custos`, sem tributar principal. Imposto somente sobre base tributável positiva, observadas regras do tipo e fato gerador.
- `taxaEfetivaAnual = (valorFinal / valorInicial)^(365/dias) − 1` para investimento único sem aportes adicionais e dias>0.
- CAGR não é taxa ponderada por fluxos; usar XIRR (fluxos datados, múltiplas raízes/sem solução sinalizadas) e TWR por subperíodos quando houver valuations.
- Indexadores percentuais do CDI exigem série observada ou cenário explícito; não usar taxa Selic como equivalente automático de CDI. IPCA+ requer curva de inflação assumida ou preços válidos.
- Resgate antecipado de Tesouro IPCA+/Prefixado exige marcação a mercado: taxa contratada não define seu preço de saída.

## Impostos parametrizados
Tabela regressiva geral de renda fixa de PF conforme tabela Receita Federal consultada para 2026: até 180 dias 22,5%; 181–360 20%; 361–720 17,5%; mais de 720 dias 15%. A regra deve ter intervalo de vigência, fonte, instrumento aplicável, jurisdição e perfil (PF/PJ). IOF para resgate muito curto exige tabela vigente separada; enquanto não configurada, não retornar 'líquido exato' até 30 dias. Regimes específicos: LCI/LCA PF (verificar vigência e elegibilidade), fundos com come-cotas, renda variável, PJ Simples/Lucro Presumido/Lucro Real — **não** usar taxa genérica de renda fixa para esses casos. No comparador, exibir 'tributação não suportada' e ocultar resultado líquido se regras faltarem. Custos podem ser corretagem, custódia, gestão, performance e spread; modelar por produto, taxa e data.

## Liquidez
Liquidez contratual e liquidez realizável são diferentes: D+0, D+1, prazo maior e mercado secundário dependem de calendário útil, cutoff, carência e condições. Não confundir prazo de cotização com pagamento. Vencimento futuro não significa resgate antecipado livre.

## Risco
Metadados: rating com agência e data quando disponível, exposição emissor/conglomerado, limites contratuais, mercado, crédito, liquidez, concentração e prazo. Exposição FGC apenas para instrumentos cobertos e conforme titularidade e regras vigentes, nunca como garantia universal. Resultado qualitativo não substitui análise regulada de adequação.

## Simulador
Capitalização mensal de taxa anual efetiva: `r_m=(1+r_a)^(1/12)-1`; contribuições ao fim do mês: `FV=P(1+r_m)^n + A*((1+r_m)^n-1)/r_m`. Com impostos, os valores por lote e datas são relevantes; fórmula simplificada só produz montante bruto de cenário. Valor real ≈ `FV/(1+inflacao)^(anos)` sob inflação constante hipotética. Taxas negativas > -100% são permitidas, sem assumir ganho. Mostrar aportes versus rendimentos e validar meses/valores e precisão.
