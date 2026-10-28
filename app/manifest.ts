import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Web app manifest: makes the portal installable ("Add to Home Screen" / "Install app"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: 'ServeNow — Client Portal',
    short_name: 'ServeNow',
    description: 'Court process service for law firms: submit, track and receive affidavits of service.',
    start_url: `${base}/jobs/`,
    scope: `${base}/`,
    display: 'standalone',
    orientation: 'any',
    background_color: '#101a2b',
    theme_color: '#101a2b',
    categories: ['business', 'productivity'],
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}/icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [{ name: 'Submit new job', url: `${base}/jobs/new/`, icons: [{ src: `${base}/icons/icon-192.png`, sizes: '192x192' }] }],
  };
}
