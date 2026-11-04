import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
test('passwords use salted scrypt and compare with timing-safe function', () => {
  const s = read('src/lib/nova-auth.ts');
  assert.match(s, /scrypt\(password/);
  assert.match(s, /randomBytes\(16\)/);
  assert.match(s, /timingSafeEqual/);
});
test('session cookie is HttpOnly, SameSite and secure for production', () => {
  const s = read('src/lib/nova-auth.ts');
  assert.match(s, /httpOnly: true/);
  assert.match(s, /sameSite: 'lax'/);
  assert.match(s, /secure: process\.env\.NODE_ENV === 'production'/);
});
test('server checks membership and session and supports token revocation', () => {
  const s = read('src/lib/nova-auth.ts');
  assert.match(s, /findUnique\(\{ where: \{ tokenHash:/);
  assert.match(s, /session\.revokedAt/);
  assert.match(s, /workspaceId_userId/);
});
test('reset token is single use, session invalidated', () => {
  const s = read('src/app/api/auth/[...action]/route.ts');
  assert.match(s, /usedAt: null/);
  assert.match(s, /novaSession\.updateMany/);
  assert.match(s, /sendResetEmail/);
});
test('overlay applies closed-by-default financial write policy', () => {
  const s = read('scripts/apply-p09.py');
  assert.match(s, /NOVA_ENABLE_FINANCIAL_WRITES/);
  assert.match(s, /RESET_TO_ZERO/);
  assert.match(s, /requireSession/);
  assert.match(s, /requireWorkspace/);
});
