# Rotas HTTP v6

Autenticação: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. O cadastro cria ambientes PERSONAL e BUSINESS com papéis OWNER.

Todas as rotas a seguir exigem cookie autenticado e parâmetro de consulta `workspace=<uuid>`; escrita exige `Idempotency-Key` aleatória e `Origin` correspondente ao servidor:

- `GET /api/state`: contexto completo do ambiente + saldos e projeções.
- `POST /api/accounts`: `{name}` cria conta com saldo inicial zero.
- `POST /api/transactions`: `{accountId,kind:'INCOME'|'EXPENSE',description,amount:'10.50',date:'YYYY-MM-DD',pending:boolean}`.
- `POST /api/transfer`: `{from,to,amount:'10.50',date}` duas pernas transacionais, sem criar renda ou despesa.
- `POST /api/settle`: `{id}` baixa única do compromisso.
- `POST /api/reserves`: `{name,amount}` alocação virtual, não diminui saldo em conta.
- `POST /api/investments`: `{name,amount,date}` posição manual sem comunicação com corretora.
- `POST /api/reconcile`: `{reconciled:boolean}` declaração de dados conferidos, não certificação bancária.
- `GET /api/health`: verificação de processo (não testa banco).

O backend devolve valores financeiros agregados em strings decimais. Valores individuais em centavos (`signedCents`, `amountCents`) são strings para interoperabilidade JavaScript.

## Decisões arquiteturais
- Identidade e sessões são persistidas no banco. O servidor não expõe endpoint para selecionar outro usuário.
- A conta precisa pertencer ao ambiente selecionado em todos os lançamentos.
- Idempotência salva hash do payload e resposta operacional numa transação serializável.
- Datas de obrigação seguem formato ISO e não executam liquidação automática.
- `income/expense` contam apenas liquidações; `pending` afeta a projeção.
- Não há mecanismo de importação bancária real.

## Lacunas a fechar antes de homologar produção
- Rate limiting distribuído, CSRF baseado em token além de Origin, e-mail verificado, MFA e ciclo de recuperação de senha.
- Auditoria imutável e exportável com carimbo, enriquecimento e retenção.
- Testes de concorrência com PostgreSQL, idempotência e autorização cruzada; rotina de reconciliação e rollback.
- Normalização das projeções por data e inclusão de saldos iniciais autenticados.
- Avaliação de privacidade e política de proteção de dados.
