import type { JobStatus } from '@/types/jobs';

/* ── Status presentation: label + semantic colour token ── */
export type Tone = 'neutral' | 'violet' | 'info' | 'ok' | 'warn' | 'bad';
export const STATUS: Record<JobStatus, { label: string; tone: Tone }> = {
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
export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-neutral-bg text-neutral',
  violet: 'bg-violet-bg text-violet',
  info: 'bg-info-bg text-info',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
};

export function StatusPill({ status }: { status: JobStatus }) {
  const s = STATUS[status];
  return <span className={`pill ${TONE_CLASS[s.tone]}`}>{s.label}</span>;
}

