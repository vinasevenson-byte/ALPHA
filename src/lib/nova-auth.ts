import { randomBytes, scrypt as scryptCallback, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { prisma, isFallbackMemoryActive } from '@/lib/prisma';
import { DEFAULT_ADMIN_EMAIL } from '@/lib/in-memory-prisma';
import type { NextRequest } from 'next/server';

const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = 'nova_session';
const DAY_MS = 86_400_000;
const SESSION_TTL = 7 * DAY_MS;

export class AuthError extends Error {
  constructor(public code: string, public status = 401, message = 'Acesso não autorizado') {
    super(message);
  }
}

export function normalizeEmail(value: string): string {
  const raw = String(value).trim().toLowerCase();
  if (raw === 'admin') return DEFAULT_ADMIN_EMAIL;
  const email = raw;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('INVALID_EMAIL', 422, 'Login ou e-mail inválido.');
  return email;
}
export function validatePassword(password: string): void {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new AuthError('WEAK_PASSWORD', 422, 'Use uma senha entre 12 e 128 caracteres.');
}
function sha256(input: string): string { return createHash('sha256').update(input).digest('hex'); }
export function sha256Hex(input: string): string { return sha256(input); }
export function makeToken(): string { return randomBytes(32).toString('base64url'); }
export function tokenHash(token: string): string { return sha256(token); }

function fallbackSecret(): string {
  return process.env.NOVA_SESSION_SECRET || process.env.NOVA_PREVIEW_PASSWORD || 'nova-homolog-fallback-session-key-v9';
}

function makeSignedFallbackToken(userId: string, expiresAtMs: number): string {
  const payload = Buffer.from(
    JSON.stringify({ u: userId, exp: expiresAtMs, n: randomBytes(8).toString('base64url') }),
    'utf8'
  ).toString('base64url');
  const sig = createHmac('sha256', fallbackSecret()).update(payload).digest('base64url');
  return `nvs1.${payload}.${sig}`;
}

export async function ensureFallbackSessionHydrated(rawToken: string): Promise<void> {
  if (!isFallbackMemoryActive() || !rawToken.startsWith('nvs1.')) return;
  const parts = rawToken.split('.');
  if (parts.length !== 3) return;
  const [, payloadB64, sigB64] = parts;
  const expectedSig = createHmac('sha256', fallbackSecret()).update(payloadB64).digest('base64url');
  const a = Buffer.from(sigB64, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      u?: string;
      exp?: number;
    };
    if (!parsed.u || !parsed.exp || parsed.exp <= Date.now()) return;
    const hash = tokenHash(rawToken);
    const existing = await prisma.novaSession.findUnique({ where: { tokenHash: hash } });
    if (existing) return;
    const user = await prisma.user.findUnique({ where: { id: parsed.u } });
    if (!user || user.status !== 'ACTIVE') return;
    await prisma.novaSession.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(parsed.exp),
      },
    });
  } catch {
    // Token malformado ignorado com segurança
  }
}

export async function hashSystemPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, Buffer.from(salt, 'hex'), 64)) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}

export async function hashPassword(password: string): Promise<string> {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, Buffer.from(salt, 'hex'), 64)) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f\d]{32}$/.test(parts[1]) || !/^[a-f\d]{128}$/.test(parts[2])) return false;
  const actual = (await scrypt(password, Buffer.from(parts[1], 'hex'), 64)) as Buffer;
  const expected = Buffer.from(parts[2], 'hex');
  return timingSafeEqual(actual, expected);
}

export async function requireSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 256) throw new AuthError('LOGIN_REQUIRED');
  await ensureFallbackSessionHydrated(token);
  const session = await prisma.novaSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') throw new AuthError('SESSION_EXPIRED');
  return { userId: session.userId, name: session.user.name, email: session.user.email, sessionId: session.id };
}
export async function issueSession(userId: string, meta?: { userAgent?: string | null; ip?: string | null }) {
  const expiresAtMs = Date.now() + SESSION_TTL;
  const token = isFallbackMemoryActive() ? makeSignedFallbackToken(userId, expiresAtMs) : makeToken();
  await prisma.novaSession.create({
    data: {
      userId,
      tokenHash: tokenHash(token),
      expiresAt: new Date(expiresAtMs),
      userAgent: meta?.userAgent ? String(meta.userAgent).slice(0, 250) : null,
      ipHash: meta?.ip ? sha256(meta.ip) : null,
    },
  });
  return token;
}
export function sessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: SESSION_TTL / 1000 };
}
export function clearSessionCookie() {
  return { name: SESSION_COOKIE, value: '', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 0 };
}
export async function requireWorkspace(userId: string, workspaceId: string, level: 'VIEW' | 'EDIT' | 'ADMIN' = 'VIEW') {
  if (!workspaceId) throw new AuthError('WORKSPACE_REQUIRED', 422, 'Informe o ambiente financeiro.');
  const membership = await prisma.membership.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
  if (!membership || membership.status !== 'ACTIVE') throw new AuthError('WORKSPACE_FORBIDDEN', 403, 'Você não tem acesso a este ambiente.');
  if (level === 'EDIT' && membership.role === 'VIEWER') throw new AuthError('WORKSPACE_FORBIDDEN', 403);
  if (level === 'ADMIN' && !['OWNER', 'ADMIN'].includes(membership.role)) throw new AuthError('WORKSPACE_FORBIDDEN', 403);
  return membership;
}
export function requireSameOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  const rawHost = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const host = rawHost?.split(',')[0]?.trim();
  if (!origin || !host) throw new AuthError('CSRF_REJECTED', 403, 'Origem não permitida.');
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new AuthError('CSRF_REJECTED', 403); }
  if (parsed.host.toLowerCase() !== host.toLowerCase() || (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:')) throw new AuthError('CSRF_REJECTED', 403);
}
export function authFailure(error: unknown) {
  if (error instanceof AuthError) return Response.json({ code: error.code, message: error.message }, { status: error.status });
  console.error('Erro de autenticação:', error instanceof Error ? error.name : 'erro desconhecido');
  return Response.json({ code: 'INTERNAL_ERROR', message: 'Falha na autenticação.' }, { status: 500 });
}

// Throttling atômico e persistente por identidade (corrigido off-by-one e janela concorrente).
export async function checkThrottle(key: string, limit = 8, periodMs = 15 * 60_000) {
  const hashed = sha256(key);
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - periodMs);

  const attempts = await prisma.$transaction(async (tx) => {
    const existing = await tx.novaAuthThrottle.findUnique({ where: { key: hashed } });
    if (!existing || existing.windowStart < windowCutoff) {
      const reset = await tx.novaAuthThrottle.upsert({
        where: { key: hashed },
        create: { key: hashed, attempts: 1, windowStart: now, windowEndsAt: new Date(now.getTime() + periodMs) },
        update: { attempts: 1, windowStart: now, windowEndsAt: new Date(now.getTime() + periodMs), blockedUntil: null },
      });
      return reset.attempts;
    }
    const updated = await tx.novaAuthThrottle.update({
      where: { key: hashed },
      data: {
        attempts: { increment: 1 },
        blockedUntil: existing.attempts + 1 > limit ? new Date(now.getTime() + periodMs) : existing.blockedUntil,
      },
    });
    return updated.attempts;
  });

  if (attempts > limit) {
    throw new AuthError('TOO_MANY_ATTEMPTS', 429, 'Muitas tentativas. Tente novamente mais tarde.');
  }
}
