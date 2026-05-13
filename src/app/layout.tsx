import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Provider } from '@/components/ui/provider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'DML — 解体業者口コミサイト',
  description: '全国の解体業者を検索・比較・口コミで評価できるサービス',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='ja' className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
