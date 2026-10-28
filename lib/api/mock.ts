/**
 * In-memory stand-in for the NestJS API, for local development and demos.
 * Enabled with NEXT_PUBLIC_API_MOCK=1. Typed as ApiClient, so it can't drift
 * from the real client's surface without a compile error.
 *
 * It mimics the server behaviours the UI depends on: idempotent POST replay,
 * optimistic-lock conflicts, server-side pricing, and 3-D Secure.
 */
import type { ApiClient, MutationOptions, UploadDocumentOptions } from './client';
import { ApiError } from './errors';
import type {
  AddressValidation,
  FileId,
  Job,
  JobDocument,
  JobId,
  JobSummary,
  Matter,
  MatterId,
  OrgId,
  PaymentOption,
  Quote,
  QuoteId,
  QuoteLineItem,
  Recipient,
  RecipientId,
  AddressId,
  UserId,
  Priority,
  DocumentType,
} from '@/types/jobs';

/** Payment method that forces a 3-D Secure challenge in the mock. */
export const MOCK_3DS_PAYMENT_ID = 'pm_mock_3ds';

/** The simulated bank challenge sets this before calling confirmSubmit. */
export const mockThreeDS = { nextOutcome: 'pass' as 'pass' | 'fail' };

const ORG = 'org_harrow' as OrgId;
const ME = 'usr_praman' as UserId;
const rid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 8)}`;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const latency = () => sleep(200 + Math.random() * 350);
const now = () => new Date().toISOString();

const PRICING = {
  base: { standard: 7500, expedited: 11000, rush: 16500, same_day: 22000 } satisfies Record<Priority, number>,
  label: { standard: 'Standard', expedited: 'Expedited', rush: 'Rush', same_day: 'Same-day' } satisfies Record<Priority, string>,
  perKm: 85,
  freeKm: 25,
  perPage: 25,
  extraAttempt: 2500,
  hst: 0.13,
};

const MATTERS: Matter[] = [
  ['LIT-24-0917', 'CV-26-00081245-0000', 'Harrow Credit Union v. Delacroix', 'superior'],
  ['COL-26-1142', 'SC-26-00004417', 'Northgate Supply Ltd. v. Pellerin', 'small_claims'],
  ['LIT-26-0214', 'CV-26-00083377-0000', 'Ostrander v. Mapleview Condo Corp. No. 612', 'superior'],
  ['FAM-26-0388', 'FC-26-1893', 'Walcott v. Walcott', 'family'],
  ['LIT-25-0102', 'CV-26-00079902-0000', 'Kestrel Logistics v. Brandt Holdings', 'superior'],
].map(([ref, file, cause, court], i) => ({
  id: `mat_seed${i}` as MatterId,
  clientOrgId: ORG,
  courtFileNo: file ?? null,
  styleOfCause: cause ?? '',
  courtName: 'Ottawa — 161 Elgin St.',
  courtType: court as Matter['courtType'],
  jurisdictionCode: 'CA-ON',
  clientReference: ref ?? null,
  createdBy: ME,
  createdAt: '2026-06-01T14:00:00-04:00',
}));

const PAYMENT_OPTIONS: PaymentOption[] = [
  { id: 'invoice', kind: 'invoice', label: 'Firm account · monthly invoice', detail: 'Net-30 · Harrow & Lindqvist LLP' },
  { id: 'pm_mock_4242', kind: 'card', label: 'Visa •••• 4242', detail: 'Firm card · exp 08/28' },
  { id: MOCK_3DS_PAYMENT_ID, kind: 'card', label: 'Visa •••• 3184', detail: 'Test card · bank verification (3-D Secure) required' },
];

/* ── Seed jobs for the dashboard, with due dates relative to today so the demo always looks current ── */
interface SeedJob {
  matter: number; // index into MATTERS
  recipient: string;
  status: JobSummary['status'];
  priority: Priority;
  method: JobSummary['serviceMethodRequested'];
  dueInDays: number;
  attempts: number;
  max: number;
  server: string | null;
}
const SEED_JOBS: SeedJob[] = [
  { matter: 0, recipient: 'Martin Delacroix', status: 'in_progress', priority: 'standard', method: 'personal', dueInDays: 4, attempts: 2, max: 3, server: 'Rahel Okafor' },
  { matter: 0, recipient: 'Delacroix Renovations Inc.', status: 'served', priority: 'standard', method: 'corporate', dueInDays: 4, attempts: 1, max: 3, server: 'Rahel Okafor' },
  { matter: 1, recipient: 'Amélie Pellerin', status: 'affidavit_pending', priority: 'rush', method: 'substituted_residence', dueInDays: 1, attempts: 3, max: 3, server: 'Denis Tremblay' },
  { matter: 3, recipient: 'Kevin Walcott', status: 'non_served', priority: 'expedited', method: 'personal', dueInDays: 2, attempts: 4, max: 4, server: 'Sophie Nguyen' },
  { matter: 4, recipient: 'Brandt Holdings Corp.', status: 'assigned', priority: 'standard', method: 'corporate', dueInDays: 8, attempts: 0, max: 3, server: 'Layla Haddad' },
  { matter: 2, recipient: 'Mapleview Condo Corp. No. 612', status: 'open', priority: 'standard', method: 'corporate', dueInDays: 9, attempts: 0, max: 3, server: null },
  { matter: 1, recipient: 'Gábor Szabo', status: 'offered', priority: 'same_day', method: 'personal', dueInDays: 0, attempts: 0, max: 2, server: null },
  { matter: 1, recipient: 'Petra Achterberg', status: 'disputed', priority: 'standard', method: 'personal', dueInDays: -3, attempts: 1, max: 3, server: 'Marc Jean-Baptiste' },
  { matter: 2, recipient: 'Fairway Insurance Co.', status: 'authorized', priority: 'expedited', method: 'corporate', dueInDays: 3, attempts: 0, max: 3, server: null },
  { matter: 3, recipient: 'Tunde Idowu', status: 'affidavit_signed', priority: 'standard', method: 'personal', dueInDays: -2, attempts: 2, max: 3, server: 'Sophie Nguyen' },
];

function seedSummaries(): JobSummary[] {
  const today = new Date();
  return SEED_JOBS.map((j, i) => {
    const due = new Date(today);
    due.setDate(due.getDate() + j.dueInDays);
    due.setHours(17, 0, 0, 0);
    const parts = j.server?.split(' ') ?? [];
    return {
      id: `job_seed${i}` as JobId,
      publicRef: `SN-2026-00${4189 + i * 7}`,
      matterId: MATTERS[j.matter]!.id,
      status: j.status,
      priority: j.priority,
      serviceMethodRequested: j.method,
      dueBy: due.toISOString(),
      maxAttempts: j.max,
      attemptCount: j.attempts,
      primaryRecipientName: j.recipient,
      assignedServer: j.server
        ? { id: `usr_srv${i}` as UserId, displayName: `${parts[0]![0]}. ${parts.slice(1).join(' ')}`, ratingAvg: 4.8 }
        : null,
      updatedAt: new Date(today.getTime() - i * 3_600_000).toISOString(),
    };
  });
}

/* ── Mock geocoder (stands in for Google Geocoding in the API) ── */
const PLACES: Record<string, { city: string; lat: number; lng: number; km: number; pool: string; province?: string }> = {
  ottawa: { city: 'Ottawa', lat: 45.4215, lng: -75.6972, km: 6, pool: 'Ottawa' },
  nepean: { city: 'Nepean', lat: 45.3345, lng: -75.724, km: 12, pool: 'Ottawa' },
  kanata: { city: 'Kanata', lat: 45.3088, lng: -75.8987, km: 24, pool: 'Ottawa' },
  orleans: { city: 'Orléans', lat: 45.47, lng: -75.515, km: 15, pool: 'Ottawa' },
  orléans: { city: 'Orléans', lat: 45.47, lng: -75.515, km: 15, pool: 'Ottawa' },
  barrhaven: { city: 'Barrhaven', lat: 45.2735, lng: -75.737, km: 19, pool: 'Ottawa' },
  rockland: { city: 'Rockland', lat: 45.546, lng: -75.291, km: 38, pool: 'Ottawa' },
  arnprior: { city: 'Arnprior', lat: 45.435, lng: -76.353, km: 61, pool: 'Ottawa' },
  toronto: { city: 'Toronto', lat: 43.6532, lng: -79.3832, km: 9, pool: 'Toronto' },
  gatineau: { city: 'Gatineau', lat: 45.4765, lng: -75.7013, km: 7, pool: 'Ottawa', province: 'QC' },
};
const travelKmByAddress = new Map<string, number>();

function mockGeocode(raw: string): AddressValidation {
  const text = raw.trim();
  const street = text.split(',')[0]?.trim() ?? '';
  if (!/\d/.test(street)) {
    return { ok: false, reason: 'No street number found. Enter the civic address, e.g. “118 Fifth Ave, Ottawa, ON K1S 2M8”.' };
  }
  const lower = text.toLowerCase();
  const key = Object.keys(PLACES).find((k) => lower.includes(k));
  const place = (key && PLACES[key]) || PLACES.ottawa!;
  const postalMatch = text.match(/[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d/);
  const postal = postalMatch ? postalMatch[0].toUpperCase().replace(/[ -]?(\d[A-Z]\d)$/, ' $1') : null;
  const province = place.province ?? 'ON';
  const titled = street.replace(/\b\w/g, (c) => c.toUpperCase());
  const formatted = `${titled}, ${place.city}, ${province}${postal ? ` ${postal}` : ''}`;
  // Deterministic per address, so re-geocoding on save matches what the clerk saw.
  const seed = [...titled.toLowerCase()].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const km = place.km + (seed % 5);
  travelKmByAddress.set(formatted, km);
  const jitter = (salt: number) => (((seed >>> salt) % 1000) / 1000 - 0.5) * 0.02;
  return {
    ok: true,
    formatted,
    location: { lat: +(place.lat + jitter(3)).toFixed(5), lng: +(place.lng + jitter(11)).toFixed(5) },
    province,
    postalCode: postal,
    confidence: postal ? (key ? 0.97 : 0.84) : key ? 0.72 : 0.58,
    precision: postal ? 'rooftop' : 'street',
    hasUnit: /(\bunit|\bapt|#|\bsuite)/i.test(text),
    nearestPool: { name: place.pool, km },
  };
}

/* ── Fake server state ── */
interface ServerJob {
  job: Job;
  pages: number;
  travelKm: number;
  paymentIntentId?: string;
}

export function createMockApiClient(): ApiClient {
  const jobs = new Map<JobId, ServerJob>();
  const idem = new Map<string, unknown>();
  let seq = 4280;
  const seeded = seedSummaries();

  /** Replays the stored response when a POST reuses an Idempotency-Key. */
  async function idempotent<T>(path: string, opts: MutationOptions | undefined, run: () => T): Promise<T> {
    await latency();
    const cacheKey = opts?.idempotencyKey ? `${opts.idempotencyKey} ${path}` : null;
    if (cacheKey && idem.has(cacheKey)) return structuredClone(idem.get(cacheKey)) as T;
    const result = run();
    if (cacheKey) idem.set(cacheKey, structuredClone(result));
    return structuredClone(result);
  }

  function mustGet(jobId: JobId): ServerJob {
    const s = jobs.get(jobId);
    if (!s) throw new ApiError({ type: '/problems/not-found', title: 'Job not found', status: 404 });
    return s;
  }

  /**
   * Apply a change. Only edits to the job's own fields (PATCH /jobs/{id}) bump `version`, matching
   * the database layer: adding documents, recipients or a quote doesn't make a client's copy stale.
   */
  function touch(s: ServerJob, patch: Partial<Job>, opts: { bumpVersion?: boolean } = {}): Job {
    const version = opts.bumpVersion ? s.job.version + 1 : s.job.version;
    s.job = { ...s.job, ...patch, version, updatedAt: now() };
    return s.job;
  }

  function price(s: ServerJob): Quote {
    const { priority, maxAttempts } = s.job;
    const km = Math.max(0, s.travelKm - PRICING.freeKm);
    const fmt = (c: number) => (c / 100).toLocaleString('en-CA', { style: 'currency', currency: 'CAD' });
    const lineItems: QuoteLineItem[] = [
      { code: 'base', label: `${PRICING.label[priority]} service · base`, amountCents: PRICING.base[priority] },
      {
        code: 'distance',
        label: km ? `Travel beyond ${PRICING.freeKm} km · ${km} km × ${fmt(PRICING.perKm)}` : `Travel · within ${PRICING.freeKm} km`,
        amountCents: km * PRICING.perKm,
      },
      { code: 'printing', label: `Printing & binding · ${s.pages} pp × ${fmt(PRICING.perPage)}`, amountCents: s.pages * PRICING.perPage },
    ];
    if (maxAttempts > 3) {
      lineItems.push({
        code: 'extra_attempts',
        label: `Additional attempts · ${maxAttempts - 3} × ${fmt(PRICING.extraAttempt)}`,
        amountCents: (maxAttempts - 3) * PRICING.extraAttempt,
      });
    }
    const subtotalCents = lineItems.reduce((a, l) => a + l.amountCents, 0);
    const taxCents = Math.round(subtotalCents * PRICING.hst);
    return {
      id: rid('quo') as QuoteId,
      jobId: s.job.id,
      lineItems,
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents,
      currency: 'CAD',
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    };
  }

  const api: ApiClient = {
    createMatter: (input, opts) =>
      idempotent('/matters', opts, () => {
        const m: Matter = {
          id: rid('mat') as MatterId,
          clientOrgId: ORG,
          courtFileNo: input.courtFileNo ?? null,
          styleOfCause: input.styleOfCause,
          courtName: input.courtName,
          courtType: input.courtType,
          jurisdictionCode: input.jurisdictionCode,
          clientReference: input.clientReference ?? null,
          createdBy: ME,
          createdAt: now(),
        };
        MATTERS.unshift(m);
        return m;
      }),

    searchMatters: async (q) => {
      await latency();
      const needle = q.trim().toLowerCase();
      const items = MATTERS.filter(
        (m) => !needle || [m.clientReference, m.courtFileNo, m.styleOfCause].join(' ').toLowerCase().includes(needle),
      );
      return { items, nextCursor: null };
    },

    createJob: (input, opts) =>
      idempotent('/jobs', opts, () => {
        const job: Job = {
          id: rid('job') as JobId,
          publicRef: `SN-2026-00${seq++}`,
          matterId: input.matterId,
          status: 'draft',
          priority: input.priority,
          serviceMethodRequested: input.serviceMethodRequested,
          dueBy: input.dueBy,
          maxAttempts: input.maxAttempts ?? 3,
          attemptCount: 0,
          primaryRecipientName: null,
          assignedServer: null,
          updatedAt: now(),
          clientOrgId: ORG,
          createdBy: ME,
          specialInstructions: input.specialInstructions ?? null,
          assignedAt: null,
          quote: null,
          recipients: [],
          documents: [],
          attempts: [],
          version: 1,
          createdAt: now(),
        };
        jobs.set(job.id, { job, pages: 0, travelKm: 12 });
        return job;
      }),

    listJobs: async () => {
      await latency();
      // Jobs submitted in this session first, then the seeded examples.
      const created = [...jobs.values()].map((s) => s.job).filter((j) => j.status !== 'draft' && j.status !== 'quoted');
      return { items: [...created.reverse(), ...seeded], nextCursor: null };
    },

    getJob: async (jobId) => {
      await latency();
      return structuredClone(mustGet(jobId).job);
    },

    updateJob: async (jobId, input) => {
      await latency();
      const s = mustGet(jobId);
      if (s.job.version !== input.version) {
        throw new ApiError({ type: '/problems/version-conflict', title: 'This job changed. Reload and try again.', status: 409 });
      }
      const { version: _v, ...patch } = input;
      const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<Job>;
      const next = touch(s, { ...clean, status: s.job.status === 'quoted' ? 'draft' : s.job.status }, { bumpVersion: true });
      return structuredClone(next);
    },

    uploadDocumentUrl: (jobId, input, opts) =>
      idempotent(`/jobs/${jobId}/documents:uploadUrl`, opts, () => {
        mustGet(jobId);
        const fileId = rid('fil') as FileId;
        return {
          fileId,
          uploadUrl: `https://storage.googleapis.com/sn-docs-ca/${fileId}`,
          requiredHeaders: { 'x-goog-hash': `sha256=${input.sha256}` },
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        };
      }),

    registerDocument: (jobId, input, opts) =>
      idempotent(`/jobs/${jobId}/documents`, opts, () => {
        const s = mustGet(jobId);
        const doc: JobDocument = {
          id: rid('doc'),
          fileId: input.fileId,
          docType: input.docType,
          fileName: `${input.fileId}.pdf`,
          pageCount: input.pageCount ?? null,
          requiresPrint: input.requiresPrint ?? true,
          sha256: '',
        };
        s.pages += input.pageCount ?? 0;
        touch(s, { documents: [...s.job.documents, doc] });
        return doc;
      }),

    uploadDocument: async (jobId: JobId, file: File, docType: DocumentType | (() => DocumentType), opts: UploadDocumentOptions = {}) => {
      opts.onStage?.('requesting');
      const target = await api.uploadDocumentUrl(
        jobId,
        { fileName: file.name, mimeType: 'application/pdf', sizeBytes: file.size, sha256: opts.sha256 ?? '' },
        {},
      );
      opts.onStage?.('uploading');
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        if (opts.signal?.aborted) throw opts.signal.reason;
        await sleep(40 + Math.min(file.size / 40_000, 60));
        opts.onProgress?.(i / steps);
      }
      opts.onStage?.('registering');
      const type = typeof docType === 'function' ? docType() : docType;
      return api.registerDocument(jobId, { fileId: target.fileId, docType: type, pageCount: opts.pageCount }, {});
    },

    removeDocument: async (jobId, documentId) => {
      await latency();
      const s = mustGet(jobId);
      const doc = s.job.documents.find((d) => d.id === documentId);
      if (doc) {
        s.pages -= doc.pageCount ?? 0;
        touch(s, { documents: s.job.documents.filter((d) => d.id !== documentId) });
      }
    },

    validateAddress: async (address) => {
      await sleep(600 + Math.random() * 500);
      return mockGeocode(address);
    },

    addRecipient: (jobId, input, opts) =>
      idempotent(`/jobs/${jobId}/recipients`, opts, () => {
        const s = mustGet(jobId);
        const recipientId = rid('rcp') as RecipientId;
        const recipient: Recipient = {
          id: recipientId,
          jobId,
          kind: input.kind,
          name: input.name,
          description: input.description ?? null,
          dateOfBirth: input.dateOfBirth ?? null,
          roleInMatter: input.roleInMatter,
          addresses: input.addresses.map((a, i) => {
            const g = mockGeocode(a.address);
            return {
              id: rid('adr') as AddressId,
              kind: a.kind,
              formatted: g.ok ? g.formatted : a.address,
              location: g.ok ? g.location : { lat: 0, lng: 0 },
              geocodeConfidence: g.ok ? g.confidence : null,
              sequence: a.sequence ?? i + 1,
            };
          }),
        };
        const first = input.addresses[0]?.address;
        s.travelKm = (first ? travelKmByAddress.get(first) : undefined) ?? 12;
        touch(s, { recipients: [recipient], primaryRecipientName: recipient.name });
        return recipient;
      }),

    createQuote: (jobId, opts) =>
      idempotent(`/jobs/${jobId}/quote`, opts, () => {
        const s = mustGet(jobId);
        const quote = price(s);
        touch(s, { quote, status: 'quoted' });
        return quote;
      }),

    submitJob: (jobId, input, opts) =>
      idempotent(`/jobs/${jobId}/submit`, opts, () => {
        const s = mustGet(jobId);
        if (s.job.quote?.id !== input.quoteId) {
          throw new ApiError({ type: '/problems/stale-quote', title: 'The price changed. Review the new quote and submit again.', status: 409 });
        }
        if (input.paymentMethodId === MOCK_3DS_PAYMENT_ID) {
          s.paymentIntentId = rid('pi');
          return { outcome: 'requires_action' as const, job: s.job, paymentClientSecret: `${s.paymentIntentId}_secret_mock` };
        }
        const job = touch(s, { status: 'authorized' });
        return input.paymentMethodId === 'invoice' || !input.paymentMethodId
          ? { outcome: 'invoiced' as const, job }
          : { outcome: 'authorized' as const, job };
      }),

    confirmSubmit: (jobId, _input, opts) =>
      idempotent(`/jobs/${jobId}/submit:confirm`, opts, () => {
        const s = mustGet(jobId);
        if (mockThreeDS.nextOutcome === 'fail') {
          throw new ApiError({
            type: '/problems/payment-declined',
            title: 'Bank verification failed',
            status: 402,
            detail: 'The card issuer declined verification. Use another card or bill the firm account.',
          });
        }
        return { outcome: 'authorized' as const, job: touch(s, { status: 'authorized' }) };
      }),

    listPaymentOptions: async () => {
      await latency();
      return PAYMENT_OPTIONS;
    },
  };
  return api;
}
