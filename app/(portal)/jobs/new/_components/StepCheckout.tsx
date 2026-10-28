'use client';

import type { PaymentOption, Priority, Quote } from '@/types/jobs';
import { INCLUDED_ATTEMPTS, PRIORITIES, PRIORITY_ORDER } from '../_lib/constants';
import { formatDay, sameDayAvailable } from '../_lib/dates';
import { formatMoney } from '../_lib/format';
import type { CheckoutDraft } from '../_lib/state';
import { useCountdown } from '../_lib/useCountdown';
import { Callout, Field, Icon, Section, Spinner } from './ui';

interface Props {
  checkout: CheckoutDraft;
  onChange: (patch: Partial<CheckoutDraft>) => void;
  dues: Record<Priority, Date>;
  quote: Quote | null;
  quoting: boolean;
  paymentOptions: readonly PaymentOption[] | null;
  error: string | null;
}

export function holdExplanation(option: PaymentOption | undefined, priority: Priority): string {
  if (!option) return '';
  if (option.kind === 'invoice') return 'Added to this month’s invoice once the affidavit is delivered. Nothing is charged today.';
  if (priority === 'standard') {
    return 'Card authorizations expire after about 7 days, so Standard jobs are charged today and held by ServeNow. The server is paid only after the affidavit is delivered.';
  }
  return 'A hold is placed on the card today and captured when the affidavit is delivered.';
}

export function StepCheckout({ checkout: c, onChange, dues, quote, quoting, paymentOptions, error }: Props) {
  const left = useCountdown(quote?.expiresAt);
  const sameDayOpen = sameDayAvailable();
  const selectedOption = paymentOptions?.find((p) => p.id === c.paymentOptionId);

  return (
    <div className="flex flex-col gap-4">
      <Section title="Priority" aside="Due dates skip weekends and Ontario statutory holidays">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Priority">
          {PRIORITY_ORDER.map((k) => {
            const p = PRIORITIES[k];
            const disabled = k === 'same_day' && !sameDayOpen;
            return (
              <label key={k} htmlFor={`p-${k}`} className="choice" data-selected={c.priority === k} data-disabled={disabled}>
                <input
                  type="radio"
                  id={`p-${k}`}
                  name="priority"
                  disabled={disabled}
                  checked={c.priority === k}
                  onChange={() => onChange({ priority: k })}
                  className="mt-1 accent-accent"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{p.label}</span>
                    <span className="font-mono text-[13px] tabular-nums">from {formatMoney(p.fromCents)}</span>
                  </div>
                  <div className="text-[12.5px] text-muted">{p.blurb}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11.5px] text-faint">
                    <span>Due {disabled ? '—' : formatDay(dues[k])}</span>
                    <span>·</span>
                    <span>{p.dispatch}</span>
                  </div>
                  {disabled ? <div className="mt-1 text-[11.5px] text-warn">Same-day cutoff is 1:00 p.m. on business days.</div> : null}
                </div>
              </label>
            );
          })}
        </div>
        <Field
          label={`Maximum attempts: ${c.maxAttempts}`}
          htmlFor="attempts"
          hint={`${INCLUDED_ATTEMPTS} included. Due diligence usually needs attempts on different days and times.`}
          className="sm:max-w-sm"
        >
          <input
            id="attempts"
            type="range"
            min={2}
            max={6}
            value={c.maxAttempts}
            onChange={(e) => onChange({ maxAttempts: Number(e.target.value) })}
            className="w-full accent-accent"
          />
        </Field>
      </Section>

      <Section
        title="Quote"
        aside={
          quote && !quoting ? (
            <span className="flex items-center gap-1 tabular-nums">
              <Icon name="clock" className="h-3.5 w-3.5" />
              Price held for {left}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Spinner /> Calculating…
            </span>
          )
        }
      >
        <div className={`flex flex-col text-[13px] transition-opacity ${quoting ? 'opacity-50' : ''}`} aria-busy={quoting}>
          {quote?.lineItems.map((l) => (
            <div key={l.code} className="flex justify-between gap-4 border-b border-line py-1.5">
              <span className="min-w-0 text-muted">{l.label}</span>
              <span className="font-mono tabular-nums">{formatMoney(l.amountCents)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-4 py-1.5">
            <span className="text-muted">Subtotal</span>
            <span className="font-mono tabular-nums">{quote ? formatMoney(quote.subtotalCents) : '—'}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-line py-1.5">
            <span className="text-muted">HST (Ontario) 13%</span>
            <span className="font-mono tabular-nums">{quote ? formatMoney(quote.taxCents) : '—'}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 pt-2.5">
            <span className="text-[15px] font-semibold">Total</span>
            <span className="font-mono text-[20px] font-semibold tabular-nums">{quote ? formatMoney(quote.totalCents) : '—'}</span>
          </div>
        </div>
        <div className="text-[11.5px] text-faint">
          Refund rules: full refund before a server accepts; after that, the base fee is kept once an attempt has been made. Non-service still produces an
          affidavit of attempted service.
        </div>
      </Section>

      <Section
        title="Payment"
        aside={
          <span className="flex items-center gap-1">
            <Icon name="lock" className="h-3.5 w-3.5" />
            Processed by Stripe
          </span>
        }
      >
        {paymentOptions === null ? (
          <div className="flex items-center gap-2 text-muted">
            <Spinner /> Loading payment options…
          </div>
        ) : (
          <div className="grid gap-2" role="radiogroup" aria-label="Payment method">
            {paymentOptions.map((p) => (
              <label key={p.id} htmlFor={`pay-${p.id}`} className="choice items-center" data-selected={c.paymentOptionId === p.id}>
                <input
                  type="radio"
                  id={`pay-${p.id}`}
                  name="payment"
                  checked={c.paymentOptionId === p.id}
                  onChange={() => onChange({ paymentOptionId: p.id })}
                  className="accent-accent"
                />
                <Icon name={p.kind === 'invoice' ? 'bank' : 'card'} className="h-5 w-5 shrink-0 text-muted" />
                <div className="min-w-0">
                  <div className="font-medium">{p.label}</div>
                  <div className="text-[12px] text-faint">{p.detail}</div>
                </div>
              </label>
            ))}
          </div>
        )}
        {selectedOption ? (
          <Callout tone="info" icon="clock">
            {holdExplanation(selectedOption, c.priority)}
          </Callout>
        ) : null}
        {error ? <Callout tone="bad">{error}</Callout> : null}
      </Section>
    </div>
  );
}
