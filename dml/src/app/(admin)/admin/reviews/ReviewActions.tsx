'use client';

import { useState, useTransition } from 'react';
import { approveReview, rejectReview } from './actions';

type Props = {
  reviewId: number;
};

export function ReviewActions({ reviewId }: Props) {
  const [approvePending, startApprove] = useTransition();
  const [rejectPending, startReject] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleApprove = () => {
    startApprove(async () => {
      const result = await approveReview(reviewId);
      setError(result.error ?? null);
    });
  };

  const handleReject = () => {
    const reason = window.prompt(
      '却下理由を入力してください（投稿者に表示されます。空欄でも却下できます）\nキャンセルすると却下されません。',
    );
    if (reason === null) return;
    startReject(async () => {
      const result = await rejectReview(reviewId, reason.trim());
      setError(result.error ?? null);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type='button'
          disabled={approvePending || rejectPending}
          onClick={handleApprove}
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
      {error && (
        <span
          role='alert'
          style={{ color: '#e53e3e', fontSize: '12px', textAlign: 'right', maxWidth: '220px' }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
