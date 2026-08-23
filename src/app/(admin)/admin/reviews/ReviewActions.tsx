'use client';

import { useTransition } from 'react';
import { approveReview, rejectReview } from './actions';

type Props = {
  reviewId: number;
};

export function ReviewActions({ reviewId }: Props) {
  const [approvePending, startApprove] = useTransition();
  const [rejectPending, startReject] = useTransition();

  const handleReject = () => {
    const reason = window.prompt(
      '却下理由を入力してください（投稿者に表示されます。空欄でも却下できます）\nキャンセルすると却下されません。',
    );
    if (reason === null) return;
    startReject(() => rejectReview(reviewId, reason.trim()));
  };

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
        onClick={handleReject}
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
        {rejectPending ? '処理中...' : '却下'}
      </button>
    </div>
  );
}
