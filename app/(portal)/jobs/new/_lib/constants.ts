/**
 * Static reference data for the intake wizard.
 *
 * Rule citations, form numbers and file-number formats are drafted from general
 * knowledge of Ontario practice. Have an Ontario litigation lawyer verify them
 * before launch (Blueprint §7), and move them into jurisdiction_rules when the API serves it.
 */
import type { CourtType, DocumentType, Priority, RecipientKind, ServiceMethod } from '@/types/jobs';

export interface CourtInfo {
  readonly label: string;
  readonly fileNumberPattern: RegExp;
  readonly fileNumberExample: string;
  readonly affidavitForm: string;
}

export const COURTS: Readonly<Record<Exclude<CourtType, 'tribunal'>, CourtInfo>> = {
  superior: {
    label: 'Superior Court of Justice',
    fileNumberPattern: /^CV-\d{2}-\d{8}-0000$/,
    fileNumberExample: 'CV-26-00081245-0000',
    affidavitForm: 'Form 16B',
  },
  small_claims: {
    label: 'Small Claims Court',
    fileNumberPattern: /^SC-\d{2}-\d{8}$/,
    fileNumberExample: 'SC-26-00004417',
    affidavitForm: 'Form 8A',
  },
  family: {
    label: 'Family Court (SCJ)',
    fileNumberPattern: /^FC-\d{2}-\d{3,6}$/,
    fileNumberExample: 'FC-26-1893',
    affidavitForm: 'Form 6B',
  },
};
export type SupportedCourt = keyof typeof COURTS;

export function courtInfo(type: CourtType): CourtInfo | null {
  return type === 'tribunal' ? null : COURTS[type];
}

export const COURT_SITES = [
  'Ottawa — 161 Elgin St.',
  'Toronto — 330 University Ave.',
  'Brampton — 7755 Hurontario St.',
  'Hamilton — 45 Main St. E.',
] as const;
export type CourtSite = (typeof COURT_SITES)[number];

export const DOC_TYPE_LABELS: Readonly<Record<DocumentType, string>> = {
  statement_of_claim: 'Statement of Claim',
  notice_of_action: 'Notice of Action',
  notice: 'Notice',
  motion: 'Notice of Motion',
  application: 'Application',
  subpoena: 'Summons to Witness',
  other: 'Other',
};

export function guessDocType(fileName: string): DocumentType {
  if (/claim/i.test(fileName)) return 'statement_of_claim';
  if (/notice/i.test(fileName)) return 'notice_of_action';
  if (/motion/i.test(fileName)) return 'motion';
  if (/application/i.test(fileName)) return 'application';
  if (/summons|subpoena/i.test(fileName)) return 'subpoena';
  return 'other';
}

export interface PriorityInfo {
  readonly label: string;
  /** Business days from today; 0 = today. */
  readonly businessDays: number;
  /** Indicative base fee for the card. The server quote is authoritative. */
  readonly fromCents: number;
  readonly dispatch: 'Marketplace pool' | 'Live cascade offer';
  readonly blurb: string;
}

export const PRIORITIES: Readonly<Record<Priority, PriorityInfo>> = {
  standard: { label: 'Standard', businessDays: 7, fromCents: 7500, dispatch: 'Marketplace pool', blurb: 'Up to 3 attempts at varied times over 7 business days' },
  expedited: { label: 'Expedited', businessDays: 3, fromCents: 11000, dispatch: 'Marketplace pool', blurb: 'First attempt within 48 h' },
  rush: { label: 'Rush', businessDays: 1, fromCents: 16500, dispatch: 'Live cascade offer', blurb: 'First attempt within 24 h; live server matching' },
  same_day: { label: 'Same-day', businessDays: 0, fromCents: 22000, dispatch: 'Live cascade offer', blurb: 'First attempt today by 8:00 p.m.' },
};
export const PRIORITY_ORDER: readonly Priority[] = ['standard', 'expedited', 'rush', 'same_day'];

/** Recipient kinds the intake form supports today. */
export type IntakeRecipientKind = Extract<RecipientKind, 'individual' | 'corporation'>;

export interface MethodInfo {
  readonly id: ServiceMethod;
  readonly label: string;
  readonly rule: string;
  readonly note: string;
}

export const METHODS_BY_KIND: Readonly<Record<IntakeRecipientKind, readonly MethodInfo[]>> = {
  individual: [
    { id: 'personal', label: 'Personal service', rule: 'r. 16.02(1)(a)', note: 'Documents handed to the person named.' },
    {
      id: 'substituted_residence',
      label: 'Alternative: at residence',
      rule: 'r. 16.03(5)',
      note: 'Left with an apparently adult household member, plus a copy mailed the same or next day.',
    },
  ],
  corporation: [
    {
      id: 'corporate',
      label: 'Corporate service',
      rule: 'r. 16.02(1)(c)',
      note: 'Officer, director or agent, or a person apparently in control or management at a place of business.',
    },
  ],
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const INCLUDED_ATTEMPTS = 3;
export const SAME_DAY_CUTOFF_HOUR = 13;
