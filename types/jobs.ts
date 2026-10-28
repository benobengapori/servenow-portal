/**
 * ServeNow client-portal domain types.
 *
 * These mirror the API's JSON shapes (Blueprint §5, §6.3), not the database rows:
 *  - snake_case columns become camelCase fields
 *  - `*_enc` columns arrive decrypted, and only for the org that owns the job
 *  - money is always integer cents plus an ISO 4217 currency code
 *  - timestamps are ISO 8601 strings; parse them at the edge, never store Date objects in state
 */

/* ───────────────────────── Primitives ───────────────────────── */

/** Nominal typing so a JobId can't be passed where a MatterId is expected. */
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type Uuid = string;
export type OrgId = Brand<Uuid, 'OrgId'>;
export type UserId = Brand<Uuid, 'UserId'>;
export type MatterId = Brand<Uuid, 'MatterId'>;
export type JobId = Brand<Uuid, 'JobId'>;
export type RecipientId = Brand<Uuid, 'RecipientId'>;
export type AddressId = Brand<Uuid, 'AddressId'>;
export type AttemptId = Brand<Uuid, 'AttemptId'>;
export type FileId = Brand<Uuid, 'FileId'>;
export type QuoteId = Brand<Uuid, 'QuoteId'>;
export type JurisdictionId = Brand<Uuid, 'JurisdictionId'>;

/** ISO 8601 timestamp with offset, e.g. "2026-10-02T18:42:11-04:00". */
export type IsoDateTime = string;
/** ISO 8601 calendar date, e.g. "2026-10-02". */
export type IsoDate = string;
/** Integer number of cents. Never a float. */
export type Cents = number;
export type CurrencyCode = 'CAD' | 'USD';
/** Lowercase hex SHA-256, 64 characters. */
export type Sha256Hex = string;

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/* ───────────────────────── Enums ─────────────────────────
 * `as const` objects instead of TS `enum`: the values are plain strings on the
 * wire, they tree-shake, and each object doubles as a runtime list for
 * dropdowns and validation.
 */

