# Integração segura no repositório NOVA
1. Localizar os workspace IDs, guards, ledger, perfis e rotas efetivas do Pacote 01; não criar banco paralelo.
2. Consolidar schema Prisma dos Pacotes 02 e 03 e incorporar tabelas adicionais do Pacote 04. Criar migration aditiva e índices com restrições de tenant.
3. Vincular controllers NestJS ao guard de membership, ações e trilha de auditoria. Preparar logs anonimizados e tratamento de erro.
4. Usar `domain/src/intelligence.ts` como núcleo inicial, substituindo objetos artificiais por dados reais consultados do ledger. Verificar completude antes do cálculo.
5. Renderizar `ui/dashboard-reference.tsx` com Tailwind ativo e dados tipados da API; substituir placeholders por gráficos reais somente quando houver dados.
6. Aplicar menu `ui/navigation.ts` a todas as rotas; criar páginas de erro, loading, empty e no-permission.
7. Implementar importador staging/preview antes de gravar; o fragmento de conector é só contrato. Nunca embutir credenciais no frontend.
8. Executar testes de unidade, integração e E2E. Revisar pacote de dependências em ambiente isolado.
9. Ativar em Preview com flags OFF; liberar uma flag de cada vez após testes, nunca ativar Open Finance sem integração real autorizada.
10. Documentar checklist de homologação e plano de rollback. Sem execução bancária ou ordens de investimento.
