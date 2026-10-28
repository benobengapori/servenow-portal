/**
 * ServeNow API client — client-portal endpoints (Blueprint §6.3).
 *
 * - Native fetch, no dependencies. Works in Server Components, Route Handlers and the browser.
 * - Every POST carries an Idempotency-Key. Pass your own to make retries across
 *   re-renders or page reloads safe; otherwise one is generated per call and
 *   reused for that call's automatic retries.
 * - Errors surface as ApiError (RFC 7807) or NetworkError.
 */

import type {
  AddRecipientInput,
  CreateJobInput,
  CreateMatterInput,
  Job,
  JobId,
  JobSummary,
  ListJobsParams,
  Matter,
  Page,
  Quote,
  Recipient,
  RegisterDocumentInput,
  JobDocument,
  SubmitJobInput,
  SubmitJobResponse,
  ConfirmSubmitInput,
  UpdateJobInput,
  AddressValidation,
  PaymentOption,
  UploadStage,
  UploadUrlRequest,
  UploadUrlResponse,
  DocumentType,
} from '@/types/jobs';
import { ApiError, NetworkError, toApiError } from './errors';
import { newIdempotencyKey, sha256Hex, type IdempotencyKey } from './idempotency';

/* ───────────────────────── Configuration ───────────────────────── */

export interface ApiClientConfig {
  /** e.g. "https://api.servenow.ca/v1" — no trailing slash needed. */
  baseUrl: string;
  /** Returns the current JWT, or null when signed out. Called on every request so refreshes are picked up. */
  getAccessToken: () => Promise<string | null> | string | null;
  /** Retries for network errors, 429 and 5xx. Default 2. Applies to GET and POST only. */
  maxRetries?: number;
  /** Per-attempt timeout in ms. Default 15 000. */
  timeoutMs?: number;
  /** Override for tests. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export interface MutationOptions extends RequestOptions {
  /** Reuse the same key when the user retries the same action. */
  idempotencyKey?: IdempotencyKey;
}

export interface UploadDocumentOptions extends MutationOptions {
  /** Precomputed hex SHA-256, if the caller already hashed the file. */
  sha256?: string;
  /** Page count read in the browser; the server re-counts. */
  pageCount?: number;
  onStage?: (stage: UploadStage) => void;
  /** 0–1 upload progress for the PUT to storage. */
  onProgress?: (fraction: number) => void;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Query = Record<string, string | number | boolean | readonly string[] | undefined>;

interface InternalRequest {
  method: HttpMethod;
  path: string;
  query?: Query;
  body?: unknown;
  idempotencyKey?: IdempotencyKey;
  signal?: AbortSignal;
}

/* ───────────────────────── Client ───────────────────────── */

export function createApiClient(config: ApiClientConfig) {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');
  const maxRetries = config.maxRetries ?? 2;
  const timeoutMs = config.timeoutMs ?? 15_000;
  const doFetch = config.fetch ?? globalThis.fetch.bind(globalThis);

  async function request<T>(req: InternalRequest): Promise<T> {
    const url = buildUrl(baseUrl, req.path, req.query);

    // Blueprint §6: every POST carries an Idempotency-Key. One key per logical
    // call, shared by all of its retries.
    const idempotencyKey =
      req.method === 'POST' ? (req.idempotencyKey ?? newIdempotencyKey()) : undefined;

    const retryable = req.method === 'GET' || req.method === 'POST';
    const attempts = retryable ? maxRetries + 1 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await backoff(attempt, req.signal);

      const headers = new Headers({ Accept: 'application/json' });
      const token = await config.getAccessToken();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);
      if (req.body !== undefined) headers.set('Content-Type', 'application/json');

      const { signal, cleanup } = withTimeout(req.signal, timeoutMs);
      let res: Response;
      try {
        res = await doFetch(url, {
          method: req.method,
          headers,
          body: req.body === undefined ? undefined : JSON.stringify(req.body),
          signal,
          cache: 'no-store', // job status is live data; never serve it from the Next.js data cache
        });
      } catch (err) {
        cleanup();
        if (req.signal?.aborted) throw err; // caller cancelled; don't retry
        lastError = new NetworkError(`${req.method} ${req.path} failed`, { cause: err });
        continue;
      }
      cleanup();

      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }

