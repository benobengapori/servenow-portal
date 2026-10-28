'use client';

import Link from 'next/link';
import type { Job, PaymentOption, Priority, Quote, SubmitJobResponse } from '@/types/jobs';
import { PRIORITIES } from '../_lib/constants';
import { formatDueTime } from '../_lib/dates';
import { formatMoney } from '../_lib/format';
import type { MatterView } from './IntakeWizard';
import { Icon } from './ui';

interface Props {
  job: Job;
  outcome: Exclude<SubmitJobResponse['outcome'], 'requires_action'>;
  quote: Quote;
  matter: MatterView;
  recipientName: string;
  address: string;
  priority: Priority;
  due: Date;
  payment: PaymentOption | undefined;
  onServeAnother: () => void;
}

export function SubmitSuccess({ job, outcome, quote, matter, recipientName, address, priority, due, payment, onServeAnother }: Props) {
  const total = formatMoney(quote.totalCents);
  const paymentLine =
    outcome === 'invoiced' ? `${total} will appear on this month’s invoice.` : `${total} ${priority === 'standard' ? 'charged and held' : 'authorized'} on ${payment?.label ?? 'the card'}.`;
  const dispatchLine = PRIORITIES[priority].dispatch === 'Marketplace pool' ? 'Posting to the local server pool.' : 'Offering to the closest available servers now.';

  const rows: [string, React.ReactNode][] = [
    ['Status', <span key="s" className="pill bg-violet-bg text-violet">{job.status}</span>],
    ['Due by', formatDueTime(due)],
    [
      'Matter',
      <div key="m">
        <div>{matter.styleOfCause}</div>
        <div className="font-mono text-[11.5px] text-muted">{matter.courtFileNo}</div>
      </div>,
    ],
    [
      'Person to be served',
      <div key="p">
        <div>{recipientName}</div>
        <div className="text-[11.5px] text-muted">{address}</div>
      </div>,
    ],
    ['Affidavit', matter.court ? `${matter.court.affidavitForm}, delivered to your inbox and the portal` : 'Delivered to your inbox and the portal'],
    ['Updates', 'Email and portal notification at each attempt'],
  ];

  return (
    <div className="pop card flex flex-col gap-5 p-5 sm:p-6" role="status">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ok-bg text-ok">
          <Icon name="check" className="h-5 w-5" strokeWidth={2.4} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold">Job {job.publicRef} submitted</h2>
          <p className="text-[13px] text-muted">
            {paymentLine} {dispatchLine}
          </p>
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-3 text-[13px] sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="eyebrow mb-0.5">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link href="/jobs" className="btn btn-primary">
          View active jobs
        </Link>
        <button type="button" className="btn btn-ghost" onClick={onServeAnother}>
          Serve another person on this matter
        </button>
      </div>
    </div>
  );
}
