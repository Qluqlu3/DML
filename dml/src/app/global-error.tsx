'use client';

import { useEffect } from 'react';
import './globals.css';

// ルートレイアウト自体が失敗した場合の最後の受け皿。
// このファイルはルートレイアウトを置き換えるため、自前で<html>/<body>を持つ必要があり、
// Chakra UIのProviderも利用できない（クライアントコンポーネント必須のためmetadataも使えない）。
export default function GlobalError({
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
    <html lang='ja'>
      <body style={{ background: '#f7fafc' }}>
        <title>エラーが発生しました | DML</title>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '40px',
              maxWidth: '480px',
              textAlign: 'center',
            }}
          >
            <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#1a202c', margin: 0 }}>
              エラーが発生しました
            </h1>
            <p style={{ fontSize: '14px', color: '#718096', marginTop: '12px' }}>
              一時的な問題の可能性があります。少し待ってから再試行してください。
            </p>
            <button
              type='button'
              onClick={() => unstable_retry()}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                background: '#f6851f',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              再試行する
            </button>
            {error.digest && (
              <p style={{ fontSize: '12px', color: '#a0aec0', marginTop: '16px' }}>
                エラーID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
