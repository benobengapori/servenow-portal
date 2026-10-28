'use client';

import { useState } from 'react';
import { signaturePath } from '@/lib/demo/signature';
import type { Affidavit, Commissioner } from '@/types/jobs';
import { CopyHash, Icon, Section, Spinner } from '../../new/_components/ui';

const DEMO = process.env.NEXT_PUBLIC_API_MOCK === '1';
const DEMO_COMMISSIONER = 'Adaeze N. Morgan';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const STATUS_TEXT: Record<Affidavit['status'], { label: string; cls: string }> = {
  drafting: { label: 'Drafting', cls: 'bg-neutral-bg text-neutral' },
  awaiting_deponent: { label: 'Waiting for the server to sign', cls: 'bg-warn-bg text-warn' },
  awaiting_commissioner: { label: 'Waiting for the commissioner', cls: 'bg-warn-bg text-warn' },
  commissioned: { label: 'Signed and commissioned', cls: 'bg-ok-bg text-ok' },
};

/**
 * The affidavit as the firm will file it: the server (deponent) signs, then affirms it before a
 * commissioner for taking affidavits, who signs and stamps it. In demo mode the two signing
 * steps can be simulated so the whole flow can be shown.
 */
export function AffidavitView({ initial, family }: { initial: Affidavit; family: boolean }) {
  const [a, setA] = useState(initial);
  const [busy, setBusy] = useState<null | 'deponent' | 'commissioner'>(null);
  const status = STATUS_TEXT[a.status];
  const parties = family ? (['Applicant', 'Respondent'] as const) : (['Plaintiff', 'Defendant'] as const);
  const title = a.kind === 'service' ? 'AFFIDAVIT OF SERVICE' : 'AFFIDAVIT OF ATTEMPTED SERVICE';

  const simulate = async (who: 'deponent' | 'commissioner') => {
    setBusy(who);
    await new Promise((r) => setTimeout(r, 1200));
    const now = new Date().toISOString();
    if (who === 'deponent') {
      setA((x) => ({ ...x, status: 'awaiting_commissioner', deponent: { name: x.deponentName, signedAt: now, signaturePath: signaturePath(x.deponentName) } }));
    } else {
      const c: Commissioner = {
        name: DEMO_COMMISSIONER,
        title: 'Commissioner for Taking Affidavits',
        licence: 'LSO #00000D (demo)',
        method: 'video_conference',
        location: 'City of Ottawa',
        signedAt: now,
        signaturePath: signaturePath(DEMO_COMMISSIONER),
      };
      setA((x) => ({ ...x, status: 'commissioned', commissioner: c, pdfSha256: '9f2c41a7d3e85b06c1f4a92e7b3d5c08e6a1f47b2c9d03e5a8b6f1c4d7e92a30' }));
    }
    setBusy(null);
  };

  return (
    <Section title={a.kind === 'service' ? 'Affidavit of service' : 'Affidavit of attempted service'} aside={<span className={`pill ${status.cls}`}>{status.label}</span>}>
      <SigningSteps a={a} />

      {/* The document itself: always paper-white, like the PDF the firm files. */}
      <div className="-mx-4 overflow-x-auto bg-sunk px-4 py-4 sm:mx-0 sm:rounded-md">
        <article
          className="relative mx-auto min-w-[320px] max-w-[680px] overflow-hidden bg-white px-6 py-7 text-[12.5px] leading-relaxed text-[#1a1a1a] shadow-panel sm:px-10 sm:py-9"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          aria-label={title}
        >
          {DEMO ? (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="-rotate-[28deg] select-none whitespace-nowrap text-[40px] font-bold tracking-[0.15em] text-[#a1262b] opacity-[0.07] sm:text-[56px]">
                DEMO SAMPLE · NOT FOR FILING
              </span>
            </div>
          ) : null}

          <div className="flex justify-between gap-4 text-[11px]">
            <span>{a.form}</span>
            <span>Court File No. {a.courtFileNo ?? '—'}</span>
          </div>
          <h4 className="mt-4 text-center text-[13px] font-bold tracking-wide">{a.courtName}</h4>

          <div className="mx-auto mt-5 grid max-w-md grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 text-[12px]">
            <span className="font-bold">BETWEEN:</span>
            <span className="text-center font-bold uppercase">{a.plaintiff}</span>
            <span className="italic">{parties[0]}</span>
            <span />
            <span className="text-center">– and –</span>
            <span />
            <span />
            <span className="text-center font-bold uppercase">{a.defendant}</span>
            <span className="italic">{parties[1]}</span>
          </div>

          <h3 className="mt-6 text-center text-[15px] font-bold tracking-[0.08em]">{title}</h3>

          <p className="mt-4">
            I, <strong>{a.deponentName}</strong>, {a.deponentOf}, <strong>AFFIRM</strong>:
          </p>
          <ol className="mt-3 flex flex-col gap-2.5">
            {a.paragraphs.map((p) => (
              <li key={p.n} className="grid grid-cols-[1.5rem_1fr] gap-1">
                <span>{p.n}.</span>
                <span>{p.text}</span>
              </li>
            ))}
          </ol>

          {/* Jurat: commissioner on the left, deponent on the right */}
          <div className="mt-8 grid grid-cols-1 gap-6 border-t border-[#1a1a1a]/30 pt-5 sm:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col gap-3">
              <p className="text-[11.5px]">
                <strong>AFFIRMED</strong> {a.commissioner?.method === 'in_person' ? 'before me' : 'remotely'} by {a.deponentName} at the City of Ottawa, in the
                Province of Ontario, before me at the {a.commissioner?.location ?? 'City of Ottawa'}, in the Province of Ontario,
                {a.commissioner ? ` on ${fmtDate(a.commissioner.signedAt)}` : ' on ________________'}
                {a.commissioner?.method !== 'in_person' ? ', in accordance with O. Reg. 431/20, Administering Oath or Declaration Remotely.' : '.'}
              </p>
              <SignatureLine path={a.commissioner?.signaturePath} caption="Commissioner for Taking Affidavits (or as may be)" pending="Not yet commissioned" />
              {a.commissioner ? (
                <div className="w-fit -rotate-1 border-2 border-[#1f3f7a] px-3 py-1.5 text-[10px] font-semibold uppercase leading-tight tracking-wide text-[#1f3f7a]" style={{ fontFamily: 'var(--font-sans)' }}>
                  {a.commissioner.name}
                  <br />
                  <span className="font-normal normal-case">A Commissioner, etc., Province of Ontario</span>
                  <br />
                  <span className="font-normal normal-case">{a.commissioner.licence}</span>
                </div>
              ) : null}
            </div>
            <div className="flex flex-col justify-end">
              <SignatureLine path={a.deponent?.signaturePath} caption={`Signature of deponent: ${a.deponentName}`} pending="Not yet signed" />
            </div>
          </div>
        </article>
      </div>

      {DEMO && a.status === 'awaiting_deponent' ? (
        <DemoAction busy={busy === 'deponent'} onClick={() => void simulate('deponent')} label={`Simulate ${a.deponentName} signing in the server app`} />
      ) : null}
      {DEMO && a.status === 'awaiting_commissioner' ? (
        <DemoAction busy={busy === 'commissioner'} onClick={() => void simulate('commissioner')} label="Simulate the commissioner signing over video" />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-faint">
        <span>Exhibit “A”: GPS-stamped photo of each attempt</span>
        {a.pdfSha256 ? (
          <span className="flex items-center gap-1">
            PDF SHA-256 <CopyHash value={a.pdfSha256} />
          </span>
        ) : null}
      </div>
      <button type="button" className="btn btn-primary self-start" disabled={a.status !== 'commissioned'} title={a.status !== 'commissioned' ? 'Available once commissioned' : undefined}>
        Download affidavit + evidence (PDF)
      </button>
    </Section>
  );
}

function SigningSteps({ a }: { a: Affidavit }) {
  const steps = [
    { label: 'Drafted from the job record', done: true, when: null as string | null },
    { label: `Signed by the server, ${a.deponentName}`, done: Boolean(a.deponent), when: a.deponent?.signedAt ?? null },
    {
      label: a.commissioner ? `Affirmed before ${a.commissioner.name}, commissioner (${a.commissioner.method === 'video_conference' ? 'video' : 'in person'})` : 'Affirmed before a commissioner for taking affidavits',
      done: Boolean(a.commissioner),
      when: a.commissioner?.signedAt ?? null,
    },
  ];
  return (
    <ol className="flex flex-col gap-2 text-[13px]">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${s.done ? 'bg-ok text-accent-fg' : 'border border-line-strong text-faint'}`}>
            {s.done ? <Icon name="check" className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
          </span>
          <span className="min-w-0">
            <span className={s.done ? '' : 'text-muted'}>{s.label}</span>
            {s.when ? <span className="ml-2 text-[12px] tabular-nums text-faint">{fmtDateTime(s.when)}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SignatureLine({ path, caption, pending }: { path: string | undefined; caption: string; pending: string }) {
  return (
    <div>
      <div className="relative h-14">
        {path ? (
          <svg viewBox="0 0 240 60" className="absolute bottom-0 left-0 h-14 w-[220px]" aria-label="Signature" role="img">
            <path d={path} fill="none" stroke="#1b2a6b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className="absolute bottom-1 left-0 text-[11px] italic text-[#888]" style={{ fontFamily: 'var(--font-sans)' }}>
            {pending}
          </span>
        )}
      </div>
      <div className="border-t border-[#1a1a1a] pt-1 text-[10.5px]">{caption}</div>
    </div>
  );
}

function DemoAction({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-line-strong p-3">
      <span className="rounded bg-warn-bg px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-warn">Demo</span>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClick}>
        {busy ? <Spinner /> : null}
        {label}
      </button>
    </div>
  );
}
