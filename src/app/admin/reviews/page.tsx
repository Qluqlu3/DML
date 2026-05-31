import { prisma } from '@/lib/prisma';
import { logoutAction } from '../login/actions';
import { ReviewActions } from './ReviewActions';

export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({
    where: { isPublished: false },
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

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
            承認待ちレビュー
          </h1>
          <p style={{ fontSize: '14px', color: '#718096', marginTop: '4px' }}>{reviews.length}件</p>
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

      {reviews.length === 0 ? (
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
          承認待ちのレビューはありません
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reviews.map((review) => (
            <div
              key={review.id}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <a
                      href={`/companies/${review.company.id}`}
                      target='_blank'
                      rel='noreferrer'
                      style={{ color: '#2b6cb0', fontWeight: 600, fontSize: '15px' }}
                    >
                      {review.company.name}
                    </a>
                    <span
                      style={{
                        background: '#faf089',
                        color: '#744210',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {'★'.repeat(review.rating)}
                      {'☆'.repeat(5 - review.rating)} {review.rating}
                    </span>
                    {review.workType && (
                      <span style={{ fontSize: '12px', color: '#718096' }}>{review.workType}</span>
                    )}
                    {review.workYear && (
                      <span style={{ fontSize: '12px', color: '#718096' }}>
                        {review.workYear}年施工
                      </span>
                    )}
                  </div>

                  {review.title && (
                    <p
                      style={{
                        fontWeight: 600,
                        margin: '0 0 6px',
                        fontSize: '14px',
                        color: '#2d3748',
                      }}
                    >
                      {review.title}
                    </p>
                  )}
                  <p
                    style={{
                      margin: '0 0 8px',
                      fontSize: '14px',
                      color: '#4a5568',
                      lineHeight: 1.6,
                    }}
                  >
                    {review.body}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#a0aec0' }}>
                    <span>投稿者: {review.authorName ?? '匿名'}</span>
                    <span>
                      {new Date(review.createdAt).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                <ReviewActions reviewId={review.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
