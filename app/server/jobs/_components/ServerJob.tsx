'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Callout, Spinner } from '@/app/(portal)/jobs/new/_components/ui';
import { ATTEMPT_OUTCOMES, currentPosition, getJob, logAttempt, ServerApiError, type ServerJobDetail } from '@/lib/server/api';

export function ServerJob() {
  const params = useSearchParams();
  const id = params.get('id');
  const [job, setJob] = useState<ServerJobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    getJob(id)
      .then((j) => alive && setJob(j))
      .catch((err) => alive && setError(err instanceof ServerApiError && err.status === 404 ? 'This job is not assigned to you.' : 'Could not load this job.'));
    return () => {
      alive = false;
    };
  }, [id]);

  if (!id) return <Callout tone="warn">No job selected. Go back to Jobs near me and accept one.</Callout>;
  if (error) return <Callout tone="bad">{error}</Callout>;
  if (!job) return <div className="flex items-center gap-2 p-4 text-muted"><Spinner /> Loading job…</div>;

  return <JobDetail job={job} onUpdate={setJob} />;
}

function JobDetail({ job, onUpdate }: { job: ServerJobDetail; onUpdate: (j: ServerJobDetail) => void }) {
  const recipient = job.recipients[0];
  const addr = recipient?.addresses[0];
  const [outcome, setOutcome] = useState(ATTEMPT_OUTCOMES[0]?.value ?? 'other');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'bad'; text: string } | null>(null);

  const finished = job.status === 'served' || job.status === 'closed';

  async function record() {
    setBusy(true);
    setMessage(null);
    try {
      const pos = await currentPosition();
      const res = await logAttempt(job.id, {
        outcome,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        notes: notes.trim(),
      });
      onUpdate(res.job);
      setNotes('');
      setMessage(
        res.flagged
          ? { tone: 'warn', text: `Logged, but you were ${Math.round(res.distanceM)} m from the address. The firm will see this flag.` }
          : { tone: 'ok', text: 'Attempt logged with your location.' },
      );
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not log the attempt.' });
    } finally {
      setBusy(false);
    }
  }

  const mapsHref = addr
    ? `https://www.google.com/maps/dir/?api=1&destination=${addr.location.lat},${addr.location.lng}`
    : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/server/" className="text-[14px] text-muted hover:underline">← Jobs near me</Link>

      <section className="card flex flex-col gap-2 p-5">
        <div className="text-[13px] text-muted">{job.publicRef}</div>
        <h1 className="text-xl font-semibold">{recipient?.name ?? 'Job'}</h1>
        <div className="text-[14px]">{addr?.formatted ?? 'Address to follow'}</div>
        <div className="text-[13px] text-faint">
          {job.priority.replace('_', ' ')} · due {new Date(job.dueBy).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })} · status {job.status.replace('_', ' ')}
        </div>
        {mapsHref ? (
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-2 text-center">
            Navigate to address
          </a>
        ) : null}
      </section>

      {finished ? (
        <Callout tone="ok">This job is complete.</Callout>
      ) : (
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="font-semibold">Log an attempt</h2>
          <p className="text-[13px] text-muted">Your phone&apos;s location is recorded with each attempt. Be at the address when you log it.</p>
          <label className="flex flex-col gap-1 text-[14px]">
            Outcome
            <select className="field" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {ATTEMPT_OUTCOMES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[14px]">
            Notes (optional)
            <textarea className="field min-h-[88px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who you spoke to, what you saw" />
          </label>
          {message ? <Callout tone={message.tone}>{message.text}</Callout> : null}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void record()}>
            {busy ? 'Getting your location…' : 'Log attempt'}
          </button>
        </section>
      )}

      <section className="card flex flex-col gap-2 p-5">
        <h2 className="font-semibold">Attempts</h2>
        {job.attempts.length === 0 ? (
          <p className="text-[14px] text-muted">No attempts logged yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {job.attempts.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5 py-2.5 text-[14px]">
                <div className="flex justify-between gap-3">
                  <span className="font-medium">{ATTEMPT_OUTCOMES.find((o) => o.value === a.outcome)?.label ?? a.outcome}</span>
                  <span className="text-[13px] text-muted tabular-nums">{new Date(a.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <div className="text-[12.5px] text-faint">
                  {Math.round(a.distance_m)} m from address{a.flagged ? ' · flagged' : ''}
                </div>
                {a.notes ? <div className="text-[13px]">{a.notes}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
