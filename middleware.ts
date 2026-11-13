import { NextRequest, NextResponse } from 'next/server';

/**
 * NOVA: Camada de proteção de homologação (Pacote 08) integrada à Autenticação Real (Pacote 09).
 * - Quando NOVA_PREVIEW_USER / NOVA_PREVIEW_PASSWORD estão configurados, exige HTTP Basic adicional.
 * - Quando ausentes, delega o bloqueio de acesso diretamente à sessão autenticada (/entrar).
 * - Libera rotas de autenticação (/api/auth/*) e consulta somente-leitura do assistente (/v1/.../assistant/query).
 * - Bloqueia mutações financeiras com 403 READ_ONLY_HOMOLOGATION quando NOVA_ENABLE_FINANCIAL_WRITES="false".
 */
export function middleware(request: NextRequest) {
  const username = process.env.NOVA_PREVIEW_USER;
  const password = process.env.NOVA_PREVIEW_PASSWORD;
  const hasBasicGateConfigured = Boolean(username || password);

  if (hasBasicGateConfigured) {
    const isExplicitAdminGate = username === 'admin' && password === 'admin';
    if (!username || !password || (password.length < 20 && !isExplicitAdminGate)) {
      return new NextResponse('NOVA: configure NOVA_PREVIEW_USER e NOVA_PREVIEW_PASSWORD na Vercel.', {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
      });
    }

    const authorization = request.headers.get('authorization');
    let authorized = false;
    if (authorization?.startsWith('Basic ')) {
      try {
        const decoded = atob(authorization.slice('Basic '.length));
        const colon = decoded.indexOf(':');
        authorized =
          colon > 0 &&
          decoded.slice(0, colon) === username &&
          decoded.slice(colon + 1) === password;
      } catch {
        authorized = false;
      }
    }

    if (!authorized) {
      return new NextResponse('NOVA: acesso restrito para homologacao.', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="NOVA Homologacao", charset="UTF-8"',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex, nofollow',
        },
      });
    }
  }

  const pathname = request.nextUrl.pathname;
  const isReadMethod = ['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  const isAuthEndpoint = pathname.startsWith('/api/auth/');
  const isReadonlyAssistant =
    request.method === 'POST' &&
    /^\/v1\/workspaces\/[^/]+\/assistant\/query\/?$/.test(pathname);
  const financialWritesDisabled =
    process.env.NOVA_ENABLE_FINANCIAL_WRITES === 'false';

  if (
    (pathname.startsWith('/api/') || pathname.startsWith('/v1/')) &&
    !isReadMethod &&
    !isAuthEndpoint &&
    !isReadonlyAssistant &&
    financialWritesDisabled
  ) {
    return NextResponse.json(
      {
        code: 'READ_ONLY_HOMOLOGATION',
        message: 'Gravacoes temporariamente bloqueadas durante homologacao.',
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|icon|apple-icon).*)',
  ],
};
