// ?page= の値を 1〜総ページ数の範囲に丸める。不正値は1ページ目として扱う。
export function resolvePage(pageParam: string | undefined, totalCount: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const requested = Number.parseInt(pageParam ?? '1', 10) || 1;
  const page = Math.min(Math.max(1, requested), totalPages);
  return { page, totalPages };
}
