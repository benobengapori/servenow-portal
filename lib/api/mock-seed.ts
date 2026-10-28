/**
 * Demo records for the mock API: ten jobs across the lifecycle, with addresses, GPS-stamped
 * attempts and affidavits. All people, firms and commissioners are fictional; street addresses
 * are only there to put pins on a real map. Dates are relative to today so the demo stays current.
 */
import { signaturePath } from '@/lib/demo/signature';
import type {
  AddressId,
  Affidavit,
  AffidavitParagraph,
  Attempt,
  AttemptId,
  AttemptOutcome,
  GeoPoint,
  Job,
  JobId,
  JobStatus,
  Matter,
  OrgId,
  Priority,
  RecipientId,
  ServiceMethod,
  UserId,
} from '@/types/jobs';

interface SeedAttempt {
  daysAgo: number;
  at: string; // "18:42"
  outcome: AttemptOutcome;
  distanceM: number;
  note: string;
  personServed?: { name: string; relationship: string };
}

interface SeedJob {
  matter: number;
  recipient: string;
  kind: 'individual' | 'corporation';
  status: JobStatus;
  priority: Priority;
  method: ServiceMethod;
  dueInDays: number;
  max: number;
  server: string | null;
  address: string;
  location: GeoPoint;
  documents: string;
  attempts: SeedAttempt[];
  instructions?: string;
}

