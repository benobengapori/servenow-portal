'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAssistant, useAssistantContext } from '@/components/assistant/AssistantProvider';
import { api } from '@/lib/api';
import { suggestionsFor } from '@/lib/assistant/engine';
import type { JobStatus, JobSummary } from '@/types/jobs';
import { StatusPill } from '../../jobs/_components/status';
import { formatDay } from '../../jobs/new/_lib/dates';
import { Icon, Spinner } from '../../jobs/new/_components/ui';

const INACTIVE: ReadonlySet<JobStatus> = new Set(['draft', 'quoted', 'completed', 'closed', 'cancelled']);
const ATTENTION: ReadonlySet<JobStatus> = new Set(['disputed', 'non_served']);

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function daysLeft(iso: string): number {
  const end = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function Home() {
  useAssistantContext({ page: 'home' });
  const { openPanel } = useAssistant();
  const [jobs, setJobs] = useState<readonly JobSummary[] | null>(null);
  const [question, setQuestion] = useState('');

  useEffect(() => {
    const c = new AbortController();
    api
      .listJobs({}, { signal: c.signal })
      .then((p) => setJobs(p.items))
      .catch(() => setJobs([]));
    return () => c.abort();
  }, []);

  const active = useMemo(() => (jobs ?? []).filter((j) => !INACTIVE.has(j.status)), [jobs]);
  const attention = useMemo(
    () =>
      active
        .filter((j) => ATTENTION.has(j.status) || (daysLeft(j.dueBy) <= 1 && !['served', 'affidavit_signed', 'affidavit_pending'].includes(j.status)))
        .sort((a, b) => Number(ATTENTION.has(b.status)) - Number(ATTENTION.has(a.status)) || a.dueBy.localeCompare(b.dueBy))
        .slice(0, 3),
    [active],
  );
  const ready = active.filter((j) => j.status === 'affidavit_signed').length;
  const inField = active.filter((j) => ['assigned', 'in_progress'].includes(j.status)).length;
  const searching = active.filter((j) => ['authorized', 'open', 'offered'].includes(j.status)).length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header>
        <div className="eyebrow">{new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <h1 className="mt-1 text-[22px] font-semibold">{greeting()}, Priya</h1>
        <p className="text-[13px] text-muted">Harrow &amp; Lindqvist LLP</p>
      </header>

      {/* Primary actions: the reason people open the app */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/jobs/new/" className="group flex items-center gap-4 rounded-xl bg-accent p-4 text-accent-fg shadow-sm transition-opacity hover:opacity-95">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/15">
            <Icon name="plus" className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold">Submit a job</span>
            <span className="block text-[12.5px] opacity-85">Upload documents, pick who to serve, get a quote</span>
          </span>
          <Icon name="arrow" className="h-4 w-4 opacity-80 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="/jobs/" className="group flex items-center gap-4 rounded-xl border border-line bg-surface p-4 hover:border-accent">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Icon name="pin" className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold">Track jobs</span>
            <span className="block text-[12.5px] text-muted">
              {jobs ? `${active.length} active · ${inField} in the field · ${searching} finding a server` : 'Loading…'}
            </span>
          </span>
          <Icon name="arrow" className="h-4 w-4 text-faint transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* What needs the clerk today */}
      <section className="card">
        <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-semibold">Needs your attention</h2>
          {ready ? <span className="text-[12px] text-ok">{ready} affidavit{ready > 1 ? 's' : ''} ready to download</span> : null}
        </div>
        {jobs === null ? (
          <div className="flex items-center gap-2 px-4 py-5 text-muted">
            <Spinner /> Loading…
          </div>
        ) : attention.length === 0 ? (
          <div className="px-4 py-5 text-[13px] text-muted">Nothing urgent. All active jobs are on track.</div>
        ) : (
          <ul className="divide-y divide-line">
            {attention.map((j) => {
              const d = daysLeft(j.dueBy);
              return (
                <li key={j.id}>
                  <Link href={`/jobs/view/?id=${encodeURIComponent(j.id)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-sunk">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{j.primaryRecipientName}</span>
                      <span className={`block text-[12px] ${d < 0 ? 'text-bad' : d <= 1 ? 'text-warn' : 'text-faint'}`}>
                        {ATTENTION.has(j.status) ? (j.status === 'disputed' ? 'Evidence under review' : 'Not served, next step needed') : `Due ${formatDay(new Date(j.dueBy))}`}
                        {d < 0 ? ` · ${-d}d overdue` : d === 0 ? ' · today' : ''}
                      </span>
                    </span>
                    <StatusPill status={j.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Help, available but not in the way */}
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Icon name="sparkle" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold">Ask ServeNow</h2>
            <p className="text-[12.5px] text-muted">Not sure about a feature, a step, or a rule for serving documents? Ask here. General information, not legal advice.</p>
          </div>
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!question.trim()) return openPanel();
            openPanel(question);
            setQuestion('');
          }}
        >
          <label htmlFor="home-ask" className="sr-only">
            Ask ServeNow
          </label>
          <input id="home-ask" className="field" placeholder="e.g. How do you serve a corporation?" value={question} onChange={(e) => setQuestion(e.target.value)} />
          <button type="submit" className="btn btn-ghost shrink-0">
            Ask
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestionsFor({ page: 'home' }).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => openPanel(q)}
              className="rounded-full border border-line-strong px-3 py-1.5 text-left text-[12.5px] hover:border-accent hover:text-accent"
            >
              {q}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
