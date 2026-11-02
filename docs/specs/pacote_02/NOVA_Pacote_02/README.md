# NOVA — Pacote 02: Planejamento, Compromissos, Reservas e Inteligência Preventiva

**Versão:** 2.0.0 (especificação e módulo de regras de referência)  
**Data-base:** 01/11/2026  
**Status:** pronto para implementação e homologação; **não instalado, não publicado, sem integrações financeiras reais**.

Este pacote é independente de qualquer projeto anterior e estende **somente** a arquitetura proposta no Pacote 01 da NOVA. Não substitui o Pacote 01, nem pressupõe que ele foi implantado.

## Entregáveis

| Arquivo | Conteúdo |
|---|---|
| `docs/01-ESPECIFICACAO-FUNCIONAL.md` | Telas, menus, fluxos completos PF/PJ, regras e estados |
| `docs/02-ARQUITETURA-E-DADOS.md` | Integração com P01, modelagem, invariantes, jobs, segurança |
| `docs/03-API-E-CONTRATOS.md` | Endpoints, payloads, validação, erros, paginação e idempotência |
| `docs/04-UX-E-NAVEGACAO.md` | Layout, acessibilidade, empty/loading/error states, modais |
| `docs/05-IMPLANTACAO-E-OPERACAO.md` | Fases, migrações, métricas, feature flags, rollback |
| `schemas/pacote02.prisma` | Modelos Prisma adicionais **de referência** a mesclar no schema principal |
| `contracts/openapi-pacote02.yaml` | Contrato HTTP OpenAPI de referência, parte da API v1 |
| `domain/src/planning.ts` | Funções TypeScript puras para cálculos de planejamento |
| `domain/test/planning.test.ts` | Testes Vitest para invariantes críticas |
| `qa/CRITERIOS-DE-ACEITE.md` | Cenários de teste, provas de cálculo, segurança e E2E |

## Premissas e limites

- O Pacote 01 fornece usuários, workspaces, contas, lançamentos, categorias, recorrências básicas, budgets e auditoria. O Pacote 02 **evolui e reutiliza** esses conceitos, em vez de criar duplicatas contábeis.
- Tela, menus e mensagens em pt-BR; BRL como moeda principal, datas locais por workspace e dinheiro preciso com `Decimal` no servidor.
- Nenhum valor fictício persistido; instalação começa sem dados. Exemplos no contrato são somente ilustrativos.
- **Não movimenta dinheiro:** 'pagar', 'receber', 'alocar', 'transferir para cofre' e 'aplicar' são ações de registro/planejamento, nunca PIX, boleto, resgate bancário ou operação com ativos.
- Reserva é uma **alocação virtual** sobre saldo já existente, não uma segunda conta financeira e não gera receita/despesa. Se houver transferência real entre contas, usar transferência do Pacote 01 separadamente.
- Recomendações são **diagnósticos de planejamento e educação financeira**; comparação de investimentos com cotações em tempo real e consultoria individualizada ficam em Pacotes futuros, condicionados a controles regulatórios.
- Adequar schema ao pacote P01 efetivamente implementado antes de migrar; campos e nomes de referência podem exigir adaptação.

## Dependências de entrada

1. P01 com autorização de `workspaceId` no backend, ledger/lançamentos, transações atômicas, auditoria e idempotência.
2. Definição única de datas (`DATE` local para vencimentos, `TIMESTAMPTZ` UTC para eventos), arredondamento e versão das entidades.
3. Feature flags por workspace: `planning_v2`, `reserves_v2`, `alerts_v2`.
4. Operações P02 ficam bloqueadas com erro `P01_NOT_READY` se os serviços-base não estiverem disponíveis.

## Como utilizar

1. Revisar `docs/01`, `docs/02` e `schemas/pacote02.prisma` com o schema real do P01.
2. Implementar rotas segundo `contracts/openapi-pacote02.yaml` e `docs/03`.
3. Incorporar funções de `domain/src` ao pacote de domínio e executar testes com Vitest (o arquivo isolado não é uma aplicação completa).
4. Implantar por migração expansiva e flags conforme `docs/05`.
5. Aprovar somente após os critérios de `qa/CRITERIOS-DE-ACEITE.md`.