/** Job state machine (Blueprint §4.1). Only the API changes status. */
export const JobStatus = {
  Draft: 'draft',
  Submitted: 'submitted',
  Quoted: 'quoted',
  Authorized: 'authorized',
  Open: 'open',
  Offered: 'offered',
  Assigned: 'assigned',
  InProgress: 'in_progress',
  Served: 'served',
  NonServed: 'non_served',
  AffidavitPending: 'affidavit_pending',
  AffidavitSigned: 'affidavit_signed',
  Completed: 'completed',
  Closed: 'closed',
  Cancelled: 'cancelled',
  Disputed: 'disputed',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

/** Statuses from which a client may still cancel (fee rules apply server-side). */
export const CANCELLABLE_STATUSES: ReadonlySet<JobStatus> = new Set([
  JobStatus.Draft,
  JobStatus.Submitted,
  JobStatus.Quoted,
  JobStatus.Authorized,
  JobStatus.Open,
  JobStatus.Offered,
  JobStatus.Assigned,
  JobStatus.InProgress,
]);

/** Statuses in which the job is still editable as a draft (PATCH /jobs/{id}). */
export const EDITABLE_STATUSES: ReadonlySet<JobStatus> = new Set([
  JobStatus.Draft,
  JobStatus.Quoted,
]);

export const Priority = {
  Standard: 'standard',
  Expedited: 'expedited',
  Rush: 'rush',
  SameDay: 'same_day',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const ServiceMethod = {
  Personal: 'personal',
  SubstitutedResidence: 'substituted_residence',
  Corporate: 'corporate',
  Mail: 'mail',
} as const;
export type ServiceMethod = (typeof ServiceMethod)[keyof typeof ServiceMethod];

/** Attempt outcomes (Blueprint §4.2). */
export const AttemptOutcome = {
  ServedPersonal: 'served_personal',
  ServedSubstituted: 'served_substituted',
  ServedCorporate: 'served_corporate',
  NoAnswer: 'no_answer',
  Refused: 'refused',
  Moved: 'moved',
  BadAddress: 'bad_address',
  Evading: 'evading',
  Vacant: 'vacant',
  Deceased: 'deceased',
  Other: 'other',
} as const;
export type AttemptOutcome = (typeof AttemptOutcome)[keyof typeof AttemptOutcome];

export const SUCCESSFUL_OUTCOMES: ReadonlySet<AttemptOutcome> = new Set([
  AttemptOutcome.ServedPersonal,
  AttemptOutcome.ServedSubstituted,
  AttemptOutcome.ServedCorporate,
]);

export const RecipientKind = {
  Individual: 'individual',
  Corporation: 'corporation',
  Government: 'government',
} as const;
export type RecipientKind = (typeof RecipientKind)[keyof typeof RecipientKind];

export const RoleInMatter = {
  Defendant: 'defendant',
  Respondent: 'respondent',
  Witness: 'witness',
  ThirdParty: 'third_party',
  Other: 'other',
} as const;
export type RoleInMatter = (typeof RoleInMatter)[keyof typeof RoleInMatter];

export const AddressKind = {
  Home: 'home',
  Work: 'work',
  RegisteredOffice: 'registered_office',
  Other: 'other',
} as const;
export type AddressKind = (typeof AddressKind)[keyof typeof AddressKind];

export const DocumentType = {
  StatementOfClaim: 'statement_of_claim',
  NoticeOfAction: 'notice_of_action',
  Notice: 'notice',
  Motion: 'motion',
  Subpoena: 'subpoena',
  Application: 'application',
  Other: 'other',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const CourtType = {
  Superior: 'superior',
  SmallClaims: 'small_claims',
  Family: 'family',
  Tribunal: 'tribunal',
} as const;
export type CourtType = (typeof CourtType)[keyof typeof CourtType];

/* ───────────────────────── Matters ───────────────────────── */

export interface Matter {
  readonly id: MatterId;
  readonly clientOrgId: OrgId;
  /** Court-assigned file number, e.g. "CV-26-00081245-0000". Null until issued. */
  readonly courtFileNo: string | null;
  /** e.g. "Smith v. Jones" */
  readonly styleOfCause: string;
  readonly courtName: string;
  readonly courtType: CourtType;
  readonly jurisdictionCode: string; // e.g. "CA-ON"
  /** The firm's own matter number. */
  readonly clientReference: string | null;
  readonly createdBy: UserId;
  readonly createdAt: IsoDateTime;
}

export interface CreateMatterInput {
  courtFileNo?: string;
  styleOfCause: string;
  courtName: string;
  courtType: CourtType;
  jurisdictionCode: string;
  clientReference?: string;
}

/* ───────────────────────── Recipients ─────────────────────────
 * Recipient data is third-party PII. The API returns it decrypted only to the
 * owning client org; servers see `coarseLocation` until they accept a job.
 */

export interface PersonDescription {
  readonly sex?: 'M' | 'F' | 'X';
  readonly approxAge?: number;
  readonly heightCm?: number;
  readonly hair?: string;
  readonly notes?: string;
}

export interface ServiceAddress {
  readonly id: AddressId;
  readonly kind: AddressKind;
  /** Single-line formatted address as validated by the geocoder. */
  readonly formatted: string;
  readonly location: GeoPoint;
  /** 0–1. Below ~0.8 the UI should ask the client to confirm the address. */
  readonly geocodeConfidence: number | null;
  /** Order in which the server should try addresses. 1 = first. */
  readonly sequence: number;
}

export interface Recipient {
  readonly id: RecipientId;
  readonly jobId: JobId;
  readonly kind: RecipientKind;
  readonly name: string;
  readonly description: PersonDescription | null;
  readonly dateOfBirth: IsoDate | null;
  readonly roleInMatter: RoleInMatter;
  readonly addresses: readonly ServiceAddress[];
}

export interface ServiceAddressInput {
  kind: AddressKind;
  /** Free-text address; the API geocodes and validates it. */
  address: string;
  sequence?: number;
}

export interface AddRecipientInput {
  kind: RecipientKind;
  name: string;
  description?: PersonDescription;
  dateOfBirth?: IsoDate;
  roleInMatter: RoleInMatter;
  addresses: readonly ServiceAddressInput[]; // at least one
}

/* ───────────────────────── Documents ───────────────────────── */

export interface JobDocument {
  readonly id: Uuid;
  readonly fileId: FileId;
  readonly docType: DocumentType;
  readonly fileName: string;
  readonly pageCount: number | null;
  readonly requiresPrint: boolean;
  readonly sha256: Sha256Hex;
}

export interface UploadUrlRequest {
  fileName: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  sha256: Sha256Hex;
}

export interface UploadUrlResponse {
  readonly fileId: FileId;
  /** Short-lived signed URL. PUT the raw bytes here; do not send the API bearer token. */
  readonly uploadUrl: string;
  /** Headers the storage provider requires on the PUT (e.g. Content-Type, checksum). */
  readonly requiredHeaders: Readonly<Record<string, string>>;
  readonly expiresAt: IsoDateTime;
}

export interface RegisterDocumentInput {
  fileId: FileId;
  docType: DocumentType;
  requiresPrint?: boolean;
  /** Page count read in the browser, used for the live quote. The server re-counts and its number wins. */
  pageCount?: number;
}

/** Progress stages reported by `uploadDocument`. */
export type UploadStage = 'requesting' | 'uploading' | 'registering';

/* ───────────────────────── Address validation ─────────────────────────
 * POST /addresses:validate — a pre-check so clerks fix addresses before
 * submitting. The Google key stays in the NestJS API. The API re-geocodes
 * authoritatively when the recipient is saved.
 */

export type GeocodePrecision = 'rooftop' | 'interpolated' | 'street' | 'approximate';

export type AddressValidation =
  | {
      readonly ok: true;
      readonly formatted: string;
      readonly location: GeoPoint;
      /** ISO 3166-2 subdivision without country, e.g. "ON", "QC". */
      readonly province: string;
      readonly postalCode: string | null;
      /** 0–1, derived from geocoder precision and partial-match flags. */
      readonly confidence: number;
      readonly precision: GeocodePrecision;
      readonly hasUnit: boolean;
      readonly nearestPool: { readonly name: string; readonly km: number };
    }
  | { readonly ok: false; readonly reason: string };

/* ───────────────────────── Payment options ───────────────────────── */

export interface PaymentOption {
  /** `invoice`, or a Stripe PaymentMethod id. */
  readonly id: string;
  readonly kind: 'invoice' | 'card';
  readonly label: string; // "Visa •••• 4242"
  readonly detail: string; // "Firm card · exp 08/28"
}

/* ───────────────────────── Attempts ───────────────────────── */

export interface EvidenceItem {
  readonly id: Uuid;
  readonly kind: 'photo' | 'audio' | 'signature' | 'screenshot';
  readonly capturedAt: IsoDateTime;
  readonly sha256: Sha256Hex;
  /** Signed, short-lived URL. Fetch again when expired rather than caching it. */
  readonly url: string;
}

export type AttemptFlag =
  | 'distance_exceeded'
  | 'mock_location'
  | 'integrity_failed'
  | 'impossible_travel'
  | 'clock_drift';

export interface Attempt {
  readonly id: AttemptId;
  readonly jobId: JobId;
  readonly addressId: AddressId;
  /** Device time at the door. */
  readonly attemptedAt: IsoDateTime;
  /** Server receipt time. A large gap from attemptedAt means an offline sync. */
  readonly receivedAt: IsoDateTime;
  readonly outcome: AttemptOutcome;
  readonly distanceFromAddressM: number | null;
  readonly personServedName: string | null;
  readonly personServedRelationship: string | null;
  readonly personDescription: PersonDescription | null;
  readonly notes: string | null;
  readonly flags: readonly AttemptFlag[];
  readonly evidence: readonly EvidenceItem[];
}

/* ───────────────────────── Quotes ───────────────────────── */

export interface QuoteLineItem {
  readonly code: 'base' | 'distance' | 'extra_attempts' | 'printing' | 'addon';
  readonly label: string;
  readonly amountCents: Cents;
}

export interface Quote {
  readonly id: QuoteId;
  readonly jobId: JobId;
  readonly lineItems: readonly QuoteLineItem[];
  readonly subtotalCents: Cents;
  readonly taxCents: Cents; // HST in Ontario
  readonly totalCents: Cents;
  readonly currency: CurrencyCode;
  readonly expiresAt: IsoDateTime;
}

/* ───────────────────────── Jobs ───────────────────────── */

export interface ServerSummary {
  readonly id: UserId;
  readonly displayName: string; // e.g. "R. Okafor"
  readonly ratingAvg: number | null;
}

/** Row shape for GET /jobs lists. */
export interface JobSummary {
  readonly id: JobId;
  readonly publicRef: string; // e.g. "SN-2026-004213"
  readonly matterId: MatterId;
  readonly status: JobStatus;
  readonly priority: Priority;
  readonly serviceMethodRequested: ServiceMethod;
  readonly dueBy: IsoDateTime;
  readonly maxAttempts: number;
  readonly attemptCount: number;
  readonly primaryRecipientName: string | null;
  readonly assignedServer: ServerSummary | null;
  readonly updatedAt: IsoDateTime;
}

/** Full shape for GET /jobs/{id}. */
export interface Job extends JobSummary {
  readonly clientOrgId: OrgId;
  readonly createdBy: UserId;
  readonly specialInstructions: string | null;
  readonly assignedAt: IsoDateTime | null;
  readonly quote: Quote | null;
  readonly recipients: readonly Recipient[];
  readonly documents: readonly JobDocument[];
  readonly attempts: readonly Attempt[];
  /** Optimistic-lock token. Send it back on PATCH; a stale value returns 409. */
  readonly version: number;
  readonly createdAt: IsoDateTime;
}

export interface CreateJobInput {
  matterId: MatterId;
  priority: Priority;
  serviceMethodRequested: ServiceMethod;
  dueBy: IsoDateTime;
  maxAttempts?: number; // server default: 3
  specialInstructions?: string;
}

export interface SubmitJobInput {
  quoteId: QuoteId;
  /** Omit when the org is on invoice terms; otherwise a Stripe PaymentMethod id. */
  paymentMethodId?: string;
}

/** POST /jobs/{id}/submit:confirm — after the 3-D Secure challenge completes in Stripe.js. */
export interface ConfirmSubmitInput {
  quoteId: QuoteId;
}

/** PATCH /jobs/{id}. `version` is the optimistic-lock token from the last read. */
export interface UpdateJobInput {
  version: number;
  matterId?: MatterId;
  priority?: Priority;
  serviceMethodRequested?: ServiceMethod;
  dueBy?: IsoDateTime;
  maxAttempts?: number;
  specialInstructions?: string | null;
}

/**
 * Submitting authorizes payment. Card authorization can need a 3-D Secure
 * step, so the client must handle `requires_action` before the job goes live.
 */
export type SubmitJobResponse =
  | { readonly outcome: 'authorized'; readonly job: Job }
  | { readonly outcome: 'invoiced'; readonly job: Job }
  | {
      readonly outcome: 'requires_action';
      readonly job: Job;
      /**
       * Pass to Stripe.js `handleNextAction`, then call `confirmSubmit`.
       * Do NOT retry submitJob with the same key: the server replays the cached
       * `requires_action` response for that key.
       */
      readonly paymentClientSecret: string;
    };

/* ───────────────────────── Pagination ───────────────────────── */

export interface Page<T> {
  readonly items: readonly T[];
  /** Null when there are no more results. */
  readonly nextCursor: string | null;
}

export interface ListJobsParams {
  status?: JobStatus | readonly JobStatus[];
  matterId?: MatterId;
  cursor?: string;
  limit?: number;
}
