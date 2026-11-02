# NOVA — Pacote 04 | Inteligência Financeira, Integrações e Design Unificado
Versão 4.0.0 · 02/11/2026 · **Entrega técnica de referência, sem conexão bancária ativa**

Este pacote amplia, **não substitui**, os Pacotes 01–03. Projeto NOVA independente de qualquer software anterior. Interfaces em pt-BR, dados por workspace PF/PJ separados, sem seed financeiro fictício.

## Entregues no ZIP
- `docs/`: especificação por módulo, telas, ações, fluxos, governança, integração, design, arquitetura, implantação e matriz de aceite.
- `schemas/pacote04.prisma`: **fragmento conceitual** para composição com o schema do monorepo, não executar isoladamente.
- `contracts/openapi-pacote04.yaml`: rotas com segurança e estados.
- `domain/src/`: motor puro para diagnósticos, qualidade de dados e liquidez; testes executáveis de domínio.
- `ui/`: tokens, mapa de navegação, definição de telas e layout React de referência, não app implantado.
- `integration/`: interface de conector e eventos; implementações reais ficam bloqueadas até convênios, autorização e homologação.
- `ops/`: checklist de implantação, monitoramento e migração.

## Rodar os testes de referência
```bash
cd domain
npm install
npm test
npm run typecheck
```
Requer Node.js >=20; npm utiliza internet para instalar dependências. **Nenhuma API bancária real nem ordem financeira é executada**. O núcleo de cálculo recebe números seguros em centavos inteiros, representáveis sem perda; persistência financeira usa Decimal.

## Sequência de incorporação
1. Aplicar os tokens e navegação no frontend existente; manter as rotas dos Pacotes 01–03.
2. Integrar os novos modelos ao schema Prisma **central** e gerar migração revisada, nunca copiar o fragmento cru.
3. Implementar endpoints de leitura e auditoria com RBAC no backend real; testar isolamento entre workspaces.
4. Implementar importação **manual/CSV** antes do conector Open Finance; deduplicação e conciliação obrigatórias.
5. Integrar provedores autorizados em ambiente sandbox, com consentimento revogável e monitoramento.
6. Habilitar sugestões explicáveis após qualidade de dados satisfatória; comparação de investimentos apenas com dados verificados e identificados como educacionais.

## Restrições
Sem movimentação financeira, pagamento, aplicação ou resgate automáticos. Sem dados de clientes ou cotações embutidas. Não é consultoria individualizada de valores mobiliários. A autenticação, emissão de tokens e conciliação final dependem do ambiente real.
