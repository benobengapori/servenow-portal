'use client';

import { useEffect, useState } from 'react';
import { fetchRelayAcceptance, type RelayAcceptance } from '@/lib/relay/acceptance';
import { Callout } from '../../new/_components/ui';

const POLL_MS = 5000;

/** Shows "Accepted by …" when a server accepts this job on the test relay. Renders nothing otherwise. */
export function RelayAcceptance({ jobId }: { jobId: string }) {
  const [accepted, setAccepted] = useState<RelayAcceptance | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const check = async () => {
      const result = await fetchRelayAcceptance(jobId, controller.signal);
      if (!cancelled && result) setAccepted(result);
    };
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [jobId]);

  if (!accepted) return null;
  return (
    <Callout tone="ok" icon="check">
      Accepted by <strong>{accepted.by}</strong> at {new Date(accepted.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
    </Callout>
  );
}
