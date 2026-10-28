'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Matter } from '@/types/jobs';
import { COURTS, COURT_SITES, courtInfo, type CourtSite, type SupportedCourt } from '../_lib/constants';
import { emptyNewMatter, type FieldErrors, type MatterDraft, type NewMatterDraft } from '../_lib/state';
import { Callout, Field, Icon, Section, Spinner } from './ui';

interface Props {
  draft: MatterDraft;
  onChange: (next: MatterDraft) => void;
  errors: FieldErrors;
}

export function StepMatter({ draft, onChange, errors }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="seg self-start" role="group" aria-label="Matter">
        <button type="button" aria-pressed={draft.mode === 'existing'} onClick={() => draft.mode !== 'existing' && onChange({ mode: 'existing', selected: null })}>
          Existing matter
        </button>
        <button
          type="button"
          aria-pressed={draft.mode === 'new'}
          onClick={() => draft.mode !== 'new' && onChange({ mode: 'new', fields: emptyNewMatter(), created: null })}
        >
          New matter
        </button>
      </div>

      {draft.mode === 'existing' ? (
        <ExistingMatterPicker
          selected={draft.selected}
          onSelect={(m) => onChange({ mode: 'existing', selected: m })}
          onCreateFromQuery={(q) => onChange({ mode: 'new', fields: { ...emptyNewMatter(), styleOfCause: q }, created: null })}
          error={errors.matter}
        />
      ) : (
        <NewMatterForm
          fields={draft.fields}
          locked={draft.created !== null}
          onChange={(fields) => onChange({ ...draft, fields })}
          errors={errors}
        />
      )}

      <div className="flex items-center gap-1.5 text-[12px] text-faint">
        <Icon name="shield" className="h-3.5 w-3.5" />
        Jurisdiction <span className="font-mono">CA-ON</span>. The affidavit of service is generated on the prescribed form for the selected court.
      </div>
    </div>
  );
}

