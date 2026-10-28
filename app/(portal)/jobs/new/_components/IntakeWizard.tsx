'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey, sha256Hex, mockThreeDS, type IdempotencyKey } from '@/lib/api';
import { handleCardAction } from '@/lib/payments/stripe';
import type {
  AddRecipientInput,
  DocumentType,
  Job,
  MatterId,
  PaymentOption,
  PersonDescription,
  Quote,
  SubmitJobResponse,
} from '@/types/jobs';
import { COURTS, MAX_UPLOAD_BYTES, courtInfo, guessDocType, type CourtInfo } from '../_lib/constants';
import { dueDates } from '../_lib/dates';
import { formatMoney, shortKey } from '../_lib/format';
import { countPdfPages, hasPdfHeader, makeSamplePdf, readFileWithProgress } from '../_lib/pdf';
import {
  emptyAddress,
  emptyNewMatter,
  emptyRecipient,
  isUploadSettled,
  serviceableAddresses,
  type AddressDraft,
  type CheckoutDraft,
  type DocUpload,
  type FieldErrors,
  type MatterDraft,
  type RecipientDraft,
  type StepIndex,
  type UploadStatus,
} from '../_lib/state';
import { JobSummary } from './JobSummary';
import { MockBankChallenge } from './MockBankChallenge';
import { StepCheckout } from './StepCheckout';
import { StepDocuments } from './StepDocuments';
import { StepMatter } from './StepMatter';
import { StepRecipient } from './StepRecipient';
import { Stepper } from './Stepper';
import { SubmitSuccess } from './SubmitSuccess';
import { Spinner } from './ui';

const MOCK_MODE = process.env.NEXT_PUBLIC_API_MOCK === '1';

/** What the summary and success screens need to show about the matter, whether saved or still a draft. */
export interface MatterView {
  id: MatterId | null;
  styleOfCause: string;
  courtFileNo: string;
  clientReference: string | null;
  court: CourtInfo | null;
}

type Done = { outcome: Exclude<SubmitJobResponse['outcome'], 'requires_action'>; job: Job };

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.problem.detail ?? err.message;
  if (err instanceof Error && err.name !== 'AbortError') return err.message;
  return fallback;
}

function matterView(d: MatterDraft): MatterView | null {
  if (d.mode === 'existing') {
    const m = d.selected;
    return m
      ? { id: m.id, styleOfCause: m.styleOfCause, courtFileNo: m.courtFileNo ?? 'Not issued', clientReference: m.clientReference, court: courtInfo(m.courtType) }
      : null;
  }
  if (d.created) {
    const m = d.created;
    return { id: m.id, styleOfCause: m.styleOfCause, courtFileNo: m.courtFileNo ?? '', clientReference: m.clientReference, court: courtInfo(m.courtType) };
  }
  const f = d.fields;
  return f.styleOfCause.trim() && f.courtFileNo.trim()
    ? { id: null, styleOfCause: f.styleOfCause.trim(), courtFileNo: f.courtFileNo.trim(), clientReference: f.clientReference || null, court: COURTS[f.court] }
    : null;
}

function toDescription(r: RecipientDraft): PersonDescription | undefined {
  if (r.kind !== 'individual') return undefined;
  const d = r.description;
  const out: { -readonly [K in keyof PersonDescription]: PersonDescription[K] } = {};
  if (d.sex) out.sex = d.sex;
  if (d.approxAge) out.approxAge = Number(d.approxAge);
  if (d.heightCm) out.heightCm = Number(d.heightCm);
  if (d.hair.trim()) out.hair = d.hair.trim();
  if (d.notes.trim()) out.notes = d.notes.trim();
  return Object.keys(out).length ? out : undefined;
}

