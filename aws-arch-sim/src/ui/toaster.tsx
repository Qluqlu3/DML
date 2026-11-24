import { Toaster as ChakraToaster, createToaster, Portal, Stack, Toast } from '@chakra-ui/react';
import { useEffect } from 'react';
import { useCanvasStore } from '../store/canvasStore';

export const toaster = createToaster({ placement: 'bottom', duration: 4000, max: 3 });

/** 画面下の通知。キャンバスストアの notify() を Chakra のトーストで表示する */
export function Toaster() {
  // ストアの通知をトーストに流す（notify の呼び出し側はそのまま）
  useEffect(
    () =>
      useCanvasStore.subscribe((s, prev) => {
        if (!s.notice || s.notice === prev.notice) return;
        // 以前の通知と同じく、常に最新の 1 件だけを出す
        toaster.dismiss();
        toaster.create({
          id: `notice-${s.notice.id}`,
          title: s.notice.text,
          type: s.notice.tone === 'error' ? 'error' : 'info',
          closable: true,
        });
      }),
    [],
  );

  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: '4' }}>
        {(toast) => (
          <Toast.Root width={{ md: 'md' }}>
            <Toast.Indicator />
            <Stack gap='1' flex='1' maxWidth='100%'>
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && <Toast.Description>{toast.description}</Toast.Description>}
            </Stack>
            {toast.closable && <Toast.CloseTrigger aria-label='閉じる' />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  );
}
