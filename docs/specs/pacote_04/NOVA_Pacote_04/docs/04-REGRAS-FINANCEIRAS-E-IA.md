# Regras financeiras e inteligência explicável

## Indicadores
- `saldo atual`: somatório ledger liquidado, sem contar pendentes.
- `saldo projetado(D)`: saldo atual + recebíveis previstos não liquidados até D - contas previstas não liquidadas até D; evitar duplicatas.
- `patrimônio líquido`: caixa + ativos com valor conhecido no mesmo asOf - passivos conhecidos; se componentes relevantes ausentes, mostrar parcial e rotular.
- `capacidade de reserva`: max(0, menor saldo projetado no horizonte - caixa mínimo protegido - reservas já vinculadas - ajustes de incerteza); exigir projeção completa e consistente, senão indisponível.
- `taxa de poupança`: (receitas realizadas - despesas realizadas)/receitas realizadas, se receita >0; transferências e aplicações não contam como despesa.
- `índice saúde financeira` (transparente): notas ponderadas de liquidez 30%, pontualidade 25%, orçamento 20%, reserva 15%, concentração 10%. Sem suficientes dados, retornar nulo; pesos ajustáveis com versionamento e documentação.

## Anomalias
Comparar gastos categoria por meses com mínimo de histórico; medianas robustas ou regras explícitas, evitar falso positivo em despesa anual/parcelada. Alertas são apoio e não acusação. Explicar período e base usados; permitir dispensar/feedback.

## Projeções
Cenário conservador, base e otimista com premissas configuráveis, sem inventar rendimentos ou receitas. Sempre separar observações de hipóteses e simulações.

## Investimentos
Nada de ranking universal 'mais rentável'. Comparar líquido após taxa, tributo, carência, prazo, risco, custos, liquidez e adequação de horizonte. Cotações com `asOf` e origem. Sem recomendação individualizada regulada nem ordens automatizadas. Atualizar regras tributárias por versão e data de vigência, não constantes imutáveis.

## IA e confiança
Entrada estruturada de ferramentas read-only com consultas autorizadas, evidência por indicador, validação de tipos e controle de PII; logs de justificativas minimizados. Prompt e modelo podem mudar; números vêm do motor determinístico e não são calculados pelo LLM.
