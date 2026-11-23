import { z } from 'zod';

function stringField() {
  return z.unknown().transform((val) => (typeof val === 'string' ? val : ''));
}

export const registerSchema = z.object({
  email: stringField()
    .transform((val) => val.trim().toLowerCase())
    .pipe(z.email({ message: 'メールアドレスの形式が正しくありません' })),
  name: stringField().transform((val) => val.trim()),
  password: stringField().pipe(
    z.string().min(8, { message: 'パスワードは8文字以上で入力してください' }),
  ),
});

export const loginSchema = z.object({
  email: stringField().transform((val) => val.trim().toLowerCase()),
  password: stringField(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
