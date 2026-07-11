import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import { DemoBanner } from '@/components/DemoBanner';
import { BRAND_DISPLAY } from '@/lib/brand';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

export const metadata: Metadata = {
  title: isDemo
    ? `${BRAND_DISPLAY} — Console demo`
    : `${BRAND_DISPLAY} — Appliance Console`,
  description: isDemo
    ? 'Interactive preview of the OwnEdge appliance console. No account required.'
    : 'Manage your private AI appliance — models, cluster, and system settings.',
  robots: isDemo ? { index: false, follow: false } : undefined,
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <DemoBanner />
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </body>
    </html>
  );
}