'use client';

import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../_lib/format';
import { Spinner } from './ui';

/**
 * Development-only stand-in for the issuer's 3-D Secure page, used in mock mode.
 * In production, Stripe.js `handleNextAction` shows the real challenge.
 */
export function MockBankChallenge({ amountCents, cardLabel, onResult }: { amountCents: number; cardLabel: string; onResult: (passed: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const approveRef = useRef<HTMLButtonElement>(null);
  useEffect(() => approveRef.current?.focus(), []);

  const decide = async (passed: boolean) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    onResult(passed);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="tds-title">
      <div className="absolute inset-0 bg-black/50" />
      <div className="pop card relative w-full max-w-sm shadow-panel">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="text-[13px] font-semibold">Card verification</span>
          <span className="font-mono text-[11px] text-faint">3DS2 · mock issuer</span>
        </div>
        <div className="flex flex-col gap-3 p-5 text-[13px]">
          <h2 id="tds-title" className="text-[16px] font-semibold">
            Confirm this payment
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 tabular-nums">
            <dt className="text-faint">Merchant</dt>
            <dd>ServeNow Inc.</dd>
            <dt className="text-faint">Amount</dt>
            <dd className="font-mono">{formatMoney(amountCents)}</dd>
            <dt className="text-faint">Card</dt>
            <dd className="font-mono">{cardLabel}</dd>
          </dl>
          <p className="text-[12.5px] text-muted">Development mode: choose how the bank responds.</p>
          <div className="mt-1 flex gap-2">
            <button ref={approveRef} type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => decide(true)}>
              {busy ? <Spinner /> : null}
              Approve
            </button>
            <button type="button" className="btn btn-ghost flex-1" disabled={busy} onClick={() => decide(false)}>
              Fail verification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
