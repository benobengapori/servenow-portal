/**
 * Reads back whether a server has accepted a job on the test relay.
 * Returns null when the relay is off or the job isn't on it yet. Never throws.
 */
export interface RelayAcceptance {
  readonly by: string;
  readonly at: number;
}

const RELAY = process.env.NEXT_PUBLIC_RELAY_URL;

export async function fetchRelayAcceptance(jobId: string, signal?: AbortSignal): Promise<RelayAcceptance | null> {
  if (!RELAY) return null;
  try {
    const res = await fetch(new URL('api/jobs', RELAY.endsWith('/') ? RELAY : `${RELAY}/`), { cache: 'no-store', signal });
    if (!res.ok) return null;
    const { jobs } = (await res.json()) as { jobs: { id: string; status: string; acceptedBy: string | null; acceptedAt: number | null }[] };
    const job = jobs.find((j) => j.id === jobId);
    if (!job || job.status !== 'accepted') return null;
    return { by: job.acceptedBy ?? 'a server', at: job.acceptedAt ?? Date.now() };
  } catch {
    return null;
  }
}
