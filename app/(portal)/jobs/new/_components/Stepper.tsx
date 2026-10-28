'use client';

import type { StepIndex } from '../_lib/state';
import { Icon } from './ui';

const STEPS = [
  { title: 'Matter', sub: 'Court file & style of cause' },
  { title: 'Documents', sub: 'PDFs to be served' },
  { title: 'Person & address', sub: 'Who, where, how' },
  { title: 'Quote & payment', sub: 'Priority, fees, hold' },
] as const;

type StepState = 'done' | 'current' | 'visited' | 'locked';

export function Stepper({ step, maxReached, onGo }: { step: StepIndex; maxReached: StepIndex; onGo: (s: StepIndex) => void }) {
  return (
    <ol className="flex gap-2 sm:grid sm:grid-cols-4 sm:gap-3">
      {STEPS.map((s, i) => {
        const idx = i as StepIndex;
        const state: StepState = idx < step ? 'done' : idx === step ? 'current' : idx <= maxReached ? 'visited' : 'locked';
        const canGo = idx !== step && idx <= maxReached;
        const barColor = state === 'locked' ? 'bg-line' : state === 'current' ? 'bg-accent' : 'bg-ok';
        const dot =
          state === 'done'
            ? 'bg-ok text-accent-fg'
            : state === 'current'
              ? 'bg-accent text-accent-fg'
              : 'border border-line-strong text-faint';
        return (
          <li key={s.title} className={`min-w-0 ${state === 'current' ? 'flex-1' : 'w-9 shrink-0 sm:w-auto'}`}>
            <button
              type="button"
              disabled={!canGo}
              onClick={() => onGo(idx)}
              aria-current={state === 'current' ? 'step' : undefined}
              className="group w-full text-left disabled:cursor-default"
            >
              <div className={`mb-2 h-[3px] rounded-full ${barColor}`} />
              <div className="flex items-center gap-2">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold ${dot}`}>
                  {state === 'done' ? <Icon name="check" className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
                </span>
                <span
                  className={`truncate text-[13px] ${state === 'current' ? 'font-semibold' : 'hidden text-muted sm:inline'} ${canGo ? 'group-hover:underline' : ''}`}
                >
                  {s.title}
                </span>
              </div>
              <div className="mt-0.5 hidden truncate pl-7 text-[11.5px] text-faint md:block">{s.sub}</div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
