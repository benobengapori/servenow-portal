/**
 * ServeNow's built-in guide: the answers the demo assistant gives, and the grounding material the
 * production assistant is given (see servenow-api/src/assistant/system-prompt.ts).
 *
 * General information about Ontario procedure, not legal advice. Citations were checked against
 * public sources in October 2026; have counsel review before launch and re-check when rules change.
 */
import type { AssistantAction, AssistantSource } from '@/types/jobs';

export const SRC = {
  rcp: (rule: string): AssistantSource => ({ label: `Rules of Civil Procedure, r. ${rule}`, url: 'https://www.ontario.ca/laws/regulation/900194' }),
  smallClaims: (rule: string): AssistantSource => ({ label: `Small Claims Court Rules, r. ${rule}`, url: 'https://www.ontario.ca/laws/regulation/980258' }),
  smallClaimsGuide: { label: 'Ontario guide: serving documents in Small Claims Court', url: 'https://www.ontario.ca/document/guide-procedures-small-claims-court/serving-documents' } as AssistantSource,
  family: (rule: string): AssistantSource => ({ label: `Family Law Rules, r. ${rule}`, url: 'https://www.ontario.ca/laws/regulation/990114' }),
  remote: { label: 'O. Reg. 431/20, Administering Oath or Declaration Remotely', url: 'https://www.ontario.ca/laws/regulation/r20431' } as AssistantSource,
  commissioners: { label: 'Commissioners for Taking Affidavits Act', url: 'https://www.ontario.ca/laws/statute/90c17' } as AssistantSource,
  app: (what: string): AssistantSource => ({ label: `ServeNow: ${what}` }),
};

const A = {
  submit: { label: 'Submit a job', href: '/jobs/new/' },
  jobs: { label: 'Open active jobs', href: '/jobs/' },
} satisfies Record<string, AssistantAction>;

export interface GuideEntry {
  id: string;
  /** Shown as a suggestion chip. */
  title: string;
  topic: 'app' | 'law' | 'why';
  /** Words and phrases that point at this entry. Multi-word phrases score higher. */
  keywords: string[];
  text: string;
  sources: AssistantSource[];
  actions?: AssistantAction[];
  followUps?: string[];
}

