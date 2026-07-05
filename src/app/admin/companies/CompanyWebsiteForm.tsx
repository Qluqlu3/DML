'use client';

import { useActionState } from 'react';
import { updateCompanyWebsite, type UpdateWebsiteState } from './actions';

const initialState: UpdateWebsiteState = { success: false };

type Props = {
  companyId: number;
  websiteUrl: string | null;
};

export function CompanyWebsiteForm({ companyId, websiteUrl }: Props) {
  const action = updateCompanyWebsite.bind(null, companyId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form
      action={formAction}
      style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}
    >
      <input
        name='websiteUrl'
        type='text'
        defaultValue={websiteUrl ?? ''}
        placeholder='https://example.com'
        style={{
          flex: '1',
          minWidth: '220px',
          padding: '6px 10px',
          borderRadius: '6px',
          border: '1px solid #cbd5e0',
          fontSize: '13px',
        }}
      />
      <button
        type='submit'
        disabled={isPending}
        style={{
          padding: '6px 14px',
          background: isPending ? '#a0aec0' : '#1a202c',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: isPending ? 'default' : 'pointer',
        }}
      >
        {isPending ? '保存中...' : '保存'}
      </button>
      {state.error && <span style={{ color: '#e53e3e', fontSize: '12px' }}>{state.error}</span>}
      {!state.error && state.success && (
        <span style={{ color: '#38a169', fontSize: '12px' }}>保存しました</span>
      )}
    </form>
  );
}
