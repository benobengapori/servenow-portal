'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * "/" → "/home/". Done on the client because static hosts (GitHub Pages) can't send redirects.
 * router.replace adds the base path; the link is the fallback if scripts haven't loaded.
 */
export default function Home() {
  const router = useRouter();
  useEffect(() => router.replace('/home/'), [router]);
  return (
    <main className="grid min-h-screen place-items-center p-6 text-muted">
      <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/home/`} className="text-accent underline">
        Open ServeNow
      </a>
    </main>
  );
}
