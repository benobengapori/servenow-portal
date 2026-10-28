/**
 * RFC 7807 problem details (Blueprint §6: errors are application/problem+json).
 */

export interface ProblemDetails {
  type: string; // URI identifying the problem type
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  /** Field-level validation errors, keyed by JSON path, e.g. "recipients[0].addresses[0].address". */
  errors?: Record<string, string[]>;
  [extension: string]: unknown;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.problem = problem;
  }

  /** 409 on PATCH means the job changed under you; refetch and retry. */
  get isVersionConflict(): boolean {
    return this.status === 409;
  }

  /** 422 carries field errors to show next to form inputs. */
  get fieldErrors(): Record<string, string[]> {
    return this.problem.errors ?? {};
  }

  /** Safe to retry with the same idempotency key. */
  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

/** Thrown when the request never got an HTTP response (offline, DNS, CORS, timeout). */
export class NetworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'NetworkError';
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      const body = (await res.json()) as Partial<ProblemDetails>;
      return new ApiError({
        type: body.type ?? 'about:blank',
        title: body.title ?? res.statusText,
        status: body.status ?? res.status,
        ...body,
      });
    } catch {
      // fall through to generic error
    }
  }
  return new ApiError({ type: 'about:blank', title: res.statusText || 'Request failed', status: res.status });
}
