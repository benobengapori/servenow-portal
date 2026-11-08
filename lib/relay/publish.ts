/**
 * Test relay: sends each placed order to the field-test job inbox so a server can accept it.
 * Only active when NEXT_PUBLIC_RELAY_URL is set at build time. Failures are silent: the order is
 * already saved in the portal, and the relay is only for the test.
 */
import type { Job } from '@/types/jobs';

const RELAY = process.env.NEXT_PUBLIC_RELAY_URL;

export function publishToRelay(job: Job): void {
  if (!RELAY) return;
  const recipient = job.recipients[0];
  const body = {
    id: job.id,
    recipientName: recipient?.name ?? '',
    address: recipient?.addresses[0]?.formatted ?? '',
    priority: job.priority,
    method: job.serviceMethodRequested,
    dueBy: job.dueBy,
  };
  try {
    void fetch(new URL('api/jobs', RELAY.endsWith('/') ? RELAY : `${RELAY}/`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Never block the order on the test relay.
  }
}
