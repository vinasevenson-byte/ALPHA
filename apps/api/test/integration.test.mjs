import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const PORT = 4186;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ORIGIN = BASE_URL;
const db = new PrismaClient();

let serverProc = null;

async function waitForServer(url, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${url}/api/health`);
      if (r.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('Servidor Pacote 06 não iniciou dentro do tempo limite');
}

function extractSessionCookie(res) {
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/nova_session=[^;]+/);
  return match ? match[0] : '';
}

async function apiRequest(path, { method = 'GET', cookie = '', origin = ORIGIN, contentType = 'application/json', idempotencyKey = null, body = undefined } = {}) {
  const headers = {};
  if (cookie) headers['Cookie'] = cookie;
  if (origin !== null && method !== 'GET' && method !== 'HEAD') {
    headers['Origin'] = origin;
  }
  if (contentType && body !== undefined) {
    headers['Content-Type'] = contentType;
  }
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, headers: res.headers, cookie: extractSessionCookie(res), data };
}

test('Homologação Integrada Pacote 06 (API + Prisma + Autenticação + RBAC + Domínio)', async (t) => {
  const runSuffix = crypto.randomBytes(4).toString('hex');
  const emailA = `homolog.a.${runSuffix}@nova.fin.br`;
  const emailB = `homolog.b.${runSuffix}@nova.fin.br`;
  const password = 'Nova@Segura#2026!orte';

  serverProc = spawn(process.execPath, ['apps/api/src/server.mjs'], {
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(PORT),
      DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
      NODE_ENV: 'development',
    },
    stdio: 'pipe',
  });

  t.after(async () => {
    if (serverProc && !serverProc.killed) {
      serverProc.kill();
    }
    // Limpa usuários temporários criados na suíte de integração
    const testUsers = await db.user.findMany({
      where: { email: { in: [emailA, emailB] } },
      include: { memberships: true },
    });
    const wsIds = testUsers.flatMap((u) => u.memberships.map((m) => m.workspaceId));
    if (wsIds.length > 0) {
      await db.idempotencyKey.deleteMany({ where: { workspaceId: { in: wsIds } } });
      await db.audit.deleteMany({ where: { workspaceId: { in: wsIds } } });
      await db.investment.deleteMany({ where: { workspaceId: { in: wsIds } } });
      await db.reserve.deleteMany({ where: { workspaceId: { in: wsIds } } });
      await db.transaction.deleteMany({ where: { workspaceId: { in: wsIds } } });
      await db.account.deleteMany({ where: { workspaceId: { in: wsIds } } });
      await db.membership.deleteMany({ where: { workspaceId: { in: wsIds } } });
      await db.workspace.deleteMany({ where: { id: { in: wsIds } } });
    }
    if (testUsers.length > 0) {
      await db.session.deleteMany({ where: { userId: { in: testUsers.map((u) => u.id) } } });
      await db.user.deleteMany({ where: { id: { in: testUsers.map((u) => u.id) } } });
    }
    await db.$disconnect();
  });

  await waitForServer(BASE_URL);

  await t.test('1. Healthcheck e entrega da interface estática com CSP', async () => {
    const health = await apiRequest('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');

    const indexRes = await fetch(`${BASE_URL}/`);
    assert.equal(indexRes.status, 200);
    assert.match(indexRes.headers.get('content-security-policy') || '', /default-src 'self'/);
    const html = await indexRes.text();
    assert.match(html, /NOVA · Inteligência Financeira/);
  });

  let cookieA = '';
  let wsPF = null;
  let wsPJ = null;

  await t.test('2. Cadastro cria usuário, dois ambientes (PF e PJ) e sessão segura', async () => {
    // Senha curta (< 12 caracteres) deve falhar
    const weak = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { name: 'Usuário Teste', email: emailA, password: '123' },
    });
    assert.equal(weak.status, 400);

    // Cadastro válido
    const reg = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { name: 'Titular Homologação A', email: emailA, password },
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.name, 'Titular Homologação A');
    assert.ok(reg.cookie.startsWith('nova_session='));
    assert.match(reg.headers.get('set-cookie') || '', /HttpOnly/);
    assert.match(reg.headers.get('set-cookie') || '', /SameSite=Strict/);
    cookieA = reg.cookie;

    // Duplicidade de e-mail bloqueada com 409
    const dup = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { name: 'Outro Nome', email: emailA, password },
    });
    assert.equal(dup.status, 409);

    // Verifica /api/auth/me e criação automática de PF + PJ com papel OWNER
    const me = await apiRequest('/api/auth/me', { cookie: cookieA });
    assert.equal(me.status, 200);
    assert.equal(me.data.email, emailA);
    assert.equal(me.data.workspaces.length, 2);

    wsPF = me.data.workspaces.find((w) => w.type === 'PERSONAL');
    wsPJ = me.data.workspaces.find((w) => w.type === 'BUSINESS');
    assert.ok(wsPF, 'Workspace PERSONAL criado');
    assert.ok(wsPJ, 'Workspace BUSINESS criado');
    assert.equal(wsPF.role, 'OWNER');
    assert.equal(wsPJ.role, 'OWNER');
    assert.equal(wsPF.reconciled, false);
  });

  await t.test('3. Logout, bloqueio de acesso não autenticado e novo Login', async () => {
    const out = await apiRequest('/api/auth/logout', {
      method: 'POST',
      cookie: cookieA,
      body: {},
    });
    assert.equal(out.status, 200);

    // Sessão encerrada no banco não deve mais autenticar
    const afterLogout = await apiRequest('/api/auth/me', { cookie: cookieA });
    assert.equal(afterLogout.status, 401);

    // Login com senha incorreta deve falhar com 401
    const badLogin = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: emailA, password: 'SenhaErrada123456' },
    });
    assert.equal(badLogin.status, 401);

    // Login com credenciais corretas emite nova sessão
    const login = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: { email: emailA, password },
    });
    assert.equal(login.status, 200);
    assert.ok(login.cookie.startsWith('nova_session='));
    cookieA = login.cookie;
  });

  await t.test('4. Proteções de Origin, Content-Type, Idempotency-Key, Acesso Cruzado (403) e RBAC (VIEWER)', async () => {
    // Origin inválido bloqueado com 403
    const badOrigin = await apiRequest(`/api/accounts?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      origin: 'http://evil.example.com',
      idempotencyKey: crypto.randomUUID(),
      body: { name: 'Conta Invasora' },
    });
    assert.equal(badOrigin.status, 403);

    // Content-Type inválido bloqueado com 415
    const badMime = await apiRequest(`/api/accounts?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      contentType: 'text/plain',
      idempotencyKey: crypto.randomUUID(),
      body: '{"name":"Conta"}',
    });
    assert.equal(badMime.status, 415);

    // Sem Idempotency-Key bloqueado com 400
    const noIdem = await apiRequest(`/api/accounts?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      body: { name: 'Conta Sem Chave' },
    });
    assert.equal(noIdem.status, 400);

    // Usuário B tenta acessar workspace do Usuário A -> 403 Forbidden
    const regB = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: { name: 'Usuário B', email: emailB, password },
    });
    assert.equal(regB.status, 201);
    const cookieB = regB.cookie;

    const crossRead = await apiRequest(`/api/state?workspace=${wsPF.id}`, {
      cookie: cookieB,
    });
    assert.equal(crossRead.status, 403);

    const crossWrite = await apiRequest(`/api/accounts?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieB,
      idempotencyKey: crypto.randomUUID(),
      body: { name: 'Conta Cruzada' },
    });
    assert.equal(crossWrite.status, 403);

    // Papel VIEWER não pode realizar escrita (403)
    const userBRecord = await db.user.findUnique({ where: { email: emailB } });
    const viewerMembership = await db.membership.create({
      data: { userId: userBRecord.id, workspaceId: wsPF.id, role: 'VIEWER' },
    });
    try {
      const viewerRead = await apiRequest(`/api/state?workspace=${wsPF.id}`, {
        cookie: cookieB,
      });
      assert.equal(viewerRead.status, 200);

      const viewerWrite = await apiRequest(`/api/accounts?workspace=${wsPF.id}`, {
        method: 'POST',
        cookie: cookieB,
        idempotencyKey: crypto.randomUUID(),
        body: { name: 'Tentativa Viewer' },
      });
      assert.equal(viewerWrite.status, 403);
    } finally {
      await db.membership.delete({ where: { id: viewerMembership.id } });
    }
  });

  let accPf1 = null;
  let accPf2 = null;

  await t.test('5. Isolamento PF vs PJ e criação de contas com saldo zero', async () => {
    const c1 = await apiRequest(`/api/accounts?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: { name: 'Conta Corrente PF' },
    });
    assert.equal(c1.status, 200);
    assert.equal(c1.data.state.accounts.length, 1);
    accPf1 = c1.data.state.accounts[0];
    assert.equal(accPf1.openingCents, '0');
    assert.equal(c1.data.state.summary.balance, '0.00');

    const c2 = await apiRequest(`/api/accounts?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: { name: 'Conta Reserva PF' },
    });
    assert.equal(c2.status, 200);
    assert.equal(c2.data.state.accounts.length, 2);
    accPf2 = c2.data.state.accounts[1];

    // Ambiente PJ continua com 0 contas (isolamento estrito)
    const pjState = await apiRequest(`/api/state?workspace=${wsPJ.id}`, {
      cookie: cookieA,
    });
    assert.equal(pjState.status, 200);
    assert.equal(pjState.data.accounts.length, 0);
  });

  let pendingTxId = '';

  await t.test('6. Receitas, despesas, compromissos pendentes, idempotência e transferências', async () => {
    // Receita liquidada +1000.00
    const incKey = crypto.randomUUID();
    const incPayload = {
      accountId: accPf1.id,
      kind: 'INCOME',
      description: 'Salário Mensal',
      amount: '1000.00',
      date: '2026-11-02',
      pending: false,
    };
    const inc = await apiRequest(`/api/transactions?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: incKey,
      body: incPayload,
    });
    assert.equal(inc.status, 200);
    assert.equal(inc.data.state.summary.balance, '1000.00');
    assert.equal(inc.data.state.summary.income, '1000.00');
    assert.equal(inc.data.state.summary.expense, '0.00');

    // Replay idempotente com a mesma chave e mesmo payload NÃO duplica saldo
    const incReplay = await apiRequest(`/api/transactions?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: incKey,
      body: incPayload,
    });
    assert.equal(incReplay.status, 200);
    assert.equal(incReplay.data.state.summary.balance, '1000.00');
    assert.equal(incReplay.data.state.transactions.length, 1);

    // Mesma chave com payload diferente retorna 409
    const incConflict = await apiRequest(`/api/transactions?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: incKey,
      body: { ...incPayload, amount: '9999.00' },
    });
    assert.equal(incConflict.status, 409);

    // Despesa liquidada -250.50 -> saldo = 749.50
    const exp = await apiRequest(`/api/transactions?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: {
        accountId: accPf1.id,
        kind: 'EXPENSE',
        description: 'Supermercado',
        amount: '250.50',
        date: '2026-11-02',
        pending: false,
      },
    });
    assert.equal(exp.status, 200);
    assert.equal(exp.data.state.summary.balance, '749.50');
    assert.equal(exp.data.state.summary.income, '1000.00');
    assert.equal(exp.data.state.summary.expense, '250.50');

    // Compromisso pendente -300.00 -> afeta apenas projeção (449.50), não saldo realizado (749.50)
    const pend = await apiRequest(`/api/transactions?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: {
        accountId: accPf1.id,
        kind: 'EXPENSE',
        description: 'Aluguel a vencer',
        amount: '300.00',
        date: '2026-11-15',
        pending: true,
      },
    });
    assert.equal(pend.status, 200);
    assert.equal(pend.data.state.summary.balance, '749.50');
    assert.equal(pend.data.state.projection.minimum, '449.50');
    assert.equal(pend.data.state.projection.closing, '449.50');
    pendingTxId = pend.data.entityId;

    // Transferência interna 200.00 entre accPf1 e accPf2 -> duas pernas de soma zero, sem inflar receita/despesa
    const tf = await apiRequest(`/api/transfer?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: {
        from: accPf1.id,
        to: accPf2.id,
        amount: '200.00',
        date: '2026-11-02',
      },
    });
    assert.equal(tf.status, 200);
    assert.equal(tf.data.state.summary.balance, '749.50');
    assert.equal(tf.data.state.summary.income, '1000.00');
    assert.equal(tf.data.state.summary.expense, '250.50');
    const transferLegs = tf.data.state.transactions.filter((x) => x.transferGroup === tf.data.entityId);
    assert.equal(transferLegs.length, 2);
  });

  await t.test('7. Liquidação única de compromisso, reservas virtuais, conciliação e investimentos manuais', async () => {
    // Liquidação do compromisso pendente (-300.00) -> saldo passa de 749.50 para 449.50
    const settled = await apiRequest(`/api/settle?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: { id: pendingTxId },
    });
    assert.equal(settled.status, 200);
    assert.equal(settled.data.state.summary.balance, '449.50');

    // Tentativa de liquidar novamente o mesmo compromisso com outra chave retorna 409 e não altera saldo
    const doubleSettle = await apiRequest(`/api/settle?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: { id: pendingTxId },
    });
    assert.equal(doubleSettle.status, 409);

    // Reserva virtual (150.00) -> não reduz saldo em conta nem cria despesa; capacidade bloqueada até conciliação
    const resv = await apiRequest(`/api/reserves?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: { name: 'Cofre Emergência', amount: '150.00', date: '2026-11-02' },
    });
    assert.equal(resv.status, 200);
    assert.equal(resv.data.state.summary.balance, '449.50');
    assert.equal(resv.data.state.summary.expense, '550.50');
    assert.equal(resv.data.state.capacity, null);

    // Declaração de dados conferidos (conciliação) -> libera capacidade de reserva (449.50 - 150.00 = 299.50)
    const rec = await apiRequest(`/api/reconcile?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: { reconciled: true, date: '2026-11-02' },
    });
    assert.equal(rec.status, 200);
    assert.equal(rec.data.state.workspace.reconciled, true);
    assert.equal(rec.data.state.capacity, '299.50');

    // Investimento manual (5000.00) -> rotulado como MANUAL e datado, sem alterar saldo de conta
    const inv = await apiRequest(`/api/investments?workspace=${wsPF.id}`, {
      method: 'POST',
      cookie: cookieA,
      idempotencyKey: crypto.randomUUID(),
      body: { name: 'Tesouro Selic 2029', amount: '5000.00', date: '2026-11-02' },
    });
    assert.equal(inv.status, 200);
    assert.equal(inv.data.state.summary.balance, '449.50');
    assert.equal(inv.data.state.investments.length, 1);
    assert.equal(inv.data.state.investments[0].source, 'MANUAL');
    assert.equal(inv.data.state.investments[0].asOf, '2026-11-02');
    assert.equal(inv.data.state.investments[0].amountCents, '500000');
    assert.ok(inv.data.state.auditCount >= 8);
  });
});
