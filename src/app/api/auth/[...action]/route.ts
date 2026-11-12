import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AuthError, authFailure, checkThrottle, clearSessionCookie, hashPassword, issueSession, makeToken, normalizeEmail, requireSameOrigin, requireSession, sessionCookie, SESSION_COOKIE, tokenHash, validatePassword, verifyPassword } from '@/lib/nova-auth';

export const runtime = 'nodejs';
const genericReset = { message: 'Se o e-mail estiver cadastrado, você receberá instruções.' };

async function seedWorkspaceDefaults(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  workspaceId: string,
  userId: string,
  type: 'PERSONAL' | 'BUSINESS'
) {
  await tx.novaPlanningScenario.createMany({
    data: [
      {
        workspaceId,
        name: 'Cenário Base (Confirmado)',
        kind: 'BASE',
        contingencyBufferPct: 0,
        hypotheticalInflowCents: 0,
        hypotheticalOutflowCents: 0,
        notes: 'Projeção oficial com compromissos registrados sem gordura extra.',
        createdBy: userId,
      },
      {
        workspaceId,
        name: 'Cenário Conservador (+10% Saídas)',
        kind: 'CONSERVATIVE',
        contingencyBufferPct: 10,
        hypotheticalInflowCents: 0,
        hypotheticalOutflowCents: 0,
        notes: 'Adiciona margem de contingência sobre despesas pendentes e ignora recebíveis incertos.',
        createdBy: userId,
      },
      {
        workspaceId,
        name: 'Cenário Otimista',
        kind: 'OPTIMISTIC',
        contingencyBufferPct: 0,
        hypotheticalInflowCents: 0,
        hypotheticalOutflowCents: 0,
        notes: 'Considera 100% dos recebíveis previstos na data original.',
        createdBy: userId,
      },
    ],
  });

  const defaultCategories =
    type === 'BUSINESS'
      ? [
          { workspaceId, type: 'INCOME', name: 'Receita Operacional / Vendas', isEssential: true },
          { workspaceId, type: 'INCOME', name: 'Serviços & Contratos', isEssential: true },
          { workspaceId, type: 'EXPENSE', name: 'Folha & Pró-Labore', isEssential: true },
          { workspaceId, type: 'EXPENSE', name: 'Impostos & Tributos', isEssential: true },
          { workspaceId, type: 'EXPENSE', name: 'Infraestrutura & SaaS', isEssential: true },
          { workspaceId, type: 'EXPENSE', name: 'Marketing & Comercial', isEssential: false },
        ]
      : [
          { workspaceId, type: 'INCOME', name: 'Salário / Pró-Labore', isEssential: true },
          { workspaceId, type: 'INCOME', name: 'Renda Extra / Dividendos', isEssential: false },
          { workspaceId, type: 'EXPENSE', name: 'Moradia & Contas Fixas', isEssential: true },
          { workspaceId, type: 'EXPENSE', name: 'Alimentação & Saúde', isEssential: true },
          { workspaceId, type: 'EXPENSE', name: 'Transporte & Educação', isEssential: true },
          { workspaceId, type: 'EXPENSE', name: 'Lazer & Estilo de Vida', isEssential: false },
        ];

  await tx.category.createMany({ data: defaultCategories });
}

async function sendResetEmail(email: string, token: string) {
  const key = process.env.RESEND_API_KEY;
  const sender = process.env.NOVA_EMAIL_FROM;
  const base = process.env.NOVA_PUBLIC_URL;
  if (!key || !sender || !base) throw new Error('Serviço de e-mail indisponível');
  const link = new URL('/redefinir-senha', base);
  link.searchParams.set('token', token);
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: sender, to: [email], subject: 'NOVA — Recuperação de acesso', text: `Para redefinir sua senha, abra este link (válido por 20 minutos): ${link.toString()}\n\nSe você não solicitou, ignore.` }),
  });
  if (!resp.ok) throw new Error('Falha no serviço de e-mail');
}

