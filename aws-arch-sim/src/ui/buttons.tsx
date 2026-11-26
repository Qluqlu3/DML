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

/** 丸いチップ型のボタン（「○○ とは？」など、話題へのリンク） */
export const ChipButton = forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button
    ref={ref}
    size='2xs'
    variant='outline'
    colorPalette='gray'
    color='fg'
    bg='bg.panel'
    rounded='full'
    gap='1'
    ps='1'
    pe='2.5'
    fontSize='12px'
    fontWeight='normal'
    _hover={{ borderColor: 'fg.info', color: 'fg.info', bg: 'bg.panel' }}
    {...props}
  />
));
ChipButton.displayName = 'ChipButton';

/** 左寄せで複数行を折り返す、一覧の 1 行ぶんのボタン（中身は呼び出し側で並べる） */
const blockButtonBase: ButtonProps = {
  h: 'auto',
  w: 'full',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  textAlign: 'left',
  whiteSpace: 'normal',
  fontWeight: 'normal',
  colorPalette: 'gray',
  color: 'fg',
};

/**
 * 選択肢のボタン（クイズ）。result で正解・不正解の色を付ける。
 * 答えたあとは disabled にするが、色は薄めない。
 */
export const ChoiceButton = forwardRef<
  HTMLButtonElement,
  ButtonProps & { result?: 'correct' | 'wrong' }
>(({ result, ...props }, ref) => (
  <Button
    ref={ref}
    {...blockButtonBase}
    size='sm'
    variant='outline'
    flexDirection='column'
    gap='1'
    py='2'
    px='2.5'
    bg={result === 'correct' ? 'bg.success' : result === 'wrong' ? 'bg.error' : 'bg.panel'}
    borderColor={result === 'correct' ? 'fg.success' : result === 'wrong' ? 'fg.error' : 'border'}
    _hover={{ borderColor: result ? undefined : 'fg.info' }}
    _disabled={{ opacity: 1, cursor: 'default' }}
    {...props}
  />
));
ChoiceButton.displayName = 'ChoiceButton';

/** 開閉できる一覧の行（Linter の指摘など）。open のときは枠と背景を付ける */
export const RowButton = forwardRef<HTMLButtonElement, ButtonProps & { open?: boolean }>(
  ({ open, ...props }, ref) => (
    <Button
      ref={ref}
      {...blockButtonBase}
      size='xs'
      variant='ghost'
      gap='2'
      py='1.5'
      px='2'
      fontSize='12px'
      lineHeight='1.5'
      border='1px solid'
      borderColor={open ? 'border' : 'transparent'}
      bg={open ? 'bg.muted' : undefined}
      _hover={{ borderColor: 'border', bg: 'bg.muted' }}
      aria-expanded={open}
      {...props}
    />
  ),
);
RowButton.displayName = 'RowButton';
