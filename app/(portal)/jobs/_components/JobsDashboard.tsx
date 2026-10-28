'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { JobStatus, JobSummary, Matter, MatterId } from '@/types/jobs';
import { PRIORITIES, courtInfo } from '../new/_lib/constants';
import { formatDay } from '../new/_lib/dates';
import { Callout, Icon, Spinner } from '../new/_components/ui';

/* ── Status presentation: label + semantic colour token ── */
type Tone = 'neutral' | 'violet' | 'info' | 'ok' | 'warn' | 'bad';
const STATUS: Record<JobStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'neutral' },
  quoted: { label: 'Quoted', tone: 'neutral' },
  authorized: { label: 'Authorized', tone: 'violet' },
  open: { label: 'Finding server', tone: 'violet' },
  offered: { label: 'Offered to servers', tone: 'violet' },
  assigned: { label: 'Server assigned', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'info' },
  served: { label: 'Served', tone: 'ok' },
  non_served: { label: 'Not served', tone: 'warn' },
  affidavit_pending: { label: 'Affidavit pending', tone: 'warn' },
  affidavit_signed: { label: 'Affidavit signed', tone: 'ok' },
  completed: { label: 'Completed', tone: 'ok' },
  closed: { label: 'Closed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  disputed: { label: 'Disputed', tone: 'bad' },
};
const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-neutral-bg text-neutral',
  violet: 'bg-violet-bg text-violet',
  info: 'bg-info-bg text-info',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
};

const PHASES: { id: string; label: string; statuses?: readonly JobStatus[] }[] = [
  { id: 'all', label: 'All active' },
  { id: 'dispatch', label: 'Awaiting server', statuses: ['authorized', 'open', 'offered'] },
  { id: 'field', label: 'In the field', statuses: ['assigned', 'in_progress'] },
  { id: 'affidavit', label: 'Affidavit', statuses: ['served', 'non_served', 'affidavit_pending', 'affidavit_signed'] },
  { id: 'attention', label: 'Needs attention', statuses: ['non_served', 'disputed'] },
];
const INACTIVE: ReadonlySet<JobStatus> = new Set(['draft', 'quoted', 'completed', 'closed', 'cancelled']);

function StatusPill({ status }: { status: JobStatus }) {
  const s = STATUS[status];
  return <span className={`pill ${TONE_CLASS[s.tone]}`}>{s.label}</span>;
}

function daysLeft(iso: string): number {
  const end = new Date(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function DueLabel({ iso }: { iso: string }) {
  const d = daysLeft(iso);
  const tone = d < 0 ? 'text-bad' : d <= 1 ? 'text-warn' : 'text-faint';
  const text = d < 0 ? `${-d}d overdue` : d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `${d} days left`;
  return <span className={tone}>{text}</span>;
}

function Attempts({ used, max }: { used: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${used} of ${max} attempts used`}>
      <span className="flex gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-sm ${i < used ? 'bg-accent' : 'bg-line-strong'}`} />
        ))}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-faint">
        {used}/{max}
      </span>
    </span>
  );
}

