'use client';

import type { RoleInMatter } from '@/types/jobs';
import { METHODS_BY_KIND, type IntakeRecipientKind } from '../_lib/constants';
import type { AddressDraft, FieldErrors, PersonDescriptionDraft, RecipientDraft } from '../_lib/state';
import { AddressCard } from './AddressCard';
import { Callout, Field, Icon, Section } from './ui';

const MAX_ADDRESSES = 3;
const digitsOnly = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

interface Props {
  recipient: RecipientDraft;
  onChange: (patch: Partial<RecipientDraft>) => void;
  onAddressChange: (key: string, patch: Partial<AddressDraft>) => void;
  onAddAddress: () => void;
  onRemoveAddress: (key: string) => void;
  onValidateAddress: (key: string) => void;
  errors: FieldErrors;
}

export function StepRecipient({ recipient: r, onChange, onAddressChange, onAddAddress, onRemoveAddress, onValidateAddress, errors }: Props) {
  const isIndividual = r.kind === 'individual';
  const setKind = (kind: IntakeRecipientKind) => onChange({ kind, method: kind === 'individual' ? 'personal' : 'corporate' });
  const setDesc = <K extends keyof PersonDescriptionDraft>(k: K, v: PersonDescriptionDraft[K]) =>
    onChange({ description: { ...r.description, [k]: v } });

  return (
    <div className="flex flex-col gap-4">
      <Section
        title="Person to be served"
        aside={
          <span className="flex items-center gap-1">
            <Icon name="lock" className="h-3.5 w-3.5" />
            Encrypted · revealed only to the assigned server
          </span>
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="seg" role="group" aria-label="Recipient type">
            <button type="button" aria-pressed={isIndividual} onClick={() => setKind('individual')}>
              Individual
            </button>
            <button type="button" aria-pressed={!isIndividual} onClick={() => setKind('corporation')}>
              Corporation
            </button>
          </div>
          <Field label="Role in matter" htmlFor="role" className="w-48">
            <select id="role" className="field" value={r.role} onChange={(e) => onChange({ role: e.target.value as RoleInMatter })}>
              <option value="defendant">Defendant</option>
              <option value="respondent">Respondent</option>
              <option value="witness">Witness</option>
              <option value="third_party">Third party</option>
            </select>
          </Field>
        </div>

        <Field
          label={isIndividual ? 'Full legal name' : 'Corporate name (exact, as registered)'}
          htmlFor="rname"
          error={errors.name}
          hint={
            isIndividual
              ? 'Include middle names and known aliases (a.k.a.) if you have them.'
              : 'Check the Ontario Business Registry. Include “Inc.”, “Ltd.” or “Corp.”.'
          }
        >
          <input
            id="rname"
            className="field"
            aria-invalid={Boolean(errors.name)}
            value={r.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder={isIndividual ? 'Jordan A. Mitchell' : 'Brandt Holdings Corp.'}
          />
        </Field>

        {isIndividual ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Field label="Sex" htmlFor="sex">
              <select id="sex" className="field" value={r.description.sex} onChange={(e) => setDesc('sex', e.target.value as PersonDescriptionDraft['sex'])}>
                <option value="">—</option>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="X">X</option>
              </select>
            </Field>
            <Field label="Approx. age" htmlFor="age">
              <input id="age" className="field tabular-nums" inputMode="numeric" value={r.description.approxAge} onChange={(e) => setDesc('approxAge', digitsOnly(e.target.value, 3))} placeholder="45" />
            </Field>
            <Field label="Height (cm)" htmlFor="height">
              <input id="height" className="field tabular-nums" inputMode="numeric" value={r.description.heightCm} onChange={(e) => setDesc('heightCm', digitsOnly(e.target.value, 3))} placeholder="180" />
            </Field>
            <Field label="Hair" htmlFor="hair">
              <input id="hair" className="field" value={r.description.hair} onChange={(e) => setDesc('hair', e.target.value)} placeholder="Grey, short" />
            </Field>
            <Field label="Date of birth" htmlFor="dob">
              <input id="dob" type="date" className="field" value={r.description.dateOfBirth} onChange={(e) => setDesc('dateOfBirth', e.target.value)} />
            </Field>
            <Field
              label="Identifying details"
              htmlFor="notes"
              className="col-span-2 sm:col-span-5"
              hint="Vehicle and plate, work hours, glasses, tattoos. Helps the server confirm identity at the door."
            >
              <textarea
                id="notes"
                rows={2}
                className="field"
                value={r.description.notes}
                onChange={(e) => setDesc('notes', e.target.value)}
                placeholder="Drives a grey Honda CR-V, plate CKLM 402. Usually home after 6 p.m."
              />
            </Field>
          </div>
        ) : (
          <Callout tone="info">
            The server will ask for an officer, director or agent, or the person in charge at the place of business, and records their name and title on
            the affidavit.
          </Callout>
        )}
      </Section>

      <Section title="Service address" aside="Validated before submission; re-checked by the server">
        {r.addresses.map((a, i) => (
          <AddressCard
            key={a.key}
            address={a}
            index={i}
            canRemove={r.addresses.length > 1}
            onChange={(p) => onAddressChange(a.key, p)}
            onValidate={() => onValidateAddress(a.key)}
            onRemove={() => onRemoveAddress(a.key)}
          />
        ))}
        {errors.address ? <div className="hint-error">{errors.address}</div> : null}
        {r.addresses.length < MAX_ADDRESSES ? (
          <button type="button" onClick={onAddAddress} className="inline-flex items-center gap-1.5 self-start text-[13px] font-medium text-accent">
            <Icon name="plus" />
            Add an alternate address
          </button>
        ) : null}
      </Section>

      <Section title="Method of service" aside="Ontario Rules of Civil Procedure">
        <div className="grid gap-2" role="radiogroup" aria-label="Method of service">
          {METHODS_BY_KIND[r.kind].map((m) => (
            <label key={m.id} htmlFor={`m-${m.id}`} className="choice" data-selected={r.method === m.id}>
              <input
                type="radio"
                id={`m-${m.id}`}
                name="method"
                checked={r.method === m.id}
                onChange={() => onChange({ method: m.id })}
                className="mt-1 accent-accent"
              />
              <div className="min-w-0">
                <div className="font-medium">
                  {m.label} <span className="ml-1 font-mono text-[11.5px] text-faint">{m.rule}</span>
                </div>
                <div className="text-[12.5px] text-muted">{m.note}</div>
              </div>
            </label>
          ))}
        </div>
        <Field label="Instructions for the server (optional)" htmlFor="instr" hint="Access codes, safety concerns, best times. Shown only after a server accepts.">
          <textarea
            id="instr"
            rows={2}
            className="field"
            value={r.instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
            placeholder="Buzzer 402. Dog on property. Avoid Sundays."
          />
        </Field>
      </Section>
    </div>
  );
}
