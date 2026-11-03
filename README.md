# NOVA — Plataforma de Inteligência Financeira (v8.0.0 | Pacotes 01 a 08)

> *"Seu dinheiro organizado. Seu futuro planejado."*

Consolidação operacional integrada dos **Pacotes 01 a 08** da plataforma **NOVA** para **Pessoas Físicas (`PERSONAL`)** e **Empresas (`BUSINESS`)**:
- **[Pacote 01](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/NOVA_Pacote_01_Especificacao.md)**: Fundação Financeira, Contas, Movimentações, Transferências Atômicas e Auditoria.
- **[Pacote 02](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/pacote_02/NOVA_Pacote_02/README.md)**: Planejamento Financeiro, Contas a Pagar/Receber, Parcelas, Cofres Virtuais e Capacidade Conservadora de Reserva (`headroom`).
- **[Pacote 03](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/pacote_03/NOVA_Pacote_03/README.md)**: Carteira de Investimentos, Liquidez D+0/Carência, Tributação Regressiva Renda Fixa e Comparador.
- **[Pacote 04](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/pacote_04/NOVA_Pacote_04/README.md)**: Inteligência Financeira, Índice de Saúde Ponderado, Assistente IA Somente Leitura e Conciliação CSV/Open Finance.
- **[Pacote 05](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/pacote_05/NOVA_Pacote_05_Consolidacao_v5.0.0/README.md)**: Núcleo Financeiro Canônico `BigInt` em centavos exatos e Conciliação Declarada.
- **[Pacote 06](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/pacote_06/NOVA_Pacote_06_Operacional_v6.0.0/README.md)**: Operação Persistente com Prisma, Autenticação (`scrypt` + salt + sessões `HttpOnly SameSite=Strict`), Isolamento PF/PJ, RBAC (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`), Proteção de `Origin` e Idempotência Transacional (`Serializable`).
- **[Pacote 07](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/pacote_07/NOVA_Pacote_07_Vercel_v7.0.0/README.md)**: Adaptação serverless (`api/index.mjs`, `apps/api/src/local.mjs`) e guia [VERCEL-DEPLOY.md](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/VERCEL-DEPLOY.md).
- **[Pacote 08](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/specs/pacote_08/NOVA_Pacote_08_ALPHA_Vercel_Seguranca_v8.0.0/README.md)**: Endurecimento para Vercel Preview no repositório `ALPHA` ([IMPLEMENTACAO.md](file:///D:/PROJETOS%20VS%20CODE/ALPHA/docs/IMPLEMENTACAO.md), [middleware.ts](file:///D:/PROJETOS%20VS%20CODE/ALPHA/middleware.ts), [vercel.json](file:///D:/PROJETOS%20VS%20CODE/ALPHA/vercel.json), [preflight.mjs](file:///D:/PROJETOS%20VS%20CODE/ALPHA/tools/preflight.mjs), [prepare-postgres.mjs](file:///D:/PROJETOS%20VS%20CODE/ALPHA/tools/prepare-postgres.mjs), remoção de `.env` do controle de versão e migração de schema para PostgreSQL).

## 1. Verificações e Homologação (Pacote 08)

```powershell
# 1. Validar schema PostgreSQL e rodar verificações pré-implantação P08
npx.cmd prisma validate
npm.cmd run preflight:p08

# 2. Executar suíte completa de testes (67 testes Vitest P01-P08 + 14 testes Node Domain & E2E Integration P06/P07)
npm.cmd test

# 3. Executar build completo para Vercel (Prisma Generate + Next.js 15 Build)
npm.cmd run build
```

## 2. Configuração na Vercel (Branch `homologacao/p08-vercel`)
- **Framework Preset**: `Next.js`
- **Root Directory**: `./`
- **Install Command**: `npm ci`
- **Build Command**: `npm run build` (`prisma generate && next build`)
- **Variáveis de Ambiente (Preview)**:
  - `DATABASE_URL`: conexão PostgreSQL exclusiva de homologação (`?sslmode=require`)
  - `NOVA_PREVIEW_USER`: usuário do gate de Preview
  - `NOVA_PREVIEW_PASSWORD`: senha aleatória de 32+ caracteres para o gate de Preview
