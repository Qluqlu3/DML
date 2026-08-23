'use client';

import { useEffect } from 'react';

// 管理画面側のエラーバウンダリ。公開サイト側とは別のルートレイアウト配下なので
// Chakra UIは使えず、管理画面と同じインラインスタイルで組む。
export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '40px',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#1a202c', margin: 0 }}>
        エラーが発生しました
      </h1>
      <p style={{ fontSize: '14px', color: '#718096', marginTop: '8px' }}>
        操作は完了していない可能性があります。再試行しても解決しない場合は再ログインしてください。
      </p>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '20px' }}>
        <button
          type='button'
          onClick={() => unstable_retry()}
          style={{
            padding: '8px 16px',
            background: '#1a202c',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          再試行
        </button>
        <a
          href='/admin/login'
          style={{
            padding: '8px 16px',
            border: '1px solid #cbd5e0',
            borderRadius: '6px',
            fontSize: '14px',
            color: '#4a5568',
            textDecoration: 'none',
          }}
        >
          ログイン画面へ
        </a>
      </div>
      {error.digest && (
        <p style={{ fontSize: '12px', color: '#a0aec0', marginTop: '16px' }}>
          エラーID: {error.digest}
        </p>
      )}
    </div>
  );
}