export async function POST(req: NextRequest, context: { params: Promise<{ action: string[] }> }) {
  try {
    requireSameOrigin(req);
    if (!(req.headers.get('content-type') ?? '').includes('application/json')) throw new AuthError('INVALID_CONTENT_TYPE', 415);
    const { action } = await context.params;
    const operation = action.join('/');
    const body = await req.json().catch(() => ({}));
    const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim().slice(0, 64);
    const userAgent = req.headers.get('user-agent');

    if (operation === 'register') {
      if (process.env.NOVA_ALLOW_REGISTRATION !== 'true') throw new AuthError('REGISTRATION_DISABLED', 403, 'Cadastro temporariamente indisponível.');
      const email = normalizeEmail(String(body.email ?? ''));
      const name = String(body.name ?? '').trim();
      const password = String(body.password ?? '');
      if (name.length < 2 || name.length > 120) throw new AuthError('INVALID_NAME', 422, 'Informe seu nome.');
      validatePassword(password);
      await checkThrottle(`reg:${ip}:${email}`, 5);
      const passwordHash = await hashPassword(password);
      const user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({ data: { email, name, passwordHash, status: 'ACTIVE' } });
        const workspace = await tx.workspace.create({
          data: { name: 'Meu Financeiro Pessoal', type: 'PERSONAL', ownerId: u.id },
        });
        await tx.membership.create({ data: { userId: u.id, workspaceId: workspace.id, role: 'OWNER' } });
        await seedWorkspaceDefaults(tx, workspace.id, u.id, 'PERSONAL');
        return { userId: u.id, workspaceId: workspace.id };
      });
      const token = await issueSession(user.userId, { userAgent, ip });
      const res = NextResponse.json({ ok: true, workspaceId: user.workspaceId }, { status: 201 });
      res.cookies.set(sessionCookie(token));
      return res;
    }
    if (operation === 'login') {
      const email = normalizeEmail(String(body.email ?? ''));
      await checkThrottle(`login:${ip}:${email}`, 8);
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.status !== 'ACTIVE' || !(await verifyPassword(String(body.password ?? ''), user.passwordHash))) throw new AuthError('INVALID_CREDENTIALS', 401, 'E-mail ou senha inválidos.');
      const membership = await prisma.membership.findFirst({ where: { userId: user.id, status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
      if (!membership) throw new AuthError('NO_WORKSPACE', 403, 'Usuário sem ambiente ativo.');
      const token = await issueSession(user.id, { userAgent, ip });
      const res = NextResponse.json({ ok: true, workspaceId: membership.workspaceId });
      res.cookies.set(sessionCookie(token));
      return res;
    }
    if (operation === 'logout') {
      const token = req.cookies.get(SESSION_COOKIE)?.value;
      if (token) await prisma.novaSession.updateMany({ where: { tokenHash: tokenHash(token) }, data: { revokedAt: new Date() } });
      const res = NextResponse.json({ ok: true });
      res.cookies.set(clearSessionCookie());
      return res;
    }
    if (operation === 'request-reset') {
      const email = normalizeEmail(String(body.email ?? ''));
      await checkThrottle(`reset:${ip}:${email}`, 4, 60 * 60_000);
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && user.status === 'ACTIVE' && process.env.RESEND_API_KEY && process.env.NOVA_EMAIL_FROM && process.env.NOVA_PUBLIC_URL) {
        const token = makeToken();
        const record = await prisma.novaPasswordReset.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 20 * 60_000) } });
        try { await sendResetEmail(email, token); } catch { await prisma.novaPasswordReset.delete({ where: { id: record.id } }); console.error('Serviço de recuperação indisponível'); }
      }
      return NextResponse.json(genericReset);
    }
    if (operation === 'reset-password') {
      const token = String(body.token ?? '');
      const password = String(body.password ?? '');
      if (token.length < 32 || token.length > 256) throw new AuthError('INVALID_TOKEN', 422);
      validatePassword(password);
      await checkThrottle(`reset-confirm:${ip}`, 8);
      const reset = await prisma.novaPasswordReset.findUnique({ where: { tokenHash: tokenHash(token) } });
      if (!reset || reset.usedAt || reset.expiresAt < new Date()) throw new AuthError('INVALID_TOKEN', 422, 'Link inválido ou expirado.');
      const passwordHash = await hashPassword(password);
      await prisma.$transaction(async tx => {
        const updated = await tx.novaPasswordReset.updateMany({ where: { id: reset.id, usedAt: null }, data: { usedAt: new Date() } });
        if (updated.count !== 1) throw new AuthError('INVALID_TOKEN', 422);
        await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
        await tx.novaSession.updateMany({ where: { userId: reset.userId }, data: { revokedAt: new Date() } });
        await tx.novaPasswordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } });
      });
      return NextResponse.json({ ok: true });
    }
    if (operation === 'create-workspace') {
      const session = await requireSession(req);
      const type = String(body.type ?? '') as 'PERSONAL' | 'BUSINESS';
      const name = String(body.name ?? '').trim();
      if (!['PERSONAL', 'BUSINESS'].includes(type) || name.length < 2 || name.length > 100) throw new AuthError('INVALID_WORKSPACE', 422);
      const workspace = await prisma.$transaction(async tx => {
        const ws = await tx.workspace.create({ data: { type, name, ownerId: session.userId } });
        await tx.membership.create({ data: { userId: session.userId, workspaceId: ws.id, role: 'OWNER' } });
        await seedWorkspaceDefaults(tx, ws.id, session.userId, type);
        return ws;
      });
      return NextResponse.json({ workspace: { id: workspace.id, name: workspace.name, type: workspace.type } }, { status: 201 });
    }
    if (operation === 'revoke-other-sessions') {
      const session = await requireSession(req);
      const revoked = await prisma.novaSession.updateMany({
        where: { userId: session.userId, id: { not: session.sessionId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return NextResponse.json({ ok: true, revokedCount: revoked.count });
    }
    throw new AuthError('NOT_FOUND', 404, 'Rota não encontrada.');
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'P2002') return NextResponse.json({ code: 'ALREADY_REGISTERED', message: 'Cadastro indisponível para os dados informados.' }, { status: 409 });
    return authFailure(error);
  }
}

export async function GET(req: NextRequest, context: { params: Promise<{ action: string[] }> }) {
  try {
    const { action } = await context.params;
    if (action.join('/') !== 'me') throw new AuthError('NOT_FOUND', 404);
    const user = await requireSession(req);
    const [memberships, activeSessions] = await Promise.all([
      prisma.membership.findMany({ where: { userId: user.userId, status: 'ACTIVE' }, include: { workspace: { select: { id: true, name: true, type: true } } } }),
      prisma.novaSession.findMany({
        where: { userId: user.userId, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, userAgent: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return NextResponse.json({
      user: { id: user.userId, name: user.name, email: user.email, currentSessionId: user.sessionId },
      workspaces: memberships.map(m => ({ ...m.workspace, role: m.role })),
      sessions: activeSessions.map(s => ({ ...s, isCurrent: s.id === user.sessionId })),
    });
  } catch (error) { return authFailure(error); }
}
