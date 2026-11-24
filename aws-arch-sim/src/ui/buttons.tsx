import { Button, type ButtonProps } from '@chakra-ui/react';
import { forwardRef } from 'react';

/**
 * アプリ共通のボタン。Chakra の Button に、用途ごとの大きさ・配色を決めたもの。
 * リンクにしたいときは asChild で react-router の Link を包む。
 */

/** 画面上部の暗いヘッダーに置くボタン */
export const ToolbarButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button
    ref={ref}
    size='xs'
    variant='outline'
    colorPalette='gray'
    color='fg'
    borderColor='border.emphasized'
    textDecoration='none'
    fontWeight='normal'
    fontSize='13px'
    _hover={{ bg: 'bg.emphasized' }}
    {...props}
  />
));
ToolbarButton.displayName = 'ToolbarButton';

/** 主な操作（次へ・提出・適用など） */
export const PrimaryButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button
    ref={ref}
    size='sm'
    colorPalette='aws'
    fontWeight='bold'
    textDecoration='none'
    alignSelf='flex-start'
    {...props}
  />
));
PrimaryButton.displayName = 'PrimaryButton';

/** 補助的な操作（ヒント・答えを見る・戻るなど） */
export const SecondaryButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button
    ref={ref}
    size='xs'
    variant='outline'
    colorPalette='gray'
    color='fg'
    fontWeight='normal'
    textDecoration='none'
    {...props}
  />
));
SecondaryButton.displayName = 'SecondaryButton';

/** パネル見出しの「たたむ / 開く」 */
export const CollapseButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button
    ref={ref}
    size='2xs'
    variant='outline'
    colorPalette='gray'
    color='fg'
    borderColor='border.emphasized'
    fontWeight='normal'
    {...props}
  />
));
CollapseButton.displayName = 'CollapseButton';
