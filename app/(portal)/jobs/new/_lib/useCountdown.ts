'use client';

import { useEffect, useState } from 'react';

/** "m:ss" until `until`, updated every second. Null when there is no deadline. */
export function useCountdown(until: string | null | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const secs = Math.max(0, Math.round((new Date(until).getTime() - now) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}
