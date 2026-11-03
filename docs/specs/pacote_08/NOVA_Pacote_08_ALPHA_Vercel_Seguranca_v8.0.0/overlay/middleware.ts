import { NextRequest, NextResponse } from 'next/server';

/**
 * NOVA P08 – TEMPORARY Preview gate, not a user authentication system.
 * Denies deployment when credentials are missing. Financial writes are disabled.
 * Replace only after real sessions, ownership checks and RBAC are implemented.
 */
export function middleware(request: NextRequest) {
  const username = process.env.NOVA_PREVIEW_USER;
  const password = process.env.NOVA_PREVIEW_PASSWORD;
  const production = process.env.VERCEL_ENV === 'production';

  if (production || !username || !password || password.length < 20) {
    return new NextResponse('NOVA indisponível: ambiente não homologado.', { status: 503 });
  }

  const auth = request.headers.get('authorization');
  let valid = false;
  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const delimiter = decoded.indexOf(':');
      const receivedUser = decoded.slice(0, delimiter);
      const receivedPassword = decoded.slice(delimiter + 1);
      // A preview access gate, not a replacement for cryptographically verified sessions.
      valid = delimiter > 0 && receivedUser === username && receivedPassword === password;
    } catch { /* malformed credentials */ }
  }
  if (!valid) {
    return new NextResponse('Autenticação necessária para homologação NOVA.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="NOVA Preview"', 'Cache-Control': 'no-store' },
    });
  }

  const pathname = request.nextUrl.pathname;
  if ((pathname.startsWith('/api/') || pathname.startsWith('/v1/')) && !['GET','HEAD','OPTIONS'].includes(request.method)) {
    return NextResponse.json({ code: 'PREVIEW_READ_ONLY', message: 'Operações de gravação desativadas até a autenticação definitiva e autorização por workspace.' }, { status: 403 });
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
