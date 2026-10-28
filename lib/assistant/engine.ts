/**
 * Demo answer engine: matches a question against ServeNow's built-in guide.
 * The production assistant (POST /assistant/messages) uses an AI model grounded on the same
 * guide, with the same scope rules: explain the app and general rules, never advise on a case.
 */
import type { AskAssistantInput, AssistantContext, AssistantReply } from '@/types/jobs';
import { GUIDE, SRC, SUGGESTIONS, type GuideEntry } from './guide';

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}.'()\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Asking for a judgment on their own matter, which only their lawyer can give. */
const CASE_ADVICE = /\b(should i|should we (sue|settle|file)|will i win|will we win|my case|our case|my lawsuit|sue (my|him|her|them)|is it legal|am i liable|are we liable|how much (can|could|will) (i|we) get|damages|should (my client|the client)|legal advice|what are my chances)\b/;

function score(q: string, tokens: Set<string>, e: GuideEntry): number {
  if (q === normalize(e.title)) return 100;
  let s = 0;
  for (const raw of e.keywords) {
    const k = normalize(raw);
    if (k.includes(' ') || k.includes('.')) {
      if (q.includes(k)) s += 3;
    } else if (tokens.has(k)) {
      s += 1.5;
    }
  }
  return s;
}

export function suggestionsFor(ctx: AssistantContext): string[] {
  const key = ctx.page === 'new-job' && ctx.step ? `new-job:${ctx.step}` : ctx.page;
  return SUGGESTIONS[key] ?? SUGGESTIONS.home!;
}

const STATUS_STORY: Record<string, string> = {
  authorized: 'Payment is authorized and the job is about to be offered to servers near the address.',
  open: 'ServeNow is offering the job to servers near the address. Nobody has accepted yet.',
  offered: 'ServeNow is offering the job to servers near the address. Nobody has accepted yet.',
  submitted: 'The job has been submitted and is being checked before it goes to servers.',
  assigned: 'A server has accepted the job and is on the way to the address.',
  in_progress: 'A server is working the job and logging attempts.',
  served: 'The person has been served. Next, the server signs the affidavit of service, then affirms it before a commissioner.',
  affidavit_pending: 'Service is done and the server has signed the affidavit. It’s waiting to be affirmed before a commissioner, usually by video the same or next day.',
  affidavit_signed: 'Service is done and the affidavit is signed by the server and commissioned. You can download it with the evidence attached.',
  completed: 'This job is complete and the affidavit has been delivered.',
  non_served: 'The server couldn’t serve the person within the attempts allowed.',
  disputed: 'This job is under review.',
};

function explainJob(ctx: AssistantContext): AssistantReply | null {
  const j = ctx.job;
  if (!j) return null;
  const parts = [`${j.publicRef}: ${STATUS_STORY[j.status] ?? 'This job is in progress.'}`];
  parts.push(`Attempts used: ${j.attempts} of ${j.maxAttempts}.`);
  const sources = [SRC.app('job status')];
  const followUps: string[] = [];

  if (j.gpsFlagged) {
    parts.push(
      'One attempt was logged more than 150 m from the service address, so ServeNow flagged it. The affidavit has to explain where service happened, and ServeNow’s operations team reviews it before it’s finalized.',
    );
    followUps.push('Why does GPS evidence matter in court?');
  }
  if (j.status === 'non_served') {
    parts.push(
      'ServeNow prepares an affidavit of attempted service listing every attempt, with GPS-tagged photos. Your lawyer can use it to ask the court for substituted service or an order dispensing with service (r. 16.04).',
    );
    sources.push(SRC.rcp('16.04'));
    followUps.push('What if the person can’t be found?');
  }
  if (j.affidavitStatus === 'awaiting_commissioner' || j.affidavitStatus === 'awaiting_deponent') {
    followUps.push('What is an affidavit of service, and who signs it?');
    sources.push(SRC.remote);
  }
  if (['open', 'offered', 'authorized'].includes(j.status)) followUps.push('What if no server accepts the job?');
  return { kind: 'answer', text: parts.join('\n\n'), sources, actions: [], followUps: followUps.slice(0, 3) };
}

export function answer(input: AskAssistantInput): AssistantReply {
  const q = normalize(input.question);
  const tokens = new Set(q.split(' '));

  if (/^(explain|summari[sz]e|what'?s (happening|going on)|status)\b.*\b(this )?job\b/.test(q) || q === 'explain this job') {
    const r = explainJob(input.context);
    if (r) return r;
    return {
      kind: 'answer',
      text: 'Open a job from Active Jobs and ask again. I’ll explain where it stands and what happens next.',
      sources: [],
      actions: [{ label: 'Open active jobs', href: '/jobs/' }],
      followUps: suggestionsFor(input.context),
    };
  }

  const ranked = GUIDE.map((e) => ({ e, s: score(q, tokens, e) })).sort((a, b) => b.s - a.s);
  const best = ranked[0];

  if (CASE_ADVICE.test(q) && (!best || best.s < 4)) {
    return {
      kind: 'out_of_scope',
      text: 'I can’t advise on a specific case or what you should do in it. That’s a question for the lawyer on the matter.\n\nI can explain how service works in Ontario in general, what the affidavit proves, and how ServeNow handles each step.',
      sources: [],
      actions: [],
      followUps: ['Personal service vs. alternative service at a residence', 'What if the person can’t be found?', 'What is an affidavit of service, and who signs it?'],
    };
  }

  if (!best || best.s < 1.5) {
    return {
      kind: 'not_sure',
      text: 'I don’t have a good answer for that yet. I can help with how ServeNow works, the general rules for serving documents in Ontario, and why ServeNow’s evidence holds up. Try one of these:',
      sources: [],
      actions: [],
      followUps: suggestionsFor(input.context),
    };
  }

  const e = best.e;
  return {
    kind: 'answer',
    text: e.text,
    sources: e.sources,
    actions: e.actions ?? [],
    followUps: (e.followUps ?? []).filter((f) => !input.history.some((h) => h.role === 'user' && normalize(h.text) === normalize(f))).slice(0, 3),
  };
}
