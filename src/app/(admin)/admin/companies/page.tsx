import { prisma } from '@/lib/prisma';
import { logoutAction } from '../login/actions';
import { CompanyWebsiteForm } from './CompanyWebsiteForm';

const SEARCH_LIMIT = 50;

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const trimmedQ = q?.trim();

  const companies = trimmedQ
    ? await prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: trimmedQ, mode: 'insensitive' } },
            { furigana: { contains: trimmedQ, mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: SEARCH_LIMIT,
      })
    : [];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a202c', margin: 0 }}>
            企業のWEBサイト登録
          </h1>
          <p style={{ fontSize: '14px', color: '#718096', marginTop: '4px' }}>
            会社名で検索し、公式サイトのURLを登録・編集できます
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type='submit'
            style={{
              padding: '6px 14px',
              background: 'transparent',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#4a5568',
              cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </form>
      </div>

      <form
        method='GET'
        style={{ marginBottom: '20px', display: 'flex', gap: '8px', maxWidth: '480px' }}
      >
        <input
          name='q'
          type='text'
          defaultValue={trimmedQ ?? ''}
          placeholder='会社名で検索'
          style={{
            flex: '1',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #cbd5e0',
            fontSize: '14px',
            boxSizing: 'border-box',
          }}
        />
        <button
          type='submit'
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
          検索
        </button>
      </form>

      {!trimmedQ ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px',
            color: '#a0aec0',
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          会社名を入力して検索してください
        </div>
      ) : companies.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px',
            color: '#a0aec0',
            background: '#fff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
          「{trimmedQ}」に一致する企業が見つかりません
        </div>
      ) : (
        <>
          {companies.length === SEARCH_LIMIT && (
            <p style={{ fontSize: '12px', color: '#a0aec0', marginBottom: '12px' }}>
              先頭{SEARCH_LIMIT}件のみ表示しています。絞り込んでください。
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {companies.map((company) => (
              <div
                key={company.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '8px',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <a
                    href={`/companies/${company.id}`}
                    target='_blank'
                    rel='noreferrer'
                    style={{ color: '#2b6cb0', fontWeight: 600, fontSize: '15px' }}
                  >
                    {company.name}
                  </a>
                  <span style={{ fontSize: '12px', color: '#a0aec0' }}>
                    {company.prefectureName}
                  </span>
                </div>
                <CompanyWebsiteForm companyId={company.id} websiteUrl={company.websiteUrl} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
