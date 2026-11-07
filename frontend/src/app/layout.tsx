import '@/app/globals.css';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { IBM_Plex_Mono, Sora } from 'next/font/google';
import { Providers } from '@/providers';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: { default: 'FairNest: rent deposits held by a contract', template: '%s · FairNest' },
  description:
    'Lock a rent security deposit in a NEAR contract. The landlord itemises deductions, the tenant disputes line by line, a neutral arbiter rules. Deadlines keep the money moving.',
};
export const viewport: Viewport = { themeColor: '#0b0a06' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${plexMono.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