      const error = await toApiError(res);
      if (!error.isRetryable) throw error;
      lastError = error;
    }

    throw lastError instanceof Error ? lastError : new NetworkError('Request failed');
  }

  const get = <T>(path: string, query?: Query, opts?: RequestOptions) =>
    request<T>({ method: 'GET', path, query, signal: opts?.signal });

  const post = <T>(path: string, body: unknown, opts?: MutationOptions) =>
    request<T>({
      method: 'POST',
      path,
      body,
      idempotencyKey: opts?.idempotencyKey,
      signal: opts?.signal,
    });

  const id = encodeURIComponent;

  const uploadDocumentUrl = (jobId: JobId, input: UploadUrlRequest, opts?: MutationOptions) =>
    post<UploadUrlResponse>(`/jobs/${id(jobId)}/documents:uploadUrl`, input, opts);

  const registerDocument = (jobId: JobId, input: RegisterDocumentInput, opts?: MutationOptions) =>
    post<JobDocument>(`/jobs/${id(jobId)}/documents`, input, opts);

  return {
    /* ── Matters ── */

    /** POST /matters — create a matter (court file no., style of cause). */
    createMatter(input: CreateMatterInput, opts?: MutationOptions): Promise<Matter> {
      return post<Matter>('/matters', input, opts);
    },

    /** GET /matters?q= */
    searchMatters(q: string, opts?: RequestOptions & { cursor?: string }): Promise<Page<Matter>> {
      return get<Page<Matter>>('/matters', { q, cursor: opts?.cursor }, opts);
    },

    /* ── Jobs ── */

    /** POST /jobs — create a draft job under a matter. */
    createJob(input: CreateJobInput, opts?: MutationOptions): Promise<Job> {
      return post<Job>('/jobs', input, opts);
    },

    /** GET /jobs?status=&matter=&cursor= */
    listJobs(params: ListJobsParams = {}, opts?: RequestOptions): Promise<Page<JobSummary>> {
      const status = Array.isArray(params.status) ? params.status.join(',') : params.status;
      return get<Page<JobSummary>>(
        '/jobs',
        { status, matter: params.matterId, cursor: params.cursor, limit: params.limit },
        opts,
      );
    },

    /** GET /jobs/{id} */
    getJob(jobId: JobId, opts?: RequestOptions): Promise<Job> {
      return get<Job>(`/jobs/${id(jobId)}`, undefined, opts);
    },

    /**
     * PATCH /jobs/{id} — edit a draft (priority, method, due date…).
     * Throws ApiError with isVersionConflict on a stale `version`; refetch and reapply.
     */
    updateJob(jobId: JobId, input: UpdateJobInput, opts?: RequestOptions): Promise<Job> {
      return request<Job>({ method: 'PATCH', path: `/jobs/${id(jobId)}`, body: input, signal: opts?.signal });
    },

    /* ── Documents ── */

    /**
     * POST /jobs/{id}/documents:uploadUrl — get a signed URL for one PDF.
     * The file's SHA-256 is sent up front so storage and the API can both verify it.
     */
    uploadDocumentUrl,

    /** POST /jobs/{id}/documents — register an uploaded file after the API verifies its hash. */
    registerDocument,

    /**
     * Full upload: hash → signed URL → PUT to storage → register.
     * Pass one idempotency key per file; per-step keys are derived from it.
     * Pass `sha256` if you already hashed the file to skip hashing it twice.
     */
    async uploadDocument(
      jobId: JobId,
      file: File,
      /** A function is read at registration time, so the user can re-classify the file while it uploads. */
      docType: DocumentType | (() => DocumentType),
      opts: UploadDocumentOptions = {},
    ): Promise<JobDocument> {
      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
        throw new ApiError({ type: 'about:blank', title: 'Only PDF files can be uploaded', status: 400 });
      }
      const base = opts.idempotencyKey ?? newIdempotencyKey();
      const sha256 = opts.sha256 ?? (await sha256Hex(file));

      opts.onStage?.('requesting');
      const target = await uploadDocumentUrl(
        jobId,
        { fileName: file.name, mimeType: 'application/pdf', sizeBytes: file.size, sha256 },
        { signal: opts.signal, idempotencyKey: `${base}:url` as IdempotencyKey },
      );

      opts.onStage?.('uploading');
      await putToSignedUrl(doFetch, target, file, opts.signal, opts.onProgress);

      opts.onStage?.('registering');
      return registerDocument(
        jobId,
        { fileId: target.fileId, docType: typeof docType === 'function' ? docType() : docType, pageCount: opts.pageCount },
        { signal: opts.signal, idempotencyKey: `${base}:register` as IdempotencyKey },
      );
    },

    /** DELETE /jobs/{id}/documents/{documentId} — remove a document from a draft. */
    removeDocument(jobId: JobId, documentId: string, opts?: RequestOptions): Promise<void> {
      return request<void>({ method: 'DELETE', path: `/jobs/${id(jobId)}/documents/${id(documentId)}`, signal: opts?.signal });
    },

    /* ── Recipients, quote, submit ── */

    /** POST /addresses:validate — geocode pre-check for the intake form. */
    validateAddress(address: string, opts?: MutationOptions): Promise<AddressValidation> {
      return post<AddressValidation>('/addresses:validate', { address, region: 'CA' }, opts);
    },

    /** POST /jobs/{id}/recipients — addresses are geocoded and validated server-side. */
    addRecipient(jobId: JobId, input: AddRecipientInput, opts?: MutationOptions): Promise<Recipient> {
      return post<Recipient>(`/jobs/${id(jobId)}/recipients`, input, opts);
    },

    /** POST /jobs/{id}/quote — price the job. Quotes expire; check `expiresAt`. */
    createQuote(jobId: JobId, opts?: MutationOptions): Promise<Quote> {
      return post<Quote>(`/jobs/${id(jobId)}/quote`, {}, opts);
    },

    /**
     * POST /jobs/{id}/submit — authorize payment, move to `open`, trigger dispatch.
     *
     * This call moves money. Create the key when the user clicks submit and keep
     * it until you get a definitive answer. On `requires_action`, run the
     * 3-D Secure challenge and then call `confirmSubmit`; a repeat submitJob with
     * the same key would only replay the cached `requires_action` response.
     */
    submitJob(jobId: JobId, input: SubmitJobInput, opts?: MutationOptions): Promise<SubmitJobResponse> {
      return post<SubmitJobResponse>(`/jobs/${id(jobId)}/submit`, input, opts);
    },

    /** POST /jobs/{id}/submit:confirm — finish submission after 3-D Secure. Uses its own idempotency key. */
    confirmSubmit(jobId: JobId, input: ConfirmSubmitInput, opts?: MutationOptions): Promise<SubmitJobResponse> {
      return post<SubmitJobResponse>(`/jobs/${id(jobId)}/submit:confirm`, input, opts);
    },

    /* ── Billing ── */

    /** GET /me/payment-options — invoice terms and saved cards for the user's firm. */
    listPaymentOptions(opts?: RequestOptions): Promise<readonly PaymentOption[]> {
      return get<readonly PaymentOption[]>('/me/payment-options', undefined, opts);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/* ───────────────────────── Helpers ───────────────────────── */

function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const url = new URL(baseUrl + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, Array.isArray(value) ? value.join(',') : String(value));
    }
  }
  return url.toString();
}

