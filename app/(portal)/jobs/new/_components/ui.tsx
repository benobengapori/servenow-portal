'use client';

import { useState, type ReactNode } from 'react';

/* ── Icons (stroke paths, 24×24) ── */
export const ICONS = {
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
  pin: 'M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11zM12 12a2 2 0 100-4 2 2 0 000 4z',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  copy: 'M8 8h11v11H8zM5 16V5h11',
  card: 'M3 6h18v12H3zM3 10h18',
  bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
  clock: 'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z',
  send: 'M4 12l16-8-6 16-2.5-6.5z',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  book: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11',
} as const;
export type IconName = keyof typeof ICONS;

export function Icon({ name, className = 'h-4 w-4', strokeWidth = 1.7 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={`bar ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  className = '',
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | undefined;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label className="lbl" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <div className="hint-error" id={`${htmlFor}-error`}>
          {error}
        </div>
      ) : hint ? (
        <div className="hint">{hint}</div>
      ) : null}
    </div>
  );
}

export type Tone = 'info' | 'warn' | 'bad' | 'ok';
const TONE_CLASS: Record<Tone, string> = {
  info: 'text-info bg-info-bg',
  warn: 'text-warn bg-warn-bg',
  bad: 'text-bad bg-bad-bg',
  ok: 'text-ok bg-ok-bg',
};

export function Callout({ tone = 'info', icon = 'alert', children }: { tone?: Tone; icon?: IconName; children: ReactNode }) {
  return (
    <div role={tone === 'bad' ? 'alert' : undefined} className={`flex gap-2.5 rounded-md px-3 py-2.5 text-[12.5px] ${TONE_CLASS[tone]}`}>
      <Icon name={icon} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 pb-3 pt-3.5">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {aside ? <div className="text-[12px] text-faint">{aside}</div> : null}
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </section>
  );
}

export function CopyHash({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked; the full hash is in the title attribute */
    }
  };
  return (
    <button type="button" onClick={copy} title={value} className="inline-flex items-center gap-1 font-mono text-[11.5px] text-muted hover:text-fg">
      {value.slice(0, 10)}…{value.slice(-6)}
      <Icon name={copied ? 'check' : 'copy'} className="h-3 w-3" />
      <span className="sr-only">{copied ? 'Copied' : 'Copy full hash'}</span>
    </button>
  );
}
