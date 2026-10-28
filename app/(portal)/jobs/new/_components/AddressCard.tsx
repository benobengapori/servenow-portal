'use client';

import type { AddressKind } from '@/types/jobs';
import type { AddressDraft } from '../_lib/state';
import { MapPreview } from './MapPreview';
import { Callout, Field, Icon, Spinner } from './ui';

const PRECISION_LABEL = { rooftop: 'Rooftop', interpolated: 'Interpolated', street: 'Street only', approximate: 'Approximate' } as const;
const PROVINCE_NAME: Partial<Record<string, string>> = { QC: 'Québec', MB: 'Manitoba', NY: 'New York', MI: 'Michigan' };

interface Props {
  address: AddressDraft;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<AddressDraft>) => void;
  onValidate: () => void;
  onRemove: () => void;
}

export function AddressCard({ address: a, index, canRemove, onChange, onValidate, onRemove }: Props) {
  const r = a.result;
  const confTone = r?.ok ? (r.confidence >= 0.9 ? 'var(--sn-ok)' : r.confidence >= 0.8 ? 'var(--sn-accent)' : 'var(--sn-warn)') : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-line bg-sunk p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-semibold">
          Address {index + 1} <span className="font-normal text-faint">· tried {index === 0 ? 'first' : `if address ${index} fails`}</span>
        </div>
        {canRemove ? (
          <button type="button" onClick={onRemove} className="text-[12px] text-faint hover:text-bad">
            Remove
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
        <Field label="Type" htmlFor={`akind-${a.key}`}>
          <select id={`akind-${a.key}`} className="field" value={a.kind} onChange={(e) => onChange({ kind: e.target.value as AddressKind })}>
            <option value="home">Residence</option>
            <option value="work">Workplace</option>
            <option value="registered_office">Registered office</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Street address" htmlFor={`addr-${a.key}`} error={r && !r.ok ? r.reason : undefined}>
          <div className="flex gap-2">
            <input
              id={`addr-${a.key}`}
              className="field"
              value={a.raw}
              aria-invalid={Boolean(r && !r.ok)}
              onChange={(e) => onChange({ raw: e.target.value, result: null })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && a.raw.trim()) {
                  e.preventDefault();
                  onValidate();
                }
              }}
              placeholder="118 Fifth Ave, Ottawa, ON K1S 2M8"
              autoComplete="off"
            />
            <button type="button" className="btn btn-ghost shrink-0" disabled={!a.raw.trim() || a.checking} onClick={onValidate}>
              {a.checking ? (
                <>
                  <Spinner /> Checking
                </>
              ) : r?.ok ? (
                'Recheck'
              ) : (
                'Validate'
              )}
            </button>
          </div>
        </Field>
      </div>

      {r?.ok ? (
        <div className="pop grid gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2 text-[12.5px]">
            <div className="flex items-start gap-2">
              <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0">
                <div className="font-medium">{r.formatted}</div>
                <div className="font-mono text-[11.5px] text-faint">Geocoded · {PRECISION_LABEL[r.precision]}</div>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums">
              <dt className="text-faint">Match confidence</dt>
              <dd className="flex items-center gap-2">
                <span className="bar inline-block w-16">
                  <span style={{ width: `${r.confidence * 100}%`, background: confTone }} />
                </span>
                {r.confidence.toFixed(2)}
              </dd>
              <dt className="text-faint">Nearest server pool</dt>
              <dd>
                {r.nearestPool.name} · {r.nearestPool.km} km
              </dd>
              <dt className="text-faint">Province</dt>
              <dd>{r.province}</dd>
            </dl>
            {r.province !== 'ON' ? (
              <Callout tone="bad">
                This address is in {PROVINCE_NAME[r.province] ?? r.province}. ServeNow currently serves Ontario only, and Ontario service rules don’t
                apply there. Service outside Ontario needs a local agent.
              </Callout>
            ) : !r.postalCode ? (
              <Callout tone="warn">
                No postal code, so this matched only to the street ({r.confidence.toFixed(2)}). Add the postal code to avoid a wasted attempt.
              </Callout>
            ) : r.confidence < 0.9 ? (
              <Callout tone="warn">Low-confidence match. Check the pin before continuing.</Callout>
            ) : null}
            {!r.hasUnit && a.kind === 'home' && r.province === 'ON' ? (
              <div className="text-[11.5px] text-faint">If this is an apartment or condo, add the unit number and buzzer code in instructions.</div>
            ) : null}
          </div>
          <MapPreview result={r} />
        </div>
      ) : null}
    </div>
  );
}
