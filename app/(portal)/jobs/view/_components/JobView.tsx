'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAssistant, useAssistantContext } from '@/components/assistant/AssistantProvider';
import { api, ApiError } from '@/lib/api';
import { seedServerFullName } from '@/lib/api/mock-seed';
import type { Affidavit, Job, JobId, Matter } from '@/types/jobs';
import { StatusPill } from '../../_components/status';
import { METHODS_BY_KIND, PRIORITIES, courtInfo } from '../../new/_lib/constants';
import { formatDueTime } from '../../new/_lib/dates';
import { Callout, Icon, Section, Spinner } from '../../new/_components/ui';
import { AffidavitView } from './AffidavitView';
import { OUTCOME_LABEL, TrackingMap } from './TrackingMap';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function JobView() {
  const params = useSearchParams();
  const id = params.get('id');
  const [job, setJob] = useState<Job | null>(null);
  const [matter, setMatter] = useState<Matter | null>(null);
  const [affidavit, setAffidavit] = useState<Affidavit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openPanel } = useAssistant();
  useAssistantContext(
    job
      ? {
          page: 'job',
          job: {
            publicRef: job.publicRef,
            status: job.status,
            attempts: job.attempts.length,
            maxAttempts: job.maxAttempts,
            gpsFlagged: job.attempts.some((a) => a.flags.includes('distance_exceeded')),
            affidavitStatus: affidavit?.status ?? null,
            courtType: matter?.courtType ?? null,
          },
        }
      : { page: 'job' },
  );

  useEffect(() => {
    if (!id) {
      setError('No job selected.');
      return;
    }
    const controller = new AbortController();
    const jobId = id as JobId; // the API validates it; a bad id comes back as 404
    (async () => {
      try {
        const [j, matters] = await Promise.all([api.getJob(jobId, { signal: controller.signal }), api.searchMatters('', { signal: controller.signal })]);
        setJob(j);
        setMatter(matters.items.find((m) => m.id === j.matterId) ?? null);
        try {
          setAffidavit(await api.getAffidavit(jobId, { signal: controller.signal }));
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 404)) throw err;
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof ApiError && err.status === 404 ? 'This job no longer exists in the demo. Demo data resets when the app is closed.' : 'Could not load this job.');
      }
    })();
    return () => controller.abort();
  }, [id]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <BackLink />
        <Callout tone="bad">{error}</Callout>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <BackLink />
        <div className="flex items-center gap-2 text-muted">
          <Spinner /> Loading job…
        </div>
      </div>
    );
  }

  const recipient = job.recipients[0];
  const address = recipient?.addresses[0];
  const court = matter ? courtInfo(matter.courtType) : null;
  const method = recipient ? METHODS_BY_KIND[recipient.kind === 'corporation' ? 'corporation' : 'individual'].find((m) => m.id === job.serviceMethodRequested) : undefined;
  const serverName = seedServerFullName(job.id) ?? job.assignedServer?.displayName ?? null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-[12.5px] text-accent">{job.publicRef}</div>
          <h1 className="mt-0.5 text-[21px] font-semibold">{recipient?.name ?? 'Recipient not set'}</h1>
          <div className="text-[13px] text-muted">{matter?.styleOfCause}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill status={job.status} />
          <button type="button" onClick={() => openPanel('Explain this job')} className="inline-flex items-center gap-1 text-[12.5px] font-medium text-accent hover:underline">
            <Icon name="sparkle" className="h-3.5 w-3.5" /> Explain this job
          </button>
        </div>
      </header>

      {address ? (
        <TrackingMap
          jobId={job.id}
          status={job.status}
          target={address.location}
          address={address.formatted}
          attempts={job.attempts}
          assignedServerName={serverName}
        />
      ) : (
        <Callout tone="warn">No validated service address yet.</Callout>
      )}

      {affidavit ? <AffidavitView initial={affidavit} family={matter?.courtType === 'family'} /> : null}

      <Section title="Attempts" aside={`${job.attempts.length} of ${job.maxAttempts} used`}>
        {job.attempts.length === 0 ? (
          <div className="text-[13px] text-muted">No attempts yet. Each attempt appears here with its time, GPS distance from the address and the server’s notes.</div>
        ) : (
          <ol className="relative ml-1.5 flex flex-col gap-4 border-l border-line">
            {job.attempts.map((a, i) => {
              const served = a.outcome.startsWith('served_');
              const flagged = a.flags.includes('distance_exceeded');
              const dot = flagged ? 'bg-bad' : served ? 'bg-ok' : 'bg-warn';
              return (
                <li key={a.id} className="relative pl-5">
                  <span className={`absolute -left-[7px] top-1 grid h-3.5 w-3.5 place-items-center rounded-full ring-2 ring-[var(--sn-surface)] ${dot}`} />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium">
                      Attempt {i + 1} · {OUTCOME_LABEL[a.outcome]}
                    </span>
                    <span className="text-[12px] tabular-nums text-faint">{fmt(a.attemptedAt)}</span>
                  </div>
                  {a.notes ? <div className="text-[13px] text-muted">{a.notes}</div> : null}
                  <div className={`text-[12px] ${flagged ? 'font-semibold text-bad' : 'text-faint'}`}>
                    <Icon name="pin" className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
                    GPS {a.distanceFromAddressM ?? '?'} m from the address{flagged ? ' · outside the 150 m tolerance' : ''}
                    {a.personServedName ? ` · served on ${a.personServedName}` : ''}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title="Job details">
        <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
          {(
            [
              ['Service address', address?.formatted ?? '—'],
              ['Method', method ? `${method.label} · ${method.rule}` : job.serviceMethodRequested],
              ['Priority', PRIORITIES[job.priority].label],
              ['Due by', formatDueTime(new Date(job.dueBy))],
              ['Court', matter ? `${court?.label ?? matter.courtName} · ${matter.courtFileNo ?? 'not issued'}` : '—'],
              ['Your matter #', matter?.clientReference ?? '—'],
              ['Server', serverName ?? 'Not assigned yet'],
              ['Affidavit form', court?.affidavitForm ?? '—'],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="eyebrow mb-0.5">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/jobs/" className="inline-flex items-center gap-1 self-start text-[13px] text-accent">
      <span aria-hidden="true">←</span> Active jobs
    </Link>
  );
}
