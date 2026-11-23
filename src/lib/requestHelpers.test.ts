import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders } from './clientIp';
import { getFormString } from './formData';

describe('clientIpFromHeaders', () => {
  it('X-Forwarded-For の先頭のアドレスを返す', () => {
    const headers = new Headers({ 'x-forwarded-for': ' 203.0.113.1 , 10.0.0.1' });
    expect(clientIpFromHeaders(headers)).toBe('203.0.113.1');
  });

  it('ヘッダーが無い・空なら null', () => {
    expect(clientIpFromHeaders(new Headers())).toBeNull();
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '' }))).toBeNull();
  });
});

describe('getFormString', () => {
  it('文字列値はそのまま、未送信やFileは空文字を返す', () => {
    const formData = new FormData();
    formData.set('name', ' taro ');
    formData.set('file', new Blob(['x']));
    expect(getFormString(formData, 'name')).toBe(' taro ');
    expect(getFormString(formData, 'missing')).toBe('');
    expect(getFormString(formData, 'file')).toBe('');
  });
});
