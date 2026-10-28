'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/home', label: 'Home' },
  { href: '/jobs', label: 'Active Jobs' },
  { href: '/matters', label: 'Matters' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/settings', label: 'Settings' },
] as const;

/**
 * Left rail on desktop; on phones a top bar (brand row + scrollable tabs).
 * Padded by the safe-area inset so it clears the notch when installed to the home screen.
 */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 z-30 flex shrink-0 flex-col bg-slate-900 pt-[env(safe-area-inset-top)] text-slate-300 md:static md:min-h-screen md:w-60">
      <div className="flex items-center gap-2.5 px-4 py-2.5 md:px-5 md:py-5">
        <div className="grid h-7 w-7 place-items-center rounded bg-[#6d9fe0] text-[12px] font-bold text-[#0b1422]">SN</div>
        <div className="min-w-0">
          <div className="font-semibold leading-tight text-white">ServeNow</div>
          <div className="text-[11px] text-slate-400">Client portal</div>
        </div>
        {process.env.NEXT_PUBLIC_API_MOCK === '1' ? (
          <span className="ml-auto rounded bg-amber-400/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-amber-300 md:hidden">Demo</span>
        ) : null}
      </div>
      <nav className="flex gap-0.5 overflow-x-auto px-2 pb-1.5 md:flex-col md:p-3" aria-label="Main">
        {NAV.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap rounded px-3 py-2 text-sm ${active ? 'bg-slate-800 text-white' : 'hover:bg-white/5'}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden border-t border-white/10 p-4 text-[12px] md:block">
        <div className="font-medium text-white/90">Harrow &amp; Lindqvist LLP</div>
        <div className="text-slate-400">Priya Raman · Law clerk</div>
        {process.env.NEXT_PUBLIC_API_MOCK === '1' ? <div className="mt-2 text-amber-300/90">Demo mode · sample data</div> : null}
      </div>
    </aside>
  );
}