export function JobsDashboard() {
  const [jobs, setJobs] = useState<readonly JobSummary[] | null>(null);
  const [matters, setMatters] = useState<ReadonlyMap<MatterId, Matter>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([api.listJobs({}, { signal: controller.signal }), api.searchMatters('', { signal: controller.signal })])
      .then(([jobPage, matterPage]) => {
        setJobs(jobPage.items);
        setMatters(new Map(matterPage.items.map((m) => [m.id, m])));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load jobs.');
      });
    return () => controller.abort();
  }, []);

  const active = useMemo(() => (jobs ?? []).filter((j) => !INACTIVE.has(j.status)), [jobs]);
  const count = (id: string) => {
    const p = PHASES.find((x) => x.id === id);
    return p?.statuses ? active.filter((j) => p.statuses!.includes(j.status)).length : active.length;
  };
  const rows = useMemo(() => {
    const p = PHASES.find((x) => x.id === phase);
    const q = query.trim().toLowerCase();
    return active
      .filter((j) => !p?.statuses || p.statuses.includes(j.status))
      .filter((j) => {
        if (!q) return true;
        const m = matters.get(j.matterId);
        return [j.publicRef, j.primaryRecipientName, m?.styleOfCause, m?.clientReference, m?.courtFileNo].join(' ').toLowerCase().includes(q);
      })
      .sort((a, b) => a.dueBy.localeCompare(b.dueBy));
  }, [active, phase, query, matters]);

  const dueSoon = active.filter((j) => daysLeft(j.dueBy) <= 1 && !['served', 'affidavit_signed'].includes(j.status)).length;
  const attention = count('attention');

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">{new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1 className="mt-1 text-[22px] font-semibold">Active service jobs</h1>
          {jobs ? (
            <p className="mt-0.5 text-[13px] text-muted">
              {active.length} open jobs · {dueSoon} due within a day{attention ? ` · ${attention} need attention` : ''}
            </p>
          ) : null}
        </div>
        <Link href="/jobs/new" className="btn btn-primary w-full sm:w-auto">
          <Icon name="plus" /> Submit new job
        </Link>
      </header>

      {error ? <Callout tone="bad">{error}</Callout> : null}

      <section className="card min-w-0">
        <div className="flex flex-col gap-2.5 border-b border-line px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="-mx-3 flex gap-1 overflow-x-auto px-3 lg:mx-0 lg:px-0" role="tablist" aria-label="Filter jobs">
            {PHASES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={phase === p.id}
                onClick={() => setPhase(p.id)}
                className={`whitespace-nowrap rounded px-3 py-1.5 text-[13px] ${phase === p.id ? 'bg-accent-soft font-semibold text-accent' : 'text-muted hover:text-fg'}`}
              >
                {p.label} <span className="ml-1 font-mono text-[11px] opacity-70">{jobs ? count(p.id) : '–'}</span>
              </button>
            ))}
          </div>
          <label className="relative block w-full lg:w-72" htmlFor="job-search">
            <span className="sr-only">Search jobs</span>
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">
              <Icon name="search" />
            </span>
            <input
              id="job-search"
              className="field py-1.5 pl-8 text-[13px]"
              placeholder="Ref, matter #, court file, person"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {jobs === null && !error ? (
          <div className="flex items-center justify-center gap-2 px-3 py-10 text-muted">
            <Spinner /> Loading jobs…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-10 text-center text-muted">No jobs match this filter.</div>
        ) : (
          <>
            {/* Phone: one card per job */}
            <ul className="divide-y divide-line md:hidden">
              {rows.map((j) => {
                const m = matters.get(j.matterId);
                return (
                  <li key={j.id} className="flex flex-col gap-2 px-3 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{j.primaryRecipientName ?? 'Recipient not set'}</div>
                        <div className="truncate text-[12px] text-muted">{m?.styleOfCause ?? '—'}</div>
                      </div>
                      <StatusPill status={j.status} />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                      <span className="font-mono text-accent">{j.publicRef}</span>
                      <span className="font-mono text-faint">{m?.clientReference}</span>
                      {['rush', 'same_day'].includes(j.priority) ? <span className="font-semibold text-bad">{PRIORITIES[j.priority].label}</span> : null}
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[12px]">
                      <Attempts used={j.attemptCount} max={j.maxAttempts} />
                      <span className="tabular-nums">
                        {formatDay(new Date(j.dueBy))} · <DueLabel iso={j.dueBy} />
                      </span>
                    </div>
                    <div className="text-[12px] text-faint">{j.assignedServer ? `Server: ${j.assignedServer.displayName}` : 'No server assigned yet'}</div>
                  </li>
                );
              })}
            </ul>

            {/* Tablet and desktop: dense table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-sunk text-left text-faint">
                    {['Job', 'Your matter #', 'Style of cause · court file', 'Person to be served', 'Priority', 'Status', 'Attempts', 'Due', 'Server'].map((h) => (
                      <th key={h} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((j) => {
                    const m = matters.get(j.matterId);
                    const court = m ? courtInfo(m.courtType) : null;
                    return (
                      <tr key={j.id} className="border-t border-line align-top hover:bg-sunk">
                        <td className="px-3 py-2.5 font-mono text-accent">{j.publicRef}</td>
                        <td className="px-3 py-2.5 font-mono">{m?.clientReference ?? '—'}</td>
                        <td className="max-w-[260px] px-3 py-2.5">
                          <div className="truncate font-medium" title={m?.styleOfCause}>
                            {m?.styleOfCause ?? '—'}
                          </div>
                          <div className="font-mono text-[12px] text-faint">
                            {m?.courtFileNo}
                            {court ? ` · ${court.label.replace(' of Justice', '')}` : ''}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-medium">{j.primaryRecipientName}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">
                          {['rush', 'same_day'].includes(j.priority) ? (
                            <span className="font-semibold text-bad">{PRIORITIES[j.priority].label}</span>
                          ) : (
                            <span className="text-muted">{PRIORITIES[j.priority].label}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusPill status={j.status} />
                        </td>
                        <td className="px-3 py-2.5">
                          <Attempts used={j.attemptCount} max={j.maxAttempts} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                          <div>{formatDay(new Date(j.dueBy))}</div>
                          <div className="text-[11.5px]">
                            <DueLabel iso={j.dueBy} />
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">{j.assignedServer?.displayName ?? <span className="italic text-faint">Unassigned</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="border-t border-line px-3 py-2 text-[11.5px] text-faint">Sample data for demo · sorted by due date</div>
      </section>
    </div>
  );
}