export const SEED_JOBS: SeedJob[] = [
  {
    matter: 0, recipient: 'Martin Delacroix', kind: 'individual', status: 'in_progress', priority: 'standard', method: 'personal',
    dueInDays: 4, max: 3, server: 'Rahel Okafor', address: '118 Fifth Ave, Ottawa, ON K1S 2M8', location: { lat: 45.40341, lng: -75.68912 },
    documents: 'Statement of Claim and Notice of Action',
    attempts: [
      { daysAgo: 3, at: '08:12', outcome: 'no_answer', distanceM: 9, note: 'No answer. Lights off, no vehicle in driveway.' },
      { daysAgo: 1, at: '19:12', outcome: 'no_answer', distanceM: 12, note: 'No answer. Neighbour says he works late most weekdays.' },
    ],
  },
  {
    matter: 0, recipient: 'Delacroix Renovations Inc.', kind: 'corporation', status: 'served', priority: 'standard', method: 'corporate',
    dueInDays: 4, max: 3, server: 'Rahel Okafor', address: '2450 Lancaster Rd, Ottawa, ON K1B 5N3', location: { lat: 45.39485, lng: -75.61824 },
    documents: 'Statement of Claim and Notice of Action',
    attempts: [
      { daysAgo: 2, at: '11:40', outcome: 'served_corporate', distanceM: 7, note: 'Served the office manager at reception.', personServed: { name: 'Lise Charbonneau', relationship: 'office manager, apparently in control of the business' } },
    ],
  },
  {
    matter: 1, recipient: 'Amélie Pellerin', kind: 'individual', status: 'affidavit_pending', priority: 'rush', method: 'substituted_residence',
    dueInDays: 1, max: 3, server: 'Denis Tremblay', address: '33 Rideau Terrace, Ottawa, ON K1M 2A1', location: { lat: 45.44102, lng: -75.67468 },
    documents: 'Plaintiff’s Claim (Form 7A)',
    attempts: [
      { daysAgo: 3, at: '17:55', outcome: 'no_answer', distanceM: 11, note: 'No answer.' },
      { daysAgo: 2, at: '07:30', outcome: 'no_answer', distanceM: 8, note: 'No answer. Car in driveway.' },
      { daysAgo: 1, at: '18:20', outcome: 'served_substituted', distanceM: 6, note: 'Left with adult household member; copy mailed the next morning.', personServed: { name: 'Julien Pellerin', relationship: 'spouse, an apparently adult member of the same household' } },
    ],
  },
  {
    matter: 3, recipient: 'Kevin Walcott', kind: 'individual', status: 'non_served', priority: 'expedited', method: 'personal',
    dueInDays: 2, max: 4, server: 'Sophie Nguyen', address: '765 Montreal Rd, Ottawa, ON K1K 0S9', location: { lat: 45.44281, lng: -75.63702 },
    documents: 'Application (Form 8) and Financial Statement (Form 13)',
    attempts: [
      { daysAgo: 6, at: '18:05', outcome: 'no_answer', distanceM: 14, note: 'No answer.' },
      { daysAgo: 5, at: '07:45', outcome: 'no_answer', distanceM: 10, note: 'No answer. Mail piling up at the door.' },
      { daysAgo: 4, at: '20:10', outcome: 'no_answer', distanceM: 9, note: 'No answer.' },
      { daysAgo: 3, at: '12:30', outcome: 'moved', distanceM: 13, note: 'Building superintendent says he moved out about three weeks ago; no forwarding address.' },
    ],
  },
  {
    matter: 4, recipient: 'Brandt Holdings Corp.', kind: 'corporation', status: 'assigned', priority: 'standard', method: 'corporate',
    dueInDays: 8, max: 3, server: 'Layla Haddad', address: '100 King St W, Toronto, ON M5X 1A9', location: { lat: 43.64873, lng: -79.38174 }, documents: 'Statement of Claim', attempts: [],
  },
  {
    matter: 2, recipient: 'Mapleview Condo Corp. No. 612', kind: 'corporation', status: 'open', priority: 'standard', method: 'corporate',
    dueInDays: 9, max: 3, server: null, address: '250 Lett St, Ottawa, ON K1R 0A8', location: { lat: 45.41412, lng: -75.71883 }, documents: 'Statement of Claim', attempts: [],
  },
  {
    matter: 1, recipient: 'Gábor Szabo', kind: 'individual', status: 'offered', priority: 'same_day', method: 'personal',
    dueInDays: 0, max: 2, server: null, address: '330 Kent St, Ottawa, ON K2P 2A4', location: { lat: 45.41291, lng: -75.70061 }, documents: 'Plaintiff’s Claim (Form 7A)', attempts: [],
  },
  {
    matter: 1, recipient: 'Petra Achterberg', kind: 'individual', status: 'disputed', priority: 'standard', method: 'personal',
    dueInDays: -3, max: 3, server: 'Marc Jean-Baptiste', address: '18 Clarey Ave, Ottawa, ON K1S 2R6', location: { lat: 45.39952, lng: -75.68553 }, documents: 'Plaintiff’s Claim (Form 7A)',
    attempts: [
      { daysAgo: 8, at: '18:50', outcome: 'served_personal', distanceM: 410, note: 'Served personally on the sidewalk near the corner.', personServed: { name: 'Petra Achterberg', relationship: 'the person named' } },
    ],
  },
  {
    matter: 2, recipient: 'Fairway Insurance Co.', kind: 'corporation', status: 'authorized', priority: 'expedited', method: 'corporate',
    dueInDays: 3, max: 3, server: null, address: '50 O’Connor St, Ottawa, ON K1P 6L2', location: { lat: 45.42283, lng: -75.69691 }, documents: 'Statement of Claim', attempts: [],
  },
  {
    matter: 5, recipient: 'Tunde Idowu', kind: 'individual', status: 'affidavit_signed', priority: 'standard', method: 'personal',
    dueInDays: -2, max: 3, server: 'Sophie Nguyen', address: '41 Chapel St, Ottawa, ON K1N 7Y8', location: { lat: 45.42906, lng: -75.68578 },
    documents: 'Application (Form 8) and Financial Statement (Form 13)',
    attempts: [
      { daysAgo: 5, at: '17:40', outcome: 'no_answer', distanceM: 8, note: 'No answer.' },
      { daysAgo: 4, at: '18:42', outcome: 'served_personal', distanceM: 6, note: 'Served personally at the front door. Confirmed his name when asked.', personServed: { name: 'Tunde Idowu', relationship: 'the person named' } },
    ],
  },
];

export const SEED_MATTER_ROWS: [string, string, string, Matter['courtType']][] = [
  ['LIT-24-0917', 'CV-26-00081245-0000', 'Harrow Credit Union v. Delacroix', 'superior'],
  ['COL-26-1142', 'SC-26-00004417', 'Northgate Supply Ltd. v. Pellerin', 'small_claims'],
  ['LIT-26-0214', 'CV-26-00083377-0000', 'Ostrander v. Mapleview Condo Corp. No. 612', 'superior'],
  ['FAM-26-0388', 'FC-26-1893', 'Walcott v. Walcott', 'family'],
  ['LIT-25-0102', 'CV-26-00079902-0000', 'Kestrel Logistics v. Brandt Holdings', 'superior'],
  ['FAM-26-0371', 'FC-26-1811', 'Moreau v. Idowu', 'family'],
];

