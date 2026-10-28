'use client';

import { useRef, useState } from 'react';
import type { DocumentType } from '@/types/jobs';
import { DOC_TYPE_LABELS } from '../_lib/constants';
import { formatBytes } from '../_lib/format';
import { isUploadSettled, type DocUpload, type UploadStatus } from '../_lib/state';
import { Callout, CopyHash, Icon, ProgressBar, Section, Spinner } from './ui';

interface Props {
  docs: readonly DocUpload[];
  onAddFiles: (files: File[]) => void;
  onRemove: (key: string) => void;
  onTypeChange: (key: string, docType: DocumentType) => void;
  onAddSamples: () => void;
  error: string | undefined;
}

export function StepDocuments({ docs, onAddFiles, onRemove, onTypeChange, onAddSamples, error }: Props) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const ready = docs.filter((d) => d.status.stage === 'registered');
  const pages = ready.reduce((a, d) => a + (d.pages ?? 0), 0);
  const busy = docs.some((d) => !isUploadSettled(d));

  return (
    <div className="flex flex-col gap-4">
      <div
        className="dropzone card border-2 border-dashed p-6 text-center transition-colors sm:p-8"
        data-over={over}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onAddFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-accent-soft text-accent">
          <Icon name="upload" className="h-5 w-5" />
        </div>
        <div className="font-semibold">Drop the issued documents here</div>
        <div className="mt-1 text-[13px] text-muted">PDF only, up to 50 MB each. Upload the version stamped by the court.</div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary" onClick={() => input.current?.click()}>
            Choose PDFs
          </button>
          {process.env.NEXT_PUBLIC_API_MOCK === '1' ? (
            <button type="button" className="btn btn-ghost" onClick={onAddSamples}>
              Add sample documents
            </button>
          ) : null}
          <input
            ref={input}
            id="doc-input"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => {
              onAddFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11.5px] text-faint">
          <Icon name="lock" className="h-3.5 w-3.5" />
          Each file is hashed (SHA-256) in your browser before upload. The server rejects any file whose hash doesn’t match.
        </div>
      </div>

      {docs.length > 0 ? (
        <Section
          title="Documents to be served"
          aside={
            <span className="tabular-nums">
              {ready.length} of {docs.length} ready · {pages} pages
            </span>
          }
        >
          <ul className="-my-2 flex flex-col divide-y divide-line">
            {docs.map((d) => (
              <DocRow key={d.key} doc={d} onRemove={onRemove} onTypeChange={onTypeChange} />
            ))}
          </ul>
        </Section>
      ) : null}

      {error && !busy ? <Callout tone="bad">{error}</Callout> : null}
    </div>
  );
}

function DocRow({ doc, onRemove, onTypeChange }: { doc: DocUpload; onRemove: (k: string) => void; onTypeChange: (k: string, t: DocumentType) => void }) {
  const s = doc.status;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="grid h-9 w-8 shrink-0 place-items-center rounded bg-bad-bg font-mono text-[9px] font-bold text-bad">PDF</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="max-w-full truncate font-medium">{doc.name}</span>
            <span className="text-[12px] tabular-nums text-faint">
              {formatBytes(doc.size)}
              {doc.pages ? ` · ${doc.pages} pp` : ''}
            </span>
          </div>
          {s.stage === 'rejected' ? (
            <div className="mt-1 text-[12.5px] text-bad">{s.error}</div>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
              <StageLabel status={s} />
              {doc.sha256 ? (
                <span className="flex items-center gap-1 text-faint">
                  SHA-256 <CopyHash value={doc.sha256} />
                </span>
              ) : null}
            </div>
          )}
        </div>
        {s.stage !== 'rejected' ? (
          <select
            aria-label={`Document type for ${doc.name}`}
            id={`type-${doc.key}`}
            className="field order-last ml-11 w-[calc(100%-2.75rem)] py-1 text-[12.5px] sm:order-none sm:ml-0 sm:w-auto sm:max-w-[44%]"
            value={doc.docType}
            disabled={s.stage === 'registering' || s.stage === 'registered'}
            title={s.stage === 'registered' ? 'To change the type, remove the file and add it again.' : undefined}
            onChange={(e) => onTypeChange(doc.key, e.target.value as DocumentType)}
          >
            {(Object.keys(DOC_TYPE_LABELS) as DocumentType[]).map((k) => (
              <option key={k} value={k}>
                {DOC_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
        ) : null}
        <button type="button" onClick={() => onRemove(doc.key)} className="rounded p-1.5 text-faint hover:text-bad" aria-label={`Remove ${doc.name}`}>
          <Icon name="trash" />
        </button>
      </div>
      {'progress' in s ? <ProgressBar value={s.progress} className="ml-11" /> : null}
    </li>
  );
}

const STAGE_TEXT: Record<Exclude<UploadStatus['stage'], 'rejected'>, string> = {
  reading: 'Reading file',
  hashing: 'Computing SHA-256 locally',
  requesting: 'Requesting signed upload URL',
  uploading: 'Uploading to Canadian storage',
  registering: 'Verifying hash on server',
  registered: 'Hash verified · stored in Canada',
};

function StageLabel({ status }: { status: Exclude<UploadStatus, { stage: 'rejected' }> }) {
  if (status.stage === 'registered') {
    return (
      <span className="flex items-center gap-1.5 text-ok">
        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.2} />
        {STAGE_TEXT.registered}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <Spinner />
      {STAGE_TEXT[status.stage]}
      <span className="tabular-nums text-faint">{Math.round(status.progress * 100)}%</span>
    </span>
  );
}
