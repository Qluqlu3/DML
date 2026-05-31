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
            gap: '12px',
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600 }}>DML 管理画面</span>
        </header>
        <main style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>{children}</main>
      </body>
    </html>
  );
}