const AFFIDAVIT_FORM: Record<Matter['courtType'], string> = { superior: 'Form 16B', small_claims: 'Form 8A', family: 'Form 6B', tribunal: 'Affidavit' };
const COURT_NAME: Record<Matter['courtType'], string> = {
  superior: 'ONTARIO SUPERIOR COURT OF JUSTICE',
  small_claims: 'ONTARIO SUPERIOR COURT OF JUSTICE · SMALL CLAIMS COURT',
  family: 'ONTARIO SUPERIOR COURT OF JUSTICE · FAMILY COURT',
  tribunal: 'ONTARIO',
};

function at(daysAgo: number, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h ?? 12, m ?? 0, 0, 0);
  return d;
}

const initials = (name: string) => {
  const parts = name.split(' ');
  return `${parts[0]![0]}. ${parts.slice(1).join(' ')}`;
};

export function seedJobs(matters: readonly Matter[], org: OrgId, me: UserId): Job[] {
  const today = new Date();
  return SEED_JOBS.map((s, i) => {
    const id = `job_seed${i}` as JobId;
    const due = new Date(today);
    due.setDate(due.getDate() + s.dueInDays);
    due.setHours(17, 0, 0, 0);
    const addressId = `adr_seed${i}` as AddressId;
    const attempts: Attempt[] = s.attempts.map((a, n) => {
      const when = at(a.daysAgo, a.at);
      return {
        id: `att_seed${i}_${n}` as AttemptId,
        jobId: id,
        addressId,
        attemptedAt: when.toISOString(),
        receivedAt: new Date(when.getTime() + 40_000).toISOString(),
        outcome: a.outcome,
        distanceFromAddressM: a.distanceM,
        personServedName: a.personServed?.name ?? null,
        personServedRelationship: a.personServed?.relationship ?? null,
        personDescription: null,
        notes: a.note,
        flags: a.distanceM > 150 ? ['distance_exceeded'] : [],
        evidence: [],
      };
    });
    const created = at((s.attempts[0]?.daysAgo ?? 1) + 1, '10:14');
    return {
      id,
      publicRef: `SN-2026-00${4189 + i * 7}`,
      matterId: matters[s.matter]!.id,
      status: s.status,
      priority: s.priority,
      serviceMethodRequested: s.method,
      dueBy: due.toISOString(),
      maxAttempts: s.max,
      attemptCount: attempts.length,
      primaryRecipientName: s.recipient,
      assignedServer: s.server ? { id: `usr_srv${i}` as UserId, displayName: initials(s.server), ratingAvg: 4.8 } : null,
      updatedAt: new Date(today.getTime() - i * 3_600_000).toISOString(),
      clientOrgId: org,
      createdBy: me,
      specialInstructions: s.instructions ?? null,
      assignedAt: s.server ? new Date(created.getTime() + 3 * 3_600_000).toISOString() : null,
      quote: null,
      recipients: [
        {
          id: `rcp_seed${i}` as RecipientId,
          jobId: id,
          kind: s.kind,
          name: s.recipient,
          description: null,
          dateOfBirth: null,
          roleInMatter: 'defendant',
          addresses: [{ id: addressId, kind: s.kind === 'corporation' ? 'work' : 'home', formatted: s.address, location: s.location, geocodeConfidence: 0.97, sequence: 1 }],
        },
      ],
      documents: [],
      attempts,
      version: 1,
      createdAt: created.toISOString(),
    } satisfies Job;
  });
}

/** Full names of the servers behind the seeded jobs (the summary only carries "R. Okafor"). */
export function seedServerFullName(jobId: JobId): string | null {
  const i = Number(String(jobId).replace('job_seed', ''));
  return Number.isInteger(i) ? (SEED_JOBS[i]?.server ?? null) : null;
}

const fmtDate = (d: Date) => d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const fmtTime = (d: Date) => d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });

const COMMISSIONER_NAME = 'Adaeze N. Morgan';

