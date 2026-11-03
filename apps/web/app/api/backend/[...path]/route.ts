import { NextRequest, NextResponse } from 'next/server';
const cookieName = 'colmeia_session';
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  if (
    !['GET', 'HEAD'].includes(request.method) &&
    request.headers.get('origin') !== request.nextUrl.origin
  ) {
    return NextResponse.json({ message: 'Origem inválida' }, { status: 403 });
  }
  const { path } = await context.params;
  if (path.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)))
    return new NextResponse(null, { status: 400 });
  const endpoint = path.join('/');
  const token = request.cookies.get(cookieName)?.value;
  const headers = new Headers({ Accept: request.headers.get('accept') || 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (request.headers.has('content-type'))
    headers.set('Content-Type', request.headers.get('content-type')!);
  try {
    const upstream = await fetch(
      `${process.env.API_INTERNAL_URL || 'http://localhost:4000/api/v1'}/${endpoint}${request.nextUrl.search}`,
      {
        method: request.method,
        headers,
        cache: 'no-store',
        redirect: 'error',
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
        signal: request.signal,
      },
    );
    let response: NextResponse;
    if (
      upstream.ok &&
      ['auth/login', 'auth/register', 'auth/switch', 'auth/refresh'].includes(endpoint)
    ) {
      const { token: session, ...data } = await upstream.json();
      response = NextResponse.json(data, { status: upstream.status });
      response.cookies.set(cookieName, session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 8 * 3600,
      });
    } else {
      response = new NextResponse(upstream.body, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
          ...(upstream.headers.has('content-disposition')
            ? {
                'Content-Disposition': upstream.headers.get('content-disposition')!,
                'X-Content-Type-Options': 'nosniff',
              }
            : {}),
          ...(upstream.headers.has('x-vercel-ai-ui-message-stream')
            ? { 'x-vercel-ai-ui-message-stream': 'v1', 'X-Accel-Buffering': 'no' }
            : {}),
        },
      });
    }
    response.headers.set('Cache-Control', 'no-store');
    if ((endpoint === 'auth/logout' && upstream.ok) || upstream.status === 401)
      response.cookies.delete(cookieName);
    return response;
  } catch {
    return NextResponse.json({ message: 'API indisponível. Tente novamente.' }, { status: 502 });
  }
}
export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
