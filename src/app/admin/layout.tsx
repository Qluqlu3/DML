export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ja'>
      <body
        style={{
          margin: 0,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: '#f7fafc',
          minHeight: '100vh',
        }}
      >
        <header
          style={{
            background: '#1a202c',
            color: '#fff',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600 }}>DML 管理画面</span>
          <nav style={{ display: 'flex', gap: '16px' }}>
            <a href='/admin/reviews' style={{ color: '#cbd5e0', fontSize: '13px' }}>
              承認待ちレビュー
            </a>
            <a href='/admin/companies' style={{ color: '#cbd5e0', fontSize: '13px' }}>
              企業のWEBサイト登録
            </a>
          </nav>
        </header>
        <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>{children}</main>
      </body>
    </html>
  );
}
