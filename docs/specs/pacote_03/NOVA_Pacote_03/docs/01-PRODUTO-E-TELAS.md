# 01 — Produto, navegação e telas

## Menu lateral
Investimentos (expansível): **Visão Geral, Minha Carteira, Operações, Comparador de Aplicações, Rentabilidade, Liquidez e Riscos, Simulador Patrimonial, Metas e Reservas, Relatórios, Fontes e Atualizações**. Admin: **Parâmetros Fiscais, Integrações, Auditoria**. Cada menu deve possuir tela real, filtro persistente em URL, breadcrumbs, estado vazio, carregando e erro com retry.

## Dashboard `/app/[workspaceId]/investimentos`
Cabeçalho (workspace PF/PJ, período, fonte e horário de atualização). KPIs: patrimônio investido, custo de aquisição, retorno bruto acumulado, retorno líquido estimado, resultado realizado, rendimentos distribuídos, valor disponível para resgate e vencimentos próximos. Gráfico patrimônio vs aportes líquidos por data (não apresentar TWR como se fosse lucro). Composição por classe, emissor e instituição; calendário de vencimentos; alertas; detalhamento e exportação. Sem carteira, todos os indicadores R$ 0,00 e nenhum gráfico fingindo resultados.

## Minha Carteira `/investimentos/carteira`
Tabela com ativo, tipo, instituição, indexador, taxa, quantidade, custo, valor atual, retorno, vencimento, liquidez e última cotação. Alternar agrupamento por classe/emissor/instituição/moeda. Ações: cadastrar ativo, cadastrar aporte, venda/resgate parcial, rendimento, taxa, ajuste com justificativa, importar extrato CSV com validação e prévia, detalhes do lote. Nunca excluir operação liquidada silenciosamente; cancelar/estornar com evento compensatório e auditoria.

## Operações `/investimentos/operacoes`
Filtros por período, ativo, conta financeira, categoria (aplicação, resgate, provento, taxa, ajuste, amortização, vencimento), status e origem. Modal de cadastro: data operação, data liquidação, quantidade, PU, valor, tarifas, instituição, conta origem/destino, idempotency key; tela de revisão + confirmação antes de persistir. Operação de investimento não é receita/despesa do fluxo de caixa; rendimentos realizados são receitas financeiras; taxas e tributos são despesas próprias. Aportes/resgates preservam total patrimonial no momento da transferência.

## Comparador `/investimentos/comparador`
Filtros: valor, horizonte, liquidez necessária, classe, emissor, risco, FGC, tributação, taxa líquida, custo, mínimo, vencimento e fonte. Cards com retorno projetado bruto/líquido, taxa efetiva, premissas, tributação estimada, cenário de resgate, risco de crédito e data/hora da cotação. Ordenações: maior retorno líquido estimado, menor risco, liquidez, vencimento. Não declarar 'melhor para você' sem conformidade para aconselhamento. Cada ranking explica critérios. Produto sem cotação vigente = indisponível para ranking em tempo real, com estado explícito.

## Rentabilidade `/investimentos/rentabilidade`
Séries temporais de retorno absoluto, retorno percentual TWR quando cotas/valorações confiáveis, XIRR com fluxos datados, benchmarks CDI/IPCA/Selic quando fonte válida. Separar ganho realizado e não realizado; retorno antes/depois de custos e impostos estimados; séries de índices não são equivalentes a retornos líquidos pessoais. Mostrar avisos de cobertura parcial e preços defasados.

## Liquidez e Risco `/investimentos/riscos`
Escada de liquidez por D+0, D+1, D+N, carência, vencimento e restrição contratual; concentração por emissor, instituição e classe; limites de garantia por CPF/CNPJ e conglomerado quando cadastro suficiente; marcação a mercado e risco de perda em resgates antecipados. Classificação de risco deve trazer metodologia, origem, data e 'não classificado' quando faltarem dados; não supor garantia pública para fundos, títulos públicos ou ações.

## Simulador `/investimentos/simulador`
Aporte inicial, aportes programados (dia e frequência), horizonte, rentabilidade esperada anual com cenários editáveis, inflação, custos, impostos por tipo de produto, disponibilidade do fluxo de caixa e política de reajuste de aportes. Resultados: total aportado, juros compostos, patrimônio bruto, patrimônio líquido estimado, poder de compra, e séries com intervalo de premissas. Cenários não são previsões ou promessas. Avisos de liquidez, déficit de caixa, impostos e inflação; salvar cenário versionado sem confundir com posição real.

## Metas e Reservas `/investimentos/metas`
Vincular objetivos Pacote 02 a carteiras, sem duplicar dinheiro. Reservas virtuais são alocação contábil/lógica; posição em corretora pertence à mesma base patrimonial. Priorizar cobertura de contas futuras antes de sugerir aportes. Expor recomendação *informativa* sobre diferença entre reservas de liquidez e investimentos longos.

## Fontes `/investimentos/fontes`
Saúde de conexão e cobertura, fonte, horário de atualização, licença, atrasos, cotações faltantes, troca de provedor; nunca oferecer botão de sincronização fingida. Administração controla credenciais e refresh server-side.

## PF vs PJ
PF: pessoa e família (se concedido), objetivos e carteira privada. PJ: entidades, contas corporativas, políticas de tesouraria, perfil por função, aprovação para alterações financeiras; regras fiscais PF não são aplicadas automaticamente a PJ. Comparações fiscais PJ somente mediante regime e regras parametrizadas, senão mostrar 'estimativa indisponível'.