function ExistingMatterPicker({
  selected,
  onSelect,
  onCreateFromQuery,
  error,
}: {
  selected: Matter | null;
  onSelect: (m: Matter) => void;
  onCreateFromQuery: (q: string) => void;
  error: string | undefined;
}) {
  const [query, setQuery] = useState('');
  const [matters, setMatters] = useState<readonly Matter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => {
      api
        .searchMatters(query, { signal: controller.signal })
        .then((page) => {
          setMatters(page.items);
          setLoadError(null);
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setLoadError(err instanceof Error ? err.message : 'Could not load matters.');
        });
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  return (
    <Section title="Select a matter" aside={matters ? `${matters.length} matters` : undefined}>
      <label className="relative block" htmlFor="matter-search">
        <span className="sr-only">Search matters</span>
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">
          <Icon name="search" />
        </span>
        <input
          id="matter-search"
          className="field pl-8"
          placeholder="Search by your matter #, court file no. or style of cause"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {loadError ? <Callout tone="bad">{loadError}</Callout> : null}

      {/* Phone: tappable cards */}
      {matters && matters.length > 0 ? (
        <ul className="-mx-4 divide-y divide-line border-y border-line sm:hidden" role="radiogroup" aria-label="Matters">
          {matters.map((m) => {
            const isSel = selected?.id === m.id;
            return (
              <li key={m.id}>
                <label htmlFor={`matter-m-${m.id}`} className={`flex cursor-pointer gap-3 px-4 py-3 ${isSel ? 'bg-accent-soft' : ''}`}>
                  <input
                    type="radio"
                    name="matter-mobile"
                    id={`matter-m-${m.id}`}
                    checked={isSel}
                    onChange={() => onSelect(m)}
                    className="mt-1 accent-accent"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{m.styleOfCause}</span>
                    <span className="block font-mono text-[12px] text-muted">{m.courtFileNo ?? 'Not issued'}</span>
                    <span className="block text-[12px] text-faint">
                      {m.clientReference ?? '—'} · {courtInfo(m.courtType)?.label ?? 'Tribunal'}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className={`-mx-4 overflow-x-auto border-y border-line ${matters && matters.length > 0 ? 'hidden sm:block' : ''}`}>
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="bg-sunk text-left text-faint">
              {['', 'Your matter #', 'Style of cause', 'Court file no.', 'Court'].map((h) => (
                <th key={h} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matters === null ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> Loading matters…
                  </span>
                </td>
              </tr>
            ) : matters.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  No matters match “{query}”.{' '}
                  <button type="button" className="font-medium text-accent" onClick={() => onCreateFromQuery(query)}>
                    Create it as a new matter
                  </button>
                </td>
              </tr>
            ) : (
              matters.map((m) => {
                const isSel = selected?.id === m.id;
                return (
                  <tr key={m.id} onClick={() => onSelect(m)} className={`cursor-pointer border-t border-line ${isSel ? 'bg-accent-soft' : 'hover:bg-sunk'}`}>
                    <td className="w-7 py-2 pl-3">
                      <input
                        type="radio"
                        name="matter"
                        id={`matter-${m.id}`}
                        checked={isSel}
                        onChange={() => onSelect(m)}
                        className="accent-accent"
                        aria-label={m.styleOfCause}
                      />
                    </td>
                    <td className="px-3 py-2 font-mono">{m.clientReference ?? '—'}</td>
                    <td className="px-3 py-2 font-medium">{m.styleOfCause}</td>
                    <td className="px-3 py-2 font-mono text-muted">{m.courtFileNo ?? 'Not issued'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{courtInfo(m.courtType)?.label ?? 'Tribunal'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {error ? <div className="hint-error">{error}</div> : null}
    </Section>
  );
}

function NewMatterForm({
  fields,
  locked,
  onChange,
  errors,
}: {
  fields: NewMatterDraft;
  locked: boolean;
  onChange: (f: NewMatterDraft) => void;
  errors: FieldErrors;
}) {
  const court = COURTS[fields.court];
  const file = fields.courtFileNo.trim();
  const formatWarning = file.length > 0 && !court.fileNumberPattern.test(file);
  const set = <K extends keyof NewMatterDraft>(k: K, v: NewMatterDraft[K]) => onChange({ ...fields, [k]: v });

  return (
    <Section title="New matter" aside={locked ? 'Saved. Contact support to change a matter’s details.' : undefined}>
      <fieldset disabled={locked} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Court" htmlFor="court">
            <select id="court" className="field" value={fields.court} onChange={(e) => set('court', e.target.value as SupportedCourt)}>
              {(Object.keys(COURTS) as SupportedCourt[]).map((k) => (
                <option key={k} value={k}>
                  {COURTS[k].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Court location" htmlFor="site">
            <select id="site" className="field" value={fields.site} onChange={(e) => set('site', e.target.value as CourtSite)}>
              {COURT_SITES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Style of cause" htmlFor="cause" hint="As it appears on the issued document, e.g. “Smith v. Jones”." error={errors.styleOfCause}>
          <input
            id="cause"
            className="field"
            aria-invalid={Boolean(errors.styleOfCause)}
            value={fields.styleOfCause}
            onChange={(e) => set('styleOfCause', e.target.value)}
            placeholder="Smith v. Jones"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Court file no."
            htmlFor="file"
            error={errors.courtFileNo}
            hint={formatWarning ? undefined : `Format for this court: ${court.fileNumberExample}`}
          >
            <input
              id="file"
              className="field font-mono"
              aria-invalid={Boolean(errors.courtFileNo)}
              value={fields.courtFileNo}
              onChange={(e) => set('courtFileNo', e.target.value.toUpperCase())}
              placeholder={court.fileNumberExample}
            />
          </Field>
          <Field label="Your matter # (optional)" htmlFor="clientref" hint="Shown on invoices and the affidavit cover sheet.">
            <input
              id="clientref"
              className="field font-mono"
              value={fields.clientReference}
              onChange={(e) => set('clientReference', e.target.value)}
              placeholder="LIT-26-0231"
            />
          </Field>
        </div>
      </fieldset>
      {formatWarning ? (
        <Callout tone="warn">
          “{file}” doesn’t match the usual {court.label} format ({court.fileNumberExample}). Check it against the issued document. A wrong
          file number on the affidavit can get it rejected at filing.
        </Callout>
      ) : null}
    </Section>
  );
}
