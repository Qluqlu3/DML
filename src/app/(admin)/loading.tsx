// 管理画面用のローディング表示。公開サイト側の loading.tsx は Chakra UI に依存するため、
// 別のルートレイアウト配下となる管理画面では使えない。
export default function AdminLoading() {
  return (
    <div style={{ padding: '60px', textAlign: 'center', color: '#a0aec0', fontSize: '14px' }}>
      読み込み中...
    </div>
  );
}