export function IntakeWizard() {
  const topRef = useRef<HTMLDivElement>(null);
  const dues = useMemo(() => dueDates(), []);

  /* ── Navigation ── */
  const [step, setStep] = useState<StepIndex>(0);
  const [maxReached, setMaxReached] = useState<StepIndex>(0);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  /* ── Server objects ── */
  const [job, setJobState] = useState<Job | null>(null);
  const jobRef = useRef<Job | null>(null);
  const setJob = useCallback((j: Job | null) => {
    jobRef.current = j;
    setJobState(j);
  }, []);

  /* ── Step state ── */
  const [matter, setMatter] = useState<MatterDraft>({ mode: 'existing', selected: null });
  const [docs, setDocs] = useState<DocUpload[]>([]);
  const docsRef = useRef<DocUpload[]>(docs);
  docsRef.current = docs;
  const uploads = useRef(new Map<string, AbortController>());
  const [recipient, setRecipient] = useState<RecipientDraft>(emptyRecipient);
  const [savedRecipientSig, setSavedRecipientSig] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutDraft>({ priority: 'standard', maxAttempts: 3, paymentOptionId: '' });
  const [paymentOptions, setPaymentOptions] = useState<readonly PaymentOption[] | null>(null);

  /* ── Quote & submit ── */
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteNonce, setQuoteNonce] = useState(0);
  const [payError, setPayError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** One key per "submit" action; reused if the clerk retries after an error or timeout. */
  const [submitKey, setSubmitKey] = useState<IdempotencyKey | null>(null);
  const [mockChallenge, setMockChallenge] = useState(false);
  const [done, setDone] = useState<Done | null>(null);

  const matterSummary = matterView(matter);
  const selectedPayment = paymentOptions?.find((p) => p.id === checkout.paymentOptionId);

  const go = useCallback((next: StepIndex) => {
    setErrors({});
    setStep(next);
    setMaxReached((m) => (next > m ? next : m));
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  /* Payment options load once. */
  useEffect(() => {
    const controller = new AbortController();
    api
      .listPaymentOptions({ signal: controller.signal })
      .then((opts) => {
        setPaymentOptions(opts);
        setCheckout((c) => (c.paymentOptionId ? c : { ...c, paymentOptionId: opts[0]?.id ?? '' }));
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) setPayError(errorMessage(err, 'Could not load payment options.'));
      });
    return () => controller.abort();
  }, []);

  /* Cancel in-flight uploads on unmount. */
  useEffect(() => {
    const map = uploads.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  /* ══════════ Step 1: matter + draft job ══════════ */
  async function continueFromMatter() {
    const e: FieldErrors = {};
    if (matter.mode === 'existing' && !matter.selected) e.matter = 'Select a matter, or create a new one.';
    if (matter.mode === 'new' && !matter.created) {
      const f = matter.fields;
      if (!f.styleOfCause.trim()) e.styleOfCause = 'Enter the style of cause.';
      else if (!/\sv\.?\s/i.test(f.styleOfCause)) e.styleOfCause = 'Style of cause usually reads “Plaintiff v. Defendant”.';
      if (!f.courtFileNo.trim()) e.courtFileNo = 'Enter the court file number from the issued document.';
    }
    if (Object.keys(e).length) return setErrors(e);

    setBusy(true);
    try {
      let matterId: MatterId;
      if (matter.mode === 'existing') {
        matterId = matter.selected!.id;
      } else if (matter.created) {
        matterId = matter.created.id;
      } else {
        const f = matter.fields;
        const created = await api.createMatter({
          styleOfCause: f.styleOfCause.trim(),
          courtFileNo: f.courtFileNo.trim(),
          courtType: f.court,
          courtName: `${COURTS[f.court].label}, ${f.site}`,
          jurisdictionCode: 'CA-ON',
          ...(f.clientReference.trim() ? { clientReference: f.clientReference.trim() } : {}),
        });
        setMatter({ mode: 'new', fields: f, created });
        matterId = created.id;
      }

      const current = jobRef.current;
      if (current) {
        if (current.matterId !== matterId) setJob(await api.updateJob(current.id, { version: current.version, matterId }));
      } else {
        setJob(
          await api.createJob({
            matterId,
            priority: checkout.priority,
            serviceMethodRequested: recipient.method,
            dueBy: dues[checkout.priority].toISOString(),
            maxAttempts: checkout.maxAttempts,
          }),
        );
      }
      go(1);
    } catch (err) {
      setErrors({ [matter.mode === 'existing' ? 'matter' : 'styleOfCause']: errorMessage(err, 'Could not save the matter. Try again.') });
    } finally {
      setBusy(false);
    }
  }

  /* ══════════ Step 2: documents ══════════ */
  const patchDoc = useCallback((key: string, patch: Partial<DocUpload>) => {
    setDocs((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }, []);
  const setStatus = useCallback((key: string, status: UploadStatus) => patchDoc(key, { status }), [patchDoc]);

  async function processFile(file: File) {
    const jobId = jobRef.current?.id;
    if (!jobId) return;
    const key = crypto.randomUUID();
    const guessed = guessDocType(file.name);
    const base: DocUpload = { key, name: file.name, size: file.size, docType: guessed, sha256: null, pages: null, status: { stage: 'reading', progress: 0 } };

    const looksPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!looksPdf) {
      setDocs((d) => [...d, { ...base, status: { stage: 'rejected', error: `${file.name} isn’t a PDF. Export or scan it to PDF first.` } }]);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setDocs((d) => [...d, { ...base, status: { stage: 'rejected', error: 'Over 50 MB. Split the document or compress it first.' } }]);
      return;
    }

    const controller = new AbortController();
    uploads.current.set(key, controller);
    setDocs((d) => [...d, base]);

    try {
      const buf = await readFileWithProgress(file, (p) => setStatus(key, { stage: 'reading', progress: p * 0.35 }));
      if (!hasPdfHeader(buf)) {
        setStatus(key, { stage: 'rejected', error: 'This file has a .pdf name but isn’t a valid PDF. Re-export it and try again.' });
        return;
      }
      setStatus(key, { stage: 'hashing', progress: 0.4 });
      const [sha256, pages] = await Promise.all([sha256Hex(buf), Promise.resolve(countPdfPages(buf))]);
      patchDoc(key, { sha256, pages, status: { stage: 'requesting', progress: 0.5 } });

      const doc = await api.uploadDocument(
        jobId,
        file,
        () => docsRef.current.find((d) => d.key === key)?.docType ?? guessed,
        {
          sha256,
          ...(pages !== null ? { pageCount: pages } : {}),
          idempotencyKey: newIdempotencyKey(),
          signal: controller.signal,
          onStage: (stage) => setStatus(key, { stage, progress: stage === 'requesting' ? 0.5 : stage === 'uploading' ? 0.55 : 0.97 }),
          onProgress: (p) => setStatus(key, { stage: 'uploading', progress: 0.55 + p * 0.4 }),
        },
      );
      patchDoc(key, { status: { stage: 'registered' }, serverId: doc.id });
    } catch (err) {
      if (!controller.signal.aborted) setStatus(key, { stage: 'rejected', error: errorMessage(err, 'Upload failed. Remove the file and try again.') });
    } finally {
      uploads.current.delete(key);
    }
  }

  function removeDoc(key: string) {
    const doc = docsRef.current.find((d) => d.key === key);
    uploads.current.get(key)?.abort();
    setDocs((d) => d.filter((x) => x.key !== key));
    const jobId = jobRef.current?.id;
    if (doc?.serverId && jobId) {
      api.removeDocument(jobId, doc.serverId).catch(() => {
        /* Non-blocking: an orphaned draft document is harmless and cleaned up server-side. */
      });
    }
  }

  function continueFromDocs() {
    if (docs.some((d) => !isUploadSettled(d))) return setErrors({ docs: 'Wait for uploads to finish.' });
    if (!docs.some((d) => d.status.stage === 'registered')) return setErrors({ docs: 'Add at least one document to be served.' });
    go(2);
  }

  /* ══════════ Step 3: recipient ══════════ */
  const patchRecipient = (patch: Partial<RecipientDraft>) => setRecipient((r) => ({ ...r, ...patch }));
  const patchAddress = (key: string, patch: Partial<AddressDraft>) =>
    setRecipient((r) => ({ ...r, addresses: r.addresses.map((a) => (a.key === key ? { ...a, ...patch } : a)) }));

  async function validateAddress(key: string) {
    const a = recipient.addresses.find((x) => x.key === key);
    if (!a?.raw.trim()) return;
    patchAddress(key, { checking: true });
    try {
      patchAddress(key, { checking: false, result: await api.validateAddress(a.raw) });
    } catch (err) {
      patchAddress(key, { checking: false, result: { ok: false, reason: errorMessage(err, 'Address check failed. Try again.') } });
    }
  }

  async function continueFromRecipient() {
    const e: FieldErrors = {};
    if (!recipient.name.trim()) e.name = recipient.kind === 'individual' ? 'Enter the person’s full legal name.' : 'Enter the corporation’s registered name.';
    const valid = serviceableAddresses(recipient);
    if (!valid.length) e.address = 'Validate at least one Ontario address.';
    else if (recipient.addresses.some((a) => a.raw.trim() && !a.result)) e.address = 'Validate every address you entered, or remove the ones you don’t need.';
    if (Object.keys(e).length) return setErrors(e);

    const input: AddRecipientInput = {
      kind: recipient.kind,
      name: recipient.name.trim(),
      roleInMatter: recipient.role,
      ...(toDescription(recipient) ? { description: toDescription(recipient) } : {}),
      ...(recipient.kind === 'individual' && recipient.description.dateOfBirth ? { dateOfBirth: recipient.description.dateOfBirth } : {}),
      addresses: valid.map(({ draft, result }, i) => ({ kind: draft.kind, address: result.formatted, sequence: i + 1 })),
    };
    const sig = JSON.stringify([input, recipient.method, recipient.instructions]);
    if (sig === savedRecipientSig) return go(3);

    const current = jobRef.current;
    if (!current) return;
    setBusy(true);
    try {
      await api.addRecipient(current.id, input);
      setJob(
        await api.updateJob(current.id, {
          version: current.version,
          serviceMethodRequested: recipient.method,
          specialInstructions: recipient.instructions.trim() || null,
        }),
      );
      setSavedRecipientSig(sig);
      go(3);
    } catch (err) {
      setErrors({ address: errorMessage(err, 'Could not save the recipient. Try again.') });
    } finally {
      setBusy(false);
    }
  }

  /* ══════════ Step 4: quote (re-priced when priority or attempts change) ══════════ */
  const quoteChain = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (step !== 3 || !jobRef.current || done) return;
    let cancelled = false;
    setQuoting(true);
    setSubmitKey(null); // a new price makes the next submit a new operation
    const { priority, maxAttempts } = checkout;

    // Serialize PATCH + quote so rapid clicks can't race on the job's version.
    quoteChain.current = quoteChain.current.then(async () => {
      if (cancelled) return;
      try {
        let j = jobRef.current!;
        if (j.priority !== priority || j.maxAttempts !== maxAttempts) {
          j = await api.updateJob(j.id, { version: j.version, priority, maxAttempts, dueBy: dues[priority].toISOString() });
          setJob(j);
        }
        if (cancelled) return;
        const q = await api.createQuote(j.id);
        if (!cancelled) {
          setQuote(q);
          setPayError(null);
        }
      } catch (err) {
        if (!cancelled) setPayError(errorMessage(err, 'Could not price this job. Try again.'));
      } finally {
        if (!cancelled) setQuoting(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, checkout.priority, checkout.maxAttempts, quoteNonce, done, dues, setJob]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ══════════ Submit ══════════ */
  function finish(res: Exclude<SubmitJobResponse, { outcome: 'requires_action' }>) {
    setJob(res.job);
    setDone({ outcome: res.outcome, job: res.job });
    setSubmitKey(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function confirmAfterChallenge() {
    const current = jobRef.current;
    if (!current || !quote) return;
    // A fresh key: the original submit key is bound to the cached requires_action response.
    const res = await api.confirmSubmit(current.id, { quoteId: quote.id });
    if (res.outcome === 'requires_action') throw new Error('Your bank asked for verification again. Try another card.');
    finish(res);
  }

  async function submit() {
    const current = jobRef.current;
    if (!current || !quote || !selectedPayment) return;
    const key = submitKey ?? newIdempotencyKey();
    setSubmitKey(key);
    setSubmitting(true);
    setPayError(null);
    try {
      const res = await api.submitJob(
        current.id,
        { quoteId: quote.id, ...(selectedPayment.kind === 'card' ? { paymentMethodId: selectedPayment.id } : {}) },
        { idempotencyKey: key },
      );
      if (res.outcome !== 'requires_action') return finish(res);

      if (MOCK_MODE) {
        setMockChallenge(true); // resolved in onMockChallenge
        return;
      }
      await handleCardAction(res.paymentClientSecret);
      await confirmAfterChallenge();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setQuoteNonce((n) => n + 1); // quote went stale; fetch a new one
      }
      if (!(err instanceof ApiError && err.isRetryable)) setSubmitKey(null);
      setPayError(errorMessage(err, 'Could not reach ServeNow. Your card was not charged twice; try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function onMockChallenge(passed: boolean) {
    setMockChallenge(false);
    mockThreeDS.nextOutcome = passed ? 'pass' : 'fail';
    setSubmitting(true);
    try {
      await confirmAfterChallenge();
    } catch (err) {
      setSubmitKey(null);
      setPayError(errorMessage(err, 'Bank verification failed.'));
    } finally {
      setSubmitting(false);
    }
  }

  /* ══════════ Serve another person on the same matter ══════════ */
  function serveAnother() {
    const m = matter.mode === 'existing' ? matter.selected : matter.created;
    uploads.current.forEach((c) => c.abort());
    setMatter(m ? { mode: 'existing', selected: m } : { mode: 'new', fields: emptyNewMatter(), created: null });
    setJob(null);
    setDocs([]);
    setRecipient(emptyRecipient());
    setSavedRecipientSig(null);
    setQuote(null);
    setDone(null);
    setSubmitKey(null);
    setPayError(null);
    setCheckout((c) => ({ ...c, priority: 'standard', maxAttempts: 3 }));
    setMaxReached(0);
    go(0);
  }

  /* ══════════ Render ══════════ */
  const continueActions: Record<Exclude<StepIndex, 3>, { label: string; run: () => void }> = {
    0: { label: 'Continue to documents', run: () => void continueFromMatter() },
    1: { label: 'Continue to person & address', run: continueFromDocs },
    2: { label: 'Continue to quote', run: () => void continueFromRecipient() },
  };

  const submitLabel = !quote
    ? 'Preparing quote…'
    : selectedPayment?.kind === 'invoice'
      ? `Submit · bill ${formatMoney(quote.totalCents)} to firm account`
      : checkout.priority === 'standard'
        ? `Pay ${formatMoney(quote.totalCents)} & submit`
        : `Authorize ${formatMoney(quote.totalCents)} & submit`;

  const firstAddress = serviceableAddresses(recipient)[0];

  return (
    <div ref={topRef} className="mx-auto flex max-w-[1180px] scroll-mt-4 flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav className="text-[12.5px] text-muted" aria-label="Breadcrumb">
            Active Jobs <span className="text-faint">/</span> <span className="text-fg">Submit new job</span>
          </nav>
          <h1 className="mt-0.5 text-[22px] font-semibold">Submit a job for service</h1>
        </div>
        {MOCK_MODE ? <div className="text-[12px] text-faint">Demo · sample data, no real charges</div> : null}
      </div>

      {!done ? <Stepper step={step} maxReached={maxReached} onGo={go} /> : null}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          {done && quote && matterSummary ? (
            <SubmitSuccess
              job={done.job}
              outcome={done.outcome}
              quote={quote}
              matter={matterSummary}
              recipientName={recipient.name}
              address={firstAddress?.result.formatted ?? ''}
              priority={checkout.priority}
              due={dues[checkout.priority]}
              payment={selectedPayment}
              onServeAnother={serveAnother}
            />
          ) : (
            <>
              {step === 0 ? <StepMatter draft={matter} onChange={setMatter} errors={errors} /> : null}
              {step === 1 ? (
                <StepDocuments
                  docs={docs}
                  onAddFiles={(files) => files.forEach((f) => void processFile(f))}
                  onRemove={removeDoc}
                  onTypeChange={(key, docType: DocumentType) => patchDoc(key, { docType })}
                  onAddSamples={() =>
                    [makeSamplePdf('Statement_of_Claim_Form14A_issued.pdf', 18), makeSamplePdf('Notice_of_Action_Form14C.pdf', 3)].forEach(
                      (f) => void processFile(f),
                    )
                  }
                  error={errors.docs}
                />
              ) : null}
              {step === 2 ? (
                <StepRecipient
                  recipient={recipient}
                  onChange={patchRecipient}
                  onAddressChange={patchAddress}
                  onAddAddress={() => setRecipient((r) => ({ ...r, addresses: [...r.addresses, emptyAddress()] }))}
                  onRemoveAddress={(key) => setRecipient((r) => ({ ...r, addresses: r.addresses.filter((a) => a.key !== key) }))}
                  onValidateAddress={(key) => void validateAddress(key)}
                  errors={errors}
                />
              ) : null}
              {step === 3 ? (
                <StepCheckout
                  checkout={checkout}
                  onChange={(p) => setCheckout((c) => ({ ...c, ...p }))}
                  dues={dues}
                  quote={quote}
                  quoting={quoting}
                  paymentOptions={paymentOptions}
                  error={payError}
                />
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {step > 0 ? (
                  <button type="button" className="btn btn-ghost" onClick={() => go((step - 1) as StepIndex)}>
                    Back
                  </button>
                ) : (
                  <span />
                )}
                <div className="ml-auto flex items-center gap-3">
                  {step === 3 && submitKey ? (
                    <span className="hidden font-mono text-[11px] text-faint sm:inline">Idempotency-Key {shortKey(submitKey)}</span>
                  ) : null}
                  {step !== 3 ? (
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={continueActions[step].run}>
                      {busy ? <Spinner /> : null}
                      {busy ? (step === 0 ? 'Creating draft…' : 'Saving…') : continueActions[step].label}
                    </button>
                  ) : (
                    <button type="button" className="btn btn-primary" disabled={!quote || quoting || submitting || !selectedPayment} onClick={() => void submit()}>
                      {submitting ? <Spinner /> : null}
                      {submitting ? 'Contacting payment processor…' : submitLabel}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
          <JobSummary
            matter={matterSummary}
            docs={docs}
            recipient={recipient}
            checkout={checkout}
            quote={quote}
            dues={dues}
            job={job}
            maxReached={maxReached}
            editable={!done}
            onEdit={go}
          />
        </aside>
      </div>

      {mockChallenge && quote ? (
        <MockBankChallenge amountCents={quote.totalCents} cardLabel={selectedPayment?.label ?? 'Card'} onResult={(p) => void onMockChallenge(p)} />
      ) : null}
    </div>
  );
}
