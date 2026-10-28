import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { InstallPrompt } from '@/components/InstallPrompt';
import './globals.css';

/*
 * Fonts are self-hosted from @fontsource (npm) rather than Google Fonts:
 * no third-party request when a law firm opens the portal, and builds don't need network access.
 */
const plexSans = localFont({
  src: [
    { path: '../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: '../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = localFont({
  src: [
    { path: '../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-plex-mono',
  display: 'swap',
});

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  title: { default: 'ServeNow', template: '%s · ServeNow' },
  description: 'Court process service for law firms',
  applicationName: 'ServeNow',
  // iOS: full-screen launch from the home screen, title under the icon, dark status bar
  appleWebApp: { capable: true, title: 'ServeNow', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [{ url: `${base}/icons/favicon-64.png`, sizes: '64x64', type: 'image/png' }],
    apple: [{ url: `${base}/icons/apple-touch-icon.png`, sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // lets the layout use env(safe-area-inset-*) around the notch
  themeColor: '#101a2b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
