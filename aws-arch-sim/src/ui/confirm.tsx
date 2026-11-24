import { Button, Dialog, Portal } from '@chakra-ui/react';
import { create } from 'zustand';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** 取り消せない・記録が消えるなど、注意が必要な操作 */
  danger?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const useConfirmStore = create<{ pending: Pending | null }>()(() => ({ pending: null }));

/** window.confirm の代わり。OK で true、キャンセル・閉じるで false */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  useConfirmStore.getState().pending?.resolve(false);
  return new Promise((resolve) => useConfirmStore.setState({ pending: { ...options, resolve } }));
}

function settle(ok: boolean) {
  const { pending } = useConfirmStore.getState();
  useConfirmStore.setState({ pending: null });
  pending?.resolve(ok);
}

/** 確認ダイアログの置き場所（Provider に 1 つだけ置く） */
export function ConfirmDialogHost() {
  const pending = useConfirmStore((s) => s.pending);
  return (
    <Dialog.Root
      role='alertdialog'
      open={pending !== null}
      onOpenChange={(e) => {
        if (!e.open) settle(false);
      }}
      placement='center'
      size='sm'
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{pending?.title}</Dialog.Title>
            </Dialog.Header>
            {pending?.message && (
              <Dialog.Body color='fg.muted' fontSize='sm'>
                {pending.message}
              </Dialog.Body>
            )}
            <Dialog.Footer>
              <Button variant='outline' colorPalette='gray' onClick={() => settle(false)}>
                キャンセル
              </Button>
              <Button colorPalette={pending?.danger ? 'red' : 'aws'} onClick={() => settle(true)}>
                {pending?.confirmLabel ?? 'OK'}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
