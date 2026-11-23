/** IPv4 CIDR の簡易計算（SG ルールの判定用） */

type Range = { start: number; end: number };

export function parseCidr(cidr: string): Range | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/.exec(cidr.trim());
  if (!m) return null;
  const octets = m.slice(1, 5).map(Number);
  const bits = Number(m[5]);
  if (octets.some((o) => o > 255) || bits > 32) return null;
  const ip = octets.reduce((acc, o) => acc * 256 + o, 0);
  const size = 2 ** (32 - bits);
  const start = Math.floor(ip / size) * size;
  return { start, end: start + size - 1 };
}

/** outer が inner を完全に含むか */
export function cidrContains(outer: string, inner: string): boolean {
  const a = parseCidr(outer);
  const b = parseCidr(inner);
  return !!a && !!b && a.start <= b.start && b.end <= a.end;
}
