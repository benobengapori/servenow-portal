'use client';

import type { ReactNode } from 'react';
import type { Job, Priority, Quote } from '@/types/jobs';
import { DOC_TYPE_LABELS, METHODS_BY_KIND, PRIORITIES } from '../_lib/constants';
import { formatDay } from '../_lib/dates';
import { formatMoney } from '../_lib/format';
import { serviceableAddresses, type CheckoutDraft, type DocUpload, type RecipientDraft, type StepIndex } from '../_lib/state';
import type { MatterView } from './IntakeWizard';

interface Props {
  matter: MatterView | null;
  docs: readonly DocUpload[];
  recipient: RecipientDraft;
  checkout: CheckoutDraft;
  quote: Quote | null;
  dues: Record<Priority, Date>;
  job: Job | null;
  maxReached: StepIndex;
  editable: boolean;
  onEdit: (step: StepIndex) => void;
}

export function JobSummary({ matter, docs, recipient, checkout, quote, dues, job, maxReached, editable, onEdit }: Props) {
  const ready = docs.filter((d) => d.status.stage === 'registered');
  const firstAddress = serviceableAddresses(recipient)[0];
  const method = METHODS_BY_KIND[recipient.kind].find((m) => m.id === recipient.method);
  const rowProps = (step: StepIndex) => ({ canEdit: editable && step <= maxReached, onEdit: () => onEdit(step) });

  return (
    <div className="card p-4">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Job summary</h2>
        {job ? <span className="font-mono text-[12px] text-accent">{job.publicRef}</span> : null}
      </div>
      <div className="mb-2 text-[11.5px] text-faint">
        {job ? (
          <>
            Draft saved · <span className="pill bg-neutral-bg text-neutral">{job.status}</span>
          </>
        ) : (
          'The draft is created after step 1'
        )}
      </div>

      <SummaryRow label="Matter" {...rowProps(0)}>
        {matter ? (
          <>
            <div className="font-medium">{matter.styleOfCause}</div>
            <div className="font-mono text-[11.5px] text-muted">
              {matter.courtFileNo}
              {matter.clientReference ? ` · ${matter.clientReference}` : ''}
            </div>
            {matter.court ? (
              <div className="text-[11.5px] text-faint">
                {matter.court.label} · affidavit {matter.court.affidavitForm}
              </div>
            ) : null}
          </>
        ) : null}
      </SummaryRow>

      <SummaryRow label="Documents" {...rowProps(1)}>
        {docs.length ? (
          <>
            <span className="tabular-nums">
              {ready.length} files · {ready.reduce((a, d) => a + (d.pages ?? 0), 0)} pages
            </span>
            <div className="truncate text-[11.5px] text-faint">{ready.map((d) => DOC_TYPE_LABELS[d.docType]).join(', ')}</div>
          </>
        ) : null}
      </SummaryRow>

      <SummaryRow label="Serve" {...rowProps(2)}>
        {recipient.name ? (
          <>
            <div className="font-medium">{recipient.name}</div>
            <div className="text-[11.5px] text-muted">{firstAddress?.result.formatted ?? 'Address not validated'}</div>
            <div className="text-[11.5px] text-faint">{method?.label}</div>
          </>
        ) : null}
      </SummaryRow>

      <SummaryRow label="Priority & due" {...rowProps(3)}>
        {maxReached >= 3 ? (
          <>
            {PRIORITIES[checkout.priority].label} · <span className="tabular-nums">{formatDay(dues[checkout.priority])}</span>
            <div className="text-[11.5px] text-faint">Up to {checkout.maxAttempts} attempts</div>
          </>
        ) : null}
      </SummaryRow>

      <div className="mt-1 flex items-baseline justify-between border-t-2 border-line pt-3">
        <span className="font-semibold">Total incl. HST</span>
        <span className="font-mono text-[17px] font-semibold tabular-nums">{quote ? formatMoney(quote.totalCents) : '—'}</span>
      </div>
    </div>
  );
}

function SummaryRow({ label, canEdit, onEdit, children }: { label: string; canEdit: boolean; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-line py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="eyebrow mb-0.5">{label}</div>
        <div className="min-w-0 text-[13px]">{children || <span className="text-faint">Not set</span>}</div>
      </div>
      {canEdit ? (
        <button type="button" onClick={onEdit} className="self-start text-[12px] text-accent">
          Edit
        </button>
      ) : null}
    </div>
  );
}
