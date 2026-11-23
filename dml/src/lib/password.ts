import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// scryptSync はNodeの単一のイベントループスレッドを占有するため、
// 1回の呼び出し(約40ms)の間サーバー全体が他のリクエストを一切処理できなくなる。
// 非同期版はlibuvのスレッドプールで実行されるのでイベントループを止めない。
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) return false;

  const storedKey = Buffer.from(hashHex, 'hex');
  if (storedKey.length === 0) return false;

  const derivedKey = await scryptAsync(password, salt, storedKey.length);
  if (storedKey.length !== derivedKey.length) return false;

  return timingSafeEqual(storedKey, derivedKey);
}

// アカウントが存在しない場合もこのダミーハッシュで検証し、
// 応答時間の差からアカウントの存在有無が推測されないようにする。
// モジュール読み込み時ではなく初回利用時に一度だけ生成する（起動時のブロックを避ける）。
let dummyHashPromise: Promise<string> | undefined;

export function dummyPasswordHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('dummy-password-for-constant-time-check');
  return dummyHashPromise;
}
