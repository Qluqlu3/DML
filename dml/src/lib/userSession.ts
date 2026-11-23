import { prisma } from '@/lib/prisma';
import {
  deleteSessionCookie,
  generateSessionToken,
  getSessionToken,
  isSessionActive,
  sessionExpiresAt,
  setSessionCookie,
} from '@/lib/sessionCookie';

const SESSION_COOKIE = 'user_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30日

export async function createUserSession(userId: number) {
  const token = generateSessionToken();
  const expiresAt = sessionExpiresAt(SESSION_TTL_MS);
  await prisma.userSession.create({ data: { token, userId, expiresAt } });
  await setSessionCookie(SESSION_COOKIE, token, expiresAt);
}

export async function getCurrentUser() {
  const token = await getSessionToken(SESSION_COOKIE);
  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { token },
    include: { user: true },
  });
  return session && isSessionActive(session) ? session.user : null;
}

export async function destroyUserSession() {
  const token = await getSessionToken(SESSION_COOKIE);
  if (token) {
    await prisma.userSession.delete({ where: { token } }).catch(() => {});
  }
  await deleteSessionCookie(SESSION_COOKIE);
}
