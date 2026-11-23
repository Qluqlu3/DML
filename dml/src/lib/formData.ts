// FormData の値を文字列として取り出す（未送信・File の場合は空文字）。
export function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}
