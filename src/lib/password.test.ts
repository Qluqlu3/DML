import { describe, expect, it } from 'vitest';
import { dummyPasswordHash, hashPassword, verifyPassword } from './password';

describe('hashPassword / verifyPassword', () => {
  it('ハッシュ化したパスワードを検証できる', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('同じパスワードでも毎回異なるsaltが使われる', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('パスワードが違えば検証は失敗する', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it.each([
    ['空文字', ''],
    ['区切り文字なし', 'noseparator'],
    ['saltが空', ':abcdef'],
    ['ハッシュ部が空', 'abcdef:'],
    // Buffer.from('zz', 'hex') は空Bufferになる。keylen=0のscryptも空Bufferを返すため、
    // 長さ比較を通過して timingSafeEqual(空, 空) === true となり、
    // 「どんなパスワードでも認証が通る」状態になっていた。
    ['ハッシュ部が不正な16進数', 'deadbeef:zz'],
    ['ハッシュ部が非16進文字を含む', 'deadbeef:xyz!'],
  ])('壊れた保存値(%s)は例外を投げずにfalseを返す', async (_label, storedHash) => {
    expect(await verifyPassword('any-password', storedHash)).toBe(false);
    expect(await verifyPassword('completely-different', storedHash)).toBe(false);
  });

  it('dummyPasswordHashは実ハッシュと同じ形式で、毎回同じ値を返す', async () => {
    const [a, b] = await Promise.all([dummyPasswordHash(), dummyPasswordHash()]);
    expect(a).toBe(b);
    expect(await verifyPassword('dummy-password-for-constant-time-check', a)).toBe(true);
    expect(await verifyPassword('anything-else', a)).toBe(false);
  });

  // scryptSyncはイベントループを占有するため、1回(約40ms)ごとにサーバー全体が停止する。
  // 非同期版で実装されている限り、ハッシュ計算中も他の処理が進み続ける。
  it('ハッシュ計算中もイベントループがブロックされない', async () => {
    const CONCURRENCY = 16;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks++;
    }, 1);

    try {
      const started = Date.now();
      await Promise.all(
        Array.from({ length: CONCURRENCY }, (_, i) => hashPassword(`password-${i}`)),
      );
      // 計測に足る時間ハッシュ計算が走ったことを確認しておく
      expect(Date.now() - started).toBeGreaterThan(20);
    } finally {
      clearInterval(timer);
    }

    // 同期実装なら0〜1回程度しか進まない
    expect(ticks).toBeGreaterThan(5);
  });
});
