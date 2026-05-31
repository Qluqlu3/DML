'use client';

import { useTransition } from 'react';
import { approveReview, rejectReview } from './actions';

type Props = {
  reviewId: number;
};

export function ReviewActions({ reviewId }: Props) {
  const [approvePending, startApprove] = useTransition();
  const [rejectPending, startReject] = useTransition();

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button
        type='button'
        disabled={approvePending || rejectPending}
        onClick={() => startApprove(() => approveReview(reviewId))}
        style={{
          padding: '6px 14px',
          background: approvePending ? '#a0aec0' : '#38a169',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: approvePending ? 'default' : 'pointer',
        }}
      >
        {approvePending ? '処理中...' : '承認'}
      </button>
      <button
        type='button'
        disabled={approvePending || rejectPending}
        onClick={() => startReject(() => rejectReview(reviewId))}
        style={{
          padding: '6px 14px',
          background: rejectPending ? '#a0aec0' : '#e53e3e',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: rejectPending ? 'default' : 'pointer',
        }}
      >
        {rejectPending ? '処理中...' : '却下（削除）'}
      </button>
    </div>
  );
}
