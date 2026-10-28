'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { suggestionsFor } from '@/lib/assistant/engine';
import { Icon, Spinner } from '@/app/(portal)/jobs/new/_components/ui';
import { useAssistant, type ChatMessage } from './AssistantProvider';

const DEMO = process.env.NEXT_PUBLIC_API_MOCK === '1';

/** Renders the assistant's plain-text format: blank-line paragraphs, "- " bullets. */
function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const bullets = lines.filter((l) => l.startsWith('- '));
        if (bullets.length && bullets.length === lines.length) {
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-faint">
              {bullets.map((l, j) => (
                <li key={j}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 ? <br /> : null}
                {l}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function Chips({ items, onPick, disabled }: { items: readonly string[]; onPick: (q: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onPick(q)}
          className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-left text-[12.5px] text-fg hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function AssistantMessage({ m, onPick, onNavigate, busy }: { m: ChatMessage; onPick: (q: string) => void; onNavigate: () => void; busy: boolean }) {
  const r = m.reply;
  return (
    <div className="flex flex-col gap-2.5">
      <div className={`rounded-lg rounded-tl-sm px-3.5 py-2.5 text-[13.5px] leading-relaxed ${m.error ? 'bg-bad-bg text-bad' : 'bg-sunk'}`}>
        <RichText text={m.text} />
        {r && r.kind === 'answer' && r.sources.some((s) => !s.label.startsWith('ServeNow')) ? (
          <div className="mt-2.5 border-t border-line pt-2 text-[11.5px] text-faint">General information, not legal advice. Check the current rules for your matter.</div>
        ) : null}
      </div>
      {r && r.sources.length ? (
        <div className="flex flex-col gap-1 pl-1">
          <div className="eyebrow">Sources</div>
          <ul className="flex flex-col gap-0.5 text-[12px]">
            {r.sources.map((s) => (
              <li key={s.label} className="flex items-start gap-1.5 text-muted">
                <Icon name="book" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
                    {s.label}
                  </a>
                ) : (
                  <span>{s.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {r && r.actions.length ? (
        <div className="flex flex-wrap gap-2 pl-1">
          {r.actions.map((a) => (
            <Link key={a.href} href={a.href} onClick={onNavigate} className="btn btn-primary px-3 py-1.5 text-[13px]">
              {a.label} <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      ) : null}
      {r && r.followUps.length ? (
        <div className="pl-1">
          <Chips items={r.followUps} onPick={onPick} disabled={busy} />
        </div>
      ) : null}
    </div>
  );
}

export function AssistantPanel() {
  const { open, closePanel, messages, pending, ask, context, clear } = useAssistant();
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closePanel();
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 150);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [open, closePanel]);

  // Close when navigating via an answer's action button.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current !== pathname) closePanel();
    lastPath.current = pathname;
  }, [pathname, closePanel]);

  if (!open) return null;

  const send = () => {
    const q = draft.trim();
    if (!q || pending) return;
    setDraft('');
    void ask(q);
  };

  const starters = suggestionsFor(context);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
      <div className="absolute inset-0 bg-black/40" onClick={closePanel} />
      <div className="pop relative flex max-h-[88dvh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-panel sm:max-h-none sm:w-[420px] sm:rounded-none sm:border-y-0 sm:border-r-0">
        <header className="flex items-start gap-3 border-b border-line px-4 pb-3 pt-3.5">
          <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
            <Icon name="sparkle" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="assistant-title" className="font-semibold">
              Ask ServeNow
            </h2>
            <p className="text-[12px] text-muted">Help with the app and general Ontario service rules. Not legal advice.</p>
          </div>
          {messages.length ? (
            <button type="button" onClick={clear} className="rounded px-2 py-1 text-[12px] text-faint hover:text-fg">
              Clear
            </button>
          ) : null}
          <button type="button" onClick={closePanel} className="rounded p-1.5 text-faint hover:bg-sunk hover:text-fg" aria-label="Close">
            <Icon name="x" />
          </button>
        </header>

        <div ref={scroller} className="flex min-h-[40dvh] flex-1 flex-col gap-4 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13.5px] text-muted">
                Confused by a feature, a step, or a rule about serving documents? Ask in your own words, or start with one of these:
              </p>
              <Chips items={starters} onPick={(q) => void ask(q)} disabled={pending} />
            </div>
          ) : (
            messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-accent px-3.5 py-2 text-[13.5px] text-accent-fg">
                  {m.text}
                </div>
              ) : (
                <AssistantMessage key={m.id} m={m} onPick={(q) => void ask(q)} onNavigate={closePanel} busy={pending} />
              ),
            )
          )}
          {pending ? (
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <Spinner /> Thinking…
            </div>
          ) : null}
        </div>

        <form
          className="flex items-end gap-2 border-t border-line px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="assistant-input" className="sr-only">
            Your question
          </label>
          <textarea
            id="assistant-input"
            ref={input}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about a feature, a rule or a step…"
            className="field max-h-32 min-h-[40px] resize-none"
          />
          <button type="submit" className="btn btn-primary h-10 w-10 shrink-0 p-0" disabled={!draft.trim() || pending} aria-label="Send">
            <Icon name="send" />
          </button>
        </form>
        {DEMO ? <div className="px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-center text-[11px] text-faint sm:pb-2">Demo: answers come from ServeNow’s built-in guide</div> : null}
      </div>
    </div>
  );
}

/** Small floating entry point on every screen. */
export function AskButton({ hidden }: { hidden?: boolean }): ReactNode {
  const { openPanel, open } = useAssistant();
  if (hidden || open) return null;
  return (
    <button
      type="button"
      onClick={() => openPanel()}
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex items-center gap-2 rounded-full bg-[#101a2b] px-4 py-2.5 text-[13px] font-semibold text-white shadow-panel ring-1 ring-white/10 hover:bg-[#1c2a42]"
      aria-label="Ask ServeNow"
    >
      <Icon name="sparkle" className="h-4 w-4 text-[#6d9fe0]" />
      Ask
    </button>
  );
}
