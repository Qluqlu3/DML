import { type ArchDocument, parseDocument } from '../engine/document';

const PREFIX = 'aws-arch-sim:';
export const SANDBOX_KEY = `${PREFIX}sandbox`;

/** localStorage が使えない環境（プライベートモード等）でも落ちないようにする */
export function loadStored(key: string): ArchDocument | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const result = parseDocument(JSON.parse(raw));
    return result.ok ? result.value : null;
  } catch {
    return null;
  }
}

export function saveStored(key: string, doc: ArchDocument): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export function downloadJson(doc: ArchDocument, filename: string) {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<ArchDocument> {
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    throw new Error('JSON として読み込めませんでした');
  }
  const result = parseDocument(json);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
