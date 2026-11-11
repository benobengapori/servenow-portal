import type { ReactNode } from 'react';
import Link from 'next/link';

export const metadata = { title: 'ServeNow — Servers' };

/** Server app shell: no firm sidebar. Designed to be installed to a phone's home screen. */
export default function ServerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-2.5 bg-slate-900 px-4 py-2.5 text-white">
        <div className="grid h-7 w-7 place-items-center rounded bg-[#6d9fe0] text-[12px] font-bold text-[#0b1422]">SN</div>
        <div className="font-semibold">ServeNow</div>
        <nav className="ml-auto flex gap-3 text-sm">
          <Link href="/server/" className="hover:underline">Jobs near me</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-4">{children}</main>
    </div>
  );
}