/** Exponential backoff with full jitter: ~250 ms, ~500 ms, ~1 s … capped at 4 s. */
function backoff(attempt: number, signal?: AbortSignal): Promise<void> {
  const ms = Math.random() * Math.min(4000, 250 * 2 ** (attempt - 1));
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** Combine a caller's signal with a per-attempt timeout. */
function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), ms);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

/**
 * PUT bytes to object storage. No Authorization header: the URL itself is the credential.
 * fetch() can't report upload progress, so XMLHttpRequest is used when a progress callback is given.
 */
async function putToSignedUrl(
  doFetch: typeof fetch,
  target: UploadUrlResponse,
  file: File,
  signal?: AbortSignal,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/pdf', ...target.requiredHeaders };
  const failed = (status: number) =>
    new ApiError({
      type: 'about:blank',
      title: 'Upload to storage failed',
      status,
      detail: 'The signed URL may have expired. Request a new one and try again.',
    });

  if (onProgress && typeof XMLHttpRequest !== 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', target.uploadUrl);
      for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(failed(xhr.status)));
      xhr.onerror = () => reject(new NetworkError('Upload to storage failed'));
      xhr.onabort = () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
      signal?.addEventListener('abort', () => xhr.abort(), { once: true });
      xhr.send(file);
    });
    onProgress(1);
    return;
  }

  let res: Response;
  try {
    res = await doFetch(target.uploadUrl, { method: 'PUT', headers, body: file, signal });
  } catch (err) {
    throw new NetworkError('Upload to storage failed', { cause: err });
  }
  if (!res.ok) throw failed(res.status);
}