export const GUIDE: GuideEntry[] = [
  /* ───────────── How the app works ───────────── */
  {
    id: 'how-it-works',
    title: 'How does ServeNow work?',
    topic: 'app',
    keywords: ['how does', 'how it works', 'what is servenow', 'get started', 'start', 'overview', 'steps', 'process', 'use the app', 'begin'],
    text: `You send the documents, ServeNow gets them served and gives you the proof.

- Submit a job: pick the matter, upload the issued PDFs, enter who to serve and where, and accept the quote.
- The job is offered to vetted process servers near the address. You can watch it on the map.
- Each attempt is logged with the time, a GPS-tagged photo and notes, and shows up on the job right away.
- When service is done, the server signs the affidavit of service and affirms it before a commissioner, often by video. You download the commissioned affidavit with the evidence attached.

Most jobs need nothing from you after you submit.`,
    sources: [SRC.app('how a job runs')],
    actions: [A.submit],
    followUps: ['Why use ServeNow instead of my usual process server?', 'What happens if no server accepts the job?', 'What is an affidavit of service?'],
  },
  {
    id: 'no-server',
    title: 'What if no server accepts the job?',
    topic: 'app',
    keywords: ['no server', 'no one', 'nobody', 'not available', 'no one available', 'widen', 'keep waiting', 'unassigned', 'finding server', 'offered', 'dispatch', 'accept'],
    text: `ServeNow offers the job to available servers closest to the address first (within 5 km), then a wider ring (10 km). Each offer waits a short time for a reply.

If nobody accepts, the map says "No server available right now" and you choose:

- Widen search to 25 km: reaches more servers. A farther server can add a travel charge, and you see the new price before anything is billed.
- Keep waiting: ServeNow keeps offering the job and notifies you when someone accepts.

You're never charged for a job no one picks up.`,
    sources: [SRC.app('dispatch')],
    actions: [A.jobs],
    followUps: ['How is the price calculated?', 'What do the priority levels mean?'],
  },
  {
    id: 'pricing',
    title: 'How is the price calculated?',
    topic: 'app',
    keywords: ['price', 'cost', 'fee', 'fees', 'quote', 'hst', 'tax', 'charge', 'charged', 'invoice', 'how much', 'billing', 'pay', 'payment', 'card', 'hold'],
    text: `The quote is built from a few lines, all shown before you submit:

- Base fee for the priority you pick (Standard, Expedited, Rush or Same-day).
- Travel beyond 25 km from the nearest server pool, per km.
- Printing and binding, per page.
- Extra attempts beyond the three included.
- HST at 13% in Ontario.

On firm invoice terms, nothing is charged at submission; it's added to the monthly invoice. On a card, a hold is placed and captured when the affidavit is delivered. Standard jobs can take longer than a card hold lasts, so they're charged up front and held. Your bank may ask you to verify the card (3-D Secure).`,
    sources: [SRC.app('quotes and payment')],
    followUps: ['Will I be charged twice if I tap submit again?', 'What do the priority levels mean?'],
  },
  {
    id: 'double-charge',
    title: 'Will I be charged twice if I tap submit again?',
    topic: 'app',
    keywords: ['twice', 'double', 'charged twice', 'duplicate', 'tapped twice', 'submit again', 'timed out', 'retry'],
    text: `No. Every submission carries a one-time key. If your connection drops and you tap Submit again, ServeNow recognizes the same submission and returns the original result instead of creating a second job or a second charge.`,
    sources: [SRC.app('payment safety')],
  },
  {
    id: 'priority',
    title: 'What do the priority levels mean?',
    topic: 'app',
    keywords: ['priority', 'priorities', 'rush', 'same day', 'same-day', 'expedited', 'standard', 'urgent', 'fast', 'quickly', 'due date'],
    text: `- Standard: up to 3 attempts at different times over 7 business days.
- Expedited: first attempt within 48 hours.
- Rush: first attempt within 24 hours, with live matching to a server.
- Same-day: first attempt today by 8:00 p.m. Available on business days before 1:00 p.m.

Due dates skip weekends and Ontario statutory holidays. If you're up against a service deadline, pick the priority that leaves room for more than one attempt.`,
    sources: [SRC.app('priorities')],
    actions: [A.submit],
    followUps: ['Is there a deadline to serve a statement of claim?'],
  },
  {
    id: 'gps',
    title: 'What does the GPS flag mean?',
    topic: 'app',
    keywords: ['gps', 'flag', 'flagged', 'distance', '410', 'metres', 'meters', 'location', 'disputed', 'dispute', 'pin', 'red line', 'tolerance'],
    text: `Every attempt records where the server's phone was when it was logged. If that point is more than 150 m from the service address, ServeNow flags it for review instead of quietly accepting it.

A flag doesn't mean service failed. A server may have served the person on the street nearby. It means the affidavit has to explain where service happened, and ServeNow's operations team checks it before the affidavit is finalized. On the map, the red dashed line shows the gap.`,
    sources: [SRC.app('evidence checks')],
    followUps: ['Why does GPS evidence matter in court?', 'What is an affidavit of service?'],
  },
  {
    id: 'privacy',
    title: 'Who can see the person’s name and address?',
    topic: 'app',
    keywords: ['privacy', 'private', 'secure', 'security', 'encrypted', 'data', 'pii', 'who can see', 'canada', 'stored', 'confidential'],
    text: `The name, description and address of the person being served are encrypted and stored in Canada.

Servers browsing available jobs see only an area about 1 km wide. The exact address and details are revealed to the one server who accepts the job, and every time someone views them it's logged.`,
    sources: [SRC.app('privacy')],
  },
  {
    id: 'matter-terms',
    title: 'What are a matter, court file number and style of cause?',
    topic: 'app',
    keywords: ['matter', 'court file', 'file number', 'style of cause', 'case name', 'existing matter', 'new matter', 'smith v. jones'],
    text: `- Matter: your firm's file for the case. One matter can have several service jobs, one per person to serve.
- Court file number: the number the court stamped on the issued document, e.g. CV-26-00081245-0000 in the Superior Court.
- Style of cause: the case name, e.g. "Smith v. Jones".

These go on the affidavit exactly as written, so copy them from the issued document. A wrong court file number can get the affidavit rejected at filing.`,
    sources: [SRC.app('matters')],
    actions: [A.submit],
  },

  /* ───────────── General Ontario rules ───────────── */
  {
    id: 'personal-vs-alternative',
    title: 'Personal service vs. alternative service at a residence',
    topic: 'law',
    keywords: ['personal service', 'alternative', 'alternative service', 'residence', 'household', 'leave with', 'spouse', 'sealed envelope', '16.02', '16.03', 'mail a copy', 'difference', 'method'],
    text: `In the Superior Court, personal service on an individual means leaving a copy of the document with that person (r. 16.02(1)(a)).

If personal service at the person's home doesn't work, an alternative is allowed (r. 16.03(5)): leave a copy in a sealed envelope addressed to the person with an apparently adult member of the same household, and on the same or next day mail another copy to the same address. That service takes effect on the fifth day after the copy is mailed.

ServeNow records both steps for alternative service, including the mailing, and the affidavit sets them out.`,
    sources: [SRC.rcp('16.02(1)(a)'), SRC.rcp('16.03(5)')],
    followUps: ['How do you serve a corporation?', 'What if the person can’t be found?'],
  },
  {
    id: 'corporation',
    title: 'How do you serve a corporation?',
    topic: 'law',
    keywords: ['corporation', 'company', 'business', 'inc', 'ltd', 'corp', 'officer', 'director', 'reception', 'receptionist', '16.02(1)(c)', 'serve a company'],
    text: `In the Superior Court, personal service on a corporation means leaving a copy with an officer, director or agent of the corporation, or with a person at any place of business of the corporation who appears to be in control or management of it (r. 16.02(1)(c)).

ServeNow's server records the name and role of the person served. That detail goes into the affidavit, because "who did you leave it with?" is the first question if service is challenged.`,
    sources: [SRC.rcp('16.02(1)(c)')],
    followUps: ['What is an affidavit of service?'],
  },
  {
    id: 'substituted',
    title: 'What if the person can’t be found?',
    topic: 'law',
    keywords: ['cannot find', 'can’t find', 'cant find', 'can’t be found', 'moved', 'evading', 'avoiding', 'substituted service', 'dispense', 'not served', '16.04', 'attempted service', 'unable to serve', 'email', 'social media'],
    text: `If personal service and the alternatives don't work, a party can bring a motion asking the court to order substituted service (another method likely to bring the document to the person's attention, such as email) or to dispense with service (r. 16.04).

The court will want to know what was tried. That's what ServeNow's affidavit of attempted service is for: it lists every attempt with dates, times and what the server found (for example, the superintendent saying the person moved out), backed by GPS-tagged photos. Whether to bring the motion, and what to ask for, is your lawyer's call.`,
    sources: [SRC.rcp('16.04')],
    followUps: ['What is an affidavit of service?', 'Why does GPS evidence matter in court?'],
  },
  {
    id: 'affidavit',
    title: 'What is an affidavit of service, and who signs it?',
    topic: 'law',
    keywords: ['affidavit', 'proof of service', 'form 16b', 'form 8a', 'form 6b', 'sworn', 'affirmed', 'commissioner', 'notary', 'sign', 'signature', 'signed', 'jurat', 'stamp', '16.09'],
    text: `An affidavit of service is the sworn or affirmed statement of the person who served the document, saying when, where, how and on whom it was served. It's how service is proved to the court (Superior Court: r. 16.09, Form 16B; Small Claims: Form 8A; Family: Form 6B).

Two people sign it:

- The process server (the deponent) signs it.
- A commissioner for taking affidavits administers the oath or affirmation and signs it with their stamp. Ontario lawyers and licensed paralegals are commissioners by virtue of their licence, and notaries public can also commission affidavits.

This can be done over live video under O. Reg. 431/20, which is how ServeNow gets affidavits commissioned the day after service instead of waiting for an in-person appointment.`,
    sources: [SRC.rcp('16.09'), SRC.commissioners, SRC.remote],
    actions: [A.jobs],
    followUps: ['Why use ServeNow instead of my usual process server?'],
  },
  {
    id: 'deadline',
    title: 'Is there a deadline to serve a statement of claim?',
    topic: 'law',
    keywords: ['deadline', 'deadline to serve', 'statement of claim', 'six months', '6 months', 'time limit', 'how long do', 'expire', 'expired', 'late', '14.08', 'time to serve'],
    text: `Generally, yes. In the Superior Court a statement of claim must be served within six months after it's issued (r. 14.08(1)). A Small Claims Court plaintiff's claim generally has to be served within six months as well. The court can extend the time on a motion, but it's better not to need one.

ServeNow shows the due date on every job and flags jobs that are close to it. Check the actual deadline in your matter, because orders and other rules can change it.`,
    sources: [SRC.rcp('14.08(1)'), SRC.smallClaimsGuide],
    actions: [A.submit],
  },
  {
    id: 'small-claims',
    title: 'How is Small Claims Court service different?',
    topic: 'law',
    keywords: ['small claims', 'plaintiff’s claim', 'plaintiffs claim', 'form 7a', 'form 8a', 'rule 8', 'small claims court'],
    text: `Small Claims Court has its own rules (O. Reg. 258/98, rule 8), similar in structure to the Superior Court: personal service, alternatives to personal service, and proof by affidavit of service on Form 8A. The plaintiff's claim generally has to be served within six months after it's issued.

ServeNow picks the affidavit form from the court you choose for the matter.`,
    sources: [SRC.smallClaims('8'), SRC.smallClaimsGuide],
  },
  {
    id: 'family',
    title: 'How is Family Court service different?',
    topic: 'law',
    keywords: ['family', 'family court', 'family law', 'application', 'form 8', 'special service', 'form 6b', 'divorce', 'custody', 'support'],
    text: `Family cases follow the Family Law Rules, rule 6. Documents that start a case, like an application, generally need special service (essentially personal service) rather than ordinary service by mail or email. Proof is by affidavit of service on Form 6B.

ServeNow treats family matters as personal service by default and uses Form 6B. Your lawyer decides which documents need special service in your case.`,
    sources: [SRC.family('6')],
  },
  {
    id: 'who-can-serve',
    title: 'Who is allowed to serve documents?',
    topic: 'law',
    keywords: ['who can serve', 'licensed', 'license', 'licence', 'licensing', 'qualified', 'process server', 'anyone', 'vetted', 'background check'],
    text: `Ontario doesn't license process servers. The rules don't require a licensed server; what the court looks at is the affidavit that proves service, and whether it holds up.

That puts the burden on quality: who is serving, and whether their evidence holds up. ServeNow servers are ID-verified and background-checked, every attempt is GPS-logged, and the affidavit is drafted from that record rather than from memory.`,
    sources: [SRC.app('server vetting')],
    followUps: ['Why use ServeNow instead of my usual process server?'],
  },

  /* ───────────── Why use ServeNow ───────────── */
  {
    id: 'why',
    title: 'Why use ServeNow instead of my usual process server?',
    topic: 'why',
    keywords: ['why', 'why use', 'benefit', 'benefits', 'advantage', 'worth', 'better', 'instead', 'reason', 'justify', 'convince', 'compare', 'value', 'should we use', 'case for'],
    text: `Service is where a lot of cases quietly go wrong, and the fix is evidence. ServeNow is built around the points where service gets challenged:

- Default judgments get attacked on service. A defendant can move to set aside a default judgment (r. 19.08), often by saying they were never served. An affidavit backed by a time-stamped, GPS-tagged photo of each attempt is much harder to dispute than one written from memory.
- Substituted service motions need a record. To get substituted service or an order dispensing with service (r. 16.04), you have to show what was tried. ServeNow builds that record automatically.
- Deadlines are tracked. A statement of claim generally has to be served within six months (r. 14.08(1)). Every job has a due date and a live status, so nothing sits in someone's inbox.
- Affidavits are faster. Commissioning by video under O. Reg. 431/20 means the affidavit is usually back the day after service.
- Documents can be checked. Each PDF is fingerprinted (SHA-256) on upload, so you can show the copy served is the copy issued.

ServeNow doesn't replace your judgment on how to serve. It makes whatever you decide easier to prove.`,
    sources: [SRC.rcp('19.08'), SRC.rcp('16.04'), SRC.rcp('14.08(1)'), SRC.remote],
    actions: [A.submit],
    followUps: ['Why does GPS evidence matter in court?', 'What is an affidavit of service, and who signs it?'],
  },
  {
    id: 'gps-court',
    title: 'Why does GPS evidence matter in court?',
    topic: 'why',
    keywords: ['evidence', 'court', 'prove', 'proof', 'challenge', 'challenged', 'credible', 'credibility', 'photo', 'photograph', 'exhibit', 'default judgment', 'set aside', '19.08', 'never served'],
    text: `When service is challenged, it usually comes down to the affidavit against the other side's word. For example, a defendant may move to set aside a default judgment by saying they were never served (r. 19.08).

Contemporaneous records make the affidavit stronger. ServeNow attaches a time-stamped, GPS-tagged photograph of each attempt as an exhibit, and the affidavit is drafted from the logged data, not reconstructed later. Whether a court accepts any piece of evidence depends on the case, but specific, recorded details are what judges look for.`,
    sources: [SRC.rcp('19.08'), SRC.app('evidence')],
    followUps: ['What does the GPS flag mean?', 'Why use ServeNow instead of my usual process server?'],
  },
];

/** Starting suggestions, by page. */
export const SUGGESTIONS: Record<string, string[]> = {
  home: ['How does ServeNow work?', 'Why use ServeNow instead of my usual process server?', 'What is an affidavit of service, and who signs it?'],
  jobs: ['What if no server accepts the job?', 'What does the GPS flag mean?', 'What do the priority levels mean?'],
  'new-job:matter': ['What are a matter, court file number and style of cause?', 'Is there a deadline to serve a statement of claim?'],
  'new-job:documents': ['Who can see the person’s name and address?', 'How does ServeNow work?'],
  'new-job:recipient': ['Personal service vs. alternative service at a residence', 'How do you serve a corporation?'],
  'new-job:checkout': ['How is the price calculated?', 'What do the priority levels mean?', 'Will I be charged twice if I tap submit again?'],
  job: ['Explain this job', 'What is an affidavit of service, and who signs it?', 'What if the person can’t be found?'],
};
