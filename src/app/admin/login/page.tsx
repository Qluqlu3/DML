'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';

const initialState = { error: '' };

export default function AdminLoginPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: typeof initialState, formData: FormData) => {
      const result = await loginAction(formData);
      return result ?? initialState;
    },
    initialState,
  );

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '40px',
          width: '100%',
          maxWidth: '360px',
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', color: '#1a202c' }}>
          管理者ログイン
        </h1>
        <form action={formAction}>
          <div style={{ marginBottom: '16px' }}>
            <label
              htmlFor='password'
              style={{ display: 'block', fontSize: '14px', color: '#4a5568', marginBottom: '6px' }}
            >
              パスワード
            </label>
            <input
              id='password'
              name='password'
              type='password'
              required
              autoComplete='current-password'
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {state?.error && (
            <p style={{ color: '#e53e3e', fontSize: '13px', marginBottom: '12px' }}>
              {state.error}
            </p>
          )}
          <button
            type='submit'
            disabled={isPending}
            style={{
              width: '100%',
              padding: '10px',
              background: isPending ? '#a0aec0' : '#1a202c',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: isPending ? 'default' : 'pointer',
            }}
          >
            {isPending ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  );
}
