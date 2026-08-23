import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { overallRating, RATING_ITEMS } from '@/lib/reviewRating';
import { STRUCTURE_TYPE_LABELS } from '@/lib/structureType';
import { logoutAction } from '../login/actions';
import { ReviewActions } from './ReviewActions';

const PAGE_SIZE = 20;

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;

  const pendingWhere = { isPublished: false, rejectedAt: null } as const;

  const totalCount = await prisma.review.count({ where: pendingWhere });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1), totalPages);

  const reviews = await prisma.review.findMany({
    where: pendingWhere,
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
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
          <p style={{ fontSize: '14px', color: '#718096', marginTop: '4px' }}>{totalCount}件</p>
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
                      総合 {'★'.repeat(Math.round(overallRating(review)))}
                      {'☆'.repeat(5 - Math.round(overallRating(review)))}
                    </span>
                    <span style={{ fontSize: '12px', color: '#718096' }}>
                      {STRUCTURE_TYPE_LABELS[review.structureType]}
                    </span>
                    {review.workYear && (
                      <span style={{ fontSize: '12px', color: '#718096' }}>
                        {review.workYear}年施工
                      </span>
                    )}
                  </div>

                  <div
                    style={{ display: 'flex', gap: '12px', margin: '0 0 8px', flexWrap: 'wrap' }}
                  >
                    {RATING_ITEMS.map((item) => (
                      <span key={item.name} style={{ fontSize: '13px', color: '#4a5568' }}>
                        {item.label}: {'★'.repeat(review[item.name])}
                        {'☆'.repeat(5 - review[item.name])}
                      </span>
                    ))}
                  </div>

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

      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            marginTop: '24px',
          }}
        >
          <Link
            href={`/admin/reviews?page=${page - 1}`}
            aria-disabled={page <= 1}
            style={{
              padding: '6px 14px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '13px',
              color: page <= 1 ? '#cbd5e0' : '#4a5568',
              pointerEvents: page <= 1 ? 'none' : 'auto',
              textDecoration: 'none',
            }}
          >
            ← 前へ
          </Link>
          <span style={{ fontSize: '13px', color: '#718096' }}>
            {page} / {totalPages}
          </span>
          <Link
            href={`/admin/reviews?page=${page + 1}`}
            aria-disabled={page >= totalPages}
            style={{
              padding: '6px 14px',
              border: '1px solid #cbd5e0',
              borderRadius: '6px',
              fontSize: '13px',
              color: page >= totalPages ? '#cbd5e0' : '#4a5568',
              pointerEvents: page >= totalPages ? 'none' : 'auto',
              textDecoration: 'none',
            }}
          >
            次へ →
          </Link>
        </div>
      )}
    </div>
  );
}
