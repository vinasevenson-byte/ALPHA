# NOVA — Pacote 05 | Consolidação operacional (v5.0.0)

**Status honesto:** aplicação web e API de desenvolvimento integradas, sem autenticação de produção, sem conexão bancária real, sem movimentações bancárias e sem publicação. O backend de demonstração usa dados persistidos em um arquivo local, permitindo verificar os fluxos em computador de desenvolvimento. Não usar com dados sensíveis ou publicar exposto à internet.

## Iniciar localmente (Node 22+)

```bash
cd apps/dev-server
node server.mjs
```

Abrir `http://127.0.0.1:4173` na própria máquina. Não requer npm install ou internet. Dados persistidos em `apps/dev-server/data/nova-dev.json` (criado no primeiro uso). O servidor recusa conexão diferente de localhost. Para apagar dados de teste, desligue o servidor e apague o arquivo local.

## Escopo implementado nesta prévia operacional
- Layout NOVA fiel **em estrutura** à referência escolhida: navegação roxa, sidebar, cards, gráfico de fluxo, recomendações e layout responsivo.
- Seleção entre workspace pessoal e empresarial, ambos criados vazios; isolamento por workspace em todas as consultas de dados do protótipo.
- Contas, receitas, despesas, compromissos pendentes e baixa de compromissos; transferências internas com dois lados e sem duplicar receita/despesa.
- Saldo realizado, resumo do período, lista de movimentações, fluxo futuro, alertas de saldo negativo, cálculo conservador de capacidade de reserva quando o usuário marca os dados como reconciliados.
- Reservas virtuais e registro manual de posições de investimentos (controle patrimonial, não operação de mercado), com gráfico sem cotações fictícias.
- API HTTP local com validação e idempotência básica para lançamentos; testes de domínio executáveis pelo Node.
- Referências originais completas de P01–P04 incluídas em `referencias/`, preservadas sem misturar código experimental com código de referência.

## Lacunas bloqueadoras para produção
1. **Autenticação real, sessões seguras e autorização de membros**. No protótipo local, workspace é uma seleção de interface, não mecanismo de segurança. Não há dados de outros usuários nem ambiente multiusuário.
2. PostgreSQL + Prisma + migrações, em vez de armazenamento JSON local; transações ACID e concorrência.
3. Testes ponta a ponta e segurança, CI, observabilidade, backups e recuperação, política LGPD.
4. Provedores homologados para Open Finance / cotações. Dados de investimento são manuais e identificados como tal.
5. Motor tributário versionado e critérios de suitability antes de disponibilizar qualquer recomendação personalizada.
6. Aplicação definitiva em Next.js/NestJS conforme Pacote 01; esta versão independente de dependências é um **protótipo funcional de integração**, não substitui a arquitetura alvo.

## Verificações
```bash
node --test apps/dev-server/test/*.test.mjs
node --check apps/dev-server/server.mjs
```

## Segurança
Servidor limitado a `127.0.0.1`; validação de origem e tipo em rotas mutáveis; limites básicos de payload; sem credenciais ou contas bancárias reais. Todos os dados são **somente locais**. Nenhum botão executa Pix, resgates ou investimentos.
