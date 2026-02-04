import type { Metadata } from 'next';
import { Playfair_Display, DM_Sans } from 'next/font/google';
import './globals.css';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    template: '%s | Personal Timeline',
    default: 'Personal Timeline - Navigate Your Life Journey',
  },
  description:
    'A unified personal timeline that consolidates life data across health, finance, career, relationships, and travel with AI coaching.',
  keywords: [
    'personal timeline',
    'life tracking',
    'goal setting',
    'AI coaching',
    'life planning',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Personal Timeline',
    title: 'Personal Timeline - Navigate Your Life Journey',
    description:
      'Visualize your past, present, and future in one beautiful timeline.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${dmSans.variable}`}>
      <body className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] antialiased">
        {children}
      </body>
    </html>
  );
}
