/** Client-side form state for the intake wizard. Wire types live in @/types/jobs. */
import type {
  AddressKind,
  AddressValidation,
  DocumentType,
  Matter,
  Priority,
  RoleInMatter,
  ServiceMethod,
} from '@/types/jobs';
import type { CourtSite, IntakeRecipientKind, SupportedCourt } from './constants';
import { COURT_SITES } from './constants';

export type StepIndex = 0 | 1 | 2 | 3;
export const STEP_COUNT = 4;

export type FieldErrors = Partial<Record<string, string>>;

/* ── Step 1 ── */
export interface NewMatterDraft {
  court: SupportedCourt;
  site: CourtSite;
  styleOfCause: string;
  courtFileNo: string;
  clientReference: string;
}

export type MatterDraft =
  | { mode: 'existing'; selected: Matter | null }
  | { mode: 'new'; fields: NewMatterDraft; created: Matter | null };

export const emptyNewMatter = (): NewMatterDraft => ({
  court: 'superior',
  site: COURT_SITES[0],
  styleOfCause: '',
  courtFileNo: '',
  clientReference: '',
});

/* ── Step 2 ── */
export type UploadStatus =
  | { stage: 'reading' | 'hashing' | 'requesting' | 'uploading' | 'registering'; progress: number }
  | { stage: 'registered' }
  | { stage: 'rejected'; error: string };

export interface DocUpload {
  key: string;
  name: string;
  size: number;
  docType: DocumentType;
  sha256: string | null;
  pages: number | null;
  status: UploadStatus;
  /** Server document id once registered; used to remove it from the draft. */
  serverId?: string;
}

export const isUploadSettled = (d: DocUpload) => d.status.stage === 'registered' || d.status.stage === 'rejected';

/* ── Step 3 ── */
export interface AddressDraft {
  key: string;
  kind: AddressKind;
  raw: string;
  checking: boolean;
  result: AddressValidation | null;
}

export interface PersonDescriptionDraft {
  sex: '' | 'M' | 'F' | 'X';
  approxAge: string;
  heightCm: string;
  hair: string;
  dateOfBirth: string;
  notes: string;
}

export interface RecipientDraft {
  kind: IntakeRecipientKind;
  role: RoleInMatter;
  name: string;
  description: PersonDescriptionDraft;
  addresses: AddressDraft[];
  method: ServiceMethod;
  instructions: string;
}

export const emptyAddress = (): AddressDraft => ({
  key: crypto.randomUUID(),
  kind: 'home',
  raw: '',
  checking: false,
  result: null,
});

export const emptyRecipient = (): RecipientDraft => ({
  kind: 'individual',
  role: 'defendant',
  name: '',
  description: { sex: '', approxAge: '', heightCm: '', hair: '', dateOfBirth: '', notes: '' },
  addresses: [emptyAddress()],
  method: 'personal',
  instructions: '',
});

/** Addresses the clerk validated and that ServeNow can serve (Ontario only for MVP). */
export function serviceableAddresses(r: RecipientDraft) {
  return r.addresses.flatMap((a) =>
    a.result?.ok && a.result.province === 'ON' ? [{ draft: a, result: a.result }] : [],
  );
}

/* ── Step 4 ── */
export interface CheckoutDraft {
  priority: Priority;
  maxAttempts: number;
  paymentOptionId: string;
}
