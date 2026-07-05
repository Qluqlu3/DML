import { type NextRequest, NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE = 'admin_session';
const ADMIN_LOGIN_PATH = '/admin/login';

// Basic認証: /admin 全体（ログイン画面自体も含む）の手前に置く常時有効なゲート。
// リバースプロキシの有無に関わらず機能する（ヘッダー偽装で回避できない）。
function checkBasicAuth(request: NextRequest): boolean {
  const user = process.env.ADMIN_BASIC_AUTH_USER;
  const password = process.env.ADMIN_BASIC_AUTH_PASSWORD;
  if (!user || !password) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Basic ')) return false;

  let decoded: string;
  try {
    decoded = atob(authHeader.slice('Basic '.length));
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) return false;

  const providedUser = decoded.slice(0, separatorIndex);
  const providedPassword = decoded.slice(separatorIndex + 1);
  return providedUser === user && providedPassword === password;
}

// IP許可リスト（任意）: ADMIN_ALLOWED_IPS が設定されている場合のみ有効。
// X-Forwarded-For はクライアントが自由に偽装できるヘッダーのため、
// 信頼できるリバースプロキシ（実IPで上書きするもの）を手前に置いた場合のみ意味を持つ。
function checkIpAllowed(request: NextRequest): boolean {
  const allowList = process.env.ADMIN_ALLOWED_IPS;
  if (!allowList) return true;

  const allowed = allowList
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;

  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return !!clientIp && allowed.includes(clientIp);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  if (!checkBasicAuth(request)) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' },
    });
  }

  if (!checkIpAllowed(request)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (pathname === ADMIN_LOGIN_PATH || pathname === `${ADMIN_LOGIN_PATH}/`) {
    return NextResponse.next();
  }

  const session = request.cookies.get(ADMIN_SESSION_COOKIE);
  if (!session?.value) {
    const loginUrl = new URL(ADMIN_LOGIN_PATH, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
