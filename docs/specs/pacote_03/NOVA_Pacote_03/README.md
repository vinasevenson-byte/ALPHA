# NOVA — Pacote 03 | Investimentos e Rentabilidade
Versão 3.0.0 • 01/11/2026 • especificação + núcleo de referência, NÃO produto implantado.

## Escopo
Carteira de investimentos para PF/PJ; cadastro manual/importação validada de operações; posições e lotes; comparação de ofertas; retorno bruto/líquido estimado; risco e liquidez; metas; simulação de patrimônio; trilha de auditoria.

**Pré-requisitos:** Pacotes 01 (workspace, contas, lançamentos) e 02 (metas, reservas, planejamento). Integrações devem ser feitas por interfaces/adaptadores, sem presumir que APIs existentes já estão operacionais. Nunca executar ordem, transferência ou recomendação individualizada automaticamente.

## Arquivos
- `docs/01-PRODUTO-E-TELAS.md`: especificação de cada tela e ação
- `docs/02-DOMINIO-E-REGRAS.md`: cálculos, liquidez, risco, fiscal e conciliação
- `docs/03-INTEGRACAO-E-DADOS.md`: adapters, autorização, segurança, observabilidade
- `docs/04-PLANO-DE-ENTREGA.md`: entregas, migrations, rollout e rollback
- `schemas/pacote03.prisma`: modelos Prisma **para adaptar/mesclar** ao schema existente
- `contracts/openapi-pacote03.yaml`: API contratual
- `domain/src/investments.ts`: motor TypeScript puro, sem operação bancária
- `domain/test/investments.test.ts`: casos com Vitest
- `qa/MATRIZ-DE-ACEITE.md`: critérios e testes de homologação
- `docs/05-PROVEDORES-E-CONFORMIDADE.md`: fontes, políticas e conformidade

## Instalação / execução de código de referência
Copiar o núcleo para `packages/domain` e instalar `vitest` e `typescript` na aplicação existente. Executar `pnpm exec vitest run` na pasta do monorepo com a configuração local. Os modelos Prisma não são migração executável isolada: dependem do schema consolidado de Pacotes 01/02. Não incluímos taxas, preços de mercado ou posições inventadas em produção.
