import { NextRequest, NextResponse } from 'next/server';

/**
 * NOVA: temporary protected inspection deployment.
 * NOT a replacement for user authentication, workspace authorization, or production hardening.
 * Basic access remains compulsory on BOTH Preview and Production.
 */
export function middleware(request: NextRequest) {
  const username = process.env.NOVA_PREVIEW_USER;
  const password = process.env.NOVA_PREVIEW_PASSWORD;

  // Fail closed when Vercel env variables were not provisioned.
  if (!username || !password || password.length < 20) {
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
      authorized = colon > 0 &&
        decoded.slice(0, colon) === username &&
        decoded.slice(colon + 1) === password;
    } catch { authorized = false; }
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

  const pathname = request.nextUrl.pathname;
  // Temporary VIEW-ONLY mode. Never release financial writes until backend RBAC/DB are validated.
  if ((pathname.startsWith('/api/') || pathname.startsWith('/v1/')) &&
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return NextResponse.json({
      code: 'READ_ONLY_HOMOLOGATION',
      message: 'Gravacoes temporariamente bloqueadas durante homologacao.'
    }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }

  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
