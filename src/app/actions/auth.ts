'use server';

import { headers } from 'next/headers';
import { AuthAttemptType } from '@/generated/prisma/enums';
import { loginSchema, registerSchema } from '@/lib/authSchema';
import { hashPassword, verifyPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';
import { createUserSession, destroyUserSession } from '@/lib/userSession';

export type AuthState = {
  error?: string;
  success?: boolean;
};

// ユーザーが存在しない場合もこのダミーハッシュで検証し、
// 応答時間の差からメールアドレスの存在有無が推測されないようにする
const DUMMY_HASH = hashPassword('dummy-password-for-constant-time-check');

const RATE_LIMIT_ERROR = 'しばらく時間をおいてから再度お試しください';

// ログイン: IPからの総当たり・DoS(scryptはCPU負荷が高い)と、
// 特定アカウントへの総当たりの両方を防ぐため、IP単位・メールアドレス単位の両方で制限する
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP = 20;
const LOGIN_MAX_PER_EMAIL = 5;

// 会員登録: 同一IP/メールアドレスからの使い捨てアカウント量産を防ぐ
const REGISTER_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_MAX_PER_IP = 5;
const REGISTER_MAX_PER_EMAIL = 3;

async function getClientIp(): Promise<string | null> {
  const headerList = await headers();
  return headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}

// 試行を記録した上で、直近ウィンドウ内の件数がIP・メールアドレスいずれかの上限を
// 超えていないか判定する。先に記録してから数えるため、連打してもウィンドウの
// リセットをすり抜けられない。
async function recordAttemptAndCheckLimit(
  type: AuthAttemptType,
  windowMs: number,
  ip: string | null,
  email: string | null,
  maxPerIp: number,
  maxPerEmail: number,
): Promise<boolean> {
  await prisma.authAttempt.create({ data: { type, ip, email } });

  const createdAt = { gte: new Date(Date.now() - windowMs) };
  const [ipCount, emailCount] = await Promise.all([
    ip ? prisma.authAttempt.count({ where: { type, ip, createdAt } }) : Promise.resolve(0),
    email ? prisma.authAttempt.count({ where: { type, email, createdAt } }) : Promise.resolve(0),
  ]);

  return ipCount > maxPerIp || emailCount > maxPerEmail;
}

export async function registerAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { email, name, password } = parsed.data;

  const ip = await getClientIp();
  const limited = await recordAttemptAndCheckLimit(
    AuthAttemptType.REGISTER,
    REGISTER_WINDOW_MS,
    ip,
    email,
    REGISTER_MAX_PER_IP,
    REGISTER_MAX_PER_EMAIL,
  );
  if (limited) {
    return { error: RATE_LIMIT_ERROR };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'このメールアドレスは既に登録されています' };
  }

  const user = await prisma.user.create({
    data: { email, name: name || null, passwordHash: hashPassword(password) },
  });

  await createUserSession(user.id);
  return { success: true };
}

export async function loginAction(_prevState: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  const { email, password } = parsed.success ? parsed.data : { email: '', password: '' };

  const ip = await getClientIp();
  const limited = await recordAttemptAndCheckLimit(
    AuthAttemptType.LOGIN,
    LOGIN_WINDOW_MS,
    ip,
    email || null,
    LOGIN_MAX_PER_IP,
    LOGIN_MAX_PER_EMAIL,
  );
  if (limited) {
    return { error: RATE_LIMIT_ERROR };
  }

  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const passwordHash = user?.passwordHash ?? DUMMY_HASH;
  const isValid = verifyPassword(password, passwordHash) && user !== null;

  if (!isValid) {
    return { error: 'メールアドレスまたはパスワードが違います' };
  }

  await createUserSession(user.id);
  return { success: true };
}

export async function logoutAction() {
  await destroyUserSession();
}
