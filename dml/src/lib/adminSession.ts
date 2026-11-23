import { prisma } from '@/lib/prisma';
import {
  deleteSessionCookie,
  generateSessionToken,
  getSessionToken,
  isSessionActive,
  sessionExpiresAt,
  setSessionCookie,
} from '@/lib/sessionCookie';

export const ADMIN_SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8時間

export async function createAdminSession(adminUserId: number) {
  const token = generateSessionToken();
  const expiresAt = sessionExpiresAt(SESSION_TTL_MS);
  await prisma.adminSession.create({ data: { token, adminUserId, expiresAt } });
  await setSessionCookie(ADMIN_SESSION_COOKIE, token, expiresAt);
}

// Proxy(cookieをリクエストから直接読む)とServer Components/Actionsの両方から使う。
export async function hasActiveAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const session = await prisma.adminSession.findUnique({ where: { token } });
  return isSessionActive(session);
}

export async function getCurrentAdmin() {
  const token = await getSessionToken(ADMIN_SESSION_COOKIE);
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({
    where: { token },
    include: { adminUser: true },
  });
  return session && isSessionActive(session) ? session.adminUser : null;
}

export async function destroyAdminSession() {
  const token = await getSessionToken(ADMIN_SESSION_COOKIE);
  if (token) {
    await prisma.adminSession.delete({ where: { token } }).catch(() => {});
  }
  await deleteSessionCookie(ADMIN_SESSION_COOKIE);
}
