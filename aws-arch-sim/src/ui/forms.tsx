import { Button, type ButtonProps, Checkbox, NativeSelect } from '@chakra-ui/react';
import type { ReactNode } from 'react';

/** 選択肢から 1 つ選ぶ（ブラウザ標準の select を Chakra の見た目で） */
export function SelectInput({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  ariaLabel?: string;
}) {
  return (
    <NativeSelect.Root size='sm'>
      <NativeSelect.Field
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}

/** ラベル付きのチェックボックス */
export function CheckInput({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Checkbox.Root
      size='sm'
      colorPalette='aws'
      checked={checked}
      onCheckedChange={(e) => onChange(e.checked === true)}
    >
      <Checkbox.HiddenInput />
      <Checkbox.Control />
      <Checkbox.Label fontWeight='normal' display='flex' alignItems='center' gap='1.5'>
        {children}
      </Checkbox.Label>
    </Checkbox.Root>
  );
}

/** 文字だけのボタン（「+ ルールを追加」など） */
export function TextButton(props: ButtonProps) {
  return (
    <Button
      size='xs'
      variant='plain'
      colorPalette='blue'
      color='fg.info'
      px='0'
      h='auto'
      alignSelf='flex-start'
      fontWeight='normal'
      _hover={{ textDecoration: 'underline' }}
      {...props}
    />
  );
}

/** 削除など、取り消しに注意がいる操作 */
export function DangerButton(props: ButtonProps) {
  return (
    <Button
      size='xs'
      variant='outline'
      colorPalette='red'
      color='fg.error'
      borderColor='border.error'
      alignSelf='flex-start'
      {...props}
    />
  );
}
