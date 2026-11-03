# Checklist de aceite da versão 6

- [x] Prisma Generate e Migrate executados sem erro (`apps/api/prisma/migrations/20261103003952_init_pacote06`).
- [x] Cadastro cria dois ambientes (`PERSONAL` e `BUSINESS`) e sessão segura (`nova_session` HttpOnly SameSite=Strict).
- [x] Login, logout, sessão expirada e acesso não autorizado verificados.
- [x] Conta criada no ambiente PF não aparece no PJ e vice-versa.
- [x] Contas novas ficam com saldo zero (`openingCents: "0"`).
- [x] Receita e despesa liquidada alteram saldo corretamente.
- [x] Compromisso pendente afeta somente projeção até baixa.
- [x] Repetição da mesma requisição/chave (`Idempotency-Key`) não gera lançamento duplicado; payload divergente com mesma chave retorna HTTP 409.
- [x] Transferência gera duas pernas de valor absoluto idêntico e soma zero, sem inflar receitas/despesas.
- [x] Conflitos de concorrência entre baixas não duplicam saldos (HTTP 409 na repetição de liquidação).
- [x] Cofre virtual não cria despesa nem movimentação bancária.
- [x] Investimento manual está rotulado como `MANUAL` e datado (`asOf`).
- [x] Menu responsivo e estado de erros validados.
- [x] Teste de acesso cruzado com usuários diferentes reprovado com HTTP 403 e papel `VIEWER` bloqueado de escrita com HTTP 403.
- [ ] Backup e restauração do banco PostgreSQL de produção comprovados em ambiente de nuvem.
- [ ] Controles anti-força-bruta distribuídos, MFA, recuperação de senha e revisão de segurança aprovados antes de produção.

**Status atual:** Pacote 06 instalado, migrado e homologado localmente com suíte automatizada de domínio e integração ponta a ponta (`apps/api/test/domain.test.mjs` + `apps/api/test/integration.test.mjs` + suíte Vitest P01–P06).
