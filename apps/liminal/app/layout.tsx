import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RegisterSW } from '@/components/register-sw';
import { MobileNavWrapper } from '@/components/mobile-nav-wrapper';
import { SidebarWrapper } from '@/components/sidebar-wrapper';

export const metadata: Metadata = {
  title: 'Liminal — A Cabinet of Instruments for Thought',
  description:
    'Six serious thinking tools. Not chatbots, not therapy. Each tool performs a distinct mode of inquiry.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Liminal',
  },
  openGraph: {
    title: 'Liminal',
    description: 'A cabinet of instruments for thought.',
    type: 'website',
    siteName: 'Liminal',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Liminal — A Cabinet of Instruments for Thought',
    description:
      'Six serious thinking tools. Not chatbots, not therapy. Each tool performs a distinct mode of inquiry.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  themeColor: '#14120E',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Fonts: Cormorant Garamond (display) + Satoshi (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700&display=swap"
          rel="stylesheet"
        />
        {/* Apple icons */}
        <link rel="apple-touch-icon" href="/apple-icon" />
      </head>
      <body>
        <div className="app-shell">
          <SidebarWrapper />
          <main className="app-main">
            {children}
          </main>
        </div>
        <MobileNavWrapper />
        <RegisterSW />
      </body>
    </html>
  );
}
