import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

// 管理者・一般ユーザーのセッションで共通の、DB照合型ランダムトークンcookieの読み書き。
// トークン自体の保存先(テーブル)は呼び出し側が受け持つ。

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function sessionExpiresAt(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}

export function isSessionActive(session: { expiresAt: Date } | null): boolean {
  return session !== null && session.expiresAt >= new Date();
}

export async function setSessionCookie(name: string, token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function getSessionToken(name: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

export async function deleteSessionCookie(name: string) {
  const cookieStore = await cookies();
  cookieStore.delete(name);
}
