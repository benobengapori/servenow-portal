/**
 * Client for the server (process server) side of the ServeNow API. Separate from the firm
 * portal's client: servers sign in with their own account and only see open jobs and their own.
 */
export const SERVER_API = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://servenow-api.onrender.com/v1').replace(/\/$/, '');

const TOKEN_KEY = 'sn-server-token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // private browsing or blocked storage: the user just signs in again
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignored: the session lasts for this page only.
  }
}

export class ServerApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ServerAddress {
  id: string;
  formatted: string;
  location: { lat: number; lng: number };
}

export interface ServerJob {
  id: string;
  publicRef: string;
  status: string;
  priority: string;
  serviceMethodRequested: string;
  dueBy: string;
  distanceM?: number | null;
  recipients: { id: string; name: string; addresses: ServerAddress[] }[];
  assignedServer?: { name: string | null } | null;
}

export interface ServerAttempt {
  id: string;
  outcome: string;
  lat: number;
  lng: number;
  gps_accuracy_m: number | null;
  distance_m: number;
  flagged: boolean;
  notes: string;
  created_at: string;
}

export type ServerJobDetail = ServerJob & { attempts: ServerAttempt[] };

async function call<T>(path: string, opts: { method?: 'GET' | 'POST'; body?: unknown; idempotent?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  // A new key per user action. The button is disabled while the request runs, so a double tap can't send two.
  if (opts.idempotent) headers['idempotency-key'] = crypto.randomUUID();

  let res: Response;
  try {
    res = await fetch(`${SERVER_API}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ServerApiError(0, 'No connection. Check your signal and try again.');
  }
  const data = (await res.json().catch(() => ({}))) as { title?: string };
  if (!res.ok) throw new ServerApiError(res.status, data.title ?? 'Something went wrong. Try again.');
  return data as T;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { token } = await call<{ token: string }>('/auth/login', { method: 'POST', body: { email, password } });
  setToken(token);
}

export function signOut(): void {
  setToken(null);
}

export function sendLocation(lat: number, lng: number, accuracy: number): Promise<{ ok: true }> {
  return call('/server/location', { method: 'POST', body: { lat, lng, accuracy } });
}

export async function openJobs(): Promise<ServerJob[]> {
  return (await call<{ items: ServerJob[] }>('/server/jobs')).items;
}

export async function myJobs(): Promise<ServerJob[]> {
  return (await call<{ items: ServerJob[] }>('/server/my-jobs')).items;
}

export function getJob(id: string): Promise<ServerJobDetail> {
  return call(`/server/jobs/${encodeURIComponent(id)}`);
}

export function acceptJob(id: string): Promise<ServerJob> {
  return call(`/server/jobs/${encodeURIComponent(id)}/accept`, { method: 'POST', idempotent: true });
}

export const ATTEMPT_OUTCOMES: { value: string; label: string; served: boolean }[] = [
  { value: 'served_personal', label: 'Served personally', served: true },
  { value: 'served_substituted', label: 'Served at residence (substituted)', served: true },
  { value: 'served_corporate', label: 'Served on the company', served: true },
  { value: 'no_answer', label: 'No answer', served: false },
  { value: 'refused', label: 'Refused to accept', served: false },
  { value: 'moved', label: 'Moved', served: false },
  { value: 'bad_address', label: 'Bad address', served: false },
  { value: 'evading', label: 'Evading', served: false },
  { value: 'vacant', label: 'Vacant', served: false },
  { value: 'deceased', label: 'Deceased', served: false },
  { value: 'other', label: 'Other', served: false },
];

export interface AttemptResult {
  attemptId: string;
  distanceM: number;
  flagged: boolean;
  job: ServerJobDetail;
}

export function logAttempt(
  id: string,
  input: { outcome: string; lat: number; lng: number; accuracy: number; notes: string },
): Promise<AttemptResult> {
  return call(`/server/jobs/${encodeURIComponent(id)}/attempts`, { method: 'POST', body: input, idempotent: true });
}

/** Where the phone is now. Rejects if location is off or refused. */
export function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new ServerApiError(0, 'This phone cannot share its location.'));
    navigator.geolocation.getCurrentPosition(resolve, (err) =>
      reject(new ServerApiError(0, err.code === 1 ? 'Allow location for this site to log an attempt.' : 'Could not get your location. Move somewhere with a clear view and try again.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}
