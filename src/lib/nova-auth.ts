import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { prisma } from '@/lib/prisma';
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
  const email = String(value).trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('INVALID_EMAIL', 422, 'E-mail inválido.');
  return email;
}
export function validatePassword(password: string): void {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new AuthError('WEAK_PASSWORD', 422, 'Use uma senha entre 12 e 128 caracteres.');
}
function sha256(input: string): string { return createHash('sha256').update(input).digest('hex'); }
export function sha256Hex(input: string): string { return sha256(input); }
export function makeToken(): string { return randomBytes(32).toString('base64url'); }
export function tokenHash(token: string): string { return sha256(token); }

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
  const session = await prisma.novaSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') throw new AuthError('SESSION_EXPIRED');
  return { userId: session.userId, name: session.user.name, email: session.user.email, sessionId: session.id };
}
export async function issueSession(userId: string) {
  const token = makeToken();
  await prisma.novaSession.create({ data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_TTL) } });
  return token;
}
export function sessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: SESSION_TTL / 1000 };
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
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
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

// Throttling persistente por identidade, não baseado em memória da função serverless.
export async function checkThrottle(key: string, limit = 8, periodMs = 15 * 60_000) {
  const hashed = sha256(key);
  const now = new Date();
  const windowStart = new Date(Date.now() - periodMs);
  await prisma.novaAuthThrottle.upsert({
    where: { key: hashed },
    create: { key: hashed, attempts: 1, windowStart: now },
    update: {},
  });
  await prisma.novaAuthThrottle.updateMany({ where: { key: hashed, windowStart: { lt: windowStart } }, data: { attempts: 0, windowStart: now } });
  const record = await prisma.novaAuthThrottle.update({ where: { key: hashed }, data: { attempts: { increment: 1 } } });
  if (record.attempts > limit) throw new AuthError('TOO_MANY_ATTEMPTS', 429, 'Muitas tentativas. Tente novamente mais tarde.');
}
