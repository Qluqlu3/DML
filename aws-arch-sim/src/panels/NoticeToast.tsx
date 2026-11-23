import { useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import styles from './NoticeToast.module.css';

export function NoticeToast() {
  const notice = useCanvasStore((s) => s.notice);
  const dismiss = useCanvasStore((s) => s.dismissNotice);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismiss, 4000);
    return () => clearTimeout(timer);
  }, [notice, dismiss]);

  if (!notice) return null;
  return (
    <div className={`${styles.toast} ${styles[notice.tone]}`} role='status'>
      {notice.text}
      <button type='button' className={styles.close} onClick={dismiss} aria-label='閉じる'>
        ×
      </button>
    </div>
  );
}