/** Draft the affidavit the way the API would from the job record. Null when there's nothing to swear to yet. */
export function buildAffidavit(job: Job, matter: Matter, serverFullName: string): Affidavit | null {
  const recipient = job.recipients[0];
  const address = recipient?.addresses[0]?.formatted ?? '';
  const seed = SEED_JOBS[Number(String(job.id).replace('job_seed', ''))];
  const docs = seed?.documents ?? 'the documents listed in the job';
  const served = [...job.attempts].reverse().find((a) => a.outcome.startsWith('served_'));
  const failedAttempts = job.attempts.filter((a) => !a.outcome.startsWith('served_'));

  const statusMap: Partial<Record<JobStatus, Affidavit['status']>> = {
    served: 'awaiting_deponent',
    affidavit_pending: 'awaiting_commissioner',
    non_served: 'awaiting_commissioner',
    affidavit_signed: 'commissioned',
    completed: 'commissioned',
    disputed: 'commissioned',
  };
  const status = statusMap[job.status];
  if (!status || !recipient) return null;

  const [plaintiff = matter.styleOfCause, defendant = ''] = matter.styleOfCause.split(/\s+v\.\s+/);
  const p: string[] = [
    `I am a process server retained through ServeNow by Harrow & Lindqvist LLP, the lawyers for the ${matter.courtType === 'family' ? 'applicant' : 'plaintiff'}, and as such I have personal knowledge of the matters set out below.`,
  ];

  let kind: Affidavit['kind'] = 'service';
  if (served) {
    const when = new Date(served.attemptedAt);
    const whenText = `On ${fmtDate(when)}, at ${fmtTime(when)}`;
    if (served.outcome === 'served_personal') {
      p.push(`${whenText}, I served ${recipient.name} with the ${docs} by leaving a copy with them personally at ${address}.`);
      p.push(`I was able to identify the person as ${recipient.name} because they confirmed their name when asked and matched the description and photograph provided by the client.`);
    } else if (served.outcome === 'served_corporate') {
      p.push(`${whenText}, I served ${recipient.name} with the ${docs} by leaving a copy with ${served.personServedName}, the ${served.personServedRelationship}, at ${address}.`);
      p.push(`${served.personServedName} confirmed their name and position when asked.`);
    } else {
      const next = new Date(when);
      next.setDate(next.getDate() + 1);
      p.push(
        `${whenText}, I served ${recipient.name} with the ${docs} by leaving a copy, in a sealed envelope addressed to ${recipient.name}, with ${served.personServedName}, ${served.personServedRelationship}, at ${address}.`,
      );
      p.push(`On ${fmtDate(next)}, I mailed another copy of the documents to ${recipient.name} at the same address.`);
    }
  } else {
    kind = 'attempted_service';
    p.push(`I attempted to serve ${recipient.name} with the ${docs} at ${address} on ${job.attempts.length} occasions, at different times of day and on different days, as set out below.`);
  }

  if (failedAttempts.length) {
    p.push(
      `${kind === 'service' ? 'Before service, I attempted' : 'My attempts were'}: ${failedAttempts
        .map((a) => `${fmtDate(new Date(a.attemptedAt))} at ${fmtTime(new Date(a.attemptedAt))} (${a.notes?.replace(/\.$/, '').toLowerCase()})`)
        .join('; ')}.`,
    );
  }
  if (kind === 'attempted_service') {
    p.push(`I have been unable to serve ${recipient.name} at this address, and I make this affidavit in support of a motion for substituted service or to dispense with service.`);
  }
  p.push(`Each attempt was recorded with a time-stamped, GPS-tagged photograph. Copies are attached as Exhibit “A”.`);

  const paragraphs: AffidavitParagraph[] = p.map((text, n) => ({ n: n + 1, text }));
  const lastAttempt = job.attempts[job.attempts.length - 1];
  const deponentAt = lastAttempt ? new Date(new Date(lastAttempt.attemptedAt).getTime() + 2 * 3_600_000) : new Date();
  const commissionedAt = new Date(deponentAt.getTime() + 20 * 3_600_000);
  commissionedAt.setHours(10, 15, 0, 0);

  return {
    jobId: job.id,
    kind,
    status,
    form: AFFIDAVIT_FORM[matter.courtType],
    courtName: COURT_NAME[matter.courtType],
    courtFileNo: matter.courtFileNo,
    plaintiff,
    defendant,
    deponentName: serverFullName,
    deponentOf: 'of the City of Ottawa, in the Province of Ontario',
    paragraphs,
    deponent:
      status === 'awaiting_deponent'
        ? null
        : { name: serverFullName, signedAt: deponentAt.toISOString(), signaturePath: signaturePath(serverFullName) },
    commissioner:
      status === 'commissioned'
        ? {
            name: COMMISSIONER_NAME,
            title: 'Commissioner for Taking Affidavits',
            licence: 'LSO #00000D (demo)',
            method: 'video_conference',
            location: 'City of Ottawa',
            signedAt: commissionedAt.toISOString(),
            signaturePath: signaturePath(COMMISSIONER_NAME),
          }
        : null,
    pdfSha256: status === 'commissioned' ? '9f2c41a7d3e85b06c1f4a92e7b3d5c08e6a1f47b2c9d03e5a8b6f1c4d7e92a30' : null,
  };
}
