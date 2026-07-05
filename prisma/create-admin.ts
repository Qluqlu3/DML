/**
 * prisma/create-admin.ts
 * 管理画面ログイン用のユーザーをDBに登録する一回限りのスクリプト。
 * 登録画面は用意していないため、これを手動で実行して管理者アカウントを作る。
 *
 * 実行:
 *   pnpm admin:create-user [username]
 *
 * パスワードは実行のたびにランダムな15文字（大小英字・数字・記号混在）で生成し、
 * scryptでハッシュ化してDBに保存する。平文は admin-credentials.local.md にのみ書き出す
 * （.gitignore 済み・標準出力には出さない）。
 */

import 'dotenv/config';
import { randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { hashPassword } from '../src/lib/password';

const USERNAME = process.argv[2] || 'admin';
const PASSWORD_LENGTH = 15;

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}';
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

function randomChar(pool: string): string {
  return pool[randomInt(pool.length)];
}

// 各文字種を最低1つ含めた上でシャッフルする（暗号論的乱数のみ使用）
function generatePassword(length: number): string {
  const required = [randomChar(LOWER), randomChar(UPPER), randomChar(DIGITS), randomChar(SYMBOLS)];
  const rest = Array.from({ length: length - required.length }, () => randomChar(ALL));
  const chars = [...required, ...rest];

  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const CREDENTIALS_FILE = resolve(__dirname, '..', 'admin-credentials.local.md');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = generatePassword(PASSWORD_LENGTH);
  const passwordHash = hashPassword(password);

  const user = await prisma.adminUser.upsert({
    where: { username: USERNAME },
    create: { username: USERNAME, passwordHash },
    update: { passwordHash },
  });

  const content = `# 管理画面ログイン情報（社外秘・gitでは管理していません）

生成日時: ${new Date().toISOString()}

- ID: ${user.username}
- PASSWORD: ${password}

パスワードはscryptでハッシュ化してDBに保存済みで、平文はこのファイルにしか残りません。
再発行したい場合は \`pnpm admin:create-user\` を再実行してください（同じIDなら上書きされます）。
`;

  writeFileSync(CREDENTIALS_FILE, content, { mode: 0o600 });

  console.log(`管理者ユーザー "${user.username}" を登録しました。`);
  console.log(`認証情報は ${CREDENTIALS_FILE} に保存しました（gitでは管理されません）。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
