import { Fragment, type ReactNode } from 'react';

/** 同じ文字列が複数あっても重ならないキーを付ける（並びが変わらない静的な文章用） */
function keyed(items: string[]): { key: string; value: string }[] {
  const seen = new Map<string, number>();
  return items.map((value) => {
    const n = (seen.get(value) ?? 0) + 1;
    seen.set(value, n);
    return { key: `${value}#${n}`, value };
  });
}

/** **太字** と `コード` を変換する */
function inline(text: string): ReactNode[] {
  return keyed(text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)).map(({ key, value }) => {
    if (value.startsWith('**') && value.endsWith('**')) {
      return <strong key={key}>{value.slice(2, -2)}</strong>;
    }
    if (value.startsWith('`') && value.endsWith('`'))
      return <code key={key}>{value.slice(1, -1)}</code>;
    return <Fragment key={key}>{value}</Fragment>;
  });
}

type Group = { list: boolean; lines: { key: string; value: string }[] };

/** 段落の中で、「- 」で始まる行の並びと、それ以外の行の並びに分ける */
function groupLines(block: string): Group[] {
  const groups: Group[] = [];
  for (const line of keyed(block.split('\n'))) {
    const list = line.value.startsWith('- ');
    const last = groups[groups.length - 1];
    if (last && last.list === list) last.lines.push(line);
    else groups.push({ list, lines: [line] });
  }
  return groups;
}

/** レッスン文用の簡易表示。空行で段落、「- 」で始まる行を箇条書きにする */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {keyed(text.split(/\n\s*\n/)).flatMap(({ key, value: block }) =>
        groupLines(block).map((g) =>
          g.list ? (
            <ul key={`${key}:${g.lines[0]?.key}`}>
              {g.lines.map((l) => (
                <li key={l.key}>{inline(l.value.slice(2))}</li>
              ))}
            </ul>
          ) : (
            <p key={`${key}:${g.lines[0]?.key}`}>
              {g.lines.map((l, i) => (
                <Fragment key={l.key}>
                  {i > 0 && <br />}
                  {inline(l.value)}
                </Fragment>
              ))}
            </p>
          ),
        ),
      )}
    </div>
  );
}
