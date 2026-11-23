// X-Forwarded-For の先頭（クライアントに最も近いアドレス）を返す。
// このヘッダーはクライアントが自由に偽装できるため、信頼できるリバースプロキシが
// 実IPで上書きする構成でのみ意味を持つ点に注意。
export function clientIpFromHeaders(headers: Pick<Headers, 'get'>): string | null {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}
