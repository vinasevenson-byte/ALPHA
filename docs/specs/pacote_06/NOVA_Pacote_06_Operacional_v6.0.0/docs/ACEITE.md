# Checklist de aceite da versão 6

- [ ] `docker compose up -d db`, Prisma Generate e Migrate executados sem erro.
- [ ] Cadastro cria dois ambientes e sessão segura.
- [ ] Login, logout, sessão expirada e acesso não autorizado verificados.
- [ ] Conta criada no ambiente PF não aparece no PJ e vice-versa.
- [ ] Contas novas ficam com saldo zero.
- [ ] Receita e despesa liquidada alteram saldo corretamente.
- [ ] Compromisso pendente afeta somente projeção até baixa.
- [ ] Repetição da mesma requisição/chave não gera lançamento duplicado.
- [ ] Transferência gera duas pernas de valor absoluto idêntico e soma zero.
- [ ] Conflitos de concorrência entre baixas não duplicam saldos.
- [ ] Cofre virtual não cria despesa nem movimentação bancária.
- [ ] Investimento manual está rotulado como manual e datado.
- [ ] Menu responsivo e estado de erros validados em navegador desktop/mobile.
- [ ] Backup e restauração do banco comprovados em homologação.
- [ ] Teste de acesso cruzado com usuários diferentes reprovado com HTTP 403.
- [ ] Controles anti-força-bruta, MFA, recuperação de senha e revisão de segurança aprovados antes de produção.

**Status atual:** código e testes de domínio gerados. Instalação de dependências e execução integral com PostgreSQL não foram realizadas neste ambiente.
